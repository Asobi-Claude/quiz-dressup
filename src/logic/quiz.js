// クイズのロジック（画面と関係なし）
// - 問題の選び方（直近に出した問題は、プールを一周するまで出さない）
// - ひーちゃんモードの絞り込みと2択化
// - 1回の流れ（ラウンド）と正解数の数え方
import { shuffle, defaultRng } from './rng.js';

export const MODE_NORMAL = 'normal';
export const MODE_HIICHAN = 'hiichan';

/** そのモードで出してよい問題（ひーちゃんモードは easy:true だけ） */
export function questionPool(questions, mode) {
  return mode === MODE_HIICHAN ? questions.filter((q) => q.easy === true) : questions.slice();
}

/**
 * プールから n 問を選ぶ。
 * seen は「いまのサイクルで出した問題ID」。まだ出していない問題から無作為に選ぶ。
 * 残りが n 問より少ないときは、残りを全部出し、足りない分は新しいサイクルから選ぶ（同じ回に重複はしない）。
 * @returns {{questions: object[], seen: string[]}} 選んだ問題と、新しい seen
 */
export function drawQuestions(pool, seen, n, rng = defaultRng) {
  const count = Math.min(n, pool.length);
  const seenSet = new Set(seen);
  const unseen = pool.filter((q) => !seenSet.has(q.id));

  if (unseen.length >= count) {
    const picked = shuffle(unseen, rng).slice(0, count);
    const nextSeen = [...seen.filter((id) => pool.some((q) => q.id === id)), ...picked.map((q) => q.id)];
    return { questions: picked, seen: nextSeen };
  }
  // サイクルの終わり: 残りを全部出す → 記録をリセットして、足りない分を新しいサイクルから
  const fromOld = shuffle(unseen, rng);
  const oldIds = new Set(fromOld.map((q) => q.id));
  const fromNew = shuffle(pool.filter((q) => !oldIds.has(q.id)), rng).slice(0, count - fromOld.length);
  const picked = shuffle([...fromOld, ...fromNew], rng);
  return { questions: picked, seen: fromNew.map((q) => q.id) };
}

/** 途中でやめたとき、まだ見せていない問題を seen から外す（次の回に出てよいようにする） */
export function releaseUnshown(seen, unshownIds) {
  const u = new Set(unshownIds);
  return seen.filter((id) => !u.has(id));
}

/**
 * 選択肢の絵の名前を、[answer, wrong[0], wrong[1], wrong[2]] の順で返す（ないところは null）。
 * choice_images_map.json の形: { answer, wrong }（wrong は wrong[0] の絵）。
 * 将来 wrong2 / wrong3 を足せば、wrong[1] / wrong[2] にも絵が付く。
 */
export function choiceImages(question, imagesMap) {
  const m = imagesMap?.[question.id];
  if (!m) return [null, null, null, null];
  return [m.answer ?? null, m.wrong ?? null, m.wrong2 ?? null, m.wrong3 ?? null];
}

/**
 * 画面に出す選択肢を作る（シャッフル済み）。
 * 通常モード: 4択。絵は4つ全部にあるときだけ付ける（絵の有無で答えがわからないように）。
 * ひーちゃんモード: answer と wrong[0] の2択。2つとも絵があれば付ける。
 * @returns {{text: string, correct: boolean, image: string|null}[]}
 */
export function buildChoices(question, mode, imagesMap, rng = defaultRng) {
  const texts = [question.answer, ...question.wrong];
  const imgs = choiceImages(question, imagesMap);
  const n = mode === MODE_HIICHAN ? 2 : 4;
  const useImages = imgs.slice(0, n).every(Boolean);
  const choices = texts.slice(0, n).map((text, i) => ({
    text,
    correct: i === 0,
    image: useImages ? imgs[i] : null,
  }));
  return shuffle(choices, rng);
}

/** 解説の最初の1文（ヒントに使う） */
export function firstSentence(text) {
  if (!text) return '';
  const i = text.indexOf('。');
  return i < 0 ? text.trim() : text.slice(0, i + 1).trim();
}

// ---- 1回の流れ（ラウンド） ----

export function createRound(questions, mode) {
  return { mode, questions, index: 0, wrongCount: 0, results: [] };
}

export function currentQuestion(round) {
  return round.questions[round.index] ?? null;
}

/**
 * いまの問題に答える。round は変更せず、新しい round を返す。
 * event.type:
 *   'correct' … 当たり。countsAsCorrect は正解数に数えるか（通常モードは1回目だけ、ひーちゃんモードはいつも）
 *   'wrong'   … はずれ。attempt は何回目のはずれか。showHint はヒントを出すか
 *               （通常モードは2回目のはずれから、ひーちゃんモードはすぐ＝正解を光らせる）
 */
export function answerCurrent(round, isCorrect) {
  if (round.results.length > round.index) throw new Error('この問題はもう答えています');
  if (!isCorrect) {
    const attempt = round.wrongCount + 1;
    const showHint = round.mode === MODE_HIICHAN ? true : attempt >= 2;
    return { round: { ...round, wrongCount: attempt }, event: { type: 'wrong', attempt, showHint } };
  }
  const firstTry = round.wrongCount === 0;
  const countsAsCorrect = round.mode === MODE_HIICHAN ? true : firstTry;
  const q = currentQuestion(round);
  const result = { id: q?.id, firstTry, countsAsCorrect };
  return {
    round: { ...round, results: [...round.results, result] },
    event: { type: 'correct', firstTry, countsAsCorrect },
  };
}

/** つぎの問題へ（答える前は進めない） */
export function nextQuestion(round) {
  if (round.results.length <= round.index) throw new Error('まだ答えていません');
  return { ...round, index: round.index + 1, wrongCount: 0 };
}

export function isLastQuestion(round) {
  return round.index >= round.questions.length - 1;
}

export function isRoundFinished(round) {
  return round.results.length >= round.questions.length;
}

/** この回の正解数（1回目で当たった数。ひーちゃんモードは全問） */
export function roundCorrectCount(round) {
  return round.results.filter((r) => r.countsAsCorrect).length;
}

/** まだ見せていない問題のID（途中でやめたとき用） */
export function unshownIds(round) {
  return round.questions.slice(round.index + 1).map((q) => q.id);
}
