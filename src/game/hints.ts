// 新手提示(易玩性改善):每回合給一個「建議」,只用玩家看得到的資訊
// (自己的數值、張眼時對方的數值、聽得到的打呼、對方的行為與台詞線索)。
import { ACTIONS, canUse } from './actions';
import { BAL, BANDS, COMFORT, EDGE_WARN, FIRM_SPAN, HARD, MAX_TURNS, REACH, SLEEP_ASLEEP } from './constants';
import { ENDING_VARS, sleepTarget } from './endings';
import { breathRate, effectiveNoise, forceWindow, isHard, wakeThreshold, warmthTarget } from './rules';
import type { HintKey } from './text';
import type { ActionId, Eyes, GameState, Goal } from './types';
import { partnerOf } from './types';
import { clamp100, coverOf, distanceOf } from './util';

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

/** 困難模式說明文字的佔位符(時間點、早上親熱要先睡到的分數、兩種體質的體溫範圍) */
export const HARD_TEXT_VARS: Record<string, string | number> = {
  ...ENDING_VARS,
  bearLo: COMFORT.male.warmLo,
  bearHi: COMFORT.male.warmHi,
  bunnyLo: COMFORT.female.warmLo,
};

/** 提示 / 目標說明文字的佔位符:{n} 想睡的對方要的心情、{lo}/{hi}/{need} 你的體質,加上困難模式的時間點 */
export function hintVars(s: GameState): Record<string, string | number> {
  const body = COMFORT[s.playerRole];
  return { ...HARD_TEXT_VARS, n: BAL.sleepyMood, lo: body.warmLo, hi: body.warmHi, need: body.intimacy };
}

/** 困難模式:下一個回合末大概的體溫(不含隨機) */
function nextWarmth(s: GameState): number {
  const w = s.chars[s.playerRole].warmth;
  return clamp100(w + (warmthTarget(s, s.playerRole) - w) * HARD.warmRate);
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

  // 危險優先
  if (Math.abs(p.lateral) >= EDGE_WARN && can('scootIn')) return act('edgeDanger', 'scootIn', { urgent: true });
  if (open && q.annoyance >= 60 && q.sleep < SLEEP_ASLEEP) return act('calmPartner', 'pat', { urgent: true });

  const hard = isHard(s);
  const timing = hard && p.goal === 'intimacy' ? p.timing : undefined;
  /** 閉著眼只聽得到呼吸:急促/平穩(≥ 10 次/分)= 對方還醒著 */
  const partnerAwake = open ? q.sleep < SLEEP_ASLEEP : breathRate(q).rate >= 10;
  // 早上親熱:天亮前(最後一個「夜裡」的回合之前)照睡覺的方式玩
  const nightOfMorning = timing === 'morning' && s.turn < HARD.morningTurn - 1;

  if (p.goal === 'sleep' || nightOfMorning) {
    if (hard) {
      // 困難模式:先顧舒適度(體溫依體質、親密度不夠睡不安穩)
      const body = COMFORT[P];
      const w = nextWarmth(s);
      // 已經超出範圍,或快到邊緣而且下回合會超出(體溫本來就會亂跳,離邊緣還遠時不用急著調)
      if ((p.warmth < body.warmLo || (p.warmth < body.warmLo + 8 && w < body.warmLo)) && can('pullBlanket')) return act('warmUp', 'pullBlanket', { urgent: p.warmth < body.warmLo });
      if ((p.warmth > body.warmHi || (p.warmth > body.warmHi - 8 && w > body.warmHi)) && can('tuckBlanket')) return act('tooHot', 'tuckBlanket', { urgent: p.warmth > body.warmHi });
      if (nightOfMorning && s.intimacy >= 80 && partnerAwake) return act('tooEarlyWarn', can('lieSideAway') ? 'lieSideAway' : 'sleep', { urgent: true });
      // 早上親熱:趁對方醒著先培養一點感情(早上只有兩三個回合,從零開始來不及)
      if (nightOfMorning && s.intimacy < HARD.morningPrep && partnerAwake && s.turn < HARD.chillTurn) {
        return act('morningPrep', open && can('kiss') ? 'kiss' : 'whisper');
      }
      if (s.intimacy < body.intimacy && !s.embrace && !s.armPillow.inUse) {
        if (open && can('hug')) return act('needCloseness', 'hug');
        if (partnerAwake) return act('needCloseness', 'whisper');
      }
    } else if (p.warmth + (coverOf(P, s.blanketOffset) - 0.55) * 80 < 30 && can('pullBlanket')) {
      return act('warmUp', 'pullBlanket', { urgent: p.warmth < 30 });
    }
    if (open) return { key: 'closeEyes', eyes: 'closed' };
    if (nightOfMorning) return act('morningSleepFirst', 'sleep');
    if (s.sleepScore >= sleepTarget(s)) return act('sleepDone', 'sleep');
    // 對方還醒著又一直想親熱 → 先哄睡。閉著眼看不到對方睡意,只聽得到呼吸聲:
    // 急促/平穩(≥ 10 次/分)= 還沒睡著,緩慢 = 睡著了(與 HUD 閉眼時顯示的呼吸聲同一個依據)
    const partnerAwakeByEar = breathRate(q).rate >= 10;
    const pestered = q.lastAction === 'kiss' || q.lastAction === 'caress' || q.lastAction === 'hug';
    if (partnerAwakeByEar && p.sleep < SLEEP_ASLEEP && (pestered || clueLean(s) === 'intimacy')) return act('lullPartner', 'pat');
    if (p.restless >= 35) return act('stayStill', 'sleep');
    return act('keepSleeping', 'sleep');
  }

  // 目標:親熱(困難模式的立即親熱:時限快到了就催;早上親熱:天亮了就叫醒自己)
  const sug = intimacySuggestion(s, act, can, open);
  if (timing === 'now' && HARD.nowDeadline - s.turn <= 2 && !sug.urgent && sug.key !== 'openEyes') return { ...sug, key: 'hurry', urgent: true };
  if (timing === 'morning' && sug.key === 'openEyes') return { ...sug, key: 'morningGo' };
  return sug;
}

