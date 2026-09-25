// Service worker: la app funciona sin internet; las imágenes se guardan la primera vez que se ven.
const VERSION = 'gymlog-v1';
const SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/data.js',
  './js/store.js',
  './js/progression.js',
  './js/images.js',
  './js/chart.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];
const IMG_CACHE = 'gymlog-img';
const API_CACHE = 'gymlog-api';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  const keep = [VERSION, IMG_CACHE, API_CACHE];
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Imágenes de ExerciseDB: primero caché, si no hay se descargan y se guardan.
  if (url.hostname === 'static.exercisedb.dev') {
    e.respondWith(cacheFirst(req, IMG_CACHE));
    return;
  }
  // API de ejercicios: red primero, caché si no hay conexión.
  if (url.hostname === 'oss.exercisedb.dev') {
    e.respondWith(networkFirst(req, API_CACHE));
    return;
  }
  // Archivos de la app: red primero (para recibir actualizaciones) y caché sin conexión.
  if (url.origin === self.location.origin) {
    e.respondWith(networkFirst(req, VERSION));
  }
});

async function cacheFirst(req, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
  return res;
}

async function networkFirst(req, name) {
  const cache = await caches.open(name);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    if (req.mode === 'navigate') return cache.match('./index.html');
    throw err;
  }
}
