// 組合結局(雙方配合):每回合累計行為統計(memo.tally),結局時依兩人各自的玩法判定「睡姿人格」(8 種),
// 你 × 對方 = 64 種組合,各有稀有度。純函式、無 UI。
import { SLEEP_ASLEEP, SLEEP_AWAKE } from './constants';
import type { ActionId, GameEvent, GameState, Role, RoleTally, Tally } from './types';
import { partnerOf } from './types';
import { coverOf } from './util';

/** 8 種睡姿人格(順序 = 圖鑑的列/行順序) */
export const PERSONAS = ['bandit', 'talker', 'koala', 'nanny', 'sleeper', 'faker', 'spinner', 'iceberg'] as const;
export type Persona = (typeof PERSONAS)[number];

export const PERSONA_EMOJI: Record<Persona, string> = {
  bandit: '🧲',
  talker: '💬',
  koala: '🐨',
  nanny: '👐',
  sleeper: '💤',
  faker: '🎭',
  spinner: '🌀',
  iceberg: '🧊',
};

/** 組合 id:`${你}_${對方}` */
export type ComboId = `${Persona}_${Persona}`;
export const COMBO_IDS: readonly ComboId[] = PERSONAS.flatMap((a) => PERSONAS.map((b) => `${a}_${b}` as ComboId));

const LIE_ACTIONS = new Set<ActionId>(['lieSupine', 'lieSideFacing', 'lieSideAway', 'lieProne']);

/** 床緣:|lateral| 超過這個值(且在自己那側)算貼在床邊 */
export const EDGE_LATERAL = 0.85;

const newRoleTally = (): RoleTally => ({
  acts: {},
  turned: 0,
  cold: 0,
  snored: 0,
  woke: 0,
  caught: 0,
  edge: 0,
  faked: 0,
  slept: 0,
  asleepAt: -1,
});

export function newTally(): Tally {
  return { male: newRoleTally(), female: newRoleTally(), embraced: 0, pillow: 0, maxNumb: 0 };
}

/** 回合結束後依本回合事件與結束時的狀態累計;turnNo = 這是第幾回合(1 起算) */
export function tallyTurn(s: GameState, events: GameEvent[], turnNo = s.turn): void {
  const t = s.memo.tally;
  for (const e of events) {
    switch (e.type) {
      case 'action': {
        const a = t[e.who].acts;
        a[e.action] = (a[e.action] ?? 0) + 1;
        // 只算自己翻身(被拍到翻身、被推開、枕上手臂時被擺成側躺都不算)
        if (e.success && LIE_ACTIONS.has(e.action)) t[e.who].turned += 1;
        break;
      }
      case 'cold':
        t[e.who].cold += 1;
        break;
      case 'snore':
        t[e.who].snored += 1;
        break;
      case 'wake':
        t[e.by].woke += 1;
        break;
      case 'noticed':
        t[e.who].caught += 1;
        break;
      default:
        break;
    }
  }
  for (const r of ['male', 'female'] as const) {
    const c = s.chars[r];
    const rt = t[r];
    if ((r === 'male' ? -c.lateral : c.lateral) >= EDGE_LATERAL) rt.edge += 1;
    if (c.eyes === 'closed' && c.sleep < SLEEP_AWAKE) rt.faked += 1;
    if (c.sleep >= SLEEP_ASLEEP) {
      rt.slept += 1;
      if (rt.asleepAt < 0) rt.asleepAt = turnNo;
    }
  }
  if (s.embrace) t.embraced += 1;
  if (s.armPillow.inUse) t.pillow += 1;
  t.maxNumb = Math.max(t.maxNumb, s.armPillow.numbness);
}

const n = (t: RoleTally, ...ids: ActionId[]) => ids.reduce((sum, id) => sum + (t.acts[id] ?? 0), 0);

/** 每種人格的原始指標(次數為主;0 = 完全沒有這個傾向) */
export function personaMetrics(s: GameState, role: Role): Record<Persona, number> {
  const all = s.memo.tally;
  const t = all[role];
  const onFloor = s.ending?.id === 'kickedOff' || s.ending?.id === 'fellOff';
  const burrito = !onFloor && coverOf(role, s.blanketOffset) >= 0.95 && coverOf(partnerOf(role), s.blanketOffset) <= 0.3;
  const male = role === 'male';
  return {
    bandit: n(t, 'pullBlanket') + (burrito ? 1.2 : 0),
    talker: n(t, 'whisper'),
    koala: n(t, 'hug', 'kiss', 'caress') + 0.5 * n(t, 'scootIn') + 0.25 * all.embraced + 0.4 * n(t, 'restOnArm'),
    nanny: n(t, 'pat', 'tuckBlanket') + (male ? 0.7 * n(t, 'offerArm') + 0.15 * all.pillow : 0),
    // 認真想睡(一直選「睡覺」)也算:被吵到睡不著的人不會因此被當成裝睡
    sleeper: t.slept + 0.5 * t.snored + 0.5 * n(t, 'sleep') + (t.asleepAt >= 1 && t.asleepAt <= 4 ? 1 : 0),
    // 閉眼卻一直沒真的睡著(真的睡很多的人不算裝睡)
    faker: Math.max(0, t.faked + 2 * t.caught - 0.6 * t.slept),
    spinner: Math.max(0, t.turned - 1),
    iceberg: n(t, 'lieSideAway', 'scootOut', 'push') + 0.25 * t.edge,
  };
}

