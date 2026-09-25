// 簡單模式的指紋:固定策略把一批簡單模式的局玩完,把事件、狀態、提示、可用動作全部串起來算雜湊。
// 同一份檔案在困難模式加入前的版本(8e3de83)跑出來的值,就是 hard.test.ts 釘住的那個數字 —— 簡單模式一個位元都沒變。
import { canUse, listAvailableActions } from '../src/game/actions';
import { goalProgress, suggestAction } from '../src/game/hints';
import { createGame, playTurn, toggleEyes } from '../src/game/turn';
import type { ActionId, GameState, Goal, Role } from '../src/game/types';
import { partnerOf } from '../src/game/types';

type Decision = { id: ActionId; force: number; eyes?: 'open' | 'closed' };
const first = (s: GameState, ids: ActionId[]): ActionId => ids.find((id) => canUse(s, s.playerRole, id)) ?? 'whisper';
const STRATS: Record<string, (s: GameState) => Decision> = {
  sleepOnly: () => ({ id: 'sleep', force: 0, eyes: 'closed' }),
  kissCaress: (s) => {
    if (s.chars[s.playerRole].posture !== 'sideFacing') return { id: 'lieSideFacing', force: 0, eyes: 'open' };
    return { id: first(s, s.turn % 2 === 0 ? ['kiss', 'caress', 'scootIn'] : ['caress', 'kiss', 'scootIn']), force: 35, eyes: 'open' };
  },
  patThenSleep: (s) => (s.chars[partnerOf(s.playerRole)].sleep >= 70 ? { id: 'sleep', force: 0, eyes: 'closed' } : { id: 'pat', force: 30, eyes: 'closed' }),
  roughHug: (s) => (s.chars[s.playerRole].posture !== 'sideFacing' ? { id: 'lieSideFacing', force: 0, eyes: 'open' } : { id: 'hug', force: 100, eyes: 'open' }),
  awayThenSleep: (s) => (s.turn === 0 && s.chars[s.playerRole].posture !== 'sideAway' ? { id: 'lieSideAway', force: 0, eyes: 'closed' } : { id: 'sleep', force: 0, eyes: 'closed' }),
  hints: (s) => {
    const sug = suggestAction(s);
    if (!sug) return { id: 'sleep', force: 0, eyes: 'closed' };
    if (sug.eyes && !sug.actionId) {
      const again = suggestAction(toggleEyes(s, sug.eyes).state);
      return { id: again?.actionId ?? (sug.eyes === 'closed' ? 'sleep' : 'whisper'), force: again?.force ?? 0, eyes: sug.eyes };
    }
    return { id: sug.actionId ?? 'sleep', force: sug.force ?? 0, eyes: sug.eyes ?? s.chars[s.playerRole].eyes };
  },
};

/** cyrb53:穩定的 53 位元字串雜湊 */
function cyrb53(str: string, h1 = 0xdeadbeef, h2 = 0x41c6ce57): [number, number] {
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return [h1 >>> 0, h2 >>> 0];
}

/** 狀態裡困難模式才有的欄位拿掉(mode: 'easy'、GoalProgress.kind),其餘照原樣 */
const plain = (s: GameState) => {
  const { mode: _mode, ...rest } = s as GameState & { mode?: string };
  return rest;
};
const progress = (s: GameState) => {
  const { kind: _kind, ...rest } = goalProgress(s) as ReturnType<typeof goalProgress> & { kind?: string };
  return rest;
};

export function easyFingerprint(seeds = 25): { hash: string; games: number; turns: number } {
  let h: [number, number] = [0xdeadbeef, 0x41c6ce57];
  const feed = (x: unknown) => (h = cyrb53(JSON.stringify(x), h[0], h[1]));
  let games = 0;
  let turns = 0;
  const goals: Goal[] = ['sleep', 'intimacy'];
  for (const role of ['male', 'female'] as Role[])
    for (const pg of goals)
      for (const qg of goals)
        for (const name of Object.keys(STRATS))
          for (let seed = 0; seed < seeds; seed++) {
            let s = createGame(role, seed, { playerGoal: pg, partnerGoal: qg });
            feed(plain(s));
            while (!s.ending && s.turn < 20) {
              feed([suggestAction(s), progress(s), listAvailableActions(s, role)]);
              const d = STRATS[name](s);
              if (d.eyes && s.chars[role].eyes !== d.eyes) {
                const t = toggleEyes(s, d.eyes);
                feed(t.events);
                s = t.state;
              }
              const r = playTurn(s, d.id, d.force);
              feed([r.events, plain(r.intermediate), plain(r.state)]);
              s = r.state;
              turns++;
            }
            games++;
          }
  return { hash: h.map((x) => x.toString(16).padStart(8, '0')).join(''), games, turns };
}
