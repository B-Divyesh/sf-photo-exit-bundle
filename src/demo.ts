import type { SourceCollection } from './sources';
import type { SourceFile } from './types';

const DEMO_STORAGE_KEY = 'demo:photo-exit-bundle:active';

function sampleFile(path: string, content: string, type = 'application/octet-stream'): SourceFile {
  const blob = new Blob([content], { type });
  return {
    path,
    name: path.split('/').pop() ?? path,
    size: blob.size,
    lastModified: Date.UTC(2024, 6, 21),
    getBlob: async () => blob,
  };
}

/** Bundled, in-memory sample files. They never use the visitor's selected files. */
export function createDemoCollection(): SourceCollection {
  const prefix = 'Takeout/Google Photos/Family weekends';
  const files = [
    sampleFile(`${prefix}/Maya_20240721.MP.jpg`, 'sample photo: Maya at the lake', 'image/jpeg'),
    sampleFile(`${prefix}/Maya_20240721.MP.jpg.json`, JSON.stringify({ photoTakenTime: { timestamp: '1721563200' } }), 'application/json'),
    sampleFile(`${prefix}/Maya_20240721.MP.mp4`, 'sample motion companion', 'video/mp4'),
    sampleFile(`${prefix}/Lena_20221224.jpg`, 'sample photo: winter table', 'image/jpeg'),
    sampleFile(`${prefix}/Lena_20221224.jpg.json`, JSON.stringify({ photoTakenTime: { timestamp: '1671883200' } }), 'application/json'),
    sampleFile(`${prefix}/camera-note.txt`, 'A sample unknown file that remains visible for review.', 'text/plain'),
  ];
  return { files, labels: ['sample-family-takeout.zip'], close: async () => undefined };
}

export function activateDemoStorage(): void {
  sessionStorage.setItem(DEMO_STORAGE_KEY, '1');
}

export function clearDemoStorage(): void {
  sessionStorage.removeItem(DEMO_STORAGE_KEY);
}

export { DEMO_STORAGE_KEY };
