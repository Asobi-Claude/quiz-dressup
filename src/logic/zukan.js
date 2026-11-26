// ずかんクイズのロジック（画面と関係なし）
// - データ（data/zukan.json）の検証
// - 問題の選び方・選択肢の作り方
// 項目の形:
//   { id, place, name, reading, difficulty: 1|2|3, image,
//     credit: { author, license, source, sourceUrl?, licenseUrl? }, sample?: boolean }
//   author・license・source は必須（空の項目は使わない）。sourceUrl・licenseUrl は、あれば文字のまま出す
// 問題の形（ZukanQuestion）:
//   { id: 項目のID, kind: 'image-to-name' | 'name-to-image', item, choices: [{ itemId, name, reading, image, correct }] }
import { drawQuestions, MODE_HIICHAN } from './quiz.js';
import { shuffle, defaultRng } from './rng.js';

export const ZUKAN_LEVELS = [1, 2, 3];
const MIN_ITEMS_FOR_PLACE = 4; // 4択を出すのに、最低4種類いる

const nonEmpty = (s) => typeof s === 'string' && s.trim() !== '';

/** 項目がゲームに使えない理由（使えるなら null） */
function problemOf(it, placeIds) {
  if (!it || typeof it !== 'object') return '項目の形が正しくない';
  if (!nonEmpty(it.id)) return 'id がない';
  if (!placeIds.includes(it.place)) return `場所 "${it.place}" が places.json にない`;
  if (!nonEmpty(it.name)) return 'name がない';
  if (!nonEmpty(it.reading)) return 'reading がない';
  if (!Number.isInteger(it.difficulty) || it.difficulty < 1 || it.difficulty > 3) return 'difficulty が 1〜3 の整数でない';
  if (!nonEmpty(it.image)) return 'image がない';
  if (!nonEmpty(it.credit?.author)) return '作者（credit.author）がない';
  if (!nonEmpty(it.credit?.license)) return 'ライセンス（credit.license）がない';
  if (!nonEmpty(it.credit?.source)) return '出典（credit.source）がない';
  return null;
}

/**
 * ずかんのデータを検べる。1件ずつ判断し、使えない項目は除いて注意に書く。
 * errors はファイル全体の問題（このときは項目を1つも使わない）。zukan が undefined（ファイルなし）なら何も出さない。
 * @returns {{errors: string[], warnings: string[], items: object[]}}
 */
export function validateZukan(zukan, placeIds) {
  const errors = [];
  const warnings = [];
  const items = [];
  if (zukan === undefined || zukan === null) return { errors, warnings, items };
  if (!Array.isArray(zukan.items)) {
    errors.push('zukan.json: items が配列ではありません');
    return { errors, warnings, items };
  }
  const seen = new Set();
  for (const it of zukan.items) {
    const problem = problemOf(it, placeIds);
    if (problem) {
      warnings.push(`zukan.json: "${it?.id ?? '?'}" は ${problem}ため、使いません`);
      continue;
    }
    if (seen.has(it.id)) {
      warnings.push(`zukan.json: ID "${it.id}" が重複しています（2つ目は使いません）`);
      continue;
    }
    seen.add(it.id);
    items.push(it);
  }
  return { errors, warnings, items };
}

/**
 * 見本（sample:true）の項目を取り除いた、新しいデータを返す（元は変えない）。
 * 見本は写真もクレジットも仮なので、確認用の指定（?sample=1）がないときは、子どもの画面に出さない。
 * ファイルがない・形がおかしいときは、そのまま返す。
 */
export function dropSamples(zukan) {
  if (!zukan || !Array.isArray(zukan.items)) return zukan;
  return { ...zukan, items: zukan.items.filter((it) => !it?.sample) };
}

/** その場所で、ずかんクイズを出せるか（4種類以上） */
export function placeHasZukan(place) {
  return Array.isArray(place?.zukan) && place.zukan.length >= MIN_ITEMS_FOR_PLACE;
}

