// НОВО: Прост service worker за офлайн работа (PWA)
// Кешира основните файлове при инсталация и обслужва от кеша,
// когато няма мрежа - при промяна на съдържанието смени CACHE_NAME,
// за да инвалидираш стария кеш.
const CACHE_NAME = 'randomtimer-cache-v2'; // НОВО: v2 - форсира еднократно изчистване на стария кеш заради fetch стратегията по-долу

const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/sounds/beep.wav',
  '/sounds/gong.wav',
  '/sounds/end_chime.wav',
  '/sounds/whistle.wav',
  '/sounds/beep_short.wav',
  '/sounds/clap.wav',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// НОВО: Тези пътища винаги трябва да се проверяват първо в мрежата -
// иначе PWA-то показва старо приложение дори след нов деплой
const NETWORK_FIRST_PATHS = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll спира, ако един файл липсва - добавяме по отделно, за да не гърми при липсващ звук
      return Promise.all(
        CORE_ASSETS.map((url) => cache.add(url).catch(() => {}))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const isNetworkFirst =
    event.request.mode === 'navigate' || NETWORK_FIRST_PATHS.includes(url.pathname);

  if (isNetworkFirst) {
    // НОВО: Приложението (HTML/manifest) - винаги първо мрежата, за да виждаш нов деплой веднага.
    // Само ако няма мрежа, пада обратно на кеша (за офлайн работа).
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Статични ресурси (звуци, икони, хеширани JS/CSS бъндли) - cache-first, за скорост и офлайн надеждност
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // без мрежа - връщаме кешираното, ако има

      return cached || networkFetch;
    })
  );
});

