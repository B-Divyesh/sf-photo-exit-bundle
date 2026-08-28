export type AssetKind = 'photo' | 'video';
export type DateSource = 'Google metadata' | 'file date' | 'filename' | 'unknown';

export interface SourceFile {
  path: string;
  name: string;
  size: number;
  lastModified: number;
  getBlob: () => Promise<Blob>;
}

export interface GoogleMetadata {
  title?: string;
  description?: string;
  photoTakenTime?: { timestamp?: string; formatted?: string };
  creationTime?: { timestamp?: string; formatted?: string };
  geoData?: { latitude?: number; longitude?: number; altitude?: number };
  [key: string]: unknown;
}

export interface PhotoAsset {
  id: string;
  source: SourceFile;
  kind: AssetKind;
  date: Date | null;
  dateSource: DateSource;
  album: string | null;
  metadata: GoogleMetadata | null;
  sidecar: SourceFile | null;
  companion: SourceFile | null;
  archivePath: string;
  issues: string[];
  duplicateOf: string | null;
  duplicateKind: 'probable' | 'byte-identical' | null;
  hash?: string;
}

export interface AnalysisError {
  path: string;
  message: string;
}

export interface AnalysisResult {
  startedAt: string;
  assets: PhotoAsset[];
  unmatchedSidecars: SourceFile[];
  unclassified: SourceFile[];
  errors: AnalysisError[];
  inputCount: number;
  totalBytes: number;
  albums: Record<string, number>;
  sourceLabels: string[];
}

export interface AnalyzeOptions {
  deepDuplicates: boolean;
  onProgress?: (done: number, total: number, message: string) => void;
}

export interface BuildOptions {
  preserveSidecars: boolean;
  includeDuplicates: boolean;
  includeUnclassified: boolean;
}

export interface RunSummary {
  id: string;
  date: string;
  sourceLabels: string[];
  photos: number;
  videos: number;
  review: number;
  albums: number;
}
