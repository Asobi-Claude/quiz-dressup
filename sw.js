// オフラインで遊べるようにする Service Worker。
// - アプリ本体とデータ: ネットワーク優先（つながっていれば新しいものを使い、保存し直す）。つながらなければ保存したもの
// - 画像（assets/）: 保存したもの優先。assets/manifest.json の version を URL に付けているので、取り込み直すと新しく保存される
// - ずかんの写真（assets/zukan/*.jpg）: 同じく保存したもの優先。data/zukan.json の version を URL に付けている（見本 sample:true は保存しない）
// ファイルを足したら SHELL にも足す（tools/run_tests.py が、書き忘れを調べる）。

const SHELL_CACHE = 'qd-shell-v2';
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
  './src/logic/zukan.js',
  './src/audio/voice.js',
  './src/audio/sfx.js',
  './src/ui/dom.js',
  './src/ui/images.js',
  './src/ui/effects.js',
  './src/ui/witch.js',
  './src/ui/common.js',
  './src/ui/flow.js',
  './src/ui/screens/title.js',
  './src/ui/screens/map.js',
  './src/ui/screens/entrance.js',
  './src/ui/screens/choose.js',
  './src/ui/screens/level.js',
  './src/ui/screens/zukanQuiz.js',
  './src/ui/screens/credits.js',
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
];
// なくてもよいファイル（あれば保存する。なくても、更新は失敗にならない）
const OPTIONAL = ['./data/voice-map.json', './data/zukan.json', './assets/manifest.json'];

/** URL を保存する。保存できなかった URL の一覧を返す */
async function cacheAll(cache, urls, optional = false) {
  const failed = [];
  await Promise.all(urls.map(async (u) => {
    try {
      const res = await fetch(u, { cache: 'no-cache' });
      if (!res.ok) throw new Error(String(res.status));
      await cache.put(u, res);
    } catch (e) {
      failed.push(u);
      if (!optional) console.warn('保存できませんでした', u, e);
    }
  }));
  return failed;
}

/** JSON を読む。なければ {missing:true}（404）、通信などの失敗は {failed:true}、読めたら {json} */
async function readJson(url) {
  let res;
  try {
    res = await fetch(url, { cache: 'no-cache' });
  } catch {
    return { failed: true };
  }
  if (res.status === 404) return { missing: true };
  if (!res.ok) return { failed: true };
  try {
    return { json: await res.json() };
  } catch {
    return { failed: true };
  }
}

/**
 * 保存しておく画像の URL の一覧。
 * assets/manifest.json の画像（.png）と、data/zukan.json のずかんの写真（.jpg。見本 sample:true は除く）。
 * どちらも、version 付きの URL（写真は version が 0 のときだけ、付けない。画面側の photoUrl と同じ決まり）。
 */
async function wantedImageUrls() {
  const want = new Set();
  let complete = true; // 一覧を、2つとも読めたか（読めないものがあると、消してよい画像がわからない）
  const abs = (path) => new URL(path, self.location).href;
  const manifest = await readJson('./assets/manifest.json'); // 404 は「画像がまだない」
  if (manifest.failed) complete = false;
  else if (manifest.json) for (const n of manifest.json.images) want.add(abs(`./assets/${n}.png?v=${manifest.json.version}`));
  const zukan = await readJson('./data/zukan.json'); // 404 は「ずかんがまだない」
  if (zukan.failed) {
    complete = false;
  } else if (zukan.json) {
    const v = Number.isInteger(zukan.json.version) ? zukan.json.version : 0;
    for (const it of zukan.json.items ?? []) {
      if (!it.sample && it.image) want.add(abs(`./assets/${it.image}.jpg${v ? `?v=${v}` : ''}`));
    }
  }
  return { want, complete };
}

/**
 * 画像を、version 付きの URL で保存する。古い version・使わなくなった画像は消す。
 * ただし、一覧を2つとも読めたときだけ消す（通信が不安定で、片方しか読めなかったときに、
 * もう片方の画像まで消してしまわないように）。
 */
async function cacheImages() {
  const { want, complete } = await wantedImageUrls();
  if (!want.size) return; // 画像がまだない
  const cache = await caches.open(ASSET_CACHE);
  if (complete) {
    for (const req of await cache.keys()) {
      if (!want.has(req.url)) await cache.delete(req);
    }
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
    const failed = await cacheAll(shell, SHELL);
    // アプリのファイルが1つでも保存できなかったら、この更新は失敗にする（古い版が、そのまま使われ続ける）。
    // 穴のある新しい版に切り替わると、オフラインで空になる
    if (failed.length) throw new Error(`アプリのファイルを保存できませんでした: ${failed.join(', ')}`);
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

  if (url.pathname.includes('/assets/') && (url.pathname.endsWith('.png') || url.pathname.endsWith('.jpg'))) {
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
