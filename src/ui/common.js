// 画面で共通に使う部品
import { h } from './dom.js';
import { sfx } from '../audio/sfx.js';

/** 大きなボタン（アイコン＋ひらがな） */
export function bigButton(icon, label, onTap, cls = '') {
  return h('button', {
    class: `btn big ${cls}`,
    type: 'button',
    'aria-label': label,
    onTap: (e) => { sfx.play('tap'); onTap(e); },
  }, h('span', { class: 'btn-icon', 'aria-hidden': 'true' }, icon), h('span', { class: 'btn-label' }, label));
}

/** 丸いアイコンボタン（おうち・スピーカー・歯車など） */
export function iconButton(icon, label, onTap, cls = '') {
  return h('button', {
    class: `btn icon ${cls}`,
    type: 'button',
    'aria-label': label,
    onTap: (e) => { sfx.play('tap'); onTap(e); },
  }, h('span', { 'aria-hidden': 'true' }, icon));
}

/** 星の列（filled 個が黄色、残りは白） */
export function stars(total, filled, cls = '') {
  return h('div', { class: `stars ${cls}`, 'aria-label': `${filled} / ${total}` },
    Array.from({ length: total }, (_, i) => h('span', { class: `star ${i < filled ? 'is-on' : ''}` }, '★')));
}

/**
 * 確認のダイアログ（大きな ○ と × の絵）。はい → true
 * root: 舞台の要素
 */
export function confirmDialog(root, { text, yesIcon = '⭕', yesLabel = 'はい', noIcon = '❌', noLabel = 'いいえ' }) {
  return new Promise((resolve) => {
    const close = (v) => { wrap.remove(); resolve(v); };
    const wrap = h('div', { class: 'modal' },
      h('div', { class: 'modal-card' },
        h('p', { class: 'modal-text' }, text),
        h('div', { class: 'modal-buttons' },
          bigButton(yesIcon, yesLabel, () => close(true), 'yes'),
          bigButton(noIcon, noLabel, () => close(false), 'no'))));
    root.appendChild(wrap);
  });
}

/** 長押しで実行するボタン（おとな用。ms ミリ秒おしつづけると onDone） */
export function holdButton(label, ms, onDone, cls = '') {
  let timer = null;
  const btn = h('button', { class: `btn hold ${cls}`, type: 'button', style: { '--hold': `${ms}ms` } },
    h('span', { class: 'hold-fill' }), h('span', { class: 'btn-label' }, label));
  const start = (e) => {
    e.preventDefault();
    btn.classList.add('is-holding');
    timer = setTimeout(() => { btn.classList.remove('is-holding'); onDone(); }, ms);
  };
  const stop = () => { clearTimeout(timer); btn.classList.remove('is-holding'); };
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('pointerup', stop);
  btn.addEventListener('pointerleave', stop);
  btn.addEventListener('pointercancel', stop);
  btn.addEventListener('contextmenu', (e) => e.preventDefault());
  return btn;
}
