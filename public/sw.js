/**
 * NOOR PWA Service Worker (v3)
 * Provides offline capabilities, asset caching, and instantaneous updates
 */

const CACHE_NAME = 'noor-pwa-v3';
const IMMUTABLE_ASSETS = [
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(IMMUTABLE_ASSETS).catch((err) => {
        console.warn('PWA precache warning:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Skip API routes, Chrome extensions, and Vite dynamic development modules
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.includes('node_modules') ||
    url.protocol.startsWith('chrome-extension')
  ) {
    return;
  }

  // Navigation requests: ALWAYS network-first without caching index.html to guarantee instantaneous updates
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' }).catch(() => {
        return caches.match('/index.html') || fetch(event.request);
      })
    );
    return;
  }

  // Static assets (images, fonts, manifest)
  const isStaticMedia =
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.json');

  if (isStaticMedia) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
  }
});
