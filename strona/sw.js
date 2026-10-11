/* Praca bez internetu (tylko przez HTTPS albo localhost). Pliki z pamięci, w tle odświeżane z sieci. */
const WERSJA = 'tabliczka-2'; // podbij przy każdej zmianie plików, wtedy telefon pobierze nowe
const PLIKI = ['./', 'index.html', 'styl.css', 'silnik.js', 'baza.js', 'przestawiane.js', 'app.js',
  'manifest.webmanifest', 'ikona.svg', 'ikona-180.png', 'ikona-192.png', 'ikona-512.png', 'inter.woff2'];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(WERSJA).then(c => c.addAll(PLIKI)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== WERSJA).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', ev => {
  const req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  ev.respondWith(caches.open(WERSJA).then(async c => {
    const zPamieci = await c.match(req, { ignoreSearch: true });
    const zSieci = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
    return zPamieci || (await zSieci) || new Response('Brak sieci, a tego pliku nie ma w pamięci.', { status: 503 });
  }));
});
