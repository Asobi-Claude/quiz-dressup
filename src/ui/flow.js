// クイズの始め方（画面から呼ぶ。app を使うので、画面と同じ側に置く）
import { startVisit, startZukanVisit } from '../logic/game.js';
import { zukanLevelsFor } from '../logic/zukan.js';

/** 今までのテキストのクイズを始める */
export function startTextQuiz(app, placeId) {
  const v = startVisit(app.progress, app.game, app.charId, placeId);
  app.save(v.progress);
  app.visit = { placeId, round: v.round, totalBefore: v.totalBefore };
  app.go('quiz');
}

/** ずかんクイズを始める（level は、ひーちゃんモードでは、かんたん(1)になる） */
export function startZukanQuiz(app, placeId, level) {
  const v = startZukanVisit(app.progress, app.game, app.charId, placeId, level);
  app.save(v.progress);
  app.visit = { placeId, round: v.round, totalBefore: v.totalBefore, kind: 'zukan', level: v.level };
  app.go('zukanQuiz');
}

/**
 * 「ずかんクイズ」を選んだあと。むずかしさが1つしかないとき（ひーちゃんモードは、いつも）は、選ばせずに始める
 */
export function pickZukan(app, placeId) {
  const levels = zukanLevelsFor(app.place(placeId), app.mode);
  if (levels.length === 1) startZukanQuiz(app, placeId, levels[0]);
  else app.go('level', { placeId });
}

/**
 * 場所の入口で「はじめる」を押したあと。
 * - ずかんクイズがある場所は、「もんだい／ずかんクイズ」を選ぶ。ただし、文字の問題がない場所は、選ばせずにずかんクイズへ
 * - ない場所は、今までどおり、すぐ問題
 */
export function startPlace(app, place) {
  if (!zukanLevelsFor(place, app.mode).length) startTextQuiz(app, place.id);
  else if (place.hasTextQuiz === false) pickZukan(app, place.id);
  else app.go('choose', { placeId: place.id });
}
