// 固定策略(playthrough.test.ts 與平衡模擬共用)
import { canUse } from '../src/game/actions';
import { HARD } from '../src/game/constants';
import { suggestAction } from '../src/game/hints';
import { createGame, playTurn, toggleEyes, type GameOptions } from '../src/game/turn';
import type { ActionId, Ending, GameState, Goal, Role } from '../src/game/types';
import { partnerOf } from '../src/game/types';

export type Strategy = (s: GameState) => { id: ActionId; force: number; eyes?: 'open' | 'closed' };

export function runGame(
  role: Role,
  seed: number,
  playerGoal: Goal | undefined,
  partnerGoal: Goal | undefined,
  strat: Strategy,
  opts: Omit<GameOptions, 'playerGoal' | 'partnerGoal'> = {},
) {
  let s = createGame(role, seed, { playerGoal, partnerGoal, ...opts });
  let turns = 0;
  while (!s.ending && turns < 20) {
    const d = strat(s);
    if (d.eyes && s.chars[role].eyes !== d.eyes) s = toggleEyes(s, d.eyes).state;
    s = playTurn(s, d.id, d.force).state;
    turns++;
  }
  return { state: s, ending: s.ending as Ending };
}

const first = (s: GameState, ids: ActionId[]): ActionId => ids.find((id) => canUse(s, s.playerRole, id)) ?? 'whisper';

export const STRATS: Record<string, Strategy> = {
  sleepOnly: () => ({ id: 'sleep', force: 0, eyes: 'closed' }),
  kissCaress: (s) => {
    const me = s.chars[s.playerRole];
    if (me.posture !== 'sideFacing') return { id: 'lieSideFacing', force: 0, eyes: 'open' };
    const order: ActionId[] = s.turn % 2 === 0 ? ['kiss', 'caress'] : ['caress', 'kiss'];
    return { id: first(s, [...order, 'scootIn']), force: 35, eyes: 'open' };
  },
  patThenSleep: (s) => {
    const q = s.chars[partnerOf(s.playerRole)];
    return q.sleep >= 70 ? { id: 'sleep', force: 0, eyes: 'closed' } : { id: 'pat', force: 30, eyes: 'closed' };
  },
  moodThenKiss: (s) => {
    const me = s.chars[s.playerRole];
    const q = s.chars[partnerOf(s.playerRole)];
    if (me.posture !== 'sideFacing') return { id: 'lieSideFacing', force: 0, eyes: 'open' };
    if (q.mood < 70) return { id: first(s, s.turn % 2 === 0 ? ['tuckBlanket', 'whisper'] : ['whisper']), force: 30, eyes: 'open' };
    return { id: first(s, ['kiss', 'caress', 'scootIn']), force: 35, eyes: 'open' };
  },
  roughHug: (s) => {
    const me = s.chars[s.playerRole];
    if (me.posture !== 'sideFacing') return { id: 'lieSideFacing', force: 0, eyes: 'open' };
    return { id: 'hug', force: 100, eyes: 'open' };
  },
  awayThenSleep: (s) => {
    const me = s.chars[s.playerRole];
    if (s.turn === 0 && me.posture !== 'sideAway') return { id: 'lieSideAway', force: 0, eyes: 'closed' };
    return { id: 'sleep', force: 0, eyes: 'closed' };
  },
  /** 照 💡 建議玩(建議只給眼睛時,先切換再問一次);困難模式的平衡表用它代表「會玩的人」 */
  followHints: (s) => {
    const me = s.chars[s.playerRole];
    const sug = suggestAction(s);
    if (!sug) return { id: 'sleep', force: 0, eyes: 'closed' };
    if (sug.eyes && !sug.actionId) {
      const again = suggestAction(toggleEyes(s, sug.eyes).state);
      return { id: again?.actionId ?? (sug.eyes === 'closed' ? 'sleep' : 'whisper'), force: again?.force ?? 0, eyes: sug.eyes };
    }
    return { id: sug.actionId ?? 'sleep', force: sug.force ?? 0, eyes: sug.eyes ?? me.eyes };
  },
  /** 早上親熱的天真玩法:天亮前一直睡,天亮後猛親 */
  sleepThenKiss: (s) => (s.turn < HARD.wakeTurn ? STRATS.sleepOnly(s) : STRATS.kissCaress(s)),
};