export type Norm = Record<Persona, readonly [mean: number, sd: number]>;

/**
 * 指標的平均與標準差(平衡模擬:混合隨機、照提示、各人格風格的玩家,各 2 萬局)。
 * 玩家與對方(AI)的習慣不同,各用一張表:人格 = 比「一般人」最突出的那一項,所以對方也拿得到每一種人格。
 */
export const PERSONA_NORM: Record<'player' | 'partner', Norm> = {
  player: {
    bandit: [1.06, 1.72],
    talker: [1.07, 1.76],
    koala: [2.08, 2.47],
    nanny: [2.31, 2.32],
    sleeper: [2.37, 5.24],
    faker: [2.19, 2.99],
    spinner: [1.23, 2],
    iceberg: [1.56, 1.75],
  },
  partner: {
    bandit: [0.93, 1.48],
    talker: [1.05, 1.44],
    koala: [3.45, 3.8],
    nanny: [0.75, 1.09],
    sleeper: [6.44, 6.58],
    faker: [0.2, 0.62],
    spinner: [0.37, 0.67],
    iceberg: [0.18, 0.6],
  },
};

export type Rarity = 'N' | 'R' | 'SR' | 'SSR';

/**
 * 稀有度(同一個平衡模擬的 2 萬局:依出現頻率排名,前 24 = N、再 20 = R、再 12 = SR、最少見的 8 = SSR)。
 * 列 = 你、行 = 對方,順序同 PERSONAS。
 */
const RARITY_GRID = [
  ['N', 'R', 'N', 'R', 'R', 'SR', 'R', 'R'], // bandit
  ['SR', 'N', 'N', 'R', 'R', 'SR', 'R', 'R'], // talker
  ['SSR', 'N', 'N', 'N', 'SR', 'N', 'SR', 'R'], // koala
  ['R', 'N', 'N', 'N', 'N', 'SR', 'N', 'R'], // nanny
  ['N', 'R', 'SSR', 'SR', 'N', 'SSR', 'N', 'SR'], // sleeper
  ['SR', 'N', 'N', 'SSR', 'SR', 'SSR', 'SSR', 'SSR'], // faker
  ['R', 'SR', 'N', 'R', 'N', 'SSR', 'R', 'SR'], // spinner
  ['R', 'N', 'N', 'N', 'N', 'R', 'R', 'R'], // iceberg
] as const satisfies readonly (readonly Rarity[])[];

export function comboRarity(id: ComboId): Rarity {
  const [a, b] = id.split('_') as [Persona, Persona];
  return RARITY_GRID[PERSONAS.indexOf(a)][PERSONAS.indexOf(b)];
}

/** 每種人格的突出程度(z 分數) */
export function personaScores(s: GameState, role: Role, norm: Norm = PERSONA_NORM[role === s.playerRole ? 'player' : 'partner']): Record<Persona, number> {
  const m = personaMetrics(s, role);
  const out = {} as Record<Persona, number>;
  for (const p of PERSONAS) out[p] = (m[p] - norm[p][0]) / norm[p][1];
  return out;
}

/** 最突出的人格(同分依 PERSONAS 順序) */
export function personaOf(s: GameState, role: Role, norm?: Norm): Persona {
  const sc = personaScores(s, role, norm);
  let best: Persona = PERSONAS[0];
  for (const p of PERSONAS) if (sc[p] > sc[best]) best = p;
  return best;
}

export interface Combo {
  id: ComboId;
  /** 0..63(圖鑑格子序號:列 = 你、行 = 對方) */
  index: number;
  me: Persona;
  partner: Persona;
}

export function comboOf(s: GameState): Combo {
  const me = personaOf(s, s.playerRole);
  const partner = personaOf(s, partnerOf(s.playerRole));
  return { id: `${me}_${partner}`, index: PERSONAS.indexOf(me) * PERSONAS.length + PERSONAS.indexOf(partner), me, partner };
}
