import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const root = join(process.cwd(), 'dist');
const config = JSON.parse(await readFile(join(root, 'staticwebapp.config.json'), 'utf8'));
const port = Number(process.env.PORT ?? 4173);

const mime = {
  '.avif': 'image/avif', '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json', '.webp': 'image/webp',
};

function matches(pattern, path) {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*');
  return new RegExp(`^${escaped}$`).test(path);
}

function safeFile(path) {
  const relative = normalize(decodeURIComponent(path)).replace(/^[/\\]+/, '');
  if (relative.startsWith('..')) return null;
  return join(root, relative || 'index.html');
}

async function isFile(path) {
  try { return (await stat(path)).isFile(); } catch { return false; }
}

function headersFor(path, file) {
  const headers = { ...config.globalHeaders };
  for (const route of config.routes ?? []) if (matches(route.route, path)) Object.assign(headers, route.headers);
  headers['Content-Type'] ??= config.mimeTypes?.[extname(file)] ?? mime[extname(file)] ?? 'application/octet-stream';
  return headers;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host}`);
  const routePath = url.pathname;
  let file = safeFile(routePath);
  let statusCode = 200;

  if (!file || !(await isFile(file))) {
    const fallback = config.navigationFallback;
    const excluded = fallback?.exclude?.some((pattern) => matches(pattern, routePath));
    if (fallback && !excluded) file = safeFile(fallback.rewrite);
    else {
      const override = config.responseOverrides?.['404'];
      file = safeFile(override?.rewrite ?? '/404.html');
      statusCode = override?.statusCode ?? 404;
    }
  }

  if (!file || !(await isFile(file))) {
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Configured response file is missing.');
    return;
  }

  const headers = headersFor(routePath, file);
  response.writeHead(statusCode, headers);
  if (request.method === 'HEAD') response.end();
  else createReadStream(file).pipe(response);
});

server.listen(port, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
