// オフラインで遊べるようにする Service Worker。
// - アプリ本体とデータ: ネットワーク優先（つながっていれば新しいものを使い、保存し直す）。つながらなければ保存したもの
// - 画像（assets/）: 保存したもの優先。assets/manifest.json の version を URL に付けているので、取り込み直すと新しく保存される
// ファイルを足したら SHELL にも足す（tools/run_tests.py が、書き忘れを調べる）。

const SHELL_CACHE = 'qd-shell-v1';
const ASSET_CACHE = 'qd-assets';

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './src/style.css',
  './src/main.js',
  './src/data.js',
  './src/logic/rng.js',
  './src/logic/quiz.js',
  './src/logic/unlock.js',
  './src/logic/progress.js',
  './src/logic/game.js',
  './src/logic/witch.js',
  './src/audio/voice.js',
  './src/audio/sfx.js',
  './src/ui/dom.js',
  './src/ui/images.js',
  './src/ui/effects.js',
  './src/ui/witch.js',
  './src/ui/common.js',
  './src/ui/screens/title.js',
  './src/ui/screens/map.js',
  './src/ui/screens/entrance.js',
  './src/ui/screens/quiz.js',
  './src/ui/screens/reward.js',
  './src/ui/screens/dressup.js',
  './src/ui/screens/ohirome.js',
  './src/ui/screens/settings.js',
  './data/quizzes.json',
  './data/choice_images_map.json',
  './data/places.json',
  './data/looks.json',
  './data/witch-lines.json',
  './assets/manifest.json',
];
// なくてもよいファイル（あれば保存する）
const OPTIONAL = ['./data/voice-map.json'];

async function cacheAll(cache, urls, optional = false) {
  await Promise.all(urls.map(async (u) => {
    try {
      const res = await fetch(u, { cache: 'no-cache' });
      if (res.ok) await cache.put(u, res);
    } catch (e) {
      if (!optional) console.warn('保存できませんでした', u, e);
    }
  }));
}

/** assets/manifest.json にある画像を、version 付きの URL で保存する。古い version は消す */
async function cacheImages() {
  let manifest;
  try {
    manifest = await (await fetch('./assets/manifest.json', { cache: 'no-cache' })).json();
  } catch {
    return; // 画像がまだない
  }
  const cache = await caches.open(ASSET_CACHE);
  const want = new Set(manifest.images.map((n) => new URL(`./assets/${n}.png?v=${manifest.version}`, self.location).href));
  for (const req of await cache.keys()) {
    if (!want.has(req.url)) await cache.delete(req);
  }
  const have = new Set((await cache.keys()).map((r) => r.url));
  const todo = [...want].filter((u) => !have.has(u));
  // 少しずつ保存する（タブレットに負担をかけないように）
  for (let i = 0; i < todo.length; i += 6) {
    await cacheAll(cache, todo.slice(i, i + 6));
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await cacheAll(shell, SHELL);
    await cacheAll(shell, OPTIONAL, true);
    await cacheImages();
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key !== SHELL_CACHE && key !== ASSET_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

// アプリから「画像を保存し直して」と頼まれたとき（manifest が変わったとき）
self.addEventListener('message', (event) => {
  if (event.data === 'refresh-images') event.waitUntil(cacheImages());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 外への通信はしない（そもそも使っていない）

  if (url.pathname.includes('/assets/') && url.pathname.endsWith('.png')) {
    event.respondWith(cacheFirst(req));
  } else {
    event.respondWith(networkFirst(req));
  }
});

async function cacheFirst(req) {
  const cache = await caches.open(ASSET_CACHE);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return new Response('', { status: 404 });
  }
}

async function networkFirst(req) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const res = await fetchWithTimeout(req, 4000);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === 'navigate') {
      const index = await cache.match('./index.html');
      if (index) return index;
    }
    return new Response('', { status: 504 });
  }
}

function fetchWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req, { cache: 'no-cache' }).then((r) => { clearTimeout(t); resolve(r); }, (e) => { clearTimeout(t); reject(e); });
  });
}
