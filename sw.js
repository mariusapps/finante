/* Service worker — Finanțe personale
   - Pagina (HTML): network-first, cu rezervă din cache când ești offline.
     Astfel, după ce publici o versiune nouă pe GitHub Pages, o primești imediat.
   - Biblioteci/fonturi externe (jsdelivr, Google Fonts): stale-while-revalidate.
   - Supabase (date + autentificare) NU este interceptat deloc: merge direct pe rețea,
     deci nu riști să vezi date vechi din cache.
   Când schimbi lista de fișiere de mai jos, crește CACHE_VERSION. */
const CACHE_VERSION = 'v1';
const CACHE_NAME = 'finante-' + CACHE_VERSION;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];
const EXTERNAL_HOSTS = [
  'cdn.jsdelivr.net',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      // addAll ar eșua întreg dacă lipsește un fișier; le adăugăm individual
      .then(cache => Promise.all(APP_SHELL.map(url => cache.add(url).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('finante-') && k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Orice altceva (inclusiv *.supabase.co) merge direct pe rețea
  const isSameOrigin = url.origin === self.location.origin;
  const isExternalAsset = EXTERNAL_HOSTS.includes(url.hostname);
  if (!isSameOrigin && !isExternalAsset) return;

  // Navigarea / HTML: network-first
  if (req.mode === 'navigate' || (isSameOrigin && req.headers.get('accept') && req.headers.get('accept').includes('text/html'))) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html') || caches.match('./')))
    );
    return;
  }

  // Restul: stale-while-revalidate
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req)
        .then(res => {
          if (res && (res.status === 200 || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
