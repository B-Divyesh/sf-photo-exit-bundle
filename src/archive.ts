import type {
  AnalysisResult,
  AnalyzeOptions,
  BuildOptions,
  DateSource,
  GoogleMetadata,
  PhotoAsset,
  SourceFile,
} from './types';

const PHOTO_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'tif', 'tiff', 'bmp', 'dng', 'raw']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'avi', '3gp', 'mkv', 'webm']);
const META_SUFFIXES = ['.supplemental-metadata.json', '.supplementalmetadata.json', '.json'];

export function cleanPath(path: string): string {
  return path.replaceAll('\\', '/').replace(/^\/+/, '').replace(/\/{2,}/g, '/');
}

export function extension(path: string): string {
  const name = path.split('/').pop() ?? path;
  const index = name.lastIndexOf('.');
  return index < 0 ? '' : name.slice(index + 1).toLowerCase();
}

function withoutMetadataSuffix(path: string): string {
  const lower = path.toLowerCase();
  for (const suffix of META_SUFFIXES) {
    if (lower.endsWith(suffix)) return path.slice(0, -suffix.length);
  }
  return path;
}

function fileStem(path: string): string {
  const name = path.split('/').pop() ?? path;
  const ext = extension(name);
  return (ext ? name.slice(0, -(ext.length + 1)) : name)
    .replace(/(?:[-_. ](?:motion|live|mp))$/i, '')
    .toLowerCase();
}

function folder(path: string): string {
  const parts = cleanPath(path).split('/');
  parts.pop();
  return parts.join('/');
}

function candidateSidecarKeys(path: string): string[] {
  const value = cleanPath(path).toLowerCase();
  const name = value.split('/').pop() ?? value;
  const parent = folder(value);
  const stem = fileStem(value);
  return [value, `${parent}/${name}`, `${parent}/${stem}`];
}

function inferAlbum(path: string): string | null {
  const parts = cleanPath(path).split('/').slice(0, -1);
  const googleIndex = parts.findIndex((part) => part.toLowerCase() === 'google photos');
  const relevant = googleIndex >= 0 ? parts.slice(googleIndex + 1) : parts;
  const candidate = relevant.at(-1);
  if (!candidate || /^photos from \d{4}$/i.test(candidate) || /^photos from/i.test(candidate)) return null;
  if (/^(takeout|archive|photos)$/i.test(candidate)) return null;
  return candidate;
}

function safeDate(value: unknown): Date | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value);
  const milliseconds = /^\d{9,12}$/.test(raw) ? Number(raw) * (raw.length <= 10 ? 1000 : 1) : Date.parse(raw);
  const date = new Date(milliseconds);
  return Number.isNaN(date.valueOf()) || date.getUTCFullYear() < 1970 || date.getUTCFullYear() > 2200 ? null : date;
}

export function inferDate(metadata: GoogleMetadata | null, source: SourceFile): { date: Date | null; source: DateSource } {
  const metaDate = safeDate(metadata?.photoTakenTime?.timestamp) ?? safeDate(metadata?.creationTime?.timestamp);
  if (metaDate) return { date: metaDate, source: 'Google metadata' };

  const name = source.name;
  const match = name.match(/(?:^|\D)(19\d{2}|20\d{2})[-_]?([01]\d)[-_]?([0-3]\d)(?:\D|$)/);
  if (match) {
    const date = safeDate(`${match[1]}-${match[2]}-${match[3]}T12:00:00Z`);
    if (date) return { date, source: 'filename' };
  }
  if (source.lastModified > 315532800000) {
    const date = safeDate(source.lastModified);
    if (date) return { date, source: 'file date' };
  }
  return { date: null, source: 'unknown' };
}

function metadataSuggestsMotion(metadata: GoogleMetadata | null, name: string): boolean {
  if (/\.mp\./i.test(name) || /[-_. ]motion/i.test(name)) return true;
  if (!metadata) return false;
  const text = JSON.stringify(metadata).toLowerCase();
  return text.includes('motionphoto') || text.includes('motion_photo') || text.includes('ismotionphoto');
}

function sanitizeSegment(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '').trim();
  return cleaned || 'untitled';
}

