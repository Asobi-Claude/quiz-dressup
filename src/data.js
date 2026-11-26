// データ（JSON）の読み込みと検証。
// validateData は純粋な関数（テストあり）。loadData はブラウザで fetch して検証まで行う。
import { validateZukan, dropSamples, placeHasZukan } from './logic/zukan.js';

export const DATA_FILES = {
  quizzes: 'data/quizzes.json',
  imagesMap: 'data/choice_images_map.json',
  places: 'data/places.json',
  looks: 'data/looks.json',
  witch: 'data/witch-lines.json',
};

// 任意のファイル（なくても動く）
export const OPTIONAL_FILES = {
  zukan: 'data/zukan.json',
  voiceMap: 'data/voice-map.json',
  assetsManifest: 'assets/manifest.json',
};

export const QUESTIONS_PER_PLACE = 25;
export const MIN_LOOKS_PER_PLACE = 6; // ルックは、場所×キャラごとに6着以上（no が 1 から連続）
export const QUESTIONS_PER_ROUND = 3;
const REQUIRED_WITCH_SCENES = [
  'entrance', 'beforeQuestion', 'correct', 'wrong', 'hint',
  'rewardNew', 'rewardNone', 'afterDressup',
];

/**
 * データの整合性を調べる。
 * errors: 遊べなくなる問題（その場所は遊べない）／warnings: 遊べるが直したほうがよいこと
 * @returns {{errors: string[], warnings: string[], playablePlaceIds: string[]}}
 */
