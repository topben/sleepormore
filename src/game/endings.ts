// 結局判定(DESIGN §7,依優先序)。文字欄位為繁中參考;UI 以 ending.id 依語系翻譯。
import { ANNOY_KICK, INTIMACY_WIN, MAX_TURNS, SLEEP_ASLEEP, SLEEP_WIN_SCORE } from './constants';
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
};

export function makeEnding(id: EndingId): Ending {
  const t = ZH.ending[id];
  return { id, ...META[id], title: t.title, caption: t.caption, description: t.description };
}

/**
 * phase 'mid'(玩家行動後):只檢查 #1 被踢、#2 掉床。
 * phase 'end'(回合末):全表。
 */
export function checkEnding(s: GameState, phase: 'mid' | 'end'): Ending | null {
  const player = s.chars[s.playerRole];
  const partner = s.chars[partnerOf(s.playerRole)];
  if (partner.annoyance >= ANNOY_KICK) return makeEnding('kickedOff');
  if (Math.abs(player.lateral) >= 1) return makeEnding(s.memo.pushedOff ? 'kickedOff' : 'fellOff');
  if (phase === 'mid') return null;
  if (s.intimacy >= INTIMACY_WIN && partner.sleep < SLEEP_ASLEEP) {
    return makeEnding(player.goal === 'intimacy' ? 'intimacyWin' : 'accidentalIntimacy');
  }
  if (s.turn >= MAX_TURNS) {
    if (player.goal === 'sleep') return makeEnding(s.sleepScore >= SLEEP_WIN_SCORE ? 'sleepWin' : 'sleepLoseTired');
    return makeEnding(player.sleep >= SLEEP_ASLEEP ? 'intimacyLoseFellAsleep' : 'intimacyLoseMorning');
  }
  return null;
}

/** 結局卡的早晨對話:回傳池名與句子序號(依 seed 固定,各語系同一句) */
export function morningLine(s: GameState): { key: SpeechKey; index: number } {
  const id = s.ending?.id;
  const special = id === 'intimacyWin' || id === 'accidentalIntimacy' ? 'together' : id === 'kickedOff' || id === 'fellOff' ? 'floor' : undefined;
  const key = morningKey(s.chars[s.playerRole].goal, s.chars[partnerOf(s.playerRole)].goal, special);
  const n = ZH.speech[key].length;
  return { key, index: ((s.seed >>> 0) + s.turn) % n };
}
