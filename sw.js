// Minimal SW: cache shell, działa offline i spełnia kryteria instalacji
const CACHE = "tuttorly-v1";
const ASSETS = [
  "./",
  "./index.html"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return; // tylko GET cache'ujemy
  e.respondWith(
    fetch(req).then(res => {
      const resClone = res.clone();
      caches.open(CACHE).then(c => c.put(req, resClone)).catch(()=>{});
      return res;
    }).catch(() => caches.match(req))
  );
});
