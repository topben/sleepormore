// Solvability table (DESIGN §12, numbers as re-balanced in §14.3): seeds 0..99 × both roles with the fixed
// strategies of tests/strategies.ts. Every intermediate and final state is also checked for NaN / out-of-range.
import { describe, expect, it } from 'vitest';
import { listAvailableActions } from '../src/game/actions';
import { mulberry32 } from '../src/game/rng';
import { aiEyes } from '../src/game/rules';
import { createGame, playTurn, toggleEyes } from '../src/game/turn';
import type { Ending, GameState, Goal, Role } from '../src/game/types';
import { partnerOf } from '../src/game/types';
import { eventViolations, stateViolations } from './helpers';
import { runGame, STRATS, type Strategy } from './strategies';

const SEEDS = Array.from({ length: 100 }, (_, i) => i);
const ROLES: Role[] = ['male', 'female'];

interface Played {
  ending: Ending;
  state: GameState;
  turnsPlayed: number;
  problems: string[];
}

/** Same loop as strategies.runGame, but records turns played and checks every state/event on the way */
function playRecorded(role: Role, seed: number, playerGoal: Goal | undefined, partnerGoal: Goal | undefined, strat: Strategy): Played {
  let s = createGame(role, seed, { playerGoal, partnerGoal });
  const problems = stateViolations(s, `${role}/${seed} start`);
  let turnsPlayed = 0;
  while (!s.ending && turnsPlayed < 20) {
    const where = `${role}/${seed} t${s.turn}`;
    const d = strat(s);
    if (d.eyes && s.chars[role].eyes !== d.eyes) {
      const t = toggleEyes(s, d.eyes);
      problems.push(...stateViolations(t.state, `${where} eyes`), ...eventViolations(t.events, `${where} eyes`));
      s = t.state;
    }
    const r = playTurn(s, d.id, d.force);
    turnsPlayed++;
    problems.push(
      ...stateViolations(r.intermediate, `${where} ${d.id} intermediate`),
      ...stateViolations(r.state, `${where} ${d.id}`),
      ...eventViolations(r.events, `${where} ${d.id}`),
    );
    const ai = r.state.chars[partnerOf(role)];
    if (ai.eyes !== aiEyes(ai)) problems.push(`${where} AI eyes out of sync`);
    s = r.state;
  }
  if (!s.ending) problems.push(`${role}/${seed} no ending after 20 turns`);
  else if (s.turn > 12) problems.push(`${role}/${seed} ran past 06:00`);
  return { ending: s.ending as Ending, state: s, turnsPlayed, problems };
}

type RunResult = ReturnType<typeof runAllUncached>;
const cache = new Map<string, RunResult>();
/** 200 games (seeds 0..99 × both roles); cached per (goals, strategy) so rows can be compared without replaying */
function runAll(playerGoal: Goal | undefined, partnerGoal: Goal | undefined, strat: Strategy): RunResult {
  const name = Object.entries(STRATS).find(([, f]) => f === strat)?.[0];
  if (!name) return runAllUncached(playerGoal, partnerGoal, strat);
  const key = `${playerGoal}/${partnerGoal}/${name}`;
  if (!cache.has(key)) cache.set(key, runAllUncached(playerGoal, partnerGoal, strat));
  return cache.get(key)!;
}

function runAllUncached(playerGoal: Goal | undefined, partnerGoal: Goal | undefined, strat: Strategy) {
  const games: Played[] = [];
  for (const role of ROLES) for (const seed of SEEDS) games.push(playRecorded(role, seed, playerGoal, partnerGoal, strat));
  const rate = (pred: (g: Played) => boolean) => games.filter(pred).length / games.length;
  return { games, rate, win: rate((g) => g.ending.outcome === 'win'), problems: games.flatMap((g) => g.problems) };
}

