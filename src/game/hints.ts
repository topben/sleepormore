// 新手提示(易玩性改善):每回合給一個「建議」,只用玩家看得到的資訊
// (自己的數值、張眼時對方的數值、聽得到的打呼、對方的行為與台詞線索)。
import { ACTIONS, canUse } from './actions';
import { EDGE_WARN, MAX_TURNS, REACH, SLEEP_ASLEEP, SLEEP_WIN_SCORE } from './constants';
import { forceWindow } from './rules';
import type { HintKey } from './text';
import type { ActionId, Eyes, GameState, Goal } from './types';
import { partnerOf } from './types';
import { coverOf, distanceOf } from './util';

export interface Suggestion {
  key: HintKey;
  /** 建議的動作(UI 高亮該按鈕) */
  actionId?: ActionId;
  /** 建議力道(綠區中心;用力叫醒時在黃區) */
  force?: number;
  /** 建議先切換眼睛(UI 高亮閉眼/張眼鈕) */
  eyes?: Eyes;
  /** 警告樣式 */
  urgent?: boolean;
}

/** 綠區中心 */
export function greenCenter(s: GameState, id: ActionId): number {
  const [lo, hi] = forceWindow(s, s.playerRole, id);
  return Math.round((lo + hi) / 2);
}

/** 依觀察到的線索,對方比較像想要什麼(平手 → null) */
export function clueLean(s: GameState): Goal | null {
  const { sleep, intimacy } = s.memo.clues;
  if (sleep > intimacy) return 'sleep';
  if (intimacy > sleep) return 'intimacy';
  return null;
}

export function suggestAction(s: GameState): Suggestion | null {
  if (s.ending) return null;
  const P = s.playerRole;
  const p = s.chars[P];
  const q = s.chars[partnerOf(P)];
  const open = p.eyes === 'open';
  const can = (id: ActionId) => canUse(s, P, id);
  const act = (key: HintKey, id: ActionId, extra: Partial<Suggestion> = {}): Suggestion => ({
    key,
    actionId: id,
    ...(ACTIONS[id].usesForce ? { force: greenCenter(s, id) } : {}),
    ...extra,
  });
  /** 用力(黃區)叫醒:綠區上緣 +10 */
  const firm = (id: ActionId): Suggestion => ({ key: 'partnerAsleep', actionId: id, force: forceWindow(s, P, id)[1] + 10 });

  // 危險優先
  if (Math.abs(p.lateral) >= EDGE_WARN && can('scootIn')) return act('edgeDanger', 'scootIn', { urgent: true });
  if (open && q.annoyance >= 60 && q.sleep < SLEEP_ASLEEP) return act('calmPartner', 'pat', { urgent: true });

  if (p.goal === 'sleep') {
    const nextWarmth = p.warmth + (coverOf(P, s.blanketOffset) - 0.55) * 80;
    if (nextWarmth < 30 && can('pullBlanket')) return act('warmUp', 'pullBlanket', { urgent: p.warmth < 30 });
    if (open) return { key: 'closeEyes', eyes: 'closed' };
    if (s.sleepScore >= SLEEP_WIN_SCORE) return act('sleepDone', 'sleep');
    // 對方還醒著又一直想親熱 → 先哄睡
    const pestered = q.lastAction === 'kiss' || q.lastAction === 'caress' || q.lastAction === 'hug';
    if (q.sleep < SLEEP_ASLEEP && p.sleep < SLEEP_ASLEEP && (pestered || clueLean(s) === 'intimacy')) return act('lullPartner', 'pat');
    if (p.restless >= 35) return act('stayStill', 'sleep');
    return act('keepSleeping', 'sleep');
  }

  // 目標:親熱
  if (!open) return { key: 'openEyes', eyes: 'open' };
  if (p.posture !== 'sideFacing') return act('faceThem', 'lieSideFacing');
  if (distanceOf(s) > REACH && can('scootIn')) return act('scootCloser', 'scootIn');
  if (q.sleep >= SLEEP_ASLEEP) {
    if (can('kiss')) return firm('kiss');
    if (can('caress')) return firm('caress');
  }
  if (q.mood < 40) return act('cheerUp', 'whisper');
  if (clueLean(s) === 'sleep' && q.mood < 70) return act('moodUp', can('tuckBlanket') && p.warmth > 45 ? 'tuckBlanket' : 'whisper');
  if (s.intimacy >= 80 && can('kiss')) return act('almostThere', 'kiss');
  if (can('kiss')) return act('kiss', 'kiss');
  if (can('hug')) return act('hug', 'hug');
  if (can('caress')) return act('caress', 'caress');
  return act('whisper', 'whisper');
}

export type ProgressStatus = 'done' | 'onTrack' | 'tight' | 'impossible';

export interface GoalProgress {
  goal: Goal;
  value: number;
  target: number;
  remainingTurns: number;
  status: ProgressStatus;
}

/** 目標進度(HUD 進度條):睡覺看睡眠分數,親熱看親密度 */
export function goalProgress(s: GameState): GoalProgress {
  const goal = s.chars[s.playerRole].goal;
  const remainingTurns = Math.max(0, MAX_TURNS - s.turn);
  if (goal === 'sleep') {
    const need = SLEEP_WIN_SCORE - s.sleepScore;
    const status: ProgressStatus =
      need <= 0 ? 'done' : need > remainingTurns ? 'impossible' : need > remainingTurns * 0.75 ? 'tight' : 'onTrack';
    return { goal, value: s.sleepScore, target: SLEEP_WIN_SCORE, remainingTurns, status };
  }
  const need = 100 - s.intimacy;
  const status: ProgressStatus =
    need <= 0 ? 'done' : need > remainingTurns * 20 ? 'impossible' : need > remainingTurns * 10 ? 'tight' : 'onTrack';
  return { goal, value: s.intimacy, target: 100, remainingTurns, status };
}
