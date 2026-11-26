const CACHE_NAME = "fm-apocalipsis-v67";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./logo.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

// Librerías externas que la app necesita para arrancar. Se guardan en caché
// para que la app instalada abra aunque no haya conexión o la señal sea mala.
const CDN_ASSETS = [
  "https://cdn.tailwindcss.com",
  "https://unpkg.com/react@18/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js",
  "https://unpkg.com/lucide-react@0.468.0/dist/umd/lucide-react.min.js",
  "https://unpkg.com/@babel/standalone@7.25.6/babel.min.js"
];
const CDN_HOSTS = ["cdn.tailwindcss.com", "unpkg.com", "www.gstatic.com"];

const isCdnRequest = (url) => (
  CDN_HOSTS.includes(url.hostname) &&
  // Solo scripts de librerías, nunca el stream, estadísticas ni Firestore.
  (url.hostname !== "www.gstatic.com" || url.pathname.startsWith("/firebasejs/"))
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(CORE_ASSETS);
      // Las librerías externas se intentan guardar, pero si alguna falla
      // la instalación sigue adelante.
      await Promise.all(CDN_ASSETS.map(async (url) => {
        try {
          const crossOriginRequest = url.includes("unpkg.com/react")
            ? new Request(url, { mode: "cors", credentials: "omit" })
            : new Request(url, { mode: "no-cors" });
          const response = await fetch(crossOriginRequest);
          if (response.ok || response.type === "opaque") await cache.put(url, response);
        } catch (_) {}
      }));
    })
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
  }
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys
        .filter((key) => key !== CACHE_NAME)
        .map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Al tocar una notificación de recordatorio, abre (o enfoca) la app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const client = clients.find((c) => "focus" in c);
      if (client) return client.focus();
      return self.clients.openWindow("./");
    })
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);

  // Librerías externas: se sirven desde caché al instante y se actualizan en segundo plano.
  if (requestUrl.origin !== self.location.origin) {
    if (!isCdnRequest(requestUrl)) return;
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request, { ignoreVary: true })
          || await cache.match(requestUrl.href, { ignoreVary: true });
        const network = fetch(event.request)
          .then((response) => {
            if (response.ok || response.type === "opaque") {
              cache.put(event.request, response.clone()).catch(() => {});
            }
            return response;
          })
          .catch(() => cached || Response.error());
        if (cached) {
          event.waitUntil(network.catch(() => {}));
          return cached;
        }
        return network;
      })
    );
    return;
  }

  // Archivos propios: primero la red (para tener siempre la última versión) y, sin conexión, la caché.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME)
            .then((cache) => cache.put(event.request, copy))
            .catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request)
        .then((cached) => cached || (event.request.mode === "navigate" ? caches.match("./index.html") : Response.error())))
  );
});
