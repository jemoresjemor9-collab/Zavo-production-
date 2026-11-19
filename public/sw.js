const CACHE_NAME = "zavo-shell-v4";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icons/zavo-192.png", "/icons/zavo-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  // Keep older caches intact: this worker must never erase user data or caches
  // owned by another app on the same origin.
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // Never cache API, Supabase, signed media, or private application responses.
  if (url.pathname.startsWith("/storage/") || url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          );
        }
        return response;
      }).catch(async () => {
        const exact = await caches.match(request);
        if (exact) return exact;
        const shell = await caches.match(new URL("/", self.location.origin).href);
        return shell || Response.error();
      })
    );
    return;
  }

  const isBuildAsset = url.pathname.startsWith("/_next/static/");
  const isPublicAsset =
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest";

  if (isBuildAsset || isPublicAsset) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
            );
          }
          return response;
        });
      })
    );
  }
});