function archiveDatePath(date: Date | null): string {
  if (!date) return 'Photos/Unknown date';
  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `Photos/${year}/${month}/${day}`;
}

async function parseMetadata(file: SourceFile): Promise<GoogleMetadata> {
  const blob = await file.getBlob();
  if (blob.size > 5_000_000) throw new Error('Metadata file is unexpectedly large.');
  const parsed: unknown = JSON.parse(await blob.text());
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Metadata is not a JSON object.');
  return parsed as GoogleMetadata;
}

async function sha256(file: SourceFile): Promise<string> {
  const bytes = await file.getBlob().then((blob) => blob.arrayBuffer());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function analyzeFiles(
  input: SourceFile[],
  sourceLabels: string[],
  options: AnalyzeOptions,
): Promise<AnalysisResult> {
  const files = input.filter((file) => !file.path.split('/').some((part) => part === '__MACOSX' || part.startsWith('._')));
  const metadataFiles = files.filter((file) => extension(file.path) === 'json');
  const mediaFiles = files.filter((file) => PHOTO_EXTENSIONS.has(extension(file.path)) || VIDEO_EXTENSIONS.has(extension(file.path)));
  if (!mediaFiles.length) throw new Error('No photos or videos were found in this selection. Choose a Takeout ZIP or folder that contains media files.');
  const unclassified = files.filter((file) => !metadataFiles.includes(file) && !mediaFiles.includes(file));
  const errors: AnalysisResult['errors'] = [];
  const metadataByKey = new Map<string, { file: SourceFile; metadata: GoogleMetadata | null; used: boolean }>();
  let done = 0;
  const total = metadataFiles.length + mediaFiles.length + (options.deepDuplicates ? mediaFiles.length : 0);

  for (const file of metadataFiles) {
    let metadata: GoogleMetadata | null = null;
    try {
      metadata = await parseMetadata(file);
    } catch (error) {
      errors.push({ path: file.path, message: error instanceof Error ? error.message : 'Could not read metadata.' });
    }
    const stripped = withoutMetadataSuffix(cleanPath(file.path)).toLowerCase();
    const parent = folder(stripped);
    const base = stripped.split('/').pop() ?? stripped;
    metadataByKey.set(stripped, { file, metadata, used: false });
    metadataByKey.set(`${parent}/${fileStem(base)}`, { file, metadata, used: false });
    options.onProgress?.(++done, total, `Reading metadata ${done} of ${metadataFiles.length}`);
  }

  const assets: PhotoAsset[] = [];
  for (const source of mediaFiles) {
    const ext = extension(source.path);
    const kind = PHOTO_EXTENSIONS.has(ext) ? 'photo' : 'video';
    let sidecarRecord: { file: SourceFile; metadata: GoogleMetadata | null; used: boolean } | undefined;
    for (const key of candidateSidecarKeys(source.path)) {
      sidecarRecord = metadataByKey.get(key);
      if (sidecarRecord) break;
    }
    if (sidecarRecord) sidecarRecord.used = true;
    const metadata = sidecarRecord?.metadata ?? null;
    const inferred = inferDate(metadata, source);
    const issues: string[] = [];
    if (!sidecarRecord) issues.push('No matching Google metadata');
    else if (!metadata) issues.push('Metadata could not be read');
    if (!inferred.date) issues.push('Date needs review');
    const asset: PhotoAsset = {
      id: `${assets.length + 1}-${source.path}`,
      source,
      kind,
      date: inferred.date,
      dateSource: inferred.source,
      album: inferAlbum(source.path),
      metadata,
      sidecar: sidecarRecord?.file ?? null,
      companion: null,
      archivePath: '',
      issues,
      duplicateOf: null,
      duplicateKind: null,
    };
    assets.push(asset);
    options.onProgress?.(++done, total, `Classifying media ${assets.length} of ${mediaFiles.length}`);
  }

  // Motion/Live Photo pairs are kept together; paired videos stop being standalone assets.
  const photos = assets.filter((asset) => asset.kind === 'photo');
  const videos = assets.filter((asset) => asset.kind === 'video');
  const pairedVideoIds = new Set<string>();
  for (const photo of photos) {
    const match = videos.find((video) =>
      !pairedVideoIds.has(video.id) && folder(video.source.path).toLowerCase() === folder(photo.source.path).toLowerCase()
      && fileStem(video.source.path) === fileStem(photo.source.path),
    );
    if (match) {
      photo.companion = match.source;
      pairedVideoIds.add(match.id);
    } else if (metadataSuggestsMotion(photo.metadata, photo.source.name)) {
      photo.issues.push('Motion companion is missing');
    }
  }
  const primaryAssets = assets.filter((asset) => !pairedVideoIds.has(asset.id));

  if (options.deepDuplicates) {
    for (const asset of primaryAssets) {
      asset.hash = await sha256(asset.source);
      options.onProgress?.(++done, total, `Checking exact duplicates ${done - metadataFiles.length - mediaFiles.length} of ${primaryAssets.length}`);
    }
  }

  const duplicateMap = new Map<string, PhotoAsset>();
  for (const asset of primaryAssets) {
    const key = options.deepDuplicates && asset.hash
      ? `hash:${asset.hash}`
      : `probable:${asset.source.size}:${asset.source.name.toLowerCase()}`;
    const original = duplicateMap.get(key);
    if (original) {
      asset.duplicateOf = original.id;
      asset.duplicateKind = options.deepDuplicates ? 'byte-identical' : 'probable';
      asset.issues.push(options.deepDuplicates ? 'Byte-identical duplicate' : 'Probable duplicate (same name and size)');
    } else {
      duplicateMap.set(key, asset);
    }
  }

  const usedPaths = new Map<string, number>();
  for (const asset of primaryAssets) {
    const baseFolder = archiveDatePath(asset.date);
    const name = sanitizeSegment(asset.source.name);
    const candidate = `${baseFolder}/${name}`;
    const count = usedPaths.get(candidate.toLowerCase()) ?? 0;
    usedPaths.set(candidate.toLowerCase(), count + 1);
    if (count === 0) asset.archivePath = candidate;
    else {
      const ext = extension(name);
      const stem = ext ? name.slice(0, -(ext.length + 1)) : name;
      asset.archivePath = `${baseFolder}/${stem} (${count + 1})${ext ? `.${ext}` : ''}`;
    }
  }

  const unmatchedSidecars = [...new Map([...metadataByKey.values()].filter((record) => !record.used).map((record) => [record.file.path, record.file])).values()];
  const albums: Record<string, number> = {};
  for (const asset of primaryAssets) if (asset.album) albums[asset.album] = (albums[asset.album] ?? 0) + 1;

  return {
    startedAt: new Date().toISOString(),
    assets: primaryAssets,
    unmatchedSidecars,
    unclassified,
    errors,
    inputCount: files.length,
    totalBytes: files.reduce((sum, file) => sum + file.size, 0),
    albums,
    sourceLabels,
  };
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

export function makeReport(result: AnalysisResult): { json: string; csv: string; readme: string; albumFiles: Map<string, string> } {
  const rows = result.assets.map((asset) => ({
    original_path: asset.source.path,
    archive_path: asset.archivePath,
    kind: asset.kind,
    bytes: asset.source.size,
    captured_at: asset.date?.toISOString() ?? '',
    date_source: asset.dateSource,
    album: asset.album ?? '',
    motion_companion: asset.companion?.name ?? '',
    metadata: asset.sidecar ? 'paired' : 'missing',
    duplicate: asset.duplicateKind ?? '',
    issues: asset.issues.join('; '),
  }));
  const headers = Object.keys(rows[0] ?? {
    original_path: '', archive_path: '', kind: '', bytes: '', captured_at: '', date_source: '', album: '',
    motion_companion: '', metadata: '', duplicate: '', issues: '',
  });
  const csv = [headers.map(csvCell).join(','), ...rows.map((row) => headers.map((header) => csvCell(row[header as keyof typeof row])).join(','))].join('\n');
  const json = JSON.stringify({
    format: 'Photo Exit Bundle report v1',
    created_at: result.startedAt,
    summary: summarize(result),
    files: rows,
    unmatched_metadata: result.unmatchedSidecars.map((file) => file.path),
    unclassified: result.unclassified.map((file) => file.path),
    errors: result.errors,
  }, null, 2);
  const albumFiles = new Map<string, string>();
  for (const album of Object.keys(result.albums).sort()) {
    const assets = result.assets.filter((asset) => asset.album === album);
    albumFiles.set(`${sanitizeSegment(album)}.csv`, ['archive_path,original_path', ...assets.map((asset) => `${csvCell(asset.archivePath)},${csvCell(asset.source.path)}`)].join('\n'));
  }
  const stats = summarize(result);
  const readme = `PHOTO EXIT BUNDLE — PORTABLE ARCHIVE\n\nCreated: ${result.startedAt}\n\nWHAT IS HERE\nPhotos/ is arranged by captured date as YYYY/MM/DD. Files whose date could not be established are in Photos/Unknown date. Album manifests are in Albums/; they point to files in Photos rather than copying them again. Reports/archive-report.csv is the human-readable ledger; archive-report.json is the machine-readable equivalent. Review/ contains source files that could not be classified when that option was selected. Original Google JSON sidecars are retained beside Reports/Metadata when selected.\n\nSUMMARY\n${stats.photos} photos, ${stats.videos} standalone videos, ${stats.motionPairs} motion pairs, ${stats.albums} albums, ${stats.review} items needing review, ${stats.duplicates} duplicates flagged.\n\nIMPORTANT\nThe converter never changes image or video bytes. Google metadata fields outside the documented date, description and location fields are retained in sidecars but may not be reflected in the folder layout. “Probable duplicate” means same filename and byte size; “byte-identical” means SHA-256 matched. Keep your original Takeout until you have opened this archive on another machine and checked the report.\n\nHOW TO VERIFY\nOpen a sample from several years, check motion pairs, and compare the report count with your Takeout. Album CSV files can be opened by any spreadsheet. No Photo Exit Bundle app is required to use this archive.\n`;
  return { json, csv, readme, albumFiles };
}

export function summarize(result: AnalysisResult) {
  return {
    photos: result.assets.filter((asset) => asset.kind === 'photo').length,
    videos: result.assets.filter((asset) => asset.kind === 'video').length,
    motionPairs: result.assets.filter((asset) => asset.companion).length,
    pairedMetadata: result.assets.filter((asset) => asset.sidecar).length,
    missingMetadata: result.assets.filter((asset) => !asset.sidecar).length,
    duplicates: result.assets.filter((asset) => asset.duplicateOf).length,
    review: result.assets.filter((asset) => asset.issues.length).length + result.unclassified.length + result.unmatchedSidecars.length + result.errors.length,
    albums: Object.keys(result.albums).length,
    unclassified: result.unclassified.length,
  };
}

export interface BundleEntry {
  path: string;
  data: string | SourceFile;
}

export function bundleEntries(result: AnalysisResult, options: BuildOptions): BundleEntry[] {
  const report = makeReport(result);
  const entries: BundleEntry[] = [
    { path: 'README.txt', data: report.readme },
    { path: 'Reports/archive-report.csv', data: report.csv },
    { path: 'Reports/archive-report.json', data: report.json },
  ];
  for (const [name, data] of report.albumFiles) entries.push({ path: `Albums/${name}`, data });
  for (const asset of result.assets) {
    if (!options.includeDuplicates && asset.duplicateOf) continue;
    entries.push({ path: asset.archivePath, data: asset.source });
    if (asset.companion) {
      const parent = asset.archivePath.slice(0, asset.archivePath.lastIndexOf('/'));
      entries.push({ path: `${parent}/${sanitizeSegment(asset.companion.name)}`, data: asset.companion });
    }
    if (options.preserveSidecars && asset.sidecar) {
      entries.push({ path: `Reports/Metadata/${sanitizeSegment(asset.id)}/${sanitizeSegment(asset.sidecar.name)}`, data: asset.sidecar });
    }
  }
  if (options.preserveSidecars) {
    for (const file of result.unmatchedSidecars) entries.push({ path: `Review/Unmatched metadata/${sanitizeSegment(file.name)}`, data: file });
  }
  if (options.includeUnclassified) {
    for (const file of result.unclassified) entries.push({ path: `Review/Unclassified/${sanitizeSegment(file.name)}`, data: file });
  }
  return entries;
}
