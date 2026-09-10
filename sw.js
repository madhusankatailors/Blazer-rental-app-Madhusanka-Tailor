const CACHE_NAME = "madhusanka-tailors-shell-v6";
const APP_SHELL = [
  "./",
  "./index.html",
  "./billing.html",
  "./shoe.html",
  "./customers.html",
  "./login.html",
  "./setup.html",
  "./manifest.webmanifest",
  "./css/styles.css",
  "./css/rentals.css",
  "./css/billing.css",
  "./css/receipt.css",
  "./css/shoe.css",
  "./js/app.js",
  "./js/auth.js",
  "./js/billing.js",
  "./js/firebase.js",
  "./js/firebase-config.js",
  "./js/i18n.js",
  "./js/login.js",
  "./js/phone-validation.js",
  "./js/shoe.js",
  "./js/customers.js",
  "./js/storage.js",
  "./js/ui-dialog.js",
  "./js/pwa.js",
  "./css/customers.css",
  "./assets/madhusanka-logo.png",
  "./assets/paid-seal.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok || response.type === "opaque") {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(request)
          .then((cached) => cached || caches.match("./index.html")),
      ),
  );
});
