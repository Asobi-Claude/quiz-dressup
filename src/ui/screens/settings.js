// せってい（マップの歯車から）
import { h } from '../dom.js';
import { bigButton, holdButton } from '../common.js';
import { resetChar } from '../../logic/progress.js';
import { voice } from '../../audio/voice.js';
import { sfx } from '../../audio/sfx.js';

const ITEMS = [
  { key: 'sfx', icon: '🔔', label: 'こうかおん' },
  { key: 'onara', icon: '💨', label: 'おならぶー' },
  { key: 'voice', icon: '🗣️', label: 'よみあげ' },
];

export function openSettings(app) {
  const toggles = ITEMS.map((it) => {
    const btn = h('button', {
      class: 'toggle',
      type: 'button',
      'aria-pressed': String(app.settings()[it.key]),
      onTap: () => {
        const v = !app.settings()[it.key];
        app.setSetting(it.key, v);
        btn.setAttribute('aria-pressed', String(v));
        btn.querySelector('.toggle-state').textContent = v ? 'オン' : 'オフ';
        sfx.play('tap');
      },
    },
    h('span', { class: 'toggle-icon', 'aria-hidden': 'true' }, it.icon),
    h('span', { class: 'toggle-label' }, it.label),
    h('span', { class: 'toggle-state' }, app.settings()[it.key] ? 'オン' : 'オフ'));
    return btn;
  });

  const v = app.game.validation;
  const notes = [];
  if (!voice.hasJapanese()) notes.push('この たんまつには にほんごの よみあげの こえが ありません（もじだけで あそべます）');
  if (v.errors.length) notes.push(`データの エラー ${v.errors.length}けん（くわしくは ブラウザの コンソール）`);
  if (v.warnings.length) notes.push(`データの ちゅうい ${v.warnings.length}けん`);

  const close = () => wrap.remove();
  const reset = holdButton(`${app.char?.name ?? ''} を さいしょから（3びょう ながおし）`, 3000, () => {
    // 進み具合を消すのは、いま選んでいるキャラだけ
    app.save(resetChar(app.progress, app.charId));
    sfx.play('pop');
    close();
    app.go('map');
  }, 'danger');

  const wrap = h('div', { class: 'modal settings' },
    h('div', { class: 'modal-card settings-card' },
      h('h2', { class: 'settings-title' }, 'せってい'),
      h('div', { class: 'toggles' }, toggles),
      h('div', { class: 'settings-adult' },
        h('p', { class: 'settings-note' }, 'おとなの ひとへ'),
        reset,
        notes.map((n) => h('p', { class: 'settings-note small' }, n))),
      bigButton('✅', 'とじる', close, 'close')));
  app.stage.appendChild(wrap);
}
