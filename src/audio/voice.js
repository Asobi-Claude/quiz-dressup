// 読み上げ（音声）。ゲームの音声はすべてこのモジュールを通す。
//
// 今はブラウザの音声合成（ja-JP）。あとで録音音声に差し替えるときは、
// data/voice-map.json に { "キー または 文そのもの": "audio/ファイル名.mp3" } を書くと、
// そのキー（なければ文）に録音があるときだけ録音を再生する。
// キーの決まり: q:問題ID（問題文）、a:問題ID（正解）、w:問題ID:番号（不正解 0〜2）、e:問題ID（解説）、
//              place:場所ID（場所の名前）、look:ルックID（ルックの名前）。魔女のセリフは文そのもので引く。
// ずかんクイズ: zukan:ずかんの項目ID（その名前。選択肢・正解のあと）、zukan-which:項目ID（「◯◯は どっち？」）、
//              zukan-ask:（「これは なあに？」。全問共通）。

/** 読み上げ用に文を整える（かっこ・なかぐろは「、」にして、間を取る） */
export function speechText(text) {
  return String(text ?? '')
    .replace(/[（(]/g, '、')
    .replace(/[）)]/g, '、')
    .replace(/・/g, '、')
    .replace(/…+/g, '、')
    .replace(/、{2,}/g, '、')
    .replace(/^、|、$/g, '')
    .trim();
}

/** 録音のファイルを探す（キー → 文そのもの の順） */
export function resolveRecorded(map, key, text) {
  if (!map) return null;
  if (key && typeof map[key] === 'string') return map[key];
  if (text && typeof map[text] === 'string') return map[text];
  return null;
}

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
let enabled = true;
let recordedMap = {};
let jaVoice = null;
let currentAudio = null;
let generation = 0; // cancel するたびに増える。古い読み上げの続きを止めるため

function pickVoice() {
  if (!synth) return;
  const voices = synth.getVoices();
  const ja = voices.filter((v) => /^ja[-_]?/i.test(v.lang));
  // ローカルの声（オフラインで使える）を優先
  jaVoice = ja.find((v) => v.localService) ?? ja[0] ?? null;
}
if (synth) {
  pickVoice();
  synth.addEventListener?.('voiceschanged', pickVoice);
}

export const voice = {
  setEnabled(v) { enabled = v; if (!v) voice.cancel(); },
  isEnabled() { return enabled; },
  setRecordedMap(m) { recordedMap = m ?? {}; },
  hasJapanese() { return !!jaVoice; },

  /** 最初のタップのときに呼ぶ（Android の Chrome は、タップのあとでないと声が出ないことがある） */
  unlock() {
    if (!synth) return;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      synth.speak(u);
    } catch { /* 何もしない */ }
  },

  cancel() {
    generation++;
    try { synth?.cancel(); } catch { /* 何もしない */ }
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  },

  /**
   * 1つ読む。読み終わったら（または止められたら）解決する Promise を返す。
   * opts.key: 録音を探すキー、opts.rate: 速さ
   */
  speak(text, opts = {}) {
    voice.cancel();
    return voice._speakOne(text, opts, generation);
  },

  /** いくつかを順番に読む。items は文字列 か {text, key, onStart} */
  async speakAll(items) {
    voice.cancel();
    const gen = generation;
    for (const it of items) {
      if (gen !== generation) return false;
      const item = typeof it === 'string' ? { text: it } : it;
      item.onStart?.();
      await voice._speakOne(item.text, item, gen);
      item.onEnd?.();
    }
    return gen === generation;
  },

  _speakOne(text, opts, gen) {
    if (!enabled || !text) return Promise.resolve();
    const file = resolveRecorded(recordedMap, opts.key, text);
    if (file) return playFile(file, gen);
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return Promise.resolve();
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(speechText(text));
      u.lang = 'ja-JP';
      if (jaVoice) u.voice = jaVoice;
      u.rate = opts.rate ?? 0.95;
      u.pitch = 1.1;
      let done = false;
      const finish = () => { if (!done) { done = true; clearTimeout(timer); resolve(); } };
      u.onend = finish;
      u.onerror = finish;
      // onend が来ない端末があるので、文の長さから決めた時間で先に進む
      // （日本語の読み上げは 1文字 0.15秒ほど。少し余裕をみる）
      const timer = setTimeout(finish, 1200 + String(text).length * 200);
      if (gen !== generation) { finish(); return; }
      try { synth.speak(u); } catch { finish(); }
    });
  },
};

function playFile(file, gen) {
  return new Promise((resolve) => {
    if (gen !== generation) { resolve(); return; }
    const a = new Audio(file);
    currentAudio = a;
    a.onended = () => resolve();
    a.onerror = () => resolve();
    a.play().catch(() => resolve());
  });
}