function intimacySuggestion(
  s: GameState,
  act: (key: HintKey, id: ActionId, extra?: Partial<Suggestion>) => Suggestion,
  can: (id: ActionId) => boolean,
  open: boolean,
): Suggestion {
  const P = s.playerRole;
  const p = s.chars[P];
  const q = s.chars[partnerOf(P)];
  if (!open) return { key: 'openEyes', eyes: 'open' };
  if (p.posture !== 'sideFacing') return act('faceThem', 'lieSideFacing');
  if (distanceOf(s) > REACH && can('scootIn')) return act('scootCloser', 'scootIn');
  if (q.sleep >= SLEEP_ASLEEP) {
    // 用力(黃區)的噪音要真的超過對方的吵醒門檻才建議;睡得太熟時連用力都叫不醒,只有粗魯做得到
    const T = wakeThreshold(q);
    for (const id of ['kiss', 'caress'] as const) {
      if (can(id) && effectiveNoise(s, P, id) * BANDS.firm.noise > T) {
        return { key: 'partnerAsleep', actionId: id, force: forceWindow(s, P, id)[1] + Math.round(FIRM_SPAN * 0.4) };
      }
    }
    return can('pullBlanket') ? act('partnerDeepSleep', 'pullBlanket') : { key: 'partnerDeepSleep' };
  }
  if (q.mood < 40) return act('cheerUp', 'whisper');
  if (clueLean(s) === 'sleep' && q.mood < BAL.sleepyMood) {
    return act('moodUp', can('tuckBlanket') && p.warmth > 45 ? 'tuckBlanket' : 'whisper');
  }
  if (s.intimacy >= 80 && can('kiss')) return act('almostThere', 'kiss');
  if (can('kiss')) return act('kiss', 'kiss');
  if (can('hug')) return act('hug', 'hug');
  if (can('caress')) return act('caress', 'caress');
  return act('whisper', 'whisper');
}

export type ProgressStatus = 'done' | 'onTrack' | 'tight' | 'impossible';

/** 進度條顯示哪一種:睡眠分數 / 親密度;困難模式:立即親熱(有時限)、早上親熱(先睡 → 天亮再親熱) */
export type ProgressKind = 'sleep' | 'intimacy' | 'now' | 'morningSleep' | 'morningLove';

export interface GoalProgress {
  goal: Goal;
  kind: ProgressKind;
  value: number;
  target: number;
  remainingTurns: number;
  status: ProgressStatus;
}

const sleepStatus = (need: number, turns: number): ProgressStatus =>
  need <= 0 ? 'done' : need > turns ? 'impossible' : need > turns * 0.75 ? 'tight' : 'onTrack';
const loveStatus = (need: number, turns: number): ProgressStatus =>
  need <= 0 ? 'done' : need > turns * 20 ? 'impossible' : need > turns * 10 ? 'tight' : 'onTrack';

/** 目標進度(HUD 進度條):睡覺看睡眠分數,親熱看親密度(困難模式見 ProgressKind) */
export function goalProgress(s: GameState): GoalProgress {
  const p = s.chars[s.playerRole];
  const goal = p.goal;
  const remainingTurns = Math.max(0, MAX_TURNS - s.turn);
  if (goal === 'sleep') {
    const target = sleepTarget(s);
    return { goal, kind: 'sleep', value: s.sleepScore, target, remainingTurns, status: sleepStatus(target - s.sleepScore, remainingTurns) };
  }
  const timing = isHard(s) ? p.timing : undefined;
  if (timing === 'now') {
    const left = Math.max(0, HARD.nowDeadline - s.turn);
    return { goal, kind: 'now', value: s.intimacy, target: 100, remainingTurns: left, status: loveStatus(100 - s.intimacy, left) };
  }
  if (timing === 'morning') {
    if (s.sleepScore < HARD.morningSleep) {
      return { goal, kind: 'morningSleep', value: s.sleepScore, target: HARD.morningSleep, remainingTurns, status: sleepStatus(HARD.morningSleep - s.sleepScore, remainingTurns) };
    }
    // 睡飽了:剩下的是早上的回合(還沒天亮就算整段早上)
    const left = Math.max(0, MAX_TURNS - Math.max(s.turn, HARD.morningTurn - 1));
    return { goal, kind: 'morningLove', value: s.intimacy, target: 100, remainingTurns: left, status: loveStatus(100 - s.intimacy, left) };
  }
  return { goal, kind: 'intimacy', value: s.intimacy, target: 100, remainingTurns, status: loveStatus(100 - s.intimacy, remainingTurns) };
}
