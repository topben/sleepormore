// 固定策略(playthrough.test.ts 與平衡模擬共用)
import { canUse } from '../src/game/actions';
import { createGame, playTurn, toggleEyes } from '../src/game/turn';
import type { ActionId, Ending, GameState, Goal, Role } from '../src/game/types';
import { partnerOf } from '../src/game/types';

export type Strategy = (s: GameState) => { id: ActionId; force: number; eyes?: 'open' | 'closed' };

export function runGame(role: Role, seed: number, playerGoal: Goal | undefined, partnerGoal: Goal | undefined, strat: Strategy) {
  let s = createGame(role, seed, { playerGoal, partnerGoal });
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
};
