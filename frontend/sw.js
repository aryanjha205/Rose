/**
 * WebCall Service Worker (PWA)
 */
const CACHE_NAME = "rose-cache-v2";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/css/variables.css",
  "/css/main.css",
  "/css/components.css",
  "/css/call.css",
  "/js/config.js",
  "/js/api.js",
  "/js/auth.js",
  "/js/audio.js",
  "/js/socket.js",
  "/js/webrtc.js",
  "/js/ui.js",
  "/js/app.js",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-192.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
  "/icons/favicon-32.png",
  "/icons/icon.svg"
];

// Install Event: pre-cache shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[PWA ServiceWorker] Pre-caching static assets");
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event: purge stale caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[PWA ServiceWorker] Removing old cache:", key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event: Network-first for dynamic requests, Stale-while-revalidate for static files
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Bypass API, WebSocket, and external CDN calls from offline cache
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/socket.io/") ||
    url.hostname.includes("neon.tech") ||
    url.hostname.includes("cloudinary.com") ||
    event.request.method !== "GET"
  ) {
    return; // Normal network fetch
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If offline and request is for a web page, return cached index.html
          if (event.request.mode === "navigate") {
            return caches.match("/index.html");
          }
        });

      return cachedResponse || fetchPromise;
    })
  );
});
