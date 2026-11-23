/**
 * Rosé Service Worker (PWA)
 * Supports Offline Shell caching, Background Web Push Calls, Ring Vibration, and Immediate Notification Actions.
 */
const CACHE_NAME = "rose-cache-v7";
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

// Activate Event: purge stale caches and claim clients immediately
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

// =========================================================================
// Web Push API: Incoming Background Call Notification & Phone Ringing
// =========================================================================
self.addEventListener("push", (event) => {
  console.log("[PWA ServiceWorker] Push notification received", event);
  if (!event.data) return;

  let payload = {};
  try {
    payload = event.data.json();
  } catch (e) {
    payload = { type: "message", text: event.data.text() };
  }

  if (payload.type === "incoming-call") {
    const caller = payload.caller || {};
    const callerName = caller.display_name || (caller.username ? `@${caller.username}` : "Rosé User");
    const callType = payload.callType === "video" ? "📹 Video Call" : "📞 Voice Call";
    const callId = payload.callId;

    const title = `📞 ${callerName} is calling...`;
    const options = {
      body: `Incoming ${callType} from ${callerName}. Tap to answer!`,
      icon: caller.avatar_url || "/icons/icon-192.png",
      badge: "/icons/favicon-32.png",
      tag: `call-${callId}`,
      renotify: true,
      requireInteraction: true,
      silent: false,
      // Continuous ringing vibration pattern: 600ms vibrate, 300ms pause
      vibrate: [600, 300, 600, 300, 600, 300, 600, 300, 600, 300, 600, 300, 600, 300],
      data: {
        url: `/?autoAnswer=${encodeURIComponent(callId || "")}`,
        callId: callId,
        caller: caller,
        callType: payload.callType
      },
      actions: [
        { action: "answer", title: "📞 Answer" },
        { action: "decline", title: "❌ Decline" }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(title, options)
    );
  } else if (payload.type === "call-cancelled") {
    const callId = payload.callId;
    event.waitUntil(
      self.registration.getNotifications().then((notifications) => {
        notifications.forEach((notification) => {
          if (notification.tag === `call-${callId}` || notification.data?.callId === callId) {
            notification.close();
          }
        });
      })
    );
  }
});

// Notification Click Event: Focus open tab or launch app to answer call
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const action = event.action;
  const callId = data.callId;

  if (action === "decline") {
    console.log("[PWA ServiceWorker] Incoming call declined via notification action");
    return;
  }

  const targetUrl = `/?autoAnswer=${encodeURIComponent(callId || "")}`;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.postMessage({ type: "NOTIFICATION_ANSWER_CALL", callId: callId });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
