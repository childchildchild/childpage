const CACHE_NAME = 'childpage-shell-20261127-6';
const SHELL = [
  'index.html',
  'styles.css',
  'menu-pages.css',
  'menu-pages.js',
  'script.js',
  'latest.js',
  'card-badges.js',
  'card-badges.css',
  'content-data.js',
  'articles-data.js',
  'stories.css',
  'stories.js',
  'preferences.css',
  'preferences.js',
  'article-navigation.js',
  'manifest.webmanifest',
  'assets/icon-192.png',
  'assets/icon-512.png',
  'assets/apple-touch-icon.png',
  'assets/optimized/planet.webp',
  'assets/under_planet.svg',
  'assets/optimized/cartoons.webp',
  'assets/optimized/games.webp',
  'assets/optimized/for_all.webp',
  'assets/optimized/storytales.webp',
  'assets/optimized/medicine.webp',
  'assets/optimized/more.webp',
  'assets/optimized/age-baby.webp',
  'assets/optimized/age-girl.webp',
  'assets/optimized/age-teens.webp',
  'assets/flower_find.png',
  'assets/optimized/story_hands.webp',
  'assets/optimized/story_tale.webp',
  'assets/optimized/story_stars.webp',
  'assets/phosphor/bold/style.css',
  'assets/phosphor/bold/Phosphor-Bold.woff2',
  'assets/phosphor/fill/style.css',
  'assets/phosphor/fill/Phosphor-Fill.woff2',
  'assets/arco.ttf',
  'assets/Roboto.ttf'
];
const shellPaths = new Set(SHELL.map(path => new URL(path, self.registration.scope).pathname));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('childpage-shell-') && key !== CACHE_NAME).map(key => caches.delete(key)))),
    self.clients.claim()
  ]));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  const path = url.pathname === new URL('./', self.registration.scope).pathname
    ? new URL('index.html', self.registration.scope).pathname
    : url.pathname;
  if (!shellPaths.has(path)) return;
  event.respondWith(
    fetch(event.request).then(async response => {
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(new Request(new URL(path, self.location.origin)), response.clone());
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(new Request(new URL(path, self.location.origin)));
      return cached || Response.error();
    })
  );
});
