// 乱数。テストでは seed を固定した rng を渡せるようにする（rng は 0以上1未満を返す関数）。

export const defaultRng = () => Math.random();

/** seed から同じ並びの乱数を作る（mulberry32） */
export function seededRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 新しい配列にしてシャッフルする（Fisher-Yates） */
export function shuffle(arr, rng = defaultRng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 配列から1つ選ぶ（空なら undefined） */
export function pickOne(arr, rng = defaultRng) {
  if (!arr || !arr.length) return undefined;
  return arr[Math.floor(rng() * arr.length)];
}
