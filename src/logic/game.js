// 1回の「場所への訪問」をまとめるロジック（画面と関係なし）。
// 画面はこの関数を呼び、返ってきた progress を保存するだけでよい。
import { questionPool, drawQuestions, releaseUnshown, createRound, answerCurrent, unshownIds, MODE_NORMAL, MODE_HIICHAN } from './quiz.js';
import { looksFor, newlyUnlocked, nextLockedLook, remainingFor } from './unlock.js';
import {
  recordVisit, setSeen, addCorrect, getPlace, totalCorrect, getZukanSeen, setZukanSeen,
} from './progress.js';
import { drawZukanQuestions } from './zukan.js';
import { defaultRng } from './rng.js';

export const QUESTIONS_PER_VISIT = 3;
export const ZUKAN_QUESTIONS_PER_VISIT = 5;

export function modeOf(game, charId) {
  return game.characters.find((c) => c.id === charId)?.mode ?? MODE_NORMAL;
}

/** 場所に入って、クイズを始める */
export function startVisit(progress, game, charId, placeId, rng = defaultRng) {
  const place = game.places.find((p) => p.id === placeId);
  if (!place) throw new Error(`場所 "${placeId}" がありません`);
  const mode = modeOf(game, charId);
  const pool = questionPool(place.questions, mode);
  const { seen } = getPlace(progress, charId, placeId);
  const drawn = drawQuestions(pool, seen, QUESTIONS_PER_VISIT, rng);
  let p = recordVisit(progress, charId, placeId);
  p = setSeen(p, charId, placeId, drawn.seen);
  return {
    progress: p,
    round: createRound(drawn.questions, mode),
    totalBefore: totalCorrect(progress, charId, placeId),
  };
}

/**
 * 場所に入って、ずかんクイズを始める（1回5問）。
 * ひーちゃんモードは、むずかしさを「かんたん(1)」にする。返す level は、実際に使ったむずかしさ。
 * 正解は、そのあとの answer() で、テキストのクイズと同じ累計（correct）に足される。
 */
export function startZukanVisit(progress, game, charId, placeId, level, rng = defaultRng) {
  const place = game.places.find((p) => p.id === placeId);
  if (!place) throw new Error(`場所 "${placeId}" がありません`);
  const mode = modeOf(game, charId);
  const usedLevel = mode === MODE_HIICHAN ? 1 : level;
  const seen = getZukanSeen(progress, charId, placeId, usedLevel);
  const drawn = drawZukanQuestions(place.zukan ?? [], placeId, usedLevel, mode, seen, ZUKAN_QUESTIONS_PER_VISIT, rng);
  let p = recordVisit(progress, charId, placeId);
  p = setZukanSeen(p, charId, placeId, usedLevel, drawn.seen);
  return {
    progress: p,
    round: createRound(drawn.questions, mode),
    totalBefore: totalCorrect(progress, charId, placeId),
    level: usedLevel,
  };
}

/** 途中でやめる（ずかんクイズ）: まだ見せていない種類は、次の回に出てよいようにする */
export function quitZukanVisit(progress, round, charId, placeId, level) {
  const seen = getZukanSeen(progress, charId, placeId, level);
  return setZukanSeen(progress, charId, placeId, level, releaseUnshown(seen, unshownIds(round)));
}

/** いまの問題に答える。正解数に数えるときは、すぐ累計に足す */
export function answer(progress, round, charId, placeId, isCorrect) {
  const res = answerCurrent(round, isCorrect);
  const p = res.event.type === 'correct' && res.event.countsAsCorrect
    ? addCorrect(progress, charId, placeId, 1)
    : progress;
  return { progress: p, round: res.round, event: res.event };
}

/** 途中でやめる: まだ見せていない問題は、次の回に出てよいようにする */
export function quitVisit(progress, round, charId, placeId) {
  const { seen } = getPlace(progress, charId, placeId);
  return setSeen(progress, charId, placeId, releaseUnshown(seen, unshownIds(round)));
}

/** ごほうび画面に出す内容 */
export function rewardSummary(game, progress, charId, placeId, totalBefore, roundCorrect) {
  const looks = looksFor(game.looks, placeId, charId);
  const total = totalCorrect(progress, charId, placeId);
  const next = nextLockedLook(looks, total);
  return {
    roundCorrect,
    total,
    newly: newlyUnlocked(looks, totalBefore, total),
    next,
    remaining: next ? remainingFor(next, total) : 0,
  };
}
