// Shared test helpers for the game-logic suites (not a test file itself).
import { MAX_TURNS } from '../src/game/constants';
import type { Rng } from '../src/game/rng';
import { endOfTurn, resolveAction, type ResolveOpts } from '../src/game/rules';
import { ZH } from '../src/game/text';
import { createGame } from '../src/game/turn';
import type { ActionId, CharacterState, GameEvent, GameState, Goal, Posture, Role } from '../src/game/types';
import { partnerOf } from '../src/game/types';

export const ROLES: Role[] = ['male', 'female'];

export type Ev<T extends GameEvent['type']> = Extract<GameEvent, { type: T }>;
export type ActionEvent = Ev<'action'>;

export function ofType<T extends GameEvent['type']>(events: GameEvent[], type: T): Ev<T>[] {
  return events.filter((e): e is Ev<T> => e.type === type);
}

/** Speech lines as `who:key`, e.g. `female:receptiveKiss` */
export const lines = (events: GameEvent[]): string[] => ofType(events, 'speech').map((e) => `${e.who}:${e.key}`);

/** Constant RNG (0 → every `r < p` branch taken; 0.99 → none taken) */
export const constRng =
  (v: number): Rng =>
  () =>
    v;

/** Scripted RNG: returns the values in order, then keeps repeating the last one */
export function seqRng(...vals: number[]): Rng {
  let i = 0;
  return () => vals[Math.min(i++, vals.length - 1)];
}

export interface SceneOpts {
  /** player role (default male) */
  role?: Role;
  seed?: number;
  playerGoal?: Goal;
  partnerGoal?: Goal;
}

type Mutator = (s: GameState, me: CharacterState, ai: CharacterState) => void;

/**
 * A neutral mid-game state built from createGame + a cloned/mutated copy:
 * turn 1, both awake (sleep 0), eyes open, lying sideFacing within reach (distance 0.6),
 * mood 60, annoyance 0, warmth 60, restless 0, no lastAction, blanket centred, intimacy 10.
 */
export function scene(opts: SceneOpts = {}, mutate?: Mutator): GameState {
  const role = opts.role ?? 'male';
  const s = structuredClone(
    createGame(role, opts.seed ?? 7, { playerGoal: opts.playerGoal ?? 'intimacy', partnerGoal: opts.partnerGoal ?? 'intimacy' }),
  );
  s.turn = 1;
  for (const r of ROLES) {
    const c = s.chars[r];
    c.posture = 'sideFacing';
    c.eyes = 'open';
    c.sleep = 0;
    c.mood = 60;
    c.annoyance = 0;
    c.warmth = 60;
    c.restless = 0;
    c.lastAction = null;
  }
  s.chars.male.lateral = -0.3;
  s.chars.female.lateral = 0.3;
  mutate?.(s, s.chars[role], s.chars[partnerOf(role)]);
  return s;
}

const POSTURES: Posture[] = ['supine', 'sideFacing', 'sideAway', 'prone'];
const ACTION_IDS = Object.keys(ZH.action) as ActionId[];

/**
 * A broad random (but structurally valid) mid-game state: any stats (with extra weight on rule boundaries),
 * postures (the player is never prone), eyes, positions, blanket, embrace, arm pillow, memo counters.
 * The AI's eyes follow the §1 rule.
 */
export function randomState(rnd: Rng): GameState {
  const role: Role = rnd() < 0.5 ? 'male' : 'female';
  const goal = (): Goal => (rnd() < 0.5 ? 'sleep' : 'intimacy');
  const val = () => (rnd() < 0.15 ? [0, 30, 45, 50, 60, 70, 75, 100][Math.floor(rnd() * 8)] : rnd() * 100);
  return scene({ role, playerGoal: goal(), partnerGoal: goal(), seed: Math.floor(rnd() * 1000) }, (st) => {
    st.turn = Math.floor(rnd() * 12);
    for (const r of ROLES) {
      const c = st.chars[r];
      c.sleep = val();
      c.mood = val();
      c.annoyance = val();
      c.warmth = val();
      c.restless = val();
      c.posture = POSTURES[Math.floor(rnd() * (r === role ? 3 : 4))];
      c.lastAction = rnd() < 0.2 ? null : ACTION_IDS[Math.floor(rnd() * ACTION_IDS.length)];
      c.eyes = rnd() < 0.5 ? 'open' : 'closed';
    }
    const ai = st.chars[partnerOf(role)];
    ai.eyes = ai.sleep >= 70 || ai.lastAction === 'sleep' ? 'closed' : 'open';
    const spread = (lim: number) => 0.1 + rnd() * (lim - 0.1);
    st.chars.male.lateral = -(rnd() < 0.2 ? 0.1 : spread(role === 'male' ? 0.99 : 0.9));
    st.chars.female.lateral = rnd() < 0.2 ? 0.1 : spread(role === 'female' ? 0.99 : 0.9);
    st.blanketOffset = rnd() < 0.2 ? [-1, 1][Math.floor(rnd() * 2)] : rnd() * 2 - 1;
    st.intimacy = val();
    st.embrace = rnd() < 0.3;
    const offered = rnd() < 0.4;
    st.armPillow = { offered, inUse: offered && rnd() < 0.6, numbness: val() };
    st.sleepScore = Math.floor(rnd() * 16) / 2;
    st.memo.pullStreak = Math.floor(rnd() * 3);
    st.memo.goodnightSpoken = rnd() < 0.5;
    st.memo.clues = { sleep: Math.floor(rnd() * 3), intimacy: Math.floor(rnd() * 3) };
  });
}

