// ルックの解放判定（画面と関係なし）
// その場所での累計正解数が、ルックの need 以上なら解放。一度解放したらずっと使える
// （累計正解数は減らないので、判定は累計だけで決まる）。

/** その場所・キャラのルック（no の順） */
export function looksFor(looks, placeId, charId) {
  return looks.filter((l) => l.place === placeId && l.char === charId).sort((a, b) => a.no - b.no);
}

export function isUnlocked(look, total) {
  return total >= look.need;
}

/** 解放にあと何問いるか（解放済みなら 0） */
export function remainingFor(look, total) {
  return Math.max(0, look.need - total);
}

export function unlockedLooks(looks, total) {
  return looks.filter((l) => isUnlocked(l, total));
}

/** before → after で新しく解放されたルック */
export function newlyUnlocked(looks, before, after) {
  return looks.filter((l) => l.need > before && l.need <= after);
}

/** つぎに解放されるルック（全部解放済みなら null） */
export function nextLockedLook(looks, total) {
  return looks.slice().sort((a, b) => a.need - b.need).find((l) => !isUnlocked(l, total)) ?? null;
}

/**
 * 着ているルックを、データの中から探す。見つからない・まだ解放されていないときは null（素体を出す）。
 * wearing: { place, no } | null、totals: { [placeId]: 累計正解数 }
 */
export function resolveWearing(wearing, looks, charId, totals) {
  if (!wearing) return null;
  const look = looks.find((l) => l.place === wearing.place && l.char === charId && l.no === wearing.no);
  if (!look) return null;
  return isUnlocked(look, totals[wearing.place] ?? 0) ? look : null;
}
