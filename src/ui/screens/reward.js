// ごほうび（解放の演出）
import { h, sleep } from '../dom.js';
import { bigButton, stars } from '../common.js';
import { createWitch } from '../witch.js';
import { picture } from '../images.js';
import { sparkleAt } from '../effects.js';
import { voice } from '../../audio/voice.js';
import { sfx } from '../../audio/sfx.js';
import { rewardSummary } from '../../logic/game.js';
import { roundCorrectCount, MODE_HIICHAN } from '../../logic/quiz.js';

export function rewardScreen(app) {
  const { placeId, round, totalBefore } = app.visit;
  const place = app.place(placeId);
  const hii = app.mode === MODE_HIICHAN;
  const n = roundCorrectCount(round);
  const total = round.questions.length;
  const s = rewardSummary(app.game, app.progress, app.charId, placeId, totalBefore, n);
  app.visit.summary = s;
  const witch = createWitch(app, { cls: 'witch-reward' });
  const tok = app.token;

  const starRow = stars(total, 0, 'reward-stars');
  const headline = h('p', { class: 'reward-headline' },
    hii ? 'ぜんぶ できたね！' : n === total ? 'ぜんぶ せいかい！' : n > 0 ? `${n}もん せいかい！` : 'よく がんばったね！');

  const newCards = s.newly.map((l) => h('div', { class: `look-card is-hidden ${l.special ? 'is-special' : ''}` },
    picture(l.image, { kind: 'char', label: l.name }),
    h('span', { class: 'look-card-name' }, l.name)));

  const teaser = s.next ? h('div', { class: 'teaser' },
    h('div', { class: 'look-card is-locked' },
      picture(s.next.image, { kind: 'char', label: 'ひみつの ドレス' }),
      h('span', { class: 'lock', 'aria-hidden': 'true' }, '🔒')),
    h('div', { class: 'teaser-text' },
      h('span', {}, 'つぎの ドレスまで'),
      h('span', { class: 'teaser-count' }, `あと ${s.remaining}もん`),
      stars(s.remaining, 0, 'teaser-stars'))) : null;

  const goBtn = bigButton('👗', 'きがえる', () => app.go('dressup'), 'go dress is-later');

  const el = h('div', { class: 'reward-wrap' },
    h('div', { class: 'reward-card' },
      headline,
      starRow,
      h('div', { class: 'reward-row' },
        newCards.length ? h('div', { class: 'reward-new' },
          h('p', { class: 'reward-new-title' }, 'あたらしい ドレス！'),
          h('div', { class: 'reward-new-cards' }, newCards)) : null,
        teaser)),
    witch.el,
    goBtn);

  return {
    el,
    bg: { name: place.bg, color: place.color },
    async enter() {
      voice.speak(headline.textContent);
      // 星をひとつずつ
      const starEls = [...starRow.children];
      for (let i = 0; i < (hii ? total : n); i++) {
        await sleep(450);
        if (!tok.alive) return;
        starEls[i].classList.add('is-on', 'pop');
        sfx.play('star');
      }
      await sleep(500);
      if (!tok.alive) return;
      // 新しいドレスをひとつずつ見せる
      for (const [i, card] of newCards.entries()) {
        card.classList.remove('is-hidden');
        card.classList.add('reveal');
        sfx.play('unlock');
        sparkleAt(app.stage, card, { count: s.newly[i].special ? 26 : 16 });
        await sleep(650);
        if (!tok.alive) return;
      }
      goBtn.classList.remove('is-later');
      const scene = s.newly.some((l) => l.special) ? 'rewardSpecial' : s.newly.length ? 'rewardNew' : 'rewardNone';
      await witch.sayScene(scene);
      if (!tok.alive) return;
      if (s.newly.length) await voice.speakAll(s.newly.map((l) => ({ text: l.name, key: `look:${l.id}` })));
      else if (s.next) await voice.speak(`つぎの ドレスまで、あと ${s.remaining}もん`);
    },
  };
}
