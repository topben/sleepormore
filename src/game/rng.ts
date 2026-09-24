// 可重現的亂數:mulberry32。每回合的 rng 由 (seed, turn) 決定(DESIGN §2 RNG)。

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 每回合的亂數流。規格原式 `seed ^ imul(turn, k)` 在 turn 0 會等於 `seed`,和 createGame 抽目標/心情的是同一條流,
 * 導致女方 AI 的開場台詞洩漏她的目標;所以用 turn + 1 加鹽(DESIGN §14.2)。
 */
export function turnRng(seed: number, turn: number): Rng {
  return mulberry32((seed ^ Math.imul(turn + 1, 0x9e3779b1)) >>> 0);
}

/** 隨機種子(開新局用;不影響可重現性,因為種子會存在 state.seed) */
export function randomSeed(): number {
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
