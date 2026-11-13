// かーちゃん魔女のセリフ選び（画面と関係なし）
import { pickOne, defaultRng } from './rng.js';

const FALLBACK = { text: '', face: 'normal' };

/** {place} や {n} を置きかえる */
export function fillVars(text, vars = {}) {
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

function finish(witch, line, vars) {
  const face = line?.face && witch?.faces?.[line.face] ? line.face : 'normal';
  return {
    text: fillVars(line?.text ?? '', vars),
    face,
    image: witch?.faces?.[face] ?? 'witch_01_normal',
  };
}

/** 場面（scene）のセリフを1つ選ぶ。モードにない場面は空のセリフ */
export function pickLine(witch, mode, scene, rng = defaultRng, vars = {}) {
  const list = witch?.modes?.[mode]?.[scene];
  return finish(witch, pickOne(list, rng) ?? FALLBACK, vars);
}

/** 場所の入口のセリフ（場所ごとのあいさつ → ふつうのあいさつ） */
export function entranceLines(witch, mode, place, rng = defaultRng) {
  const vars = { place: place.name };
  const lines = [];
  const own = witch?.places?.[place.id]?.[mode];
  if (own?.length) lines.push(finish(witch, pickOne(own, rng), vars));
  lines.push(pickLine(witch, mode, 'entrance', rng, vars));
  return lines.filter((l) => l.text);
}

/** おならぶー！のセリフ（おなら → あとのひとこと） */
export function onaraLines(witch, rng = defaultRng) {
  return [
    finish(witch, pickOne(witch?.onara, rng) ?? { text: 'おならぶー！', face: 'onara' }),
    finish(witch, pickOne(witch?.onaraAfter, rng) ?? { text: '', face: 'warai' }),
  ].filter((l) => l.text);
}

/** おならぶー！を出すか（設定がOFFなら出さない） */
export function shouldOnara(witch, enabled, rng = defaultRng) {
  if (!enabled) return false;
  const chance = typeof witch?.onaraChance === 'number' ? witch.onaraChance : 0.125;
  return rng() < chance;
}
