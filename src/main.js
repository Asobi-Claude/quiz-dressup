// 起動と画面の切り替え
import { loadData } from './data.js';
import { createStore, getWearing, totalsByPlace, setSetting } from './logic/progress.js';
import { resolveWearing } from './logic/unlock.js';
import { modeOf } from './logic/game.js';
import { setManifest, setZukanVersion, background } from './ui/images.js';
import { voice } from './audio/voice.js';
import { sfx } from './audio/sfx.js';
import { h, markNavigation } from './ui/dom.js';
import { titleScreen } from './ui/screens/title.js';
import { mapScreen } from './ui/screens/map.js';
import { entranceScreen } from './ui/screens/entrance.js';
import { chooseScreen } from './ui/screens/choose.js';
import { levelScreen } from './ui/screens/level.js';
import { quizScreen } from './ui/screens/quiz.js';
import { zukanQuizScreen } from './ui/screens/zukanQuiz.js';
import { rewardScreen } from './ui/screens/reward.js';
import { dressupScreen } from './ui/screens/dressup.js';
import { ohiromeScreen } from './ui/screens/ohirome.js';

const SCREENS = {
  title: titleScreen,
  map: mapScreen,
  entrance: entranceScreen,
  choose: chooseScreen,
  level: levelScreen,
  quiz: quizScreen,
  zukanQuiz: zukanQuizScreen,
  reward: rewardScreen,
  dressup: dressupScreen,
  ohirome: ohiromeScreen,
};

const STAGE_W = 1280;
const STAGE_H = 720;

class App {
  constructor(game, store) {
    this.game = game;
    this.store = store;
    this.progress = store.load();
    this.charId = null;
    this.visit = null; // いま遊んでいる場所の情報 { placeId, round, totalBefore, summary }
    this.token = { alive: true };
    this.busy = false;
    this.stage = document.getElementById('stage');
    this.backdrop = document.getElementById('backdrop');
    this.applySettings();
    this.fit();
    const refit = () => this.fit();
    window.addEventListener('resize', refit);
    window.addEventListener('orientationchange', () => { [100, 300, 800].forEach((ms) => setTimeout(refit, ms)); }); // 回したあと、タブレットが古い大きさを返すことがある
    window.visualViewport?.addEventListener('resize', refit); // アドレスバー・ツールバーの出入り
  }

  get mode() { return modeOf(this.game, this.charId); }
  get char() { return this.game.characters.find((c) => c.id === this.charId); }
  place(id) { return this.game.places.find((p) => p.id === id); }
  settings() { return this.progress.settings; }
  isBusy() { return this.busy; }

  save(progress) {
    this.progress = progress;
    this.store.save(progress);
  }

  setSetting(key, value) {
    this.save(setSetting(this.progress, key, value));
    this.applySettings();
  }

  applySettings() {
    const s = this.progress.settings;
    sfx.setEnabled(s.sfx);
    voice.setEnabled(s.voice);
  }

  /** 着ているルック（解放済みのものだけ。なければ null＝素体） */
  wearingLook(charId = this.charId) {
    return resolveWearing(getWearing(this.progress, charId), this.game.looks, charId, totalsByPlace(this.progress, charId));
  }

  /** 舞台（1280×720）を画面に合わせて拡大・縮小する */
  fit() {
    const vv = window.visualViewport;
    const w = vv?.width || window.innerWidth;
    const h = vv?.height || window.innerHeight;
    const s = Math.min(w / STAGE_W, h / STAGE_H);
    this.stage.style.transform = `translate(-50%, -50%) scale(${s})`;
    document.documentElement.style.setProperty('--stage-scale', s);
  }

  /** 画面を切り替える */
  go(name, params = {}) {
    voice.cancel();
    this.token.alive = false;
    this.token = { alive: true };
    this.busy = false;
    const screen = SCREENS[name](this, params);
    const bgEl = background(screen.bg?.name ?? 'bg_title', { color: screen.bg?.color });
    const scr = h('div', { class: `screen screen-${name} mode-${this.mode}` }, bgEl, screen.el);
    this.stage.replaceChildren(scr);
    markNavigation(); // 切り替えた直後の連打が、新しい画面のボタンに届かないように
    this.stage.dataset.screen = name;
    // 舞台の外（すきま）にも同じ背景をぼかして敷く
    this.backdrop.replaceChildren(bgEl.cloneNode(true));
    screen.enter?.();
  }
}

function showFatal(msg) {
  document.getElementById('stage').replaceChildren(
    h('div', { class: 'fatal' }, h('p', {}, 'よみこみに しっぱいしました'), h('pre', {}, msg)));
}

async function boot() {
  let game;
  try {
    game = await loadData('./');
  } catch (e) {
    showFatal(String(e?.message ?? e));
    return;
  }
  setManifest(game.assetsManifest);
  setZukanVersion(game.zukanVersion);
  voice.setRecordedMap(game.voiceMap);
  const app = new App(game, createStore(window.localStorage));
  window.__app = app; // 動作確認用
  app.go('title');

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
    // 画像を取り込み直したときなど、まだ保存していない画像を保存してもらう
    navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage('refresh-images')).catch(() => {});
  }
}

boot();
