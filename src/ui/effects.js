// 演出（キラキラ・フラッシュ・ゆれ・けむり・星）
import { h } from './dom.js';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function layer(root) {
  return root.querySelector(':scope > .fx-layer') ?? root.appendChild(h('div', { class: 'fx-layer' }));
}

/** キラキラ（x, y は舞台の中の px） */
export function sparkle(root, x, y, { count = 14, spread = 220, colors } = {}) {
  const L = layer(root);
  const cs = colors ?? ['#f7c948', '#ffffff', '#f28fb0', '#9fd8f5', '#c9b2f0'];
  for (let i = 0; i < count; i++) {
    const a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const d = spread * (0.45 + Math.random() * 0.55);
    const s = h('div', {
      class: 'fx-spark',
      style: {
        left: `${x}px`, top: `${y}px`,
        '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d}px`,
        '--c': cs[i % cs.length],
        '--s': `${18 + Math.random() * 22}px`,
        animationDelay: `${Math.random() * 120}ms`,
      },
    });
    L.appendChild(s);
    setTimeout(() => s.remove(), 1300);
  }
}

/** 要素の真ん中でキラキラ */
export function sparkleAt(root, el, opts) {
  const r = rectIn(root, el);
  sparkle(root, r.x + r.w / 2, r.y + r.h / 2, opts);
}

/** 舞台の中での要素の位置（拡大・縮小を戻す） */
export function rectIn(root, el) {
  const rr = root.getBoundingClientRect();
  const er = el.getBoundingClientRect();
  const scale = rr.width / root.offsetWidth || 1;
  return { x: (er.left - rr.left) / scale, y: (er.top - rr.top) / scale, w: er.width / scale, h: er.height / scale };
}

/** 写真の「ぱしゃっ」フラッシュ */
export function flash(root) {
  const f = h('div', { class: 'fx-flash' });
  layer(root).appendChild(f);
  setTimeout(() => f.remove(), 700);
}

/** 画面をゆらす */
export function shake(el) {
  if (reduced()) return;
  el.classList.remove('fx-shake');
  void el.offsetWidth;
  el.classList.add('fx-shake');
  setTimeout(() => el.classList.remove('fx-shake'), 700);
}

/** 緑のけむり（おなら） */
export function smoke(root, x, y) {
  const L = layer(root);
  for (let i = 0; i < 9; i++) {
    const p = h('div', {
      class: 'fx-smoke',
      style: {
        left: `${x + (Math.random() - 0.5) * 60}px`,
        top: `${y + (Math.random() - 0.5) * 40}px`,
        '--dx': `${(Math.random() - 0.3) * 260}px`,
        '--dy': `${-60 - Math.random() * 160}px`,
        '--s': `${70 + Math.random() * 90}px`,
        animationDelay: `${i * 60}ms`,
      },
    });
    L.appendChild(p);
    setTimeout(() => p.remove(), 2200);
  }
}

/** ふわっと出てくる大きな文字（「おならぶー！」など） */
export function burstText(root, text, cls = '') {
  const t = h('div', { class: `fx-burst ${cls}` }, text);
  layer(root).appendChild(t);
  setTimeout(() => t.remove(), 1800);
}
