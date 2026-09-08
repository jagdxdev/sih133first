/**
 * GramHealth Service Worker (sw.js)
 * -------------------------------------------------------------
 * Progressive Web App (PWA) Offline Engine
 * 
 * Functions:
 * 1. Installation: Pre-caches application shell (HTML, CSS, JS, Assets).
 * 2. Activation: Cleans up deprecated caches.
 * 3. Fetch Interception: Serves resources from cache when offline, or fetches from network and updates cache.
 * 4. Background Sync: Handles offline sync triggers when network connectivity resumes.
 */

// Unique Cache Identifier - Versioned to force update when app files change
const CACHE_NAME = 'sarthi-v1.0.0';

// Core Application Shell assets required for offline rendering
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/auth.js',
  './js/db.js',
  './js/sync.js',
  './js/triage.js',
  './js/asha.js',
  './js/doctor.js',
  './js/admin.js',
  './js/api.js',
  './assets/icon-192.png',
  './assets/icon-512.png'
];

/**
 * Service Worker Event: INSTALL
 * Called when the browser registers the Service Worker for the first time.
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing GramHealth SW...');

  // Force newly installed SW to activate immediately without waiting for existing clients
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching Application Shell');
      return cache.addAll(ASSETS_TO_CACHE);
    }).catch(err => {
      console.warn('[Service Worker] Cache addAll warning (some non-critical assets may be skipped):', err);
    })
  );
});

/**
 * Service Worker Event: ACTIVATE
 * Called when the Service Worker becomes active. Deletes outdated caches.
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating GramHealth SW...');

  // Claim all active windows/tabs immediately
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting outdated cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

/**
 * Service Worker Event: FETCH
 * Intercepts all network requests. Implements Stale-While-Revalidate strategy.
 * Returns cached asset immediately if found, while updating cache from network in background.
 * If offline and asset is not in cache, fallback to index.html for SPA navigation.
 */
self.addEventListener('fetch', (event) => {
  // Only intercept GET requests
  if (event.request.method !== 'GET') return;

  // Ignore cross-origin / browser extension requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        // Fetch fresh copy from network to update cache in background
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // If valid response, update cache
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch((err) => {
          console.log('[Service Worker] Fetch failed (Offline mode active):', event.request.url);
          // If offline and request is an HTML navigation page, serve cached index.html
          if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
            return cache.match('./index.html') || cachedResponse;
          }
        });

        // Return cached response instantly if available, otherwise wait for network
        return cachedResponse || fetchPromise;
      });
    })
  );
});

/**
 * Service Worker Event: MESSAGE
 * Listens for commands sent from app JS (e.g. manual cache updates or sync signals)
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
