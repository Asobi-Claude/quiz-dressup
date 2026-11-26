// ずかんクイズの「むずかしさ」を選ぶ（みーちゃんモードだけ。ひーちゃんモードは、かんたんに決まる）
import { h } from '../dom.js';
import { iconButton, stars } from '../common.js';
import { photo } from '../images.js';
import { voice } from '../../audio/voice.js';
import { sfx } from '../../audio/sfx.js';
import { zukanLevelsFor, zukanPool } from '../../logic/zukan.js';
import { startZukanQuiz } from '../flow.js';
import { pickOne } from '../../logic/rng.js';

const NAMES = { 1: 'かんたん', 2: 'ふつう', 3: 'むずかしい' };
const SUBS = { 1: 'やさしい もの', 2: 'ちょっと にている ものも', 3: 'ずかん はかせ むけ' };

export function levelScreen(app, { placeId }) {
  const place = app.place(placeId);
  const levels = zukanLevelsFor(place, app.mode);

  const cards = levels.map((lv) => {
    const sample = pickOne(zukanPool(place.zukan, placeId, lv, app.mode)); // 見本の写真（そのむずかしさの、どれか1つ）
    return h('button', {
      class: `level-card level-${lv}`,
      type: 'button',
      'aria-label': NAMES[lv],
      dataset: { level: String(lv) },
      onTap: () => { sfx.play('pop'); startZukanQuiz(app, placeId, lv); },
    },
    stars(3, lv, 'level-stars'),
    h('span', { class: 'level-name' }, NAMES[lv]),
    h('span', { class: 'level-pic' }, sample ? photo(sample.image, { kind: 'zukan', label: '？' }) : null),
    h('span', { class: 'level-sub' }, SUBS[lv]));
  });

  const el = h('div', { class: 'level-wrap' },
    iconButton('🏠', 'マップに もどる', () => app.go('map'), 'home'),
    h('div', { class: 'place-title', style: { '--c': place.color } }, 'どれに ちょうせん する？'),
    h('div', { class: 'level-cards' }, cards));

  return {
    el,
    bg: { name: place.bg, color: place.color },
    enter() { voice.speak('どれに ちょうせん する？'); },
  };
}
