const CACHE_NAME = "apocalipsis-radio-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // dejamos pasar todas las peticiones sin cachear
  return;
});
