// 對話池(DESIGN §8)。句子本身在 src/i18n/<語系>/game.ts 的 speech;這裡只挑句子序號。
import type { Rng } from './rng';
import { ZH, type SpeechKey } from './text';
import type { Goal } from './types';

export type { SpeechKey };

/** 由對方(AI)說出時,算作「對方目標」的一條線索 */
export const CLUE_OF: Partial<Record<SpeechKey, Goal>> = {
  goodnight: 'sleep',
  sleepTalk_sleep: 'sleep',
  sleepTalk_intimacy: 'intimacy',
  sleepyDecline: 'sleep',
  okFine: 'sleep',
  noticedSleep: 'sleep',
  noticedIntimacy: 'intimacy',
  partnerInitiate: 'intimacy',
  wakeUp: 'intimacy',
  stare: 'sleep',
};

/** 開場晚安池前 2 句是兩個目標共用的曖昧句,不算線索 */
export const SHARED_GOODNIGHT_LINES = 2;

/** 對方說出這句話時透露的目標(沒有 → null) */
export function lineClue(key: SpeechKey, index: number): Goal | null {
  if (key === 'goodnight_sleep') return index >= SHARED_GOODNIGHT_LINES ? 'sleep' : null;
  if (key === 'goodnight_intimacy') return index >= SHARED_GOODNIGHT_LINES ? 'intimacy' : null;
  return CLUE_OF[key] ?? null;
}

/** 從池中挑一句:回傳序號與繁中原文。各語系的池句數相同,序號即可對應翻譯。 */
export function pickLine(key: SpeechKey, rng: Rng): { index: number; text: string } {
  const pool = ZH.speech[key];
  const index = Math.floor(rng() * pool.length) % pool.length;
  return { index, text: pool[index] };
}

/** 結局畫面的早晨對話池 */
export function morningKey(playerGoal: Goal, partnerGoal: Goal, special?: 'together' | 'floor'): SpeechKey {
  if (special) return `morning_${special}`;
  return `morning_${playerGoal}_${partnerGoal}`;
}
