/* Photo Exit Bundle service worker — intentionally dependency-free. */
const VERSION = 'photo-exit-v1';
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const OFFLINE_URL = '/offline.html';
const STATIC_URLS = [
  '/', OFFLINE_URL, '/manifest.webmanifest',
  '/art/archive-crossing-768.webp', '/art/archive-crossing-1280.webp',
  '/icons/icon-192.png', '/icons/icon-512.png', '/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await cache.addAll(STATIC_URLS);
    // The built index names hashed JS/CSS assets; discover and cache those exact files.
    const response = await fetch('/');
    const html = await response.clone().text();
    await cache.put('/', response);
    const urls = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((match) => match[1]);
    await Promise.allSettled(urls.map((url) => cache.add(url)));
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => ![SHELL, RUNTIME].includes(key)).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.hostname.endsWith('sociobot.in') && url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok && url.origin === location.origin) (await caches.open(RUNTIME)).put(request, response.clone());
        return response;
      } catch {
        return (await caches.match(request, { ignoreVary: true })) ?? (await caches.match('/', { ignoreVary: true })) ?? (await caches.match(OFFLINE_URL, { ignoreVary: true }));
      }
    })());
    return;
  }
  if (url.origin !== location.origin) return;
  event.respondWith((async () => {
    const cached = await caches.match(request, { ignoreVary: true });
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) (await caches.open(RUNTIME)).put(request, response.clone());
    return response;
  })());
});
