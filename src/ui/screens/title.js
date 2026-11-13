// タイトル／キャラ選択
import { h } from '../dom.js';
import { picture, charImageNames } from '../images.js';
import { voice } from '../../audio/voice.js';
import { sfx } from '../../audio/sfx.js';

const LOGO_COLORS = ['#f497b5', '#f7c948', '#7fd1a8', '#9dd3f0', '#c4a8f0', '#f9a66c', '#f497b5'];

function goFullscreen() {
  const standalone = window.matchMedia?.('(display-mode: fullscreen), (display-mode: standalone)').matches;
  const touch = window.matchMedia?.('(pointer: coarse)').matches;
  if (standalone || !touch || document.fullscreenElement) return;
  document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).then(() => {
    screen.orientation?.lock?.('landscape').catch(() => {});
  }).catch(() => {});
}

export function titleScreen(app) {
  const cards = app.game.characters.map((c) => {
    const look = app.wearingLook(c.id);
    const special = look?.special;
    return h('button', {
      class: `char-card ${special ? 'is-special' : ''}`,
      type: 'button',
      style: { '--c': c.color },
      'aria-label': c.name,
      dataset: { char: c.id },
      onTap: () => {
        sfx.unlock();
        voice.unlock();
        sfx.play('sparkle');
        goFullscreen();
        app.charId = c.id;
        voice.speak(`${c.name}！`);
        setTimeout(() => app.go('map'), 450);
      },
    },
    h('div', { class: 'char-card-pic' }, picture(charImageNames(app.game, c.id, look), { kind: 'char', label: c.name })),
    h('div', { class: 'char-card-name' }, c.name));
  });

  const el = h('div', { class: 'title-wrap' },
    h('h1', { class: 'logo' },
      h('span', { class: 'logo-small' }, 'クイズで'),
      h('span', { class: 'logo-big' }, [...'ドレスアップ！'].map((ch, i) => h('span', {
        class: 'ch',
        style: {
          '--i': i,
          '--c': LOGO_COLORS[i % LOGO_COLORS.length],
          '--r': `${i % 2 ? 4 : -4}deg`,
          '--y': `${i % 3 === 1 ? -6 : 0}px`,
        },
      }, ch)))),
    h('p', { class: 'title-ask' }, 'だれが あそぶ？'),
    h('div', { class: 'char-cards' }, cards));

  return {
    el,
    bg: { name: 'bg_title', color: '#cfe6f5' },
  };
}
