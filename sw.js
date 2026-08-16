// MarkTask — service worker
// Met l'app en cache pour qu'elle s'ouvre et fonctionne sans connexion.
// (Les données, elles, sont gérées par le cache hors-ligne de Firestore.)

const CACHE = 'marktask-v6';

const FICHIERS = [
  './',
  'index.html',
  'taches-realisees.html',
  'societes-cloturees.html',
  'css/style.css',
  'js/app.js',
  'js/realisees.js',
  'js/cloturees.js',
  'js/stockage.js',
  'js/firebase-config.js',
  'manifest.webmanifest',
  'assets/logo-192.png',
  'assets/logo-512.png',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(FICHIERS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  // ne jamais intercepter Firestore : le SDK gère lui-même temps réel et hors-ligne
  if (url.hostname.endsWith('googleapis.com')) return;

  if (url.origin === self.location.origin || e.request.mode === 'navigate') {
    // tout ce qui vient du site (pages, scripts, styles) : le réseau d'abord,
    // en forçant la revalidation ({cache:'no-cache'}) — sans elle, le cache
    // HTTP du navigateur peut mélanger deux versions (HTML neuf, script vieux).
    // Le cache du service worker reste le secours hors-ligne.
    e.respondWith(
      fetch(e.request, { cache: 'no-cache' })
        .then((reponse) => {
          const copie = reponse.clone();
          caches.open(CACHE).then((cache) => cache.put(e.request, copie));
          return reponse;
        })
        .catch(() =>
          caches.match(e.request).then((r) => r || caches.match('index.html'))
        )
    );
    return;
  }

  // bibliothèques externes (adresses versionnées, immuables) : cache d'abord
  e.respondWith(
    caches.match(e.request).then((enCache) =>
      enCache ||
      fetch(e.request).then((reponse) => {
        const copie = reponse.clone();
        caches.open(CACHE).then((cache) => cache.put(e.request, copie));
        return reponse;
      })
    )
  );
});