/** Put a character to sleep consistently with the AI eye rule (closed eyes, lastAction sleep) */
export function asleep(c: CharacterState, sleep = 80): void {
  c.sleep = sleep;
  c.eyes = 'closed';
  c.lastAction = 'sleep';
}

/** Run resolveAction on a clone and return the new state + events */
export function act(
  s0: GameState,
  actor: Role,
  id: ActionId,
  force = 0,
  rng: Rng = constRng(0.99),
  opts: ResolveOpts = {},
) {
  const s = structuredClone(s0);
  const events: GameEvent[] = [];
  resolveAction(s, actor, id, force, rng, events, opts);
  const action = ofType(events, 'action')[0];
  return { s, events, action, notes: action.noteKeys ?? [], lines: lines(events) };
}

/** Run endOfTurn on a clone */
export function eot(s0: GameState, rng: Rng = constRng(0.99)) {
  const s = structuredClone(s0);
  const events: GameEvent[] = [];
  endOfTurn(s, rng, events);
  return { s, events, lines: lines(events) };
}

export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o as Record<string, unknown>)) deepFreeze(v);
  }
  return o;
}

const bad = (v: unknown, lo: number, hi: number) => typeof v !== 'number' || !Number.isFinite(v) || v < lo || v > hi;

/** Every numeric invariant of §1/§2 (clamps, no NaN, no crossing the bed centre, arm pillow consistency) */
export function stateViolations(s: GameState, where = ''): string[] {
  const out: string[] = [];
  const chk = (name: string, v: unknown, lo: number, hi: number) => {
    if (bad(v, lo, hi)) out.push(`${where} ${name}=${String(v)} ∉ [${lo},${hi}]`);
  };
  for (const r of ROLES) {
    const c = s.chars[r];
    for (const k of ['sleep', 'mood', 'annoyance', 'warmth', 'restless'] as const) chk(`${r}.${k}`, c[k], 0, 100);
    const lim = r === s.playerRole ? 1 : 0.9;
    chk(`${r}.lateral`, c.lateral, -lim, lim);
  }
  chk('male.lateral(center)', s.chars.male.lateral, -1, -0.1 + 1e-9);
  chk('female.lateral(center)', s.chars.female.lateral, 0.1 - 1e-9, 1);
  chk('intimacy', s.intimacy, 0, 100);
  chk('numbness', s.armPillow.numbness, 0, 100);
  chk('blanketOffset', s.blanketOffset, -1, 1);
  chk('sleepScore', s.sleepScore, 0, MAX_TURNS);
  chk('turn', s.turn, 0, MAX_TURNS);
  if (s.armPillow.inUse && !s.armPillow.offered) out.push(`${where} armPillow.inUse without offered`);
  return out;
}

/** Numeric event payloads are finite; i18n keys resolve in the zh-TW dictionary */
export function eventViolations(events: GameEvent[], where = ''): string[] {
  const out: string[] = [];
  const msg = ZH.msg as Record<string, string>;
  const speech = ZH.speech as Record<string, readonly string[]>;
  for (const e of events) {
    for (const [k, v] of Object.entries(e)) {
      if (typeof v === 'number' && !Number.isFinite(v)) out.push(`${where} ${e.type}.${k}=${v}`);
    }
    if (e.type === 'action') {
      for (const k of e.noteKeys ?? []) if (!(k in msg)) out.push(`${where} unknown note key ${k}`);
      if (e.noteKeys?.length && e.note !== e.noteKeys.map((k) => msg[k]).join(',')) out.push(`${where} note text mismatch`);
    }
    if (e.type === 'speech') {
      const pool = e.key ? speech[e.key] : undefined;
      if (!pool || e.index === undefined || e.index < 0 || e.index >= pool.length || pool[e.index] !== e.text) {
        out.push(`${where} bad speech ${e.key}#${e.index}`);
      }
    }
    if (e.type === 'note' && (!e.key || !(e.key in msg))) out.push(`${where} bad note key ${e.key}`);
  }
  return out;
}
