// 數值常數。語意見 docs/DESIGN.md §1–§7;調整後請跑 tests/playthrough.test.ts(§12 勝率)。
import type { ForceBand, Posture, Role } from './types';

export const MAX_TURNS = 12;
export const START_MINUTES = 22 * 60; // 22:00
export const MINUTES_PER_TURN = 40;

// 睡意分界
export const SLEEP_AWAKE = 30; // < 30 醒著
export const SLEEP_ASLEEP = 70; // >= 70 睡著
export const SLEEP_DEEP = 100;
export const WAKE_CHECK_MIN = 45; // >= 45 才有吵醒門檻 T

export const COLD = 30; // warmth < 30 = 冷
export const REACH = 0.75; // affection 動作的最大距離
export const SCOOT_MIN_DISTANCE = 0.3;
export const RESTLESS_WARN = 35;
export const RESTLESS_NOTICE = 50;
export const EDGE_WARN = 0.65; // |lateral| >= 0.65 → 床沿
export const AI_LATERAL_MAX = 0.9;
export const CENTER_MIN = 0.1; // 不可跨中心:male <= -0.1、female >= +0.1
export const SLEEP_WIN_SCORE = 7;
export const INTIMACY_WIN = 100;
export const ANNOY_PUSH = 70;
export const ANNOY_KICK = 100;
export const MOOD_RECEPTIVE = 40;
export const ANNOY_RECEPTIVE = 50;

export const INITIAL = {
  lateral: 0.35,
  warmth: 60,
  intimacy: 10,
  moodBase: 50,
  moodSpread: 21, // 50 + floor(r × 21) → 50..70
} as const;

/** 力道分段:eff 套用在標明 ×eff 的數值;noise = 噪音倍率 */
export const BANDS: Record<ForceBand, { eff: number; noise: number; label: string }> = {
  timid: { eff: 0.5, noise: 0.6, label: '太輕' },
  gentle: { eff: 1.0, noise: 1.0, label: '溫柔' },
  firm: { eff: 1.25, noise: 1.7, label: '用力' },
  rough: { eff: 1.5, noise: 2.6, label: '粗魯' },
};
export const FIRM_SPAN = 25; // hi < f <= hi+25 → firm
export const FIRM_ANNOY = 4;
export const ROUGH_ANNOY = 15;
export const CLOSED_EYES_NOISE = 5;
export const CLOSED_EYES_PULL_WINDOW: [number, number] = [40, 60];
export const FORCE_FILL_MS = 1800; // UI 力道條 0→100 所需時間

export const SNORE_NOISE: Record<1 | 2 | 3, number> = { 1: 6, 2: 16, 3: 30 };
export const SLEEP_TALK_NOISE = 8;
export const NUMB_PER_TURN = 25;

export const POSTURE_LABEL: Record<Posture, string> = {
  supine: '仰躺',
  sideFacing: '側躺面向對方',
  sideAway: '側躺背對對方',
  prone: '趴睡',
};

