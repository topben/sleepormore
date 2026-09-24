// 結局判定(DESIGN §7,依優先序;困難模式 §15)。文字欄位為繁中參考;UI 以 ending.id 依語系翻譯。
import { ANNOY_KICK, HARD, INTIMACY_WIN, MAX_TURNS, SLEEP_ASLEEP, SLEEP_WIN_SCORE, clockLabel } from './constants';
import { morningKey } from './speech';
import { ZH, type SpeechKey } from './text';
import type { Ending, EndingId, EndingStyle, GameState } from './types';
import { partnerOf } from './types';

const META: Record<EndingId, { outcome: Ending['outcome']; style: EndingStyle }> = {
  kickedOff: { outcome: 'lose', style: 'wasted' },
  fellOff: { outcome: 'lose', style: 'wasted' },
  intimacyWin: { outcome: 'win', style: 'passed' },
  accidentalIntimacy: { outcome: 'draw', style: 'neutral' },
  sleepWin: { outcome: 'win', style: 'passed' },
  sleepLoseTired: { outcome: 'lose', style: 'wasted' },
  intimacyLoseFellAsleep: { outcome: 'lose', style: 'wasted' },
  intimacyLoseMorning: { outcome: 'lose', style: 'wasted' },
  intimacyLoseDeadline: { outcome: 'lose', style: 'wasted' },
  intimacyMorningWin: { outcome: 'win', style: 'passed' },
  intimacyTooEarly: { outcome: 'draw', style: 'neutral' },
  intimacyLoseOverslept: { outcome: 'lose', style: 'wasted' },
};

/** 睡覺目標要的睡眠分數(困難模式比較低,但要舒服地睡著才算滿分) */
export const sleepTarget = (s: GameState): number => (s.mode === 'hard' ? HARD.sleepWin : SLEEP_WIN_SCORE);

/** 結局文字的佔位符(困難模式的時間點與門檻;UI 翻譯時也用這組) */
export const ENDING_VARS = {
  deadline: clockLabel(HARD.nowDeadline),
  morning: clockLabel(HARD.morningTurn),
  dawn: clockLabel(HARD.dawnTurn),
  sleep: HARD.morningSleep,
};

const fill = (text: string): string => text.replace(/\{(\w+)\}/g, (m, k: string) => (k in ENDING_VARS ? String(ENDING_VARS[k as keyof typeof ENDING_VARS]) : m));

export function makeEnding(id: EndingId): Ending {
  const t = ZH.ending[id];
  return { id, ...META[id], title: t.title, caption: t.caption, description: fill(t.description) };
}

/**
 * phase 'mid'(玩家行動後):只檢查 #1 被踢、#2 掉床。
 * phase 'end'(回合末):全表。困難模式(§15):
 * - 立即親熱:時限(HARD.nowDeadline)還沒達成就輸;
 * - 早上親熱:turn >= HARD.morningTurn 且睡眠分數 >= HARD.morningSleep 才算贏,太早 = 平手;06:00 還閉著眼 = 睡過頭。
 */
export function checkEnding(s: GameState, phase: 'mid' | 'end'): Ending | null {
  const player = s.chars[s.playerRole];
  const partner = s.chars[partnerOf(s.playerRole)];
  if (partner.annoyance >= ANNOY_KICK) return makeEnding('kickedOff');
  if (Math.abs(player.lateral) >= 1) return makeEnding(s.memo.pushedOff ? 'kickedOff' : 'fellOff');
  if (phase === 'mid') return null;
  const timing = s.mode === 'hard' && player.goal === 'intimacy' ? player.timing : undefined;
  if (s.intimacy >= INTIMACY_WIN && partner.sleep < SLEEP_ASLEEP) {
    if (player.goal !== 'intimacy') return makeEnding('accidentalIntimacy');
    if (timing === 'morning') {
      const morning = s.turn >= HARD.morningTurn && s.sleepScore >= HARD.morningSleep;
      return makeEnding(morning ? 'intimacyMorningWin' : 'intimacyTooEarly');
    }
    return makeEnding('intimacyWin');
  }
  if (timing === 'now' && s.turn >= HARD.nowDeadline) return makeEnding('intimacyLoseDeadline');
  if (s.turn >= MAX_TURNS) {
    if (player.goal === 'sleep') return makeEnding(s.sleepScore >= sleepTarget(s) ? 'sleepWin' : 'sleepLoseTired');
    // 早上親熱:鬧鐘響了還閉著眼睛賴床 = 睡過頭(後半夜越睡越淺,06:00 不會真的還睡著)
    if (timing === 'morning') return makeEnding(player.eyes === 'closed' ? 'intimacyLoseOverslept' : 'intimacyLoseMorning');
    return makeEnding(player.sleep >= SLEEP_ASLEEP ? 'intimacyLoseFellAsleep' : 'intimacyLoseMorning');
  }
  return null;
}

/** 結局卡的早晨對話:回傳池名與句子序號(依 seed 固定,各語系同一句) */
export function morningLine(s: GameState): { key: SpeechKey; index: number } {
  const id = s.ending?.id;
  const together = id === 'intimacyWin' || id === 'accidentalIntimacy' || id === 'intimacyMorningWin' || id === 'intimacyTooEarly';
  const special = together ? 'together' : id === 'kickedOff' || id === 'fellOff' ? 'floor' : undefined;
  const key = morningKey(s.chars[s.playerRole].goal, s.chars[partnerOf(s.playerRole)].goal, special);
  const n = ZH.speech[key].length;
  return { key, index: ((s.seed >>> 0) + s.turn) % n };
}
