const CACHE_VERSION = 'domicilios-v1';
const CACHE_ASSETS = [
  './',
  './domicilios-web.html',
  './domicilios-web.css',
  './domicilios-web.js',
  './manifest.webmanifest',
  './img/logo%202024%20marca%20registrada-04.png'
];

globalThis.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(CACHE_ASSETS))
  );
  globalThis.skipWaiting();
});

globalThis.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      )
    )
  );
  globalThis.clients.claim();
});

globalThis.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== globalThis.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request)
        .then(response => {
          if (response?.ok && response.type === 'basic') {
            const cloned = response.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(event.request, cloned));
          }
          return response;
        })
        .catch(async () => {
          if (event.request.mode === 'navigate') {
            return caches.match('./domicilios-web.html');
          }
          return new Response('Sin conexión', { status: 503, statusText: 'Offline' });
        });
    })
  );
});