/** turn 0 → "22:00";turn 12 → "06:00" */
export function clockLabel(turn: number): string {
  const total = (START_MINUTES + turn * MINUTES_PER_TURN) % (24 * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * 平衡旋鈕(v2 規格實作後,依 §12 勝率模擬補上的規則;見 docs/DESIGN.md §14)。
 * 可在測試/模擬中暫時修改。
 */
export const BAL = {
  /** 對方(想親熱)被拍拍後直接睡意上來、選擇睡覺的機率(哄睡) */
  lullChance: 0.6,
  /** 對方(想親熱)已經閉眼在睡、且沒被打擾 → 繼續睡的最低睡意 */
  momentumMinSleep: 30,
  /** 玩家看似睡著且背對時,想親熱的對方:偷偷從背後抱 / 小聲試探 / 放棄去睡 的機率(其餘 = 照常叫醒) */
  shieldHug: 0.15,
  shieldWhisper: 0.1,
  shieldGiveUp: 0.05,
  /** 想親熱的對方心情 < 50 時:悄悄話 / 蓋被 的機率(其餘 = 賭氣睡覺) */
  sulkWhisper: 0.35,
  sulkTuck: 0.2,
  /** 想睡的對方回應玩家示好(回悄悄話)的機率;只在對方還醒著(睡意 < 30)時 */
  replyChance: 0.6,
  /** 拍拍安撫給對方的睡意(×eff) */
  patSleep: 6,
  /** 想睡的對方:心情 >= 此值才正常接受親熱(sleepyDecline 門檻,原規格 70) */
  sleepyMood: 75,
  /** 想睡且已昏沉(睡意 >= 30)的對方被示好時,翻身背對的機率 */
  drowsyTurnAway: 0.5,
};

/**
 * 困難模式(DESIGN §15):親熱分「立即 / 早上」,睡覺要維持舒適的體溫與親密度。
 * 回合數都是「回合結束後的 turn」(clockLabel(turn) 就是那個時間點)。可在測試/模擬中暫時修改。
 */
export const HARD = {
  /** 睡覺:睡眠分數要到這裡(困難模式要「舒服地睡著」才算滿分) */
  sleepWin: 5,
  /** 開局的親密度(簡單模式 INITIAL.intimacy) */
  startIntimacy: 20,
  /** 立即親熱:turn 到這裡(02:00)還沒達成就輸 */
  nowDeadline: 6,
  /** 早上親熱:turn >= 此值(04:40)才算早上 */
  morningTurn: 10,
  /** 早上親熱:達成時睡眠分數至少要有(先睡過) */
  morningSleep: 4,
  /** 早上親熱的對方:turn >= 此值(04:00)自己醒來,醒來後睡意壓到 wakeSleep */
  wakeTurn: 9,
  wakeSleep: 40,
  /** 早晨(turn >= wakeTurn)的親熱加倍甜:動作帶來的親密度 × morningBoost */
  morningBoost: 2,
  /** 早上親熱:晚上先把親密度養到這附近(提示用;別養到 100) */
  morningPrep: 40,
  /**
   * 後半夜越睡越淺:turn >= dawnTurn(03:20)的回合末,睡意最多 dawnCap − (turn − dawnTurn) × dawnStep
   * (80 → 60 → 40 → 20,早上叫得醒);那時睡飽的人(睡意 >= 70)心情 +restedMood
   */
  dawnTurn: 8,
  dawnCap: 80,
  dawnStep: 20,
  restedMood: 8,
  /**
   * 體溫會往「目標」靠攏(每回合 warmRate):目標 = warmBase + 蓋到的比例 × warmCover,
   * turn >= chillTurn 起深夜變冷 −chill,抱著 +hugHeat、枕著手臂 +pillowHeat;另外每回合隨機 ±warmDrift
   */
  warmBase: 10,
  warmCover: 100,
  warmRate: 0.5,
  warmDrift: 6,
  chillTurn: 4,
  chill: 15,
  hugHeat: 15,
  pillowHeat: 8,
  /**
   * 親密度:兩人都醒著卻沒有親熱動作、也沒抱著 / 枕著手臂時每回合 −intimacyDecay(有人睡著時不掉);
   * 抱著 +hugIntimacy;另外每回合隨機 ±intimacyJitter
   */
  intimacyDecay: 4,
  intimacyJitter: 3,
  hugIntimacy: 2,
  /** 不舒服時「閉眼睡」的睡意倍率 */
  hotSleep: 0.6,
  coldSleep: 0.5,
  lonelySleep: 0.75,
  /** 睡著但太熱 / 太冷:回合末睡意 −uncomfySleep */
  uncomfySleep: 8,
};

/** 困難模式的體質(男女不同):舒服的體溫範圍、睡得安穩要有的親密度 */
export const COMFORT: Record<Role, { warmLo: number; warmHi: number; intimacy: number }> = {
  male: { warmLo: 30, warmHi: 70, intimacy: 15 }, // 小熊怕熱
  female: { warmLo: 55, warmHi: 100, intimacy: 30 }, // 垂耳兔怕冷,也要多一點安全感
};
