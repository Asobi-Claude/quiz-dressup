// 進み具合（キャラごと）と設定の、データ構造と保存・読み込み。
// 更新の関数は、元の progress を変えずに新しい progress を返す。
//
// 形:
// {
//   version: 2,
//   settings: { sfx: true, onara: true, voice: true },
//   chars: {
//     midori: {
//       wearing: { place: 'mushi', no: 2 } | null,
//       places: { mushi: { correct: 4, visits: 2, seen: ['mushi-03', ...],
//                          zukanSeen: { '1': ['mushi-monshirochou', ...], '2': [...] } } }
//     }
//   }
// }
// version 1（zukanSeen なし）の保存データも、そのまま読める（足りない項目は空で補う）。
// correct は、テキストのクイズとずかんクイズで共通の、その場所の累計正解数。
// seen はテキストのクイズ、zukanSeen はずかんクイズ（むずかしさごと）の「直近に出した問題」の記録。

export const STORAGE_KEY = 'quiz-dressup.progress.v1'; // 形は互換なので、キーは変えない
export const PROGRESS_VERSION = 2;
export const DEFAULT_SETTINGS = Object.freeze({ sfx: true, onara: true, voice: true });

export function defaultProgress() {
  return { version: PROGRESS_VERSION, settings: { ...DEFAULT_SETTINGS }, chars: {} };
}

const emptyPlace = () => ({ correct: 0, visits: 0, seen: [], zukanSeen: {} });
const ZUKAN_LEVEL_KEYS = ['1', '2', '3'];

/** zukanSeen を、{ '1': string[], '2': string[], '3': string[] }（ある分だけ）に直す */
function normalizeZukanSeen(raw) {
  const out = {};
  if (!isObj(raw)) return out;
  for (const k of ZUKAN_LEVEL_KEYS) {
    if (Array.isArray(raw[k])) out[k] = raw[k].filter((s) => typeof s === 'string');
  }
  return out;
}
const emptyChar = () => ({ wearing: null, places: {} });
const clone = (x) => JSON.parse(JSON.stringify(x));
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const nat = (x) => (Number.isInteger(x) && x >= 0 ? x : 0);

/** 読み込んだデータを、壊れていても使える形に直す */
export function normalizeProgress(raw) {
  const p = defaultProgress();
  if (!isObj(raw)) return p;
  if (isObj(raw.settings)) {
    for (const k of Object.keys(DEFAULT_SETTINGS)) {
      if (typeof raw.settings[k] === 'boolean') p.settings[k] = raw.settings[k];
    }
  }
  if (isObj(raw.chars)) {
    for (const [cid, c] of Object.entries(raw.chars)) {
      if (!isObj(c)) continue;
      const ch = emptyChar();
      if (isObj(c.wearing) && typeof c.wearing.place === 'string' && Number.isInteger(c.wearing.no)) {
        ch.wearing = { place: c.wearing.place, no: c.wearing.no };
      }
      if (isObj(c.places)) {
        for (const [pid, ps] of Object.entries(c.places)) {
          if (!isObj(ps)) continue;
          ch.places[pid] = {
            correct: nat(ps.correct),
            visits: nat(ps.visits),
            seen: Array.isArray(ps.seen) ? ps.seen.filter((s) => typeof s === 'string') : [],
            zukanSeen: normalizeZukanSeen(ps.zukanSeen),
          };
        }
      }
      p.chars[cid] = ch;
    }
  }
  return p;
}

// ---- 読むだけの関数 ----

export function getChar(progress, charId) {
  return progress.chars[charId] ?? emptyChar();
}

export function getPlace(progress, charId, placeId) {
  return getChar(progress, charId).places[placeId] ?? emptyPlace();
}

/** ずかんクイズで、そのむずかしさの「直近に出した種類のID」（なければ []） */
export function getZukanSeen(progress, charId, placeId, level) {
  const seen = getPlace(progress, charId, placeId).zukanSeen?.[String(level)];
  return Array.isArray(seen) ? seen.slice() : [];
}

/** その場所での累計正解数 */
export function totalCorrect(progress, charId, placeId) {
  return getPlace(progress, charId, placeId).correct;
}

/** 場所ごとの累計正解数 { placeId: n } */
export function totalsByPlace(progress, charId) {
  const out = {};
  for (const [pid, ps] of Object.entries(getChar(progress, charId).places)) out[pid] = ps.correct;
  return out;
}

export function hasVisited(progress, charId, placeId) {
  return getPlace(progress, charId, placeId).visits > 0;
}

export function getWearing(progress, charId) {
  return getChar(progress, charId).wearing;
}

// ---- 更新する関数（新しい progress を返す） ----

function updatePlace(progress, charId, placeId, fn) {
  const p = clone(progress);
  const ch = p.chars[charId] ?? (p.chars[charId] = emptyChar());
  const ps = ch.places[placeId] ?? (ch.places[placeId] = emptyPlace());
  fn(ps);
  return p;
}

export function addCorrect(progress, charId, placeId, n = 1) {
  return updatePlace(progress, charId, placeId, (ps) => { ps.correct += Math.max(0, n); });
}

export function recordVisit(progress, charId, placeId) {
  return updatePlace(progress, charId, placeId, (ps) => { ps.visits += 1; });
}

export function setSeen(progress, charId, placeId, seen) {
  return updatePlace(progress, charId, placeId, (ps) => { ps.seen = seen.slice(); });
}

/** ずかんクイズの記録を、そのむずかしさだけ書き換える（ほかのむずかしさ・元のデータは変えない） */
export function setZukanSeen(progress, charId, placeId, level, seen) {
  return updatePlace(progress, charId, placeId, (ps) => {
    ps.zukanSeen = { ...(isObj(ps.zukanSeen) ? ps.zukanSeen : {}), [String(level)]: seen.slice() };
  });
}

export function setWearing(progress, charId, wearing) {
  const p = clone(progress);
  const ch = p.chars[charId] ?? (p.chars[charId] = emptyChar());
  ch.wearing = wearing ? { place: wearing.place, no: wearing.no } : null;
  return p;
}

export function setSetting(progress, key, value) {
  const p = clone(progress);
  p.settings[key] = value;
  return p;
}

/** 1人のキャラの進み具合だけを消す（ほかのキャラと設定は残す） */
export function resetChar(progress, charId) {
  const p = clone(progress);
  delete p.chars[charId];
  return p;
}

/** 進み具合を消す（設定は残す） */
export function resetProgress(progress) {
  return { ...defaultProgress(), settings: { ...progress.settings } };
}

// ---- 保存と読み込み ----

/**
 * storage は localStorage と同じ形（getItem / setItem / removeItem）。
 * 保存できない環境（プライベートモードなど）でも止まらない。
 */
export function createStore(storage, key = STORAGE_KEY) {
  return {
    load() {
      try {
        const s = storage?.getItem(key);
        return normalizeProgress(s ? JSON.parse(s) : null);
      } catch {
        return defaultProgress();
      }
    },
    save(progress) {
      try {
        storage?.setItem(key, JSON.stringify(progress));
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      try { storage?.removeItem(key); } catch { /* 何もしない */ }
    },
  };
}

/** テスト用: メモリだけに保存する storage */
export function memoryStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}
