// クイズ（1問ずつ）＋ 正解・不正解と解説
import { h, sleep } from '../dom.js';
import { bigButton, iconButton, confirmDialog } from '../common.js';
import { createWitch } from '../witch.js';
import { picture, placeholder, preload } from '../images.js';
import { sparkleAt } from '../effects.js';
import { voice } from '../../audio/voice.js';
import { sfx } from '../../audio/sfx.js';
import {
  buildChoices, currentQuestion, firstSentence, isLastQuestion, nextQuestion, choiceImages, MODE_HIICHAN,
} from '../../logic/quiz.js';
import { answer, quitVisit } from '../../logic/game.js';
import { pickLine } from '../../logic/witch.js';

const IDLE_MS = 12000;
const MAX_IDLE = 3;

export function quizScreen(app) {
  const { placeId } = app.visit;
  const place = app.place(placeId);
  let round = app.visit.round;
  const q = currentQuestion(round);
  const hii = app.mode === MODE_HIICHAN;
  const choices = buildChoices(q, app.mode, app.game.imagesMap);
  const witch = createWitch(app, { cls: 'witch-quiz' });
  const tok = app.token;

  let seq = 0;            // 答えるたびに増える（古い演出の続きを止めるため）
  let answered = false;
  let idleTimer = null;
  let idleCount = 0;

  // 選択肢の読み上げキー（録音に差し替えるとき用）
  const keyOf = (c) => (c.correct ? `a:${q.id}` : `w:${q.id}:${q.wrong.indexOf(c.text)}`);

  // ---- 部品 ----
  const dots = h('div', { class: 'qdots', 'aria-label': `${round.index + 1} / ${round.questions.length}` },
    round.questions.map((_, i) => h('i', {
      class: i < round.index ? 'is-done' : i === round.index ? 'is-now' : '',
    }, i < round.index ? '★' : '')));

  const qtext = h('p', { class: 'qtext' }, q.q);
  const qbox = h('div', { class: 'qbox' },
    qtext,
    iconButton('🔊', 'もういちど きく', () => readAll(), 'speaker'));

  const choiceEls = choices.map((c, i) => {
    const btn = h('button', {
      class: `choice ${c.image ? 'has-pic' : 'no-pic'}`,
      type: 'button',
      'aria-label': c.text,
      dataset: { correct: String(c.correct), index: String(i) },
      onTap: () => onChoose(c, btn),
    },
    c.image || hii ? h('span', { class: 'choice-pic' },
      c.image ? picture(c.image, { kind: 'choice', label: c.text }) : placeholder(c.text, { kind: 'choice' })) : null,
    h('span', { class: 'choice-text' }, c.text));
    return btn;
  });
  const grid = h('div', { class: `choices n${choices.length}` }, choiceEls);
  const panelSlot = h('div', { class: 'panel-slot' });

  const el = h('div', { class: 'quiz-wrap' },
    iconButton('🏠', 'マップに もどる', onHome, 'home'),
    dots,
    qbox,
    grid,
    witch.el,
    panelSlot);

  // ---- 読み上げ ----
  async function readAll() {
    clearIdle();
    const items = [{ text: q.q, key: `q:${q.id}` }];
    choiceEls.forEach((btn, i) => {
      if (btn.disabled) return;
      items.push({
        text: choices[i].text,
        key: keyOf(choices[i]),
        onStart: () => btn.classList.add('is-reading'),
        onEnd: () => btn.classList.remove('is-reading'),
      });
    });
    const finished = await voice.speakAll(items);
    choiceEls.forEach((b) => b.classList.remove('is-reading'));
    if (finished && !answered && tok.alive) startIdle();
  }

  function startIdle() {
    clearIdle();
    if (idleCount >= MAX_IDLE) return;
    idleTimer = setTimeout(async () => {
      if (answered || !tok.alive) return;
      idleCount++;
      const my = seq;
      if (!(await witch.maybeOnara())) await witch.sayScene('idle');
      if (my === seq && !answered && tok.alive) startIdle();
    }, IDLE_MS);
  }
  function clearIdle() { clearTimeout(idleTimer); idleTimer = null; }

  // ---- 答える ----
  function onChoose(c, btn) {
    if (answered || btn.disabled || !tok.alive) return;
    clearIdle();
    voice.cancel();
    const my = ++seq;
    const res = answer(app.progress, round, app.charId, placeId, c.correct);
    app.save(res.progress);
    round = res.round;
    app.visit.round = round;
    if (res.event.type === 'correct') onCorrect(res.event, c, btn, my);
    else onWrong(res.event, btn, my);
  }

  async function onCorrect(event, c, btn, my) {
    answered = true;
    sfx.play('correct');
    btn.classList.add('is-correct');
    choiceEls.forEach((b) => { if (b !== btn) b.classList.add('is-dim'); b.classList.remove('is-glow'); });
    sparkleAt(app.stage, btn, { count: 18 });
    const scene = event.firstTry || hii ? 'correct' : 'correctRetry';
    const line = pickLine(app.game.witch, app.mode, scene);
    await witch.say(line);
    if (my !== seq || !tok.alive) return;
    showPanel(c);
  }

  async function onWrong(event, btn, my) {
    sfx.play('wrong');
    btn.classList.remove('wiggle');
    void btn.offsetWidth;
    btn.classList.add('wiggle');
    if (!hii) {
      btn.disabled = true;
      btn.classList.add('is-out');
    } else {
      // ひーちゃんモード: 正解の絵をキラキラ光らせて、押してもらうのを待つ
      choiceEls.forEach((b) => b.classList.toggle('is-glow', b.dataset.correct === 'true'));
    }
    await witch.sayScene('wrong');
    if (my !== seq || !tok.alive) return;
    if (await witch.maybeOnara()) { if (my !== seq || !tok.alive) return; }
    if (event.showHint) {
      if (hii) {
        await witch.sayScene('hint');
      } else {
        const hint = firstSentence(q.explain);
        await witch.sayScene('hint');
        if (my !== seq || !tok.alive) return;
        witch.show(`ヒント: ${hint}`);
        await voice.speak(hint);
      }
    }
    if (my === seq && tok.alive) startIdle();
  }

  // ---- 解説 ----
  function showPanel(c) {
    const last = isLastQuestion(round);
    const imgs = choiceImages(q, app.game.imagesMap);
    const next = () => {
      if (last) { app.go('reward'); return; }
      round = nextQuestion(round);
      app.visit.round = round;
      app.go('quiz');
    };
    const panel = h('div', { class: 'panel' },
      h('div', { class: 'panel-answer' },
        imgs[0] && (c.image || hii) ? h('span', { class: 'panel-pic' }, picture(imgs[0], { kind: 'choice', label: q.answer })) : null,
        h('span', { class: 'hanamaru', 'aria-hidden': 'true' }),
        h('span', { class: 'panel-answer-text' }, q.answer)),
      h('div', { class: 'panel-body' },
        h('p', { class: 'panel-explain' }, q.explain),
        h('div', { class: 'panel-actions' },
          iconButton('🔊', 'もういちど きく', () => voice.speak(q.explain, { key: `e:${q.id}` }), 'speaker'),
          last ? bigButton('🎁', 'ごほうび', next, 'go next') : bigButton('▶', 'つぎへ', next, 'go next'))));
    panelSlot.replaceChildren(panel);
    el.classList.add('has-panel');
    voice.speak(q.explain, { key: `e:${q.id}` });
  }

  // ---- やめる ----
  async function onHome() {
    clearIdle();
    voice.cancel();
    const yes = await confirmDialog(app.stage, {
      text: 'マップに もどる？', yesIcon: '🗺️', yesLabel: 'もどる', noIcon: '▶', noLabel: 'つづける',
    });
    if (!yes || !tok.alive) { if (!answered) startIdle(); return; }
    app.save(quitVisit(app.progress, round, app.charId, placeId));
    app.visit = null;
    app.go('map');
  }

  // つぎの問題の絵を先に読む
  const nq = round.questions[round.index + 1];
  if (nq) preload(choiceImages(nq, app.game.imagesMap).filter(Boolean));

  return {
    el,
    bg: { name: place.bg, color: place.color },
    async enter() {
      await sleep(150);
      if (!tok.alive) return;
      const my = seq;
      await witch.sayScene(round.index === 0 ? 'firstQuestion' : 'beforeQuestion');
      if (my !== seq || !tok.alive || answered) return;
      readAll();
    },
  };
}
