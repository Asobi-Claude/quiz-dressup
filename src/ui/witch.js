// かーちゃん魔女（表情5種類＋ふきだし）
import { h, sleep } from './dom.js';
import { picture } from './images.js';
import { voice } from '../audio/voice.js';
import { sfx } from '../audio/sfx.js';
import { pickLine, onaraLines, shouldOnara } from '../logic/witch.js';
import { shake, smoke, burstText, rectIn } from './effects.js';

/**
 * app: { game, stage, mode, settings(), token }
 * opts.bubble: ふきだしを出すか（出さない画面は、ほかの場所にセリフを書く）
 */
export function createWitch(app, { cls = '', bubble = true, tappable = true } = {}) {
  const faces = app.game.witch?.faces ?? {};
  const faceEls = {};
  const body = h('div', { class: 'witch-body' });
  for (const [face, image] of Object.entries(faces)) {
    const p = picture(image, { kind: 'witch', label: 'かーちゃん まじょ' });
    p.dataset.face = face;
    faceEls[face] = p;
    body.appendChild(p);
  }
  const bubbleEl = bubble ? h('div', { class: 'bubble witch-bubble is-empty' }) : null;
  const el = h('div', { class: `witch ${cls}` }, body, bubbleEl);
  let busy = false;

  function setFace(face) {
    const f = faceEls[face] ? face : 'normal';
    for (const [k, e] of Object.entries(faceEls)) e.classList.toggle('is-on', k === f);
    el.dataset.face = f;
  }
  setFace('normal');

  function show(text) {
    if (!bubbleEl) return;
    bubbleEl.textContent = text;
    bubbleEl.classList.toggle('is-empty', !text);
    bubbleEl.classList.remove('pop');
    void bubbleEl.offsetWidth;
    bubbleEl.classList.add('pop');
  }

  const witch = {
    el,
    setFace,
    show,
    /** セリフを言う（ふきだし＋表情＋読み上げ）。読み終わると解決 */
    async say(line, { speak = true } = {}) {
      if (!line?.text) return;
      setFace(line.face);
      show(line.text);
      if (speak) await voice.speak(line.text);
    },
    /** 場面のセリフを選んで言う */
    sayScene(scene, vars) {
      return witch.say(pickLine(app.game.witch, app.mode, scene, Math.random, vars));
    },
    /** 確率でおならぶー！。出したら true */
    async maybeOnara() {
      if (!shouldOnara(app.game.witch, app.settings().onara)) return false;
      await witch.onara();
      return true;
    },
    /** おならぶー！（画面がゆれ、緑のけむり、みんなで笑う） */
    async onara() {
      const tok = app.token;
      const [boo, after] = onaraLines(app.game.witch);
      sfx.play('onara');
      shake(app.stage.firstElementChild ?? app.stage); // 舞台そのものは拡大・縮小に transform を使うので、中の画面をゆらす
      const r = rectIn(app.stage, body);
      smoke(app.stage, r.x + r.w * 0.75, r.y + r.h * 0.8);
      burstText(app.stage, boo?.text ?? 'おならぶー！', 'fx-boo');
      await witch.say(boo);
      if (!tok.alive) return;
      await sleep(250);
      if (after && tok.alive) await witch.say(after);
    },
  };

  if (tappable) {
    body.classList.add('is-tappable');
    body.addEventListener('click', async () => {
      if (busy || app.isBusy?.()) return;
      busy = true;
      sfx.play('pop');
      body.classList.remove('boing');
      void body.offsetWidth;
      body.classList.add('boing');
      try {
        if (!(await witch.maybeOnara())) await witch.sayScene('tap');
      } finally {
        busy = false;
      }
    });
  }
  return witch;
}
