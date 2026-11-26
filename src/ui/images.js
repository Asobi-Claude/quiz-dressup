// 画像の読み込み。画像がないときは、プレースホルダー（色つきの四角＋名前）を出す。
// assets/manifest.json（tools/import_assets.py が作る）があれば、それを見て、ない画像は最初からプレースホルダーにする。
import { h } from './dom.js';

const ASSET_DIR = 'assets/';
let known = null; // manifest にある画像の名前（Set）。manifest がなければ null（読んでみて判断）
let version = '';  // manifest の version。画像を取り込み直すと変わる（オフライン用の保存を新しくするため）

export function setManifest(manifest) {
  known = manifest && Array.isArray(manifest.images) ? new Set(manifest.images) : null;
  version = manifest?.version ?? '';
}

export function assetUrl(name) {
  return `${ASSET_DIR}${name}.png${version ? `?v=${version}` : ''}`;
}

/** 画像があるか（manifest がなければ「たぶんある」とみなして true） */
export function mayHave(name) {
  return !!name && (known ? known.has(name) : true);
}

// ---- ずかんの写真（assets/zukan/*.jpg） ----
// ドレスなどの絵（.png）とは別。manifest.json には載せないので、manifest は見ない。
let zukanVersion = 0; // data/zukan.json の version。写真を入れ替えたら上げる（オフライン用の保存を新しくするため）

export function setZukanVersion(v) {
  zukanVersion = Number.isInteger(v) ? v : 0;
}

export function photoUrl(path) {
  return `${ASSET_DIR}${path}.jpg${zukanVersion ? `?v=${zukanVersion}` : ''}`;
}

/**
 * ずかんの写真を出す。読めなかったら、「？」だけのプレースホルダー。
 * 名前や写真のファイル名は出さない（出すと、写真を当てるクイズの答えがわかってしまう）。
 * opts: { label（読み上げ用。答えの名前は渡さない）, kind, cls }
 * 戻り値の .dataset.image に、写真の path が入る（プレースホルダーなら空）。
 */
export function photo(path, opts = {}) {
  const wrap = h('div', { class: `pic pic-${opts.kind ?? 'zukan'} ${opts.cls ?? ''}` });
  const showPlaceholder = () => {
    wrap.replaceChildren(h('div', { class: 'ph ph-zukan', role: 'img', 'aria-label': opts.label ?? '？' },
      h('span', { class: 'ph-mark' }, '？')));
    wrap.dataset.image = '';
    wrap.classList.add('is-ph');
  };
  const img = h('img', { src: photoUrl(path), alt: opts.label ?? '', draggable: 'false' });
  img.addEventListener('error', showPlaceholder, { once: true });
  wrap.appendChild(img);
  wrap.dataset.image = path;
  return wrap;
}

function hue(str) {
  let x = 0;
  for (const ch of String(str)) x = (x * 31 + ch.codePointAt(0)) % 360;
  return x;
}

/** プレースホルダー */
export function placeholder(name, { label, kind = 'thing', color } = {}) {
  const hh = hue(name);
  return h('div', {
    class: `ph ph-${kind}`,
    style: { '--ph': color ?? `hsl(${hh} 60% 78%)`, '--ph2': color ? color : `hsl(${(hh + 40) % 360} 65% 88%)` },
    role: 'img',
    'aria-label': label ?? name,
  },
  h('span', { class: 'ph-label' }, label ?? ''),
  h('span', { class: 'ph-name' }, name));
}

/**
 * 画像を出す。names は候補（前から順に、あるものを使う）。どれもなければプレースホルダー。
 * opts: { label, kind: 'char' | 'witch' | 'choice' | 'bg' | 'thing', cls, color }
 * 戻り値の要素の .dataset.image に、使った画像の名前が入る（プレースホルダーなら空）。
 */
export function picture(names, opts = {}) {
  const list = (Array.isArray(names) ? names : [names]).filter(mayHave);
  const wrap = h('div', { class: `pic pic-${opts.kind ?? 'thing'} ${opts.cls ?? ''}` });
  const fallbackName = (Array.isArray(names) ? names[0] : names) ?? '';
  const showPh = () => {
    wrap.replaceChildren(placeholder(fallbackName, opts));
    wrap.dataset.image = '';
    wrap.classList.add('is-ph');
  };
  let i = 0;
  const tryNext = () => {
    if (i >= list.length) { showPh(); return; }
    const name = list[i++];
    const img = h('img', { src: assetUrl(name), alt: opts.label ?? '', draggable: 'false' });
    img.addEventListener('error', tryNext, { once: true });
    wrap.replaceChildren(img);
    wrap.dataset.image = name;
    wrap.classList.remove('is-ph');
  };
  tryNext();
  return wrap;
}

/** 背景（透過なし）。ないときは場所の色のグラデーション */
export function background(name, { color, label } = {}) {
  const el = h('div', { class: 'bg' });
  const ph = () => {
    el.classList.add('is-ph');
    el.style.setProperty('--bgc', color ?? '#bcd7ef');
    el.replaceChildren(h('span', { class: 'bg-name' }, name));
  };
  if (!mayHave(name)) { ph(); return el; }
  const img = h('img', { src: assetUrl(name), alt: label ?? '', draggable: 'false' });
  img.addEventListener('error', ph, { once: true });
  el.appendChild(img);
  return el;
}

/** キャラの全身絵の候補（着ているルック → 素体 → 最初の場所のルック01） */
export function charImageNames(game, charId, look) {
  const c = game.characters.find((x) => x.id === charId);
  const first = game.places[0] ? `look_${game.places[0].id}_${charId}_01` : null;
  return [look?.image, c?.base, first].filter(Boolean);
}

/** 画像を先に読んでおく（次の画面の準備） */
export function preload(names) {
  for (const n of names) {
    if (!mayHave(n)) continue;
    const img = new Image();
    img.src = assetUrl(n);
  }
}