// ---- 出題 ----

/**
 * 出題の候補。通常モードは、その場所の、選んだむずかしさだけ。
 * ひーちゃんモードは、むずかしさに関係なく、その場所の「かんたん(1)」だけ。
 */
export function zukanPool(items, placeId, level, mode) {
  const inPlace = items.filter((it) => it.place === placeId);
  return mode === MODE_HIICHAN
    ? inPlace.filter((it) => it.difficulty === 1)
    : inPlace.filter((it) => it.difficulty === level);
}

/**
 * その場所で、ずかんクイズを出せるむずかしさ。
 * 通常モード: 1件以上あるむずかしさ。ひーちゃんモード: かんたん(1)が1件以上あれば [1]。
 * その場所のずかんが4種類に満たないときは、[]（出さない）。
 */
export function zukanLevelsFor(place, mode) {
  if (!placeHasZukan(place)) return [];
  const levels = mode === MODE_HIICHAN ? [1] : ZUKAN_LEVELS;
  return levels.filter((lv) => zukanPool(place.zukan, place.id, lv, mode).length > 0);
}

/**
 * クレジット画面に出す、場所ごとの一覧。places の順。ずかんがある場所だけ。
 * 場所の中は、むずかしさ、名前の順。
 * @returns {{placeId: string, placeName: string, lines: {name, author, license, source}[]}[]}
 */
export function creditLines(items, places) {
  const out = [];
  for (const p of places) {
    const mine = items
      .filter((it) => it.place === p.id)
      .sort((a, b) => a.difficulty - b.difficulty || a.name.localeCompare(b.name, 'ja'));
    if (!mine.length) continue;
    out.push({
      placeId: p.id,
      placeName: p.name,
      lines: mine.map((it) => ({
        name: it.name, author: it.credit.author, license: it.credit.license, source: it.credit.source ?? '',
        sourceUrl: it.credit.sourceUrl ?? '', licenseUrl: it.credit.licenseUrl ?? '',
      })),
    });
  }
  return out;
}

const toChoice = (it, correct) => ({ itemId: it.id, name: it.name, reading: it.reading, image: it.image, correct });

/**
 * 1つの種類から、問題を作る。
 * 通常モード: 写真を見て名前を選ぶ（image-to-name）。正解＋ダミー3つの4択。
 * ひーちゃんモード: 名前を聞いて写真を選ぶ（name-to-image）。正解＋ダミー1つの2択。
 * ダミーは placeItems（同じ場所の、すべてのむずかしさ）から、名前が重ならないように選ぶ。
 * 種類が足りないときは、ある分だけ。choices はシャッフル済み。
 */
export function buildZukanQuestion(item, placeItems, mode, rng = defaultRng) {
  const hii = mode === MODE_HIICHAN;
  const wanted = hii ? 1 : 3;
  const usedNames = new Set([item.name]);
  const others = [];
  for (const cand of shuffle(placeItems.filter((it) => it.id !== item.id), rng)) {
    if (usedNames.has(cand.name)) continue;
    usedNames.add(cand.name);
    others.push(cand);
    if (others.length === wanted) break;
  }
  const choices = shuffle([toChoice(item, true), ...others.map((it) => toChoice(it, false))], rng);
  return { id: item.id, kind: hii ? 'name-to-image' : 'image-to-name', item, choices };
}

/**
 * n問を選ぶ（直近に出した種類は、プールを一周するまで出さない。選び方は今のクイズと同じ）。
 * @returns {{questions: object[], seen: string[]}}
 */
export function drawZukanQuestions(items, placeId, level, mode, seen, n, rng = defaultRng) {
  const pool = zukanPool(items, placeId, level, mode);
  const drawn = drawQuestions(pool, seen, n, rng);
  const placeItems = items.filter((it) => it.place === placeId);
  return {
    questions: drawn.questions.map((it) => buildZukanQuestion(it, placeItems, mode, rng)),
    seen: drawn.seen,
  };
}
