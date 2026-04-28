const CACHE_NAME = 'ca-meetup-plus-v2';

const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/index.css',
  'https://app.fullertonpogo.com/images/cameetup-icon.png',
  'https://app.fullertonpogo.com/images/meetupplus.png',
  'https://app.fullertonpogo.com/images/logo.png',
  'https://app.fullertonpogo.com/images/happy-pika.gif',
  'https://app.fullertonpogo.com/images/pika-sad.gif',
  'https://app.fullertonpogo.com/images/pika-nomo.gif'
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
  if (!event.request.url.startsWith(self.location.origin) && !event.request.url.startsWith('https://app.fullertonpogo.com')) return;

  const url = new URL(event.request.url);
  
  // Bypass Vite dev server routes and dynamic imports
  if (
    url.pathname.startsWith('/@vite') ||
    url.pathname.startsWith('/@react-refresh') ||
    url.pathname.startsWith('/node_modules') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.ts') ||
    url.searchParams.has('import') ||
    url.searchParams.has('t')
  ) {
    return; // Let the browser handle these normally
  }

  // Only apply Stale-While-Revalidate to the assets we explicitly want to cache
  const isCachableAsset = 
    url.pathname === '/' || 
    url.pathname === '/index.html' || 
    url.pathname === '/index.css' || 
    url.pathname === '/manifest.json' || 
    url.href.startsWith('https://app.fullertonpogo.com/images/');

  if (!isCachableAsset) return;

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
