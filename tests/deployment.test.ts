import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('static deployment policy', () => {
  it('ships CSP, immutable asset caching, manifest MIME, and a real 404 override', async () => {
    const config = JSON.parse(await readFile('public/staticwebapp.config.json', 'utf8')) as Record<string, unknown>;
    const headers = config.globalHeaders as Record<string, string>;
    expect(headers['Content-Security-Policy']).toContain("default-src 'self'");
    expect(headers['Permissions-Policy']).toContain('camera=()');
    const routes = config.routes as Array<{ route: string; headers: Record<string, string> }>;
    expect(routes.find((route) => route.route === '/assets/*')?.headers['Cache-Control']).toContain('immutable');
    expect(routes.find((route) => route.route === '/manifest.webmanifest')?.headers['Content-Type']).toBe('application/manifest+json');
    expect((config.mimeTypes as Record<string, string>)['.webmanifest']).toBe('application/manifest+json');
    expect((config.navigationFallback as { exclude: string[] }).exclude).toContain('/404');
    expect((config.responseOverrides as Record<string, { statusCode: number }>)['404'].statusCode).toBe(404);
  });
});