export function validateData({ quizzes, imagesMap, places, looks, witch, zukan }) {
  const errors = [];
  const warnings = [];
  const badPlaces = new Set();
  const placeErr = (pid, msg) => { errors.push(msg); badPlaces.add(pid); };

  const placeList = places?.places ?? [];
  const chars = places?.characters ?? [];
  if (!placeList.length) errors.push('places.json に場所がありません');
  if (!chars.length) errors.push('places.json に characters がありません');

  // 場所IDの重複
  const placeIds = placeList.map((p) => p.id);
  dupes(placeIds).forEach((id) => errors.push(`places.json: 場所ID "${id}" が重複しています`));

  // enabled:false の場所（準備中）は、問題もルックもなくてよいので、中身を検べない
  const activePlaces = placeList.filter((p) => p.enabled !== false);
  const disabledIds = new Set(placeList.filter((p) => p.enabled === false).map((p) => p.id));

  // 問題
  const quizPlaces = new Map((quizzes?.places ?? []).map((p) => [p.id, p]));
  const allQIds = [];
  for (const p of activePlaces) {
    if (p.textQuiz === false) continue; // 文字のクイズがなく、ずかんクイズだけの場所（ずかんの数は、あとで検べる）
    const qp = quizPlaces.get(p.id);
    if (!qp) { placeErr(p.id, `quizzes.json に場所 "${p.id}" の問題がありません`); continue; }
    const qs = qp.questions ?? [];
    if (qs.length < QUESTIONS_PER_ROUND) placeErr(p.id, `${p.id}: 問題が ${qs.length} 問しかありません（${QUESTIONS_PER_ROUND}問以上いります）`);
    else if (qs.length !== QUESTIONS_PER_PLACE) warnings.push(`${p.id}: 問題が ${qs.length} 問です（予定は ${QUESTIONS_PER_PLACE} 問）`);
    for (const q of qs) {
      allQIds.push(q.id);
      if (!q.id || !q.q || !q.answer || !q.explain) placeErr(p.id, `${p.id}: 問題 "${q.id ?? '?'}" に id / q / answer / explain のどれかがありません`);
      if (!Array.isArray(q.wrong) || q.wrong.length !== 3) placeErr(p.id, `${q.id}: wrong が3つではありません`);
      else if (new Set([q.answer, ...q.wrong]).size !== 4) placeErr(p.id, `${q.id}: 選択肢に同じものがあります`);
      if (typeof q.easy !== 'boolean') warnings.push(`${q.id}: easy が true / false ではありません`);
      if (q.id && !q.id.startsWith(p.id + '-')) warnings.push(`${q.id}: ID が場所名 "${p.id}-" で始まっていません`);
    }
    const easy = qs.filter((q) => q.easy === true).length;
    if (easy < 1) placeErr(p.id, `${p.id}: ひーちゃんモード用（easy:true）の問題がありません`);
    else if (easy < QUESTIONS_PER_ROUND) warnings.push(`${p.id}: easy の問題が ${easy} 問しかありません（ひーちゃんモードで同じ回に同じ問題は出ませんが、${QUESTIONS_PER_ROUND}問に足りません）`);
  }
  for (const qp of quizPlaces.values()) {
    if (!placeIds.includes(qp.id)) warnings.push(`quizzes.json の場所 "${qp.id}" は places.json にありません（使われません）`);
  }
  dupes(allQIds).forEach((id) => errors.push(`quizzes.json: 問題ID "${id}" が重複しています`));

  // 選択肢の絵の対応表
  const qById = new Map();
  for (const qp of quizPlaces.values()) for (const q of qp.questions ?? []) qById.set(q.id, q);
  for (const [qid, m] of Object.entries(imagesMap ?? {})) {
    if (!qById.has(qid)) { warnings.push(`choice_images_map.json: 問題 "${qid}" は quizzes.json にありません`); continue; }
    if (!m || typeof m.answer !== 'string' || typeof m.wrong !== 'string') warnings.push(`choice_images_map.json: "${qid}" に answer / wrong がありません`);
  }

  // ルック
  const lookList = looks?.looks ?? [];
  dupes(lookList.map((l) => l.id)).forEach((id) => errors.push(`looks.json: ルックID "${id}" が重複しています`));
  for (const p of activePlaces) {
    for (const c of chars) {
      const ls = lookList.filter((l) => l.place === p.id && l.char === c.id).sort((a, b) => a.no - b.no);
      if (ls.length < MIN_LOOKS_PER_PLACE) { placeErr(p.id, `looks.json: ${p.id} × ${c.id} のルックが ${ls.length} 個です（${MIN_LOOKS_PER_PLACE}個以上いります）`); continue; }
      ls.forEach((l, i) => {
        if (l.no !== i + 1) placeErr(p.id, `looks.json: ${p.id} × ${c.id} の no が 1〜${ls.length} の連続になっていません`);
        if (!Number.isInteger(l.need) || l.need < 0) placeErr(p.id, `looks.json: ${l.id} の need が正しくありません`);
        if (i > 0 && l.need < ls[i - 1].need) warnings.push(`looks.json: ${l.id} の need が前のルックより小さいです`);
        if (!l.image) placeErr(p.id, `looks.json: ${l.id} に image がありません`);
      });
      if (ls[0] && ls[0].need !== 0) warnings.push(`looks.json: ${p.id} × ${c.id} のルック01が 0問で解放されません`);
    }
  }

  // 魔女のセリフ
  const modes = new Set(chars.map((c) => c.mode));
  for (const mode of modes) {
    const m = witch?.modes?.[mode];
    if (!m) { errors.push(`witch-lines.json: モード "${mode}" のセリフがありません`); continue; }
    for (const scene of REQUIRED_WITCH_SCENES) {
      if (!Array.isArray(m[scene]) || !m[scene].length) warnings.push(`witch-lines.json: ${mode}.${scene} のセリフがありません`);
    }
  }
  for (const p of activePlaces) {
    if (!witch?.places?.[p.id]) warnings.push(`witch-lines.json: 場所 "${p.id}" のあいさつがありません（ふつうのあいさつだけになります）`);
  }
  const faces = witch?.faces ?? {};
  const allLines = [
    ...Object.values(witch?.modes ?? {}).flatMap((m) => Object.values(m).flat()),
    ...(witch?.onara ?? []), ...(witch?.onaraAfter ?? []),
    ...Object.values(witch?.places ?? {}).flatMap((pp) => Object.values(pp).flat()),
  ];
  for (const line of allLines) {
    if (line?.face && !faces[line.face]) warnings.push(`witch-lines.json: 表情 "${line.face}" が faces にありません`);
  }

  // ずかん（準備中の場所の項目も、先に入れておける）
  const z = validateZukan(zukan, placeIds);
  errors.push(...z.errors);
  warnings.push(...z.warnings);
  for (const p of activePlaces.filter((x) => x.textQuiz === false)) {
    const n = z.items.filter((it) => it.place === p.id).length;
    if (!placeHasZukan({ zukan: z.items.filter((it) => it.place === p.id) })) {
      placeErr(p.id, `${p.id}: ずかんが ${n} 種類しかありません（文字のクイズがない場所は、4種類以上いります）`);
    }
  }

  const playablePlaceIds = placeIds.filter((id) => !badPlaces.has(id) && !disabledIds.has(id));
  return { errors, warnings, playablePlaceIds, zukanItems: z.items };
}

