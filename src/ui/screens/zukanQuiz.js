// ずかんクイズ（1問ずつ）
//   みーちゃん: 写真を見て、名前を4択から選ぶ（image-to-name）
//   ひーちゃん: 名前を声で聞いて、2枚の写真から選ぶ（name-to-image）
// 正解は、その場所の累計正解数に足される（game.answer）。魔女のセリフは出さない。
import { h, sleep } from '../dom.js';
import { bigButton, iconButton, confirmDialog } from '../common.js';
import { photo, photoUrl } from '../images.js';
import { sparkleAt } from '../effects.js';
import { voice } from '../../audio/voice.js';
import { sfx } from '../../audio/sfx.js';
import { currentQuestion, isLastQuestion, nextQuestion } from '../../logic/quiz.js';
import { answer, quitZukanVisit } from '../../logic/game.js';

export function zukanQuizScreen(app) {
  const { placeId, level } = app.visit;
  const place = app.place(placeId);
  let round = app.visit.round;
  const q = currentQuestion(round);
  const toImage = q.kind === 'name-to-image';
  const tok = app.token;

  let seq = 0;          // 答えるたびに増える（古い演出の続きを止めるため）
  let answered = false; // 正解したら true。連打しても、二重に数えない

  // 声には、名前ではなく「読み」（ひらがな）を使う（「N700S」「火星」なども、読み間違えないように）。
  // ひーちゃんの問いは、字が読めなくても、画面もひらがなにする
  const promptText = toImage ? `${q.item.reading}は どっち？` : 'これは なあに？';
  const nameKey = (itemId) => `zukan:${itemId}`;

  // ---- 部品 ----
  const dots = h('div', { class: 'qdots', 'aria-label': `${round.index + 1} / ${round.questions.length}` },
    round.questions.map((_, i) => h('i', {
      class: i < round.index ? 'is-done' : i === round.index ? 'is-now' : '',
    }, i < round.index ? '★' : '')));

  const ask = h('div', { class: 'zq-ask' },
    h('span', { class: 'zq-ask-text' }, promptText),
    iconButton('🔊', 'もういちど きく', () => readAll(), 'speaker'));

  const choiceEls = q.choices.map((c, i) => h('button', {
    class: toImage ? 'choice zq-pic-choice' : 'choice zq-choice',
    type: 'button',
    'aria-label': toImage ? 'しゃしん' : c.name,
    dataset: { correct: String(c.correct), index: String(i), item: c.itemId },
    onTap: () => onChoose(c, choiceEls[i]),
  },
  toImage
    ? photo(c.image, { kind: 'zukan', label: '？' })
    : [h('span', { class: 'zq-reading' }, c.reading), h('span', { class: 'choice-text' }, c.name)]));

  const stage = toImage
    ? h('div', { class: 'zq-two' }, choiceEls)
    : [h('div', { class: 'zq-photo' }, photo(q.item.image, { kind: 'zukan', label: '？' })),
      h('div', { class: 'zq-choices' }, choiceEls)];

  const panelSlot = h('div', { class: 'panel-slot' });
  const el = h('div', { class: 'zq-wrap' },
    iconButton('🏠', 'マップに もどる', onHome, 'home'),
    dots,
    ask,
    stage,
    panelSlot);

  // ---- 読み上げ ----
  async function readAll() {
    voice.cancel();
    const items = [{ text: promptText, key: toImage ? `zukan-which:${q.id}` : 'zukan-ask' }];
    if (!toImage) {
      choiceEls.forEach((btn, i) => {
        if (btn.disabled) return;
        items.push({
          text: q.choices[i].reading,
          key: nameKey(q.choices[i].itemId),
          onStart: () => btn.classList.add('is-reading'),
          onEnd: () => btn.classList.remove('is-reading'),
        });
      });
    }
    await voice.speakAll(items);
    choiceEls.forEach((b) => b.classList.remove('is-reading'));
  }

  // ---- 答える ----
  function onChoose(c, btn) {
    if (answered || btn.disabled || !tok.alive) return;
    if (c.correct) answered = true; // answer() を呼ぶ前に立てる（続けて押されても、二重に数えない）
    voice.cancel();
    const my = ++seq;
    const res = answer(app.progress, round, app.charId, placeId, c.correct);
    app.save(res.progress);
    round = res.round;
    app.visit.round = round;
    if (res.event.type === 'correct') onCorrect(btn, my);
    else onWrong(res.event, c, btn, my);
  }

  async function onCorrect(btn, my) {
    sfx.play('correct');
    btn.classList.add('is-correct');
    choiceEls.forEach((b) => { if (b !== btn) b.classList.add('is-dim'); b.classList.remove('is-glow'); });
    sparkleAt(app.stage, btn, { count: 18 });
    await sleep(750);
    if (my !== seq || !tok.alive) return;
    showPanel();
  }

  async function onWrong(event, c, btn, my) {
    sfx.play('wrong');
    btn.classList.remove('wiggle');
    void btn.offsetWidth;
    btn.classList.add('wiggle');
    if (!toImage) { // 名前の選択肢は、押したものをうすくして、押せなくする
      btn.disabled = true;
      btn.classList.add('is-out');
    }
    // ひーちゃんは、すぐ正解を光らせる。みーちゃんは、2回目の間違いから
    if (event.showHint) choiceEls.forEach((b) => b.classList.toggle('is-glow', b.dataset.correct === 'true'));
    await sleep(250);
    if (my !== seq || !tok.alive) return;
    if (toImage) voice.speak(promptText);
    else voice.speak(c.reading, { key: nameKey(c.itemId) }); // 押した名前を聞かせる
  }

  // ---- 正解のあと: 写真と名前を見せて、次へ ----
  function showPanel() {
    const last = isLastQuestion(round);
    const next = () => {
      if (last) { app.go('reward'); return; }
      round = nextQuestion(round);
      app.visit.round = round;
      app.go('zukanQuiz');
    };
    const panel = h('div', { class: 'zq-panel' },
      h('div', { class: 'zq-panel-pic' }, photo(q.item.image, { kind: 'zukan', label: q.item.name })),
      h('div', { class: 'zq-panel-body' },
        h('div', { class: 'zq-panel-answer' },
          h('span', { class: 'hanamaru', 'aria-hidden': 'true' }),
          h('div', { class: 'zq-panel-name' }, q.item.name),
          h('div', { class: 'zq-panel-reading' }, q.item.reading)),
        h('div', { class: 'panel-actions' },
          iconButton('🔊', 'もういちど きく', () => voice.speak(q.item.reading, { key: nameKey(q.item.id) }), 'speaker'),
          last ? bigButton('🎁', 'ごほうび', next, 'go next') : bigButton('▶', 'つぎへ', next, 'go next'))));
    panelSlot.replaceChildren(panel);
    el.classList.add('has-panel');
    voice.speak(q.item.reading, { key: nameKey(q.item.id) });
  }

  // ---- やめる ----
  async function onHome() {
    voice.cancel();
    const yes = await confirmDialog(app.stage, {
      text: 'マップに もどる？', yesIcon: '🗺️', yesLabel: 'もどる', noIcon: '▶', noLabel: 'つづける',
    });
    if (!yes || !tok.alive) return;
    app.save(quitZukanVisit(app.progress, round, app.charId, placeId, level));
    app.visit = null;
    app.go('map');
  }

  // つぎの問題の写真を先に読む
  const nq = round.questions[round.index + 1];
  if (nq) {
    const paths = nq.kind === 'name-to-image' ? nq.choices.map((c) => c.image) : [nq.item.image];
    for (const p of paths) new Image().src = photoUrl(p);
  }

  return {
    el,
    bg: { name: place.bg, color: place.color },
    async enter() {
      await sleep(150);
      if (!tok.alive) return;
      readAll();
    },
  };
}
