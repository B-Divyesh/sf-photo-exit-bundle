import { describe, expect, it } from 'vitest';
import { analyzeFiles, bundleEntries, inferDate, makeReport } from './archive';
import type { SourceFile } from './types';

function source(path: string, content = 'x', lastModified = 0): SourceFile {
  const blob = new Blob([content]);
  return { path, name: path.split('/').pop()!, size: blob.size, lastModified, getBlob: async () => blob };
}

describe('Takeout analysis', () => {
  it('pairs metadata, motion files, albums and dates', async () => {
    const files = [
      source('Takeout/Google Photos/Beach trip/IMG_1000.MP.jpg', 'photo'),
      source('Takeout/Google Photos/Beach trip/IMG_1000.MP.jpg.json', JSON.stringify({ photoTakenTime: { timestamp: '1704067200' } })),
      source('Takeout/Google Photos/Beach trip/IMG_1000.MP.mp4', 'video'),
    ];
    const result = await analyzeFiles(files, ['takeout.zip'], { deepDuplicates: false });
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0].companion?.name).toBe('IMG_1000.MP.mp4');
    expect(result.assets[0].album).toBe('Beach trip');
    expect(result.assets[0].archivePath).toContain('Photos/2024/01/01');
    expect(result.assets[0].issues).toEqual([]);
  });

  it('flags probable duplicates and preserves them by default in a bundle plan', async () => {
    const files = [source('Album A/same.jpg', 'aaa'), source('Album B/same.jpg', 'bbb')];
    const result = await analyzeFiles(files, ['folder'], { deepDuplicates: false });
    expect(result.assets[1].duplicateKind).toBe('probable');
    const entries = bundleEntries(result, { preserveSidecars: true, includeDuplicates: true, includeUnclassified: true });
    expect(entries.filter((entry) => entry.path.endsWith('.jpg'))).toHaveLength(2);
  });

  it('uses filename dates before file dates', () => {
    const picked = inferDate(null, source('IMG_20231225_090000.jpg', 'x', Date.UTC(2025, 1, 1)));
    expect(picked.source).toBe('filename');
    expect(picked.date?.toISOString()).toContain('2023-12-25');
  });

  it('produces portable CSV and JSON reports', async () => {
    const result = await analyzeFiles([source('Photos from 2020/2020-01-02.jpg')], ['folder'], { deepDuplicates: false });
    const report = makeReport(result);
    expect(report.csv).toContain('archive_path');
    expect(JSON.parse(report.json).format).toBe('Photo Exit Bundle report v1');
    expect(report.readme).toContain('HOW TO VERIFY');
  });
});