function dupes(arr) {
  const seen = new Set();
  const d = new Set();
  for (const x of arr) { if (seen.has(x)) d.add(x); seen.add(x); }
  return [...d];
}

/** 検証済みのデータから、使いやすい形の「ゲームデータ」を作る（純粋な関数） */
export function buildGameData(raw, validation) {
  const quizPlaces = new Map((raw.quizzes?.places ?? []).map((p) => [p.id, p]));
  const playable = new Set(validation.playablePlaceIds);
  const zukanItems = validation.zukanItems ?? [];
  const places = (raw.places.places ?? []).map((p) => ({
    ...p,
    enabled: p.enabled !== false && playable.has(p.id),
    hasTextQuiz: p.textQuiz !== false,
    questions: quizPlaces.get(p.id)?.questions ?? [],
    zukan: zukanItems.filter((it) => it.place === p.id),
  }));
  return {
    characters: raw.places.characters ?? [],
    places,
    looks: raw.looks?.looks ?? [],
    imagesMap: raw.imagesMap ?? {},
    witch: raw.witch ?? {},
    voiceMap: raw.voiceMap ?? {},
    assetsManifest: raw.assetsManifest ?? null,
    zukanVersion: Number.isInteger(raw.zukan?.version) ? raw.zukan.version : 0,
    validation,
  };
}

async function fetchJson(url, optional = false) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`${url}: ${res.status}`);
    return await res.json();
  } catch (e) {
    if (optional) return null;
    throw e;
  }
}

/** URL に ?sample=1 があるときだけ、ずかんの見本データ（sample:true）を使う（おとなの確認用） */
function sampleAllowedByUrl() {
  try {
    return new URLSearchParams(globalThis.location?.search ?? '').get('sample') === '1';
  } catch {
    return false;
  }
}

/**
 * すべてのデータを読み込んで検証する（ブラウザ用）。
 * ずかんの見本データ（写真もクレジットも仮）は、allowSample が真のときだけ使う。ふだんは隠す。
 */
export async function loadData(base = './', { allowSample = sampleAllowedByUrl() } = {}) {
  const entries = await Promise.all([
    ...Object.entries(DATA_FILES).map(async ([k, f]) => [k, await fetchJson(base + f)]),
    ...Object.entries(OPTIONAL_FILES).map(async ([k, f]) => [k, await fetchJson(base + f, true)]),
  ]);
  const raw = Object.fromEntries(entries);
  if (!allowSample) raw.zukan = dropSamples(raw.zukan);
  const validation = validateData(raw);
  if (validation.errors.length) console.error('データのエラー:', validation.errors);
  if (validation.warnings.length) console.warn('データの注意:', validation.warnings);
  return buildGameData(raw, validation);
}
