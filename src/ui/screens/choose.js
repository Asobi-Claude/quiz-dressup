// 「もんだい」（今までのクイズ）か「ずかんクイズ」かを選ぶ
import { h } from '../dom.js';
import { iconButton } from '../common.js';
import { createWitch } from '../witch.js';
import { sfx } from '../../audio/sfx.js';
import { startTextQuiz, pickZukan } from '../flow.js';

export function chooseScreen(app, { placeId }) {
  const place = app.place(placeId);
  const witch = createWitch(app, { cls: 'witch-entrance' });

  const card = (icon, label, sub, onPick, cls) => h('button', {
    class: `mode-card ${cls}`,
    type: 'button',
    'aria-label': label,
    onTap: onPick,
  },
  h('span', { class: 'mode-card-icon', 'aria-hidden': 'true' }, icon),
  h('span', { class: 'mode-card-label' }, label),
  h('span', { class: 'mode-card-sub' }, sub));

  const pickText = () => { sfx.play('pop'); startTextQuiz(app, placeId); };
  const pickZukanCard = () => { sfx.play('pop'); pickZukan(app, placeId); };

  const el = h('div', { class: 'choose-wrap' },
    iconButton('🏠', 'マップに もどる', () => app.go('map'), 'home'),
    h('div', { class: 'place-title', style: { '--c': place.color } },
      h('span', { class: 'place-title-icon', 'aria-hidden': 'true' }, place.icon), place.name),
    witch.el,
    h('div', { class: 'choose-cards' },
      card('❓', 'もんだい', 'いままでの クイズ', pickText, 'is-text'),
      card('📷', 'ずかん クイズ', 'しゃしんを みて あてよう', pickZukanCard, 'is-zukan')));

  return {
    el,
    bg: { name: place.bg, color: place.color },
    async enter() {
      await witch.say({ text: 'どっちで あそぶ？', face: 'normal' });
    },
  };
}