describe('§12 win-rate table (200 games per row)', () => {
  const rows: { n: string; player: Goal; partner: Goal; strat: keyof typeof STRATS; lo: number; hi: number }[] = [
    { n: '#1 sleep/sleep, sleep every turn', player: 'sleep', partner: 'sleep', strat: 'sleepOnly', lo: 0.9, hi: 1 },
    { n: '#2 intimacy/intimacy, face then kiss/caress 35', player: 'intimacy', partner: 'intimacy', strat: 'kissCaress', lo: 0.7, hi: 1 },
    { n: '#3 sleep/intimacy, pat 30 until they sleep, then sleep', player: 'sleep', partner: 'intimacy', strat: 'patThenSleep', lo: 0.35, hi: 0.8 },
    { n: '#4 intimacy/sleep, raise mood to 70 then kiss/caress 35', player: 'intimacy', partner: 'sleep', strat: 'moodThenKiss', lo: 0.25, hi: 0.7 },
    { n: '#6 sleep/intimacy, fake sleep to the end', player: 'sleep', partner: 'intimacy', strat: 'sleepOnly', lo: 0, hi: 0.35 },
    { n: '#7 sleep/intimacy, turn away then sleep', player: 'sleep', partner: 'intimacy', strat: 'awayThenSleep', lo: 0, hi: 0.6 },
  ];

  it.each(rows.map((r) => [r.n, r] as const))('%s', (_n, row) => {
    const res = runAll(row.player, row.partner, STRATS[row.strat]);
    expect(res.problems).toEqual([]);
    expect(res.win, `${row.n}: win rate ${res.win}`).toBeGreaterThanOrEqual(row.lo);
    expect(res.win, `${row.n}: win rate ${res.win}`).toBeLessThanOrEqual(row.hi);
  });

  it('#5 any goals, face then rough hug (force 100) every turn: never wins, ≥ 90% thrown out within 8 turns, ≥ 20% kicked', () => {
    const res = runAll(undefined, undefined, STRATS.roughHug);
    expect(res.problems).toEqual([]);
    expect(res.win).toBe(0);
    const early = res.rate((g) => (g.ending.id === 'kickedOff' || g.ending.id === 'fellOff') && g.turnsPlayed <= 8);
    expect(early, `thrown out within 8 turns: ${early}`).toBeGreaterThanOrEqual(0.9);
    const kicked = res.rate((g) => g.ending.id === 'kickedOff');
    expect(kicked, `kickedOff share: ${kicked}`).toBeGreaterThanOrEqual(0.2);
  });

  it('§14.3 ordering for a sleeper courted by an intimacy partner: fake sleep (#6) < turn away (#7) < lull first (#3)', () => {
    const fake = runAll('sleep', 'intimacy', STRATS.sleepOnly).win;
    const shield = runAll('sleep', 'intimacy', STRATS.awayThenSleep).win;
    const lull = runAll('sleep', 'intimacy', STRATS.patThenSleep).win;
    expect(fake, `#6 ${fake} < #7 ${shield}`).toBeLessThan(shield);
    expect(shield, `#7 ${shield} < #3 ${lull}`).toBeLessThan(lull);
  });

  it('#5 rough hugging never wins for any fixed goal pairing either', () => {
    for (const pg of ['sleep', 'intimacy'] as Goal[]) {
      for (const qg of ['sleep', 'intimacy'] as Goal[]) {
        const res = runAll(pg, qg, STRATS.roughHug);
        expect(res.win, `${pg}/${qg}`).toBe(0);
        expect(res.problems).toEqual([]);
      }
    }
  });

  it('the recording loop replays exactly what strategies.runGame produces', () => {
    for (const [pg, qg, strat] of [
      ['sleep', 'intimacy', 'patThenSleep'],
      ['intimacy', 'sleep', 'moodThenKiss'],
      [undefined, undefined, 'roughHug'],
    ] as const) {
      for (const role of ROLES) {
        for (const seed of SEEDS.slice(0, 25)) {
          expect(playRecorded(role, seed, pg, qg, STRATS[strat]).state).toEqual(runGame(role, seed, pg, qg, STRATS[strat]).state);
        }
      }
    }
  });
});

describe('invariants under a random policy', () => {
  it('random available actions, random forces and eye toggles: every state stays in range, every game ends at 06:00 at the latest', () => {
    const problems: string[] = [];
    const endings = new Set<string>();
    for (const role of ROLES) {
      for (const seed of SEEDS) {
        const rnd = mulberry32(seed * 7919 + (role === 'male' ? 1 : 2));
        const strat: Strategy = (s) => {
          const ok = listAvailableActions(s, role).filter((a) => a.ok);
          const a = ok[Math.floor(rnd() * ok.length)];
          const eyes = rnd() < 0.25 ? (s.chars[role].eyes === 'open' ? 'closed' : 'open') : undefined;
          return { id: a.def.id, force: Math.round(rnd() * 100), eyes };
        };
        const g = playRecorded(role, seed, undefined, undefined, strat);
        problems.push(...g.problems);
        endings.add(g.ending.id);
        if (g.ending.id !== 'kickedOff' && g.ending.id !== 'fellOff' && g.ending.id !== 'intimacyWin' && g.ending.id !== 'accidentalIntimacy') {
          if (g.state.turn !== 12) problems.push(`${role}/${seed} ${g.ending.id} before 06:00`);
        }
      }
    }
    expect(problems.slice(0, 20)).toEqual([]);
    expect(endings.size).toBeGreaterThanOrEqual(4); // the policy explores several outcomes
  });
});
