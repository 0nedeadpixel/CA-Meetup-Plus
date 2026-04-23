const CACHE_NAME = 'ca-meetup-plus-v1';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/index.css',
  '/images/meetupplus-icon.png',
  '/images/meetupplus.png',
  '/images/logo.png',
  '/images/happy-pika.gif',
  '/images/pika-sad.gif',
  '/images/pika-nomo.gif'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Ignore failures if some assets are not found during Development cache load
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Part of the cache was not added:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;
  
  // Don't intercept API endpoints or other protocols (skip firestore calls)
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Stale-While-Revalidate pattern
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch((e) => {
        // Network failed (e.g. offline). Use cached response if available.
        return cachedResponse;
      });

      // Return the cached response immediately if it exists, while fetchPromise updates cache in background
      // If not cached, return the fetch promise
      return cachedResponse || fetchPromise;
    })
  );
});
