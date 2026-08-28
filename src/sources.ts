import { BlobReader, BlobWriter, ZipReader, configure, type Entry } from '@zip.js/zip.js';
import { cleanPath, extension } from './archive';
import type { SourceFile } from './types';

configure({ useWebWorkers: false });

export interface SourceCollection {
  files: SourceFile[];
  labels: string[];
  close: () => Promise<void>;
}

function mimeFor(path: string): string {
  const types: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
    heic: 'image/heic', heif: 'image/heif', tif: 'image/tiff', tiff: 'image/tiff',
    mp4: 'video/mp4', mov: 'video/quicktime', m4v: 'video/x-m4v', json: 'application/json',
  };
  return types[extension(path)] ?? 'application/octet-stream';
}

export async function fromZipFiles(input: File[]): Promise<SourceCollection> {
  const readers: ZipReader<Blob>[] = [];
  const sources: SourceFile[] = [];
  for (const zipFile of input) {
    if (!zipFile.name.toLowerCase().endsWith('.zip')) throw new Error(`${zipFile.name} is not a ZIP file.`);
    const reader = new ZipReader(new BlobReader(zipFile));
    readers.push(reader);
    let entries: Entry[];
    try {
      entries = await reader.getEntries();
    } catch {
      throw new Error(`${zipFile.name} could not be opened. It may be incomplete or password protected.`);
    }
    if (entries.length > 500_000) throw new Error(`${zipFile.name} contains more than 500,000 entries. Split the export into smaller batches.`);
    for (const entry of entries) {
      if (entry.directory) continue;
      const path = cleanPath(entry.filename);
      sources.push({
        path,
        name: path.split('/').pop() ?? path,
        size: entry.uncompressedSize,
        lastModified: entry.lastModDate?.valueOf() ?? 0,
        getBlob: async () => entry.getData(new BlobWriter(mimeFor(path))),
      });
    }
  }
  return {
    files: sources,
    labels: input.map((file) => file.name),
    close: async () => { await Promise.all(readers.map((reader) => reader.close())); },
  };
}

export function fromFolderFiles(input: File[]): SourceCollection {
  const sources = input.filter((file) => file.size > 0 || !file.name.startsWith('.')).map((file) => {
    const path = cleanPath(file.webkitRelativePath || file.name);
    return {
      path,
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      getBlob: async () => file,
    } satisfies SourceFile;
  });
  const root = sources[0]?.path.split('/')[0] ?? 'Selected folder';
  return { files: sources, labels: [root], close: async () => undefined };
}
