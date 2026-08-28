import { BlobReader, BlobWriter, TextReader, ZipWriter, configure } from '@zip.js/zip.js';
import { bundleEntries } from './archive';
import type { AnalysisResult, BuildOptions } from './types';

configure({ useWebWorkers: false });

interface FileSystemWritableFileStream {
  write(data: Blob | string): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandle {
  createWritable(): Promise<FileSystemWritableFileStream>;
}

interface FileSystemDirectoryHandle {
  getDirectoryHandle(name: string, options: { create: boolean }): Promise<FileSystemDirectoryHandle>;
  getFileHandle(name: string, options: { create: boolean }): Promise<FileSystemFileHandle>;
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
  }
}

function safeOutputPath(path: string): string[] {
  return path.split('/').filter(Boolean).map((part) => part.replace(/[<>:"\\|?*\u0000-\u001f]/g, '_'));
}

async function writeToDirectory(root: FileSystemDirectoryHandle, path: string, data: Blob | string): Promise<void> {
  const parts = safeOutputPath(path);
  const name = parts.pop();
  if (!name) return;
  let directory = root;
  for (const part of parts) directory = await directory.getDirectoryHandle(part, { create: true });
  const handle = await directory.getFileHandle(name, { create: true });
  const stream = await handle.createWritable();
  await stream.write(data);
  await stream.close();
}

function archiveName(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `Photo Exit Archive ${stamp}`;
}

export async function buildToFolder(
  result: AnalysisResult,
  options: BuildOptions,
  onProgress: (done: number, total: number, message: string) => void,
): Promise<string> {
  if (!window.showDirectoryPicker) throw new Error('Folder output is not supported by this browser. Use ZIP download instead.');
  const selected = await window.showDirectoryPicker({ mode: 'readwrite' });
  const name = archiveName();
  const root = await selected.getDirectoryHandle(name, { create: true });
  const entries = bundleEntries(result, options);
  let done = 0;
  for (const entry of entries) {
    const data = typeof entry.data === 'string' ? entry.data : await entry.data.getBlob();
    await writeToDirectory(root, entry.path, data);
    onProgress(++done, entries.length, `Writing ${entry.path}`);
  }
  return name;
}

export async function buildZip(
  result: AnalysisResult,
  options: BuildOptions,
  onProgress: (done: number, total: number, message: string) => void,
): Promise<{ blob: Blob; name: string }> {
  const writer = new ZipWriter(new BlobWriter('application/zip'));
  const entries = bundleEntries(result, options);
  let done = 0;
  for (const entry of entries) {
    const reader = typeof entry.data === 'string'
      ? new TextReader(entry.data)
      : new BlobReader(await entry.data.getBlob());
    await writer.add(entry.path, reader, { level: 0 });
    onProgress(++done, entries.length, `Packing ${entry.path}`);
  }
  const blob = await writer.close();
  return { blob, name: `${archiveName()}.zip` };
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
