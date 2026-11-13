// 効果音。音声ファイルは使わず、Web Audio で合成する（小さめの音量）。設定でOFFにできる。

let ctx = null;
let master = null;
let enabled = true;
const VOLUME = 0.16;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = VOLUME;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone({ freq, to, type = 'sine', start = 0, dur = 0.15, vol = 1, attack = 0.01 }) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise({ start = 0, dur = 0.12, vol = 0.6, filter = 2000, q = 1 }) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + start;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = filter;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}

const SOUNDS = {
  tap() { tone({ freq: 660, to: 880, dur: 0.08, vol: 0.5 }); },
  correct() {
    [784, 988, 1175, 1568].forEach((f, i) => tone({ freq: f, start: i * 0.09, dur: 0.25, vol: 0.7, type: 'triangle' }));
  },
  // 不正解: こわくない、ぽよん という音
  wrong() {
    tone({ freq: 440, to: 330, dur: 0.18, vol: 0.5, type: 'sine' });
    tone({ freq: 330, to: 392, start: 0.16, dur: 0.2, vol: 0.4, type: 'sine' });
  },
  sparkle() {
    [1319, 1568, 2093, 2637, 3136].forEach((f, i) => tone({ freq: f, start: i * 0.06, dur: 0.3, vol: 0.35, type: 'sine' }));
  },
  unlock() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, start: i * 0.08, dur: 0.4, vol: 0.5, type: 'triangle' }));
  },
  star() { tone({ freq: 1047, to: 1568, dur: 0.18, vol: 0.5, type: 'triangle' }); },
  // ぱしゃっ（写真）
  shutter() {
    noise({ dur: 0.05, vol: 0.9, filter: 3500, q: 0.7 });
    noise({ start: 0.07, dur: 0.09, vol: 0.7, filter: 2200, q: 0.7 });
  },
  // おなら: 小さく、低く、ぷるぷる
  onara() {
    const c = ac();
    if (!c) return;
    const t0 = c.currentTime;
    const o = c.createOscillator();
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    const g = c.createGain();
    const f = c.createBiquadFilter();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(110, t0);
    o.frequency.exponentialRampToValueAtTime(70, t0 + 0.6);
    lfo.frequency.value = 28;
    lfoGain.gain.value = 25;
    lfo.connect(lfoGain).connect(o.frequency);
    f.type = 'lowpass';
    f.frequency.value = 600;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.5, t0 + 0.04);
    g.gain.setValueAtTime(0.5, t0 + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.65);
    o.connect(f).connect(g).connect(master);
    o.start(t0); lfo.start(t0);
    o.stop(t0 + 0.7); lfo.stop(t0 + 0.7);
  },
  pop() { tone({ freq: 520, to: 1040, dur: 0.1, vol: 0.5 }); },
};

export const sfx = {
  setEnabled(v) { enabled = v; },
  isEnabled() { return enabled; },
  /** 最初のタップで呼ぶ（音を出せるようにする） */
  unlock() { try { ac(); } catch { /* 何もしない */ } },
  play(name) {
    if (!enabled) return;
    try { SOUNDS[name]?.(); } catch { /* 音が出なくても遊べる */ }
  },
};
