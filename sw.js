const CACHE_NOMI = "qidiruv-pwa-v1";

// GitHub Pages subpath uchun to'liq yo'llar
const BASE = "/qidiruv-pwa";

const CACHE_FAYLLAR = [
  `${BASE}/`,
  `${BASE}/index.html`,
  `${BASE}/app.js`,
  `${BASE}/style.css`,
  `${BASE}/manifest.json`,
  `${BASE}/icons/icon-192.png`,
  `${BASE}/icons/icon-512.png`,
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NOMI).then((cache) => {
      return Promise.allSettled(
        CACHE_FAYLLAR.map((url) =>
          cache.add(url).catch((err) => console.warn("[SW] Cache xato:", url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ... qolgan qismi avvalgidek