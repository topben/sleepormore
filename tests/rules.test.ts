// Rules layer (DESIGN §1–§6, as amended by §14). Scenarios are built with createGame → clone → mutate
// (tests/helpers.ts `scene`), then resolveAction / endOfTurn are run on a clone.
import { describe, expect, it } from 'vitest';
import { ACTIONS, canUse, checkAction, listAvailableActions } from '../src/game/actions';
import { BAL, BANDS } from '../src/game/constants';
import { mulberry32 } from '../src/game/rng';
import {
  apparentlyAsleep,
  applyNoise,
  breathRate,
  effectiveNoise,
  forceBand,
  forceWindow,
  noiseRisk,
  projectedNoise,
  receptive,
  sleepyDecline,
  snoreLevel,
  wakeThreshold,
} from '../src/game/rules';
import { SHARED_GOODNIGHT_LINES } from '../src/game/speech';
import { ZH } from '../src/game/text';
import { createGame, playTurn, splitPhases, toggleEyes } from '../src/game/turn';
import type { ActionCategory, ActionId, CharacterState, GameState, Posture, Role } from '../src/game/types';
import { partnerOf } from '../src/game/types';
import { coverOf, distanceOf } from '../src/game/util';
import { act, asleep, constRng, eot, ofType, randomState, scene, stateViolations } from './helpers';

const round1 = (v: number) => Math.round(v * 10) / 10;
const FORCE_ACTIONS: ActionId[] = ['hug', 'kiss', 'caress', 'pat', 'pullBlanket', 'tuckBlanket', 'scootIn', 'scootOut', 'withdrawArm'];
const ALL_ACTIONS = Object.keys(ACTIONS) as ActionId[];
/** a gentle force for an action (window lo); 0 for non-force actions */
const gentle = (id: ActionId) => (ACTIONS[id].usesForce ? ACTIONS[id].forceWindow[0] : 0);

// ───────────────────────── §1 derived pure functions ─────────────────────────

describe('§1 derived functions', () => {
  const ch = (p: Partial<CharacterState>): CharacterState => ({ ...scene().chars.female, ...p });

  it('breathRate: 16 / 12 / 8 / 6 by sleep band; faking sleep = 14 and perfectly regular', () => {
    expect(breathRate(ch({ sleep: 0 }))).toEqual({ rate: 16, regular: false });
    expect(breathRate(ch({ sleep: 29 }))).toEqual({ rate: 16, regular: false });
    expect(breathRate(ch({ sleep: 30 }))).toEqual({ rate: 12, regular: false });
    expect(breathRate(ch({ sleep: 69 }))).toEqual({ rate: 12, regular: false });
    expect(breathRate(ch({ sleep: 70 }))).toEqual({ rate: 8, regular: false });
    expect(breathRate(ch({ sleep: 99 }))).toEqual({ rate: 8, regular: false });
    expect(breathRate(ch({ sleep: 100 }))).toEqual({ rate: 6, regular: false });
    expect(breathRate(ch({ sleep: 29, lastAction: 'sleep' }))).toEqual({ rate: 14, regular: true });
    expect(breathRate(ch({ sleep: 30, lastAction: 'sleep' }))).toEqual({ rate: 12, regular: false });
    expect(breathRate(ch({ sleep: 85, lastAction: 'sleep' }))).toEqual({ rate: 8, regular: false });
  });

  it('snoreLevel: 0 below 70 or prone; supine 2 (3 from 90); side postures 1', () => {
    expect(snoreLevel(ch({ sleep: 69, posture: 'supine' }))).toBe(0);
    expect(snoreLevel(ch({ sleep: 70, posture: 'supine' }))).toBe(2);
    expect(snoreLevel(ch({ sleep: 89, posture: 'supine' }))).toBe(2);
    expect(snoreLevel(ch({ sleep: 90, posture: 'supine' }))).toBe(3);
    expect(snoreLevel(ch({ sleep: 100, posture: 'prone' }))).toBe(0);
    expect(snoreLevel(ch({ sleep: 100, posture: 'sideFacing' }))).toBe(1);
    expect(snoreLevel(ch({ sleep: 70, posture: 'sideAway' }))).toBe(1);
  });

  it('apparentlyAsleep is false whenever eyes are open', () => {
    for (const sleep of [0, 29, 50, 70, 100])
      for (const lastAction of [null, 'sleep', 'hug'] as const)
        for (const restless of [0, 49, 100]) expect(apparentlyAsleep(ch({ eyes: 'open', sleep, lastAction, restless }))).toBe(false);
  });

  it('apparentlyAsleep with closed eyes: (sleep >= 70 or just chose sleep) and restless < 50', () => {
    expect(apparentlyAsleep(ch({ eyes: 'closed', sleep: 70 }))).toBe(true);
    expect(apparentlyAsleep(ch({ eyes: 'closed', sleep: 0, lastAction: 'sleep' }))).toBe(true); // faking works on the AI
    expect(apparentlyAsleep(ch({ eyes: 'closed', sleep: 69, lastAction: 'lieSupine' }))).toBe(false);
    expect(apparentlyAsleep(ch({ eyes: 'closed', sleep: 100, restless: 49 }))).toBe(true);
    expect(apparentlyAsleep(ch({ eyes: 'closed', sleep: 100, restless: 50 }))).toBe(false);
  });

  it('wakeThreshold T = 15 + 0.45·sleep from sleep 45, Infinity below', () => {
    expect(wakeThreshold(ch({ sleep: 44.99 }))).toBe(Infinity);
    expect(wakeThreshold(ch({ sleep: 45 }))).toBeCloseTo(35.25);
    expect(wakeThreshold(ch({ sleep: 70 }))).toBeCloseTo(46.5);
    expect(wakeThreshold(ch({ sleep: 100 }))).toBeCloseTo(60);
  });

  it('receptive = sleep < 70 && annoyance < 50 && mood >= 40', () => {
    expect(receptive(ch({ sleep: 69, annoyance: 49, mood: 40 }))).toBe(true);
    expect(receptive(ch({ sleep: 70, annoyance: 0, mood: 60 }))).toBe(false);
    expect(receptive(ch({ sleep: 0, annoyance: 50, mood: 60 }))).toBe(false);
    expect(receptive(ch({ sleep: 0, annoyance: 0, mood: 39 }))).toBe(false);
  });

  it('cover: male = clamp(0.75 − 0.6·offset), female = clamp(0.75 + 0.6·offset); distance = female − male', () => {
    expect(coverOf('male', 0)).toBeCloseTo(0.75);
    expect(coverOf('female', 0)).toBeCloseTo(0.75);
    expect(coverOf('male', 0.5)).toBeCloseTo(0.45);
    expect(coverOf('female', 0.5)).toBe(1);
    expect(coverOf('male', -1)).toBe(1);
    expect(coverOf('female', -1)).toBeCloseTo(0.15);
    expect(distanceOf(createGame('male', 1))).toBeCloseTo(0.7);
  });

  it('sleepyDecline = goal sleep && mood < BAL.sleepyMood (§14.3 raised 70 → 75)', () => {
    expect(BAL.sleepyMood).toBeGreaterThanOrEqual(70);
    expect(sleepyDecline(ch({ goal: 'sleep', mood: BAL.sleepyMood - 1 }))).toBe(true);
    expect(sleepyDecline(ch({ goal: 'sleep', mood: BAL.sleepyMood }))).toBe(false);
    expect(sleepyDecline(ch({ goal: 'intimacy', mood: 0 }))).toBe(false);
  });
});

// ───────────────────────── §5 action table metadata ─────────────────────────

describe('§5 action table', () => {
  const BOTH: Role[] = ['male', 'female'];
  const TABLE: Record<ActionId, { cat: ActionCategory; roles: Role[]; noise: number; window?: [number, number] }> = {
    lieSupine: { cat: 'posture', roles: BOTH, noise: 20 },
    lieSideFacing: { cat: 'posture', roles: BOTH, noise: 20 },
    lieSideAway: { cat: 'posture', roles: BOTH, noise: 20 },
    lieProne: { cat: 'posture', roles: [], noise: 25 },
    hug: { cat: 'affection', roles: BOTH, noise: 35, window: [25, 55] },
    kiss: { cat: 'affection', roles: BOTH, noise: 30, window: [20, 50] },
    caress: { cat: 'affection', roles: BOTH, noise: 28, window: [20, 50] },
    whisper: { cat: 'affection', roles: BOTH, noise: 15 },
    pat: { cat: 'rest', roles: BOTH, noise: 12, window: [15, 45] },
    offerArm: { cat: 'arm', roles: ['male'], noise: 15 },
    restOnArm: { cat: 'arm', roles: ['female'], noise: 15 },
    leaveArm: { cat: 'arm', roles: ['female'], noise: 12 },
    withdrawArm: { cat: 'arm', roles: ['male'], noise: 25, window: [15, 45] },
    pullBlanket: { cat: 'blanket', roles: BOTH, noise: 30, window: [35, 65] },
    tuckBlanket: { cat: 'blanket', roles: BOTH, noise: 10, window: [15, 50] },
    scootIn: { cat: 'move', roles: BOTH, noise: 15, window: [15, 50] },
    scootOut: { cat: 'move', roles: BOTH, noise: 15, window: [15, 50] },
    sleep: { cat: 'rest', roles: BOTH, noise: 0 },
    push: { cat: 'partner', roles: [], noise: 20 },
  };

  it.each(ALL_ACTIONS)('%s: category / roles / baseNoise / force window as in §5', (id) => {
    const d = ACTIONS[id];
    const t = TABLE[id];
    expect(d.id).toBe(id);
    expect(d.category).toBe(t.cat);
    expect([...d.roles].sort()).toEqual([...t.roles].sort());
    expect(d.baseNoise).toBe(t.noise);
    expect(d.usesForce).toBe(!!t.window);
    if (t.window) expect(d.forceWindow).toEqual(t.window);
    expect(d.label.length).toBeGreaterThan(0);
    expect(d.emoji.length).toBeGreaterThan(0);
  });

  it('exactly the nine §3 actions use force', () => {
    expect(ALL_ACTIONS.filter((id) => ACTIONS[id].usesForce).sort()).toEqual([...FORCE_ACTIONS].sort());
  });

  it('listAvailableActions lists only actions whose roles include the actor, with ok/reason matching available()', () => {
    for (const role of BOTH) {
      const s = scene({ role });
      for (const actor of BOTH) {
        const list = listAvailableActions(s, actor);
        expect(list.map((a) => a.def.id).sort()).toEqual(ALL_ACTIONS.filter((id) => ACTIONS[id].roles.includes(actor)).sort());
        for (const a of list) {
          const r = ACTIONS[a.def.id].available(s, actor);
          expect(a.ok).toBe(r.ok);
          if (!r.ok) {
            expect(a.reasonKey).toBe(r.reasonKey);
            expect(a.reason).toBe(ZH.msg[r.reasonKey as keyof typeof ZH.msg]);
          }
        }
      }
      // AI-only actions never reach the player's menu
      const ids = listAvailableActions(s, role).map((a) => a.def.id);
      expect(ids).not.toContain('push');
      expect(ids).not.toContain('lieProne');
    }
  });
});

// ───────────────────────── §3 force ─────────────────────────

describe('§3 force bands', () => {
  it('BANDS: eff / noise multipliers', () => {
    expect(BANDS.timid).toMatchObject({ eff: 0.5, noise: 0.6 });
    expect(BANDS.gentle).toMatchObject({ eff: 1, noise: 1 });
    expect(BANDS.firm).toMatchObject({ eff: 1.25, noise: 1.7 });
    expect(BANDS.rough).toMatchObject({ eff: 1.5, noise: 2.6 });
  });

  it.each(FORCE_ACTIONS)('%s: lo-0.01 timid, lo gentle, hi gentle, hi+0.01 firm, hi+25 firm, hi+25.01 rough', (id) => {
    const w = ACTIONS[id].forceWindow;
    const [lo, hi] = w;
    expect(forceBand(w, lo - 0.01)).toBe('timid');
    expect(forceBand(w, lo)).toBe('gentle');
    expect(forceBand(w, hi)).toBe('gentle');
    expect(forceBand(w, hi + 0.01)).toBe('firm');
    expect(forceBand(w, hi + 25)).toBe('firm');
    expect(forceBand(w, hi + 25.01)).toBe('rough');
  });

  it('the band reported by the action event follows the same boundaries (player hug, window [25,55])', () => {
    const s = scene();
    const band = (f: number) => act(s, 'male', 'hug', f).action.band;
    expect(band(24.99)).toBe('timid');
    expect(band(25)).toBe('gentle');
    expect(band(55)).toBe('gentle');
    expect(band(80)).toBe('firm');
    expect(band(80.01)).toBe('rough');
  });

  it('closed-eyes player pullBlanket green zone shrinks to [40,60] (player only, pullBlanket only)', () => {
    const closed = scene({}, (_s, me, ai) => {
      me.eyes = 'closed';
      ai.eyes = 'closed';
    });
    expect(forceWindow(closed, 'male', 'pullBlanket')).toEqual([40, 60]);
    expect(forceWindow(closed, 'female', 'pullBlanket')).toEqual([35, 65]); // AI unaffected (§14.2)
    expect(forceWindow(closed, 'male', 'pat')).toEqual([15, 45]);
    expect(forceWindow(scene(), 'male', 'pullBlanket')).toEqual([35, 65]);
    expect(act(closed, 'male', 'pullBlanket', 39.99).action.band).toBe('timid');
    expect(act(closed, 'male', 'pullBlanket', 40).action.band).toBe('gentle');
    expect(act(closed, 'male', 'pullBlanket', 60).action.band).toBe('gentle');
    expect(act(closed, 'male', 'pullBlanket', 85).action.band).toBe('firm');
    expect(act(closed, 'male', 'pullBlanket', 85.01).action.band).toBe('rough');
  });

  it('non-force actions are always gentle with force 0; out-of-range / NaN force is clamped', () => {
    const s = scene();
    expect(act(s, 'male', 'whisper', 100).action).toMatchObject({ band: 'gentle', force: 0, noise: 15 });
    expect(act(s, 'male', 'kiss', 250).action).toMatchObject({ band: 'rough', force: 100 });
    expect(act(s, 'male', 'kiss', -40).action).toMatchObject({ band: 'timid', force: 0 });
    expect(act(s, 'male', 'kiss', Number.NaN).action).toMatchObject({ band: 'timid', force: 0 });
  });

  it('firm adds +4 annoyance to an awake target, not to a sleeping one; rough adds +15 always', () => {
    const awake = scene({}, (_s, _me, ai) => (ai.annoyance = 20));
    expect(act(awake, 'male', 'pat', 60).s.chars.female.annoyance).toBeCloseTo(20 + 4 - 12 * 1.25);
    const sleeping = scene({}, (_s, _me, ai) => {
      asleep(ai, 90);
      ai.annoyance = 20;
    });
    expect(act(sleeping, 'male', 'pat', 60).s.chars.female.annoyance).toBeCloseTo(20 - 12 * 1.25);
    const r = act(sleeping, 'male', 'pat', 100);
    expect(r.s.chars.female.annoyance).toBe(35);
    expect(r.notes).toContain('tooRough');
  });
});

// ───────────────────────── §1.1 eyes ─────────────────────────

describe('§1.1 eyes open / closed', () => {
  it('player `sleep` needs closed eyes (reasonKey closeEyesFirst)', () => {
    const s = scene();
    const item = listAvailableActions(s, 'male').find((a) => a.def.id === 'sleep')!;
    expect(item).toMatchObject({ ok: false, reasonKey: 'closeEyesFirst' });
    expect(canUse(toggleEyes(s, 'closed').state, 'male', 'sleep')).toBe(true);
  });

  it('player kiss / hug need open eyes; caress works blind', () => {
    const closed = scene({}, (_s, me) => (me.eyes = 'closed'));
    expect(checkAction(closed, 'male', 'kiss')).toMatchObject({ ok: false, reasonKey: 'eyesClosedKiss' });
    expect(checkAction(closed, 'male', 'hug')).toMatchObject({ ok: false, reasonKey: 'eyesClosedHug' });
    expect(canUse(closed, 'male', 'caress')).toBe(true);
    const open = scene();
    expect(canUse(open, 'male', 'kiss')).toBe(true);
    expect(canUse(open, 'male', 'hug')).toBe(true);
  });

  it('eye restrictions apply to the player only (§14.2): AI may sleep with open eyes and kiss/hug with closed eyes', () => {
    expect(canUse(scene(), 'female', 'sleep')).toBe(true);
    const aiClosed = scene({}, (_s, _me, ai) => (ai.eyes = 'closed'));
    expect(canUse(aiClosed, 'female', 'kiss')).toBe(true);
    expect(canUse(aiClosed, 'female', 'hug')).toBe(true);
  });

  it('closed-eyes force actions are +5 noisier (player only); non-force actions are not', () => {
    const open = scene();
    const closed = scene({}, (_s, me) => (me.eyes = 'closed'));
    const cases: [ActionId, number][] = [
      ['caress', 28],
      ['pat', 12],
      ['pullBlanket', 30],
      ['tuckBlanket', 10],
      ['scootIn', 15],
      ['scootOut', 15],
    ];
    for (const [id, base] of cases) {
      expect(act(open, 'male', id, forceWindow(open, 'male', id)[0]).action.noise).toBeCloseTo(base);
      expect(act(closed, 'male', id, forceWindow(closed, 'male', id)[0]).action.noise).toBeCloseTo(base + 5);
    }
    expect(act(closed, 'male', 'whisper').action.noise).toBe(15);
    expect(act(closed, 'male', 'lieSupine').action.noise).toBe(20);
    const aiClosed = scene({}, (_s, _me, ai) => (ai.eyes = 'closed'));
    expect(act(aiClosed, 'female', 'caress', 35).action.noise).toBe(28);
  });

  it('time passage: open eyes +0 (+2 from turn 6), closed eyes +6 (+8 from turn 6)', () => {
    const cases = [
      [1, 'open', 0],
      [5, 'open', 0],
      [6, 'open', 2],
      [11, 'open', 2],
      [1, 'closed', 6],
      [6, 'closed', 8],
    ] as const;
    for (const [turn, eyes, gain] of cases) {
      const s = scene({}, (st, me) => {
        st.turn = turn;
        me.eyes = eyes;
        me.sleep = 40;
      });
      expect(eot(s).s.chars.male.sleep, `turn ${turn} ${eyes}`).toBeCloseTo(40 + gain);
    }
  });

  it('toggleEyes closed→open at sleep >= 70 costs 20 sleep + wokeYourself note; below 70 or open→closed is free', () => {
    const r = toggleEyes(
      scene({}, (_s, me) => {
        me.eyes = 'closed';
        me.sleep = 75;
      }),
      'open',
    );
    expect(r.state.chars.male).toMatchObject({ eyes: 'open', sleep: 55 });
    expect(r.events).toEqual([{ type: 'eyes', who: 'male', eyes: 'open' }, expect.objectContaining({ type: 'note', who: 'male', key: 'wokeYourself' })]);

    const t = toggleEyes(
      scene({}, (_s, me) => {
        me.eyes = 'closed';
        me.sleep = 69;
      }),
      'open',
    );
    expect(t.state.chars.male.sleep).toBe(69);
    expect(ofType(t.events, 'note')).toHaveLength(0);

    const u = toggleEyes(scene({}, (_s, me) => (me.sleep = 90)), 'closed');
    expect(u.state.chars.male).toMatchObject({ eyes: 'closed', sleep: 90 });
    expect(u.events).toEqual([{ type: 'eyes', who: 'male', eyes: 'closed' }]);
  });

  it('stare: open-eyed sideFacing player costs an awake sleep-goal partner +2 annoyance per turn; the line at most once per 3 turns', () => {
    let s = scene({ partnerGoal: 'sleep' });
    const said: number[] = [];
    for (let t = 2; t <= 8; t++) {
      s.turn = t;
      s.chars.female.annoyance = 20;
      const r = eot(s);
      expect(r.s.chars.female.annoyance, `turn ${t}`).toBe(17); // +2 stare, −5 decay
      if (r.lines.includes('female:stare')) said.push(t);
      s = r.s;
    }
    expect(said).toEqual([2, 5, 8]);
  });

  it('no stare when eyes closed, not sideFacing, partner wants intimacy, or partner already drowsy', () => {
    const variants: ((st: GameState, me: CharacterState, ai: CharacterState) => void)[] = [
      (_s, me) => (me.eyes = 'closed'),
      (_s, me) => (me.posture = 'supine'),
      (st) => (st.chars.female.goal = 'intimacy'),
      (_s, _me, ai) => (ai.sleep = 30),
    ];
    for (const v of variants) {
      const r = eot(
        scene({ partnerGoal: 'sleep' }, (st, me, ai) => {
          ai.annoyance = 20;
          v(st, me, ai);
        }),
      );
      expect(r.s.chars.female.annoyance).toBe(15);
      expect(r.lines).not.toContain('female:stare');
    }
  });
});

// ───────────────────────── §4 noise ─────────────────────────

describe('§4 noise: action event `noise` equals N', () => {
  interface NoiseCase {
    name: string;
    s: GameState;
    actor: Role;
    id: ActionId;
    force: number;
    N: number;
    noiseBonus?: number;
  }
  const inUse = (st: GameState) => {
    st.armPillow.offered = true;
    st.armPillow.inUse = true;
  };
  const cases: NoiseCase[] = [
    { name: 'gentle kiss', s: scene(), actor: 'male', id: 'kiss', force: 35, N: 30 },
    { name: 'timid kiss', s: scene(), actor: 'male', id: 'kiss', force: 10, N: 30 * 0.6 },
    { name: 'firm kiss', s: scene(), actor: 'male', id: 'kiss', force: 60, N: 30 * 1.7 },
    { name: 'rough kiss', s: scene(), actor: 'male', id: 'kiss', force: 90, N: 30 * 2.6 },
    { name: 'firm hug', s: scene(), actor: 'male', id: 'hug', force: 70, N: 35 * 1.7 },
    { name: 'rough hug', s: scene(), actor: 'male', id: 'hug', force: 100, N: 35 * 2.6 },
    { name: 'rough pat', s: scene(), actor: 'male', id: 'pat', force: 100, N: 12 * 2.6 },
    { name: 'closed-eyes firm caress', s: scene({}, (_s, me) => (me.eyes = 'closed')), actor: 'male', id: 'caress', force: 60, N: 33 * 1.7 },
    { name: 'closed-eyes firm pullBlanket', s: scene({}, (_s, me) => (me.eyes = 'closed')), actor: 'male', id: 'pullBlanket', force: 70, N: 35 * 1.7 },
    { name: 'withdrawArm offered only', s: scene({}, (st) => (st.armPillow.offered = true)), actor: 'male', id: 'withdrawArm', force: 30, N: 25 },
    { name: 'withdrawArm inUse gentle (+10)', s: scene({}, inUse), actor: 'male', id: 'withdrawArm', force: 30, N: 35 },
    { name: 'withdrawArm inUse timid', s: scene({}, inUse), actor: 'male', id: 'withdrawArm', force: 10, N: 35 * 0.6 },
    { name: 'withdrawArm inUse firm', s: scene({}, inUse), actor: 'male', id: 'withdrawArm', force: 60, N: 35 * 1.7 },
    {
      name: 'withdrawArm inUse closed eyes',
      s: scene({}, (st, me) => {
        inUse(st);
        me.eyes = 'closed';
      }),
      actor: 'male',
      id: 'withdrawArm',
      force: 30,
      N: 40,
    },
    { name: 'male offered → lieSideAway (+10)', s: scene({}, (st) => (st.armPillow.offered = true)), actor: 'male', id: 'lieSideAway', force: 0, N: 30 },
    { name: 'male inUse supine↔sideFacing (+5)', s: scene({}, inUse), actor: 'male', id: 'lieSupine', force: 0, N: 25 },
    { name: 'female inUse → lieSideAway (+5)', s: scene({ role: 'female' }, inUse), actor: 'female', id: 'lieSideAway', force: 0, N: 25 },
    { name: 'female inUse → lieSupine (no bonus)', s: scene({ role: 'female' }, inUse), actor: 'female', id: 'lieSupine', force: 0, N: 20 },
    { name: 'AI male offered → lieProne (+10)', s: scene({ role: 'female' }, (st) => (st.armPillow.offered = true)), actor: 'male', id: 'lieProne', force: 0, N: 35 },
    { name: 'AI sleep-talk (sleep + noiseBonus 8)', s: scene(), actor: 'female', id: 'sleep', force: 0, N: 8, noiseBonus: 8 },
    { name: 'failed kiss (too far): baseNoise×0.5', s: scene({}, (st) => (st.chars.female.lateral = 0.6)), actor: 'male', id: 'kiss', force: 35, N: 15 },
    { name: 'failed firm kiss: baseNoise×0.5×1.7', s: scene({}, (st) => (st.chars.female.lateral = 0.6)), actor: 'male', id: 'kiss', force: 60, N: 30 * 0.5 * 1.7 },
    { name: 'failed kiss with closed eyes (no +5)', s: scene({}, (_s, me) => (me.eyes = 'closed')), actor: 'male', id: 'kiss', force: 35, N: 15 },
    { name: 'player push (not allowed)', s: scene(), actor: 'male', id: 'push', force: 0, N: 10 },
  ];

  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const r = act(c.s, c.actor, c.id, c.force, constRng(0.5), c.noiseBonus ? { noiseBonus: c.noiseBonus } : {});
    expect(r.action.noise).toBe(round1(c.N));
  });

  it('effectiveNoise / projectedNoise = gentle N incl. state bonuses and closed-eyes +5', () => {
    const s = scene();
    const closed = scene({}, (_s, me) => (me.eyes = 'closed'));
    const used = scene({}, (st) => {
      st.armPillow.offered = true;
      st.armPillow.inUse = true;
    });
    expect(projectedNoise(s, 'male', 'kiss')).toBe(30);
    expect(projectedNoise(s, 'male', 'hug')).toBe(35);
    expect(projectedNoise(s, 'male', 'sleep')).toBe(0);
    expect(projectedNoise(closed, 'male', 'caress')).toBe(33);
    expect(projectedNoise(closed, 'male', 'whisper')).toBe(15);
    expect(projectedNoise(used, 'male', 'withdrawArm')).toBe(35);
    expect(projectedNoise(used, 'male', 'lieSupine')).toBe(25);
    for (const id of ALL_ACTIONS) expect(projectedNoise(closed, 'male', id)).toBe(effectiveNoise(closed, 'male', id));
  });

  it('noiseRisk: green < 0.8T ≤ yellow ≤ T < red; always green while the partner is below 45', () => {
    expect(noiseRisk(scene(), 'male', 'hug', 999)).toBe('safe');
    expect(noiseRisk(scene({}, (_s, _me, ai) => (ai.sleep = 44.9)), 'male', 'hug', 999)).toBe('safe');

    const s70 = scene({}, (_s, _me, ai) => asleep(ai, 70)); // T = 46.5, 0.8T = 37.2
    expect(noiseRisk(s70, 'male', 'kiss', 37.1)).toBe('safe');
    expect(noiseRisk(s70, 'male', 'kiss', 37.2)).toBe('risky');
    expect(noiseRisk(s70, 'male', 'kiss', 46.5)).toBe('risky');
    expect(noiseRisk(s70, 'male', 'kiss', 46.51)).toBe('loud');

    // default noise = projectedNoise; partner at 45 → T = 35.25, 0.8T = 28.2
    const s45 = scene({}, (st, me, ai) => {
      ai.sleep = 45;
      st.armPillow.offered = true;
      st.armPillow.inUse = true;
      me.eyes = 'closed';
    });
    expect(noiseRisk(s45, 'male', 'whisper')).toBe('safe'); // 15
    expect(noiseRisk(s45, 'male', 'caress')).toBe('risky'); // 33
    expect(noiseRisk(s45, 'male', 'withdrawArm')).toBe('loud'); // 40
  });
});

describe('§4 waking', () => {
  const sleeper = (sleep: number, patch: Partial<CharacterState> = {}) =>
    scene({}, (_s, _me, ai) => {
      asleep(ai, sleep);
      Object.assign(ai, patch);
    });

  it('N == T does not wake; the sleeper only loses N×0.15', () => {
    for (const S of [45, 60, 70, 80, 100]) {
      const s = sleeper(S);
      const T = wakeThreshold(s.chars.female);
      expect(applyNoise(s, 'female', T).woke).toBe(false);
      expect(s.chars.female.sleep).toBeCloseTo(S - T * 0.15);
    }
    // concrete: a firm kiss (N = 51) on a sleeper at 80 (T = 51) → sneak kiss, no wake
    const r = act(sleeper(80), 'male', 'kiss', 60);
    expect(r.action.noise).toBe(51);
    expect(ofType(r.events, 'wake')).toHaveLength(0);
    expect(r.notes).toContain('sneakKiss');
    expect(r.s.chars.female.sleep).toBeCloseTo(80 - 51 * 0.15 - 5);
  });

  it('N > T wakes: sleep −(N−T)×1.5−10, annoyance +8+(N−T)/2, mood −5, `wake` line when annoyance stays < 50', () => {
    const s = sleeper(70, { annoyance: 10, mood: 60 });
    const N = 60;
    const T = 46.5;
    expect(applyNoise(s, 'female', N)).toEqual({ woke: true, key: 'wake' });
    expect(s.chars.female.sleep).toBeCloseTo(70 - (N - T) * 1.5 - 10);
    expect(s.chars.female.annoyance).toBeCloseTo(10 + 8 + (N - T) / 2);
    expect(s.chars.female.mood).toBe(55);
  });

  it('wake line is wakeAngry once annoyance reaches 50, coldAwake when caused by pullBlanket; sleep floors at 0', () => {
    expect(applyNoise(sleeper(70, { annoyance: 40 }), 'female', 60).key).toBe('wakeAngry');
    expect(applyNoise(sleeper(70), 'female', 60, true).key).toBe('coldAwake');
    const s = sleeper(45);
    applyNoise(s, 'female', 500);
    expect(s.chars.female.sleep).toBe(0);
  });

  it('30 ≤ sleep < 45 never wakes (light disturbance only); below 30 noise does nothing', () => {
    for (const S of [30, 40, 44.99]) {
      const s = sleeper(S);
      expect(applyNoise(s, 'female', 78).woke).toBe(false);
      expect(s.chars.female.sleep).toBeCloseTo(Math.max(0, S - 78 * 0.15));
    }
    const low = sleeper(29);
    expect(applyNoise(low, 'female', 1000).woke).toBe(false);
    expect(low.chars.female.sleep).toBe(29);
    // via an action: a rough kiss on a drowsy (44) partner emits no wake event
    const r = act(scene({}, (_s, _me, ai) => (ai.sleep = 44)), 'male', 'kiss', 90);
    expect(ofType(r.events, 'wake')).toHaveLength(0);
    expect(r.s.chars.female.sleep).toBeCloseTo(44 - 78 * 0.15);
  });

  it('deep sleep (100, T = 60): with normal kiss/hug only rough wakes', () => {
    for (const id of ['kiss', 'hug'] as const) {
      const [lo, hi] = ACTIONS[id].forceWindow;
      const cases = [
        [lo - 1, false],
        [lo, false],
        [hi, false],
        [hi + 25, false],
        [hi + 25.01, true],
        [100, true],
      ] as const;
      for (const [f, wakes] of cases) {
        const r = act(sleeper(100), 'male', id, f);
        expect(ofType(r.events, 'wake').length > 0, `${id} f=${f}`).toBe(wakes);
      }
    }
  });

  it('firm kiss (N = 51) only wakes sleepers below 80', () => {
    const wakes = (S: number) => ofType(act(sleeper(S), 'male', 'kiss', 60).events, 'wake').length > 0;
    expect(wakes(70)).toBe(true);
    expect(wakes(79)).toBe(true);
    expect(wakes(80)).toBe(false);
    expect(wakes(81)).toBe(false);
  });

  it('design intent: nothing the player does in the green zone wakes a sleeper at 70', () => {
    const setups: [string, GameState][] = [
      ['open', scene({}, (_s, _me, ai) => asleep(ai, 70))],
      [
        'closed',
        scene({}, (_s, me, ai) => {
          asleep(ai, 70);
          me.eyes = 'closed';
        }),
      ],
      [
        'offered',
        scene({}, (st, _me, ai) => {
          asleep(ai, 70);
          st.armPillow.offered = true;
        }),
      ],
      [
        'inUse closed',
        scene({}, (st, me, ai) => {
          asleep(ai, 70);
          st.armPillow = { offered: true, inUse: true, numbness: 0 };
          me.eyes = 'closed';
        }),
      ],
      [
        'female inUse',
        scene({ role: 'female' }, (st, _me, ai) => {
          asleep(ai, 70);
          st.armPillow = { offered: true, inUse: true, numbness: 0 };
        }),
      ],
    ];
    for (const [name, s] of setups) {
      const P = s.playerRole;
      for (const a of listAvailableActions(s, P).filter((x) => x.ok)) {
        const id = a.def.id;
        const f = a.def.usesForce ? forceWindow(s, P, id)[1] : 0;
        const r = act(s, P, id, f);
        expect(ofType(r.events, 'wake'), `${name}: ${id}`).toHaveLength(0);
        expect(projectedNoise(s, P, id)).toBeLessThanOrEqual(wakeThreshold(s.chars[partnerOf(P)]));
      }
    }
  });
});

// ───────────────────────── §5 availability + failed actions ─────────────────────────

describe('§5 availability and failed actions', () => {
  interface AvCase {
    name: string;
    s: GameState;
    actor: Role;
    id: ActionId;
    expect: true | string;
  }
  const M = (mut?: Parameters<typeof scene>[1]) => scene({ role: 'male' }, mut);
  const F = (mut?: Parameters<typeof scene>[1]) => scene({ role: 'female' }, mut);
  const offered = (st: GameState) => (st.armPillow.offered = true);
  const inUse = (st: GameState) => (st.armPillow.offered = st.armPillow.inUse = true);
  const post = (who: Role, p: Posture) => (st: GameState) => (st.chars[who].posture = p);
  const lat = (m: number, f: number) => (st: GameState) => {
    st.chars.male.lateral = m;
    st.chars.female.lateral = f;
  };
  const blind = (me: CharacterState) => (me.eyes = 'closed');
  const farBlindAway = (st: GameState, me: CharacterState) => {
    blind(me);
    lat(-0.9, 0.9)(st);
    me.posture = 'sideAway';
  };

  const cases: AvCase[] = [
    // posture
    { name: 'lieSupine', s: M(), actor: 'male', id: 'lieSupine', expect: true },
    { name: 'lieSupine when already supine', s: M(post('male', 'supine')), actor: 'male', id: 'lieSupine', expect: 'alreadyPosture' },
    { name: 'lieSideFacing when already sideFacing', s: M(), actor: 'male', id: 'lieSideFacing', expect: 'alreadyPosture' },
    { name: 'lieSideAway', s: M(), actor: 'male', id: 'lieSideAway', expect: true },
    { name: 'lieSideAway when already sideAway', s: M(post('male', 'sideAway')), actor: 'male', id: 'lieSideAway', expect: 'alreadyPosture' },
    { name: 'male lieSideAway while arm inUse (§5.2)', s: M(inUse), actor: 'male', id: 'lieSideAway', expect: 'armPinned' },
    { name: 'male lieSupine while arm inUse (§5.2)', s: M(inUse), actor: 'male', id: 'lieSupine', expect: true },
    { name: 'player lieProne (AI only)', s: M(), actor: 'male', id: 'lieProne', expect: 'notAllowed' },
    { name: 'AI lieProne', s: M(), actor: 'female', id: 'lieProne', expect: true },
    { name: 'AI lieProne when prone', s: M(post('female', 'prone')), actor: 'female', id: 'lieProne', expect: 'alreadyPosture' },
    { name: 'AI male lieProne while arm inUse', s: F(inUse), actor: 'male', id: 'lieProne', expect: 'armPinned' },
    // hug
    { name: 'hug', s: M(), actor: 'male', id: 'hug', expect: true },
    { name: 'hug a sideAway partner (spooning)', s: M(post('female', 'sideAway')), actor: 'male', id: 'hug', expect: true },
    { name: 'hug with closed eyes', s: M((_s, me) => (me.eyes = 'closed')), actor: 'male', id: 'hug', expect: 'eyesClosedHug' },
    { name: 'hug while already embracing', s: M((st) => (st.embrace = true)), actor: 'male', id: 'hug', expect: 'alreadyEmbrace' },
    { name: 'hug while supine', s: M(post('male', 'supine')), actor: 'male', id: 'hug', expect: 'needFacing' },
    { name: 'hug a supine partner', s: M(post('female', 'supine')), actor: 'male', id: 'hug', expect: 'partnerNotSide' },
    { name: 'hug a prone partner', s: M(post('female', 'prone')), actor: 'male', id: 'hug', expect: 'partnerNotSide' },
    { name: 'hug at distance 0.75', s: M(lat(-0.375, 0.375)), actor: 'male', id: 'hug', expect: true },
    { name: 'hug at distance 0.76', s: M(lat(-0.38, 0.38)), actor: 'male', id: 'hug', expect: 'tooFar' },
    // kiss
    { name: 'kiss', s: M(), actor: 'male', id: 'kiss', expect: true },
    { name: 'kiss a supine partner', s: M(post('female', 'supine')), actor: 'male', id: 'kiss', expect: true },
    { name: 'kiss with closed eyes', s: M((_s, me) => (me.eyes = 'closed')), actor: 'male', id: 'kiss', expect: 'eyesClosedKiss' },
    { name: 'kiss while sideAway', s: M(post('male', 'sideAway')), actor: 'male', id: 'kiss', expect: 'needFacing' },
    { name: 'kiss a sideAway partner', s: M(post('female', 'sideAway')), actor: 'male', id: 'kiss', expect: 'partnerFacingAway' },
    { name: 'kiss a prone partner', s: M(post('female', 'prone')), actor: 'male', id: 'kiss', expect: 'partnerProne' },
    { name: 'kiss too far', s: M(lat(-0.4, 0.4)), actor: 'male', id: 'kiss', expect: 'tooFar' },
    // caress
    { name: 'caress blind, partner prone', s: M((st, me) => (blind(me), post('female', 'prone')(st))), actor: 'male', id: 'caress', expect: true },
    { name: 'caress a sideAway partner', s: M(post('female', 'sideAway')), actor: 'male', id: 'caress', expect: true },
    { name: 'caress while supine', s: M(post('male', 'supine')), actor: 'male', id: 'caress', expect: 'needFacing' },
    { name: 'caress too far', s: M(lat(-0.4, 0.4)), actor: 'male', id: 'caress', expect: 'tooFar' },
    // whisper / pat: always
    { name: 'whisper far away, blind, back turned', s: M(farBlindAway), actor: 'male', id: 'whisper', expect: true },
    { name: 'pat far away, blind, back turned', s: M(farBlindAway), actor: 'male', id: 'pat', expect: true },
    // offerArm
    { name: 'offerArm', s: M(), actor: 'male', id: 'offerArm', expect: true },
    { name: 'offerArm both supine', s: M((st) => (post('male', 'supine')(st), post('female', 'supine')(st))), actor: 'male', id: 'offerArm', expect: true },
    { name: 'female offerArm', s: F(), actor: 'female', id: 'offerArm', expect: 'notAllowed' },
    { name: 'offerArm twice', s: M(offered), actor: 'male', id: 'offerArm', expect: 'armAlreadyOffered' },
    { name: 'offerArm while sideAway', s: M(post('male', 'sideAway')), actor: 'male', id: 'offerArm', expect: 'offerNeedPosture' },
    { name: 'offerArm to her back', s: M(post('female', 'sideAway')), actor: 'male', id: 'offerArm', expect: 'herBackTurned' },
    { name: 'offerArm to a prone partner', s: M(post('female', 'prone')), actor: 'male', id: 'offerArm', expect: 'herBackTurned' },
    // restOnArm / leaveArm
    { name: 'restOnArm', s: F(offered), actor: 'female', id: 'restOnArm', expect: true },
    { name: 'restOnArm supine', s: F((st) => (offered(st), post('female', 'supine')(st))), actor: 'female', id: 'restOnArm', expect: true },
    { name: 'male restOnArm', s: M(offered), actor: 'male', id: 'restOnArm', expect: 'notAllowed' },
    { name: 'restOnArm not offered', s: F(), actor: 'female', id: 'restOnArm', expect: 'armNotOffered' },
    { name: 'restOnArm already on it', s: F(inUse), actor: 'female', id: 'restOnArm', expect: 'alreadyOnArm' },
    { name: 'restOnArm while sideAway', s: F((st) => (offered(st), post('female', 'sideAway')(st))), actor: 'female', id: 'restOnArm', expect: 'restNeedPosture' },
    { name: 'leaveArm', s: F(inUse), actor: 'female', id: 'leaveArm', expect: true },
    { name: 'leaveArm not on it', s: F(offered), actor: 'female', id: 'leaveArm', expect: 'notOnArm' },
    // withdrawArm
    { name: 'withdrawArm', s: M(offered), actor: 'male', id: 'withdrawArm', expect: true },
    { name: 'withdrawArm nothing out', s: M(), actor: 'male', id: 'withdrawArm', expect: 'armNotOut' },
    { name: 'female withdrawArm', s: F(inUse), actor: 'female', id: 'withdrawArm', expect: 'notAllowed' },
    // blanket limits
    { name: 'male pullBlanket at −0.99', s: M((st) => (st.blanketOffset = -0.99)), actor: 'male', id: 'pullBlanket', expect: true },
    { name: 'male pullBlanket at −1', s: M((st) => (st.blanketOffset = -1)), actor: 'male', id: 'pullBlanket', expect: 'blanketAllMine' },
    { name: 'female pullBlanket at +1', s: F((st) => (st.blanketOffset = 1)), actor: 'female', id: 'pullBlanket', expect: 'blanketAllMine' },
    { name: 'female pullBlanket at −1', s: F((st) => (st.blanketOffset = -1)), actor: 'female', id: 'pullBlanket', expect: true },
    { name: 'male tuckBlanket at +1', s: M((st) => (st.blanketOffset = 1)), actor: 'male', id: 'tuckBlanket', expect: 'blanketAllTheirs' },
    { name: 'male tuckBlanket at −1', s: M((st) => (st.blanketOffset = -1)), actor: 'male', id: 'tuckBlanket', expect: true },
    { name: 'female tuckBlanket at −1', s: F((st) => (st.blanketOffset = -1)), actor: 'female', id: 'tuckBlanket', expect: 'blanketAllTheirs' },
    { name: 'female tuckBlanket at 0.99', s: F((st) => (st.blanketOffset = 0.99)), actor: 'female', id: 'tuckBlanket', expect: true },
    // moves
    { name: 'scootIn at distance 0.31', s: M(lat(-0.16, 0.15)), actor: 'male', id: 'scootIn', expect: true },
    { name: 'scootIn at distance 0.3', s: M(lat(-0.15, 0.15)), actor: 'male', id: 'scootIn', expect: 'alreadyClose' },
    { name: 'scootIn already at the centre line (§14.2)', s: M(lat(-0.1, 0.8)), actor: 'male', id: 'scootIn', expect: 'atCenter' },
    { name: 'scootOut', s: M(), actor: 'male', id: 'scootOut', expect: true },
    { name: 'male scootOut while arm inUse (§5.2)', s: M(inUse), actor: 'male', id: 'scootOut', expect: 'armPinned' },
    { name: 'female scootOut while on the arm', s: F(inUse), actor: 'female', id: 'scootOut', expect: true },
    // sleep / push
    { name: 'player sleep with open eyes', s: M(), actor: 'male', id: 'sleep', expect: 'closeEyesFirst' },
    { name: 'player sleep with closed eyes', s: M((_s, me) => (me.eyes = 'closed')), actor: 'male', id: 'sleep', expect: true },
    { name: 'player push', s: M((_s, me) => (me.annoyance = 80)), actor: 'male', id: 'push', expect: 'notAllowed' },
    { name: 'AI push at annoyance 69', s: M((_s, _me, ai) => (ai.annoyance = 69)), actor: 'female', id: 'push', expect: 'notAngryEnough' },
    { name: 'AI push at annoyance 70', s: M((_s, _me, ai) => (ai.annoyance = 70)), actor: 'female', id: 'push', expect: true },
    { name: 'AI push at annoyance 99', s: M((_s, _me, ai) => (ai.annoyance = 99)), actor: 'female', id: 'push', expect: true },
    { name: 'AI push at annoyance 100', s: M((_s, _me, ai) => (ai.annoyance = 100)), actor: 'female', id: 'push', expect: 'notAngryEnough' },
  ];

  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const r = checkAction(c.s, c.actor, c.id);
    expect(r.ok ? true : r.reasonKey).toBe(c.expect);
    if (!r.ok) expect(r.reason).toBe(ZH.msg[r.reasonKey as keyof typeof ZH.msg]);
  });

  it.each(cases.filter((c) => c.expect !== true).map((c) => [c.name, c] as const))(
    'failed attempt "%s": success=false, reason note, N = baseNoise×0.5, lastAction set, no effect',
    (_name, c) => {
      const f = gentle(c.id);
      const r = act(c.s, c.actor, c.id, f);
      expect(r.action.success).toBe(false);
      expect(r.notes).toContain(c.expect);
      expect(r.action.noise).toBe(round1(ACTIONS[c.id].baseNoise * 0.5));
      expect(r.s.chars[c.actor].lastAction).toBe(c.id);
      // no branch effect: positions, postures, blanket, arm, embrace, intimacy untouched
      const pick = (s: GameState) => ({
        m: [s.chars.male.posture, s.chars.male.lateral, s.chars.male.restless],
        f: [s.chars.female.posture, s.chars.female.lateral, s.chars.female.restless],
        o: s.blanketOffset,
        a: s.armPillow,
        e: s.embrace,
        i: s.intimacy,
      });
      expect(pick(r.s)).toEqual(pick(c.s));
    },
  );

  it('a failed attempt still pays band annoyance (firm +4, rough +15 + tooRough)', () => {
    const far = scene({}, (st) => (st.chars.female.lateral = 0.6));
    expect(act(far, 'male', 'kiss', 60).s.chars.female.annoyance).toBe(4);
    const rough = act(far, 'male', 'kiss', 100);
    expect(rough.s.chars.female.annoyance).toBe(15);
    expect(rough.notes).toEqual(['tooFar', 'tooRough']);
  });

  it('a failed affection attempt still counts as "tried affection" for the intimacy decay', () => {
    const far = scene({}, (st) => (st.chars.female.lateral = 0.6));
    const tried = act(far, 'male', 'kiss', 35).s;
    expect(eot(tried).s.intimacy).toBe(10);
    expect(eot(far).s.intimacy).toBe(7);
  });
});

// ───────────────────────── §5 effects ─────────────────────────

describe('§5 affection effects (awake partner)', () => {
  // player male → AI female; AI awake at sleep 20 so the −5 sleep is visible
  const awake = (mut?: (ai: CharacterState, s: GameState) => void, partnerGoal: 'sleep' | 'intimacy' = 'intimacy') =>
    scene({ partnerGoal }, (st, _me, ai) => {
      ai.sleep = 20;
      mut?.(ai, st);
    });

  it('receptive hug: embrace, intimacy +8×eff, mood +5, sleep −5, both gather to the middle, receptiveHug', () => {
    const r = act(awake(), 'male', 'hug', 40);
    expect(r.s.embrace).toBe(true);
    expect(r.s.intimacy).toBe(18);
    expect(r.s.chars.female).toMatchObject({ mood: 65, sleep: 15, annoyance: 0 });
    expect(r.s.chars.male.lateral).toBe(-0.15);
    expect(r.s.chars.female.lateral).toBe(0.15);
    expect(r.lines).toEqual(['female:receptiveHug']);
    expect(ofType(r.events, 'embrace')).toEqual([{ type: 'embrace', on: true }]);
    expect(act(awake(), 'male', 'hug', 10).s.intimacy).toBe(14); // timid ×0.5
    const firm = act(awake(), 'male', 'hug', 70);
    expect(firm.s.intimacy).toBe(20); // ×1.25
    expect(firm.s.chars.female.annoyance).toBe(4);
  });

  it('sleepy-decline hug (sleep goal, mood < BAL.sleepyMood): still embraces, gains halved, annoyance +6', () => {
    const r = act(awake((ai) => (ai.mood = BAL.sleepyMood - 15), 'sleep'), 'male', 'hug', 40);
    expect(r.s.embrace).toBe(true);
    expect(r.s.intimacy).toBe(14);
    expect(r.s.chars.female.mood).toBe(BAL.sleepyMood - 15 + 2.5);
    expect(r.s.chars.female.annoyance).toBe(6);
    expect(r.lines).toEqual(['female:sleepyDecline']);
    // at the threshold a sleepy partner accepts normally
    const ok = act(awake((ai) => (ai.mood = BAL.sleepyMood), 'sleep'), 'male', 'hug', 40);
    expect(ok.s.intimacy).toBe(18);
    expect(ok.lines).toEqual(['female:receptiveHug']);
  });

  it('refused hug: annoyance +8, no embrace, refuseAnnoyed (annoyance >= 50) / refuseMood (mood < 40)', () => {
    const angry = act(awake((ai) => (ai.annoyance = 50)), 'male', 'hug', 40);
    expect(angry.s.embrace).toBe(false);
    expect(angry.s.chars.female.annoyance).toBe(58);
    expect(angry.s.intimacy).toBe(10);
    expect(angry.lines).toEqual(['female:refuseAnnoyed']);
    const sulky = act(awake((ai) => (ai.mood = 39)), 'male', 'hug', 40);
    expect(sulky.s.chars.female.annoyance).toBe(8);
    expect(sulky.lines).toEqual(['female:refuseMood']);
  });

  it('receptive kiss: intimacy +12×eff, mood +6, sleep −5, receptiveKiss; timid adds the ticklish note', () => {
    const r = act(awake(), 'male', 'kiss', 35);
    expect(r.s.intimacy).toBe(22);
    expect(r.s.chars.female).toMatchObject({ mood: 66, sleep: 15 });
    expect(r.lines).toEqual(['female:receptiveKiss']);
    const timid = act(awake(), 'male', 'kiss', 10);
    expect(timid.s.intimacy).toBe(16);
    expect(timid.notes).toContain('ticklish');
    expect(act(awake(), 'male', 'kiss', 60).s.intimacy).toBe(25);
  });

  it('sleepy-decline kiss / refused kiss', () => {
    const d = act(awake((ai) => (ai.mood = 60), 'sleep'), 'male', 'kiss', 35);
    expect(d.s.intimacy).toBe(16);
    expect(d.s.chars.female).toMatchObject({ mood: 63, annoyance: 6 });
    const no = act(awake((ai) => (ai.annoyance = 60)), 'male', 'kiss', 35);
    expect(no.s.intimacy).toBe(10);
    expect(no.s.chars.female).toMatchObject({ annoyance: 70, mood: 57 });
    expect(no.lines).toEqual(['female:refuseAnnoyed']);
  });

  it('receptive caress: intimacy +10×eff, mood +4; refused caress: annoyance +8, mood −2', () => {
    const r = act(awake(), 'male', 'caress', 35);
    expect(r.s.intimacy).toBe(20);
    expect(r.s.chars.female).toMatchObject({ mood: 64, sleep: 15 });
    expect(r.lines).toEqual(['female:receptiveCaress']);
    const no = act(awake((ai) => (ai.mood = 30)), 'male', 'caress', 35);
    expect(no.s.intimacy).toBe(10);
    expect(no.s.chars.female).toMatchObject({ annoyance: 8, mood: 28 });
    expect(no.lines).toEqual(['female:refuseMood']);
  });

  it('whisper: receptive mood +6 / intimacy +4 (no sleepyDecline, §14.2); refused annoyance +3', () => {
    const r = act(awake(), 'male', 'whisper');
    expect(r.s.intimacy).toBe(14);
    expect(r.s.chars.female.mood).toBe(66);
    expect(r.lines).toEqual(['female:whisperReply']);
    const sleepy = act(awake((ai) => (ai.mood = 60), 'sleep'), 'male', 'whisper');
    expect(sleepy.s.intimacy).toBe(14);
    expect(sleepy.s.chars.female).toMatchObject({ mood: 66, annoyance: 0 });
    const no = act(awake((ai) => (ai.annoyance = 55)), 'male', 'whisper');
    expect(no.s.chars.female.annoyance).toBe(58);
    expect(no.s.intimacy).toBe(10);
  });

  it('rough affection = refusal (§14.3): no gains, refusal penalties + band +15, roughComplaint wins the line', () => {
    const kiss = act(awake(), 'male', 'kiss', 90);
    expect(kiss.s.intimacy).toBe(10);
    expect(kiss.s.chars.female).toMatchObject({ annoyance: 25, mood: 57 });
    expect(kiss.notes).toContain('tooRough');
    expect(kiss.lines).toEqual(['female:roughComplaint']);

    const hug = act(awake(), 'male', 'hug', 100);
    expect(hug.s.embrace).toBe(false);
    expect(hug.s.intimacy).toBe(10);
    expect(hug.s.chars.female.annoyance).toBe(23);
    expect(hug.s.chars.male.lateral).toBe(-0.3); // no gathering

    const caress = act(awake(), 'male', 'caress', 90);
    expect(caress.s.intimacy).toBe(10);
    expect(caress.s.chars.female).toMatchObject({ annoyance: 23, mood: 58 });

    // firm is still welcome
    expect(act(awake(), 'male', 'kiss', 75).s.intimacy).toBe(25);
  });
});

describe('§5 affection effects (sleeping partner)', () => {
  const sleeping = (sleep: number, partnerGoal: 'sleep' | 'intimacy' = 'intimacy') =>
    scene({ partnerGoal }, (_s, _me, ai) => {
      asleep(ai, sleep);
      ai.mood = 60;
    });

  it('sneak hug (no wake): embrace, intimacy +3, sleep −5, sneakHug note, no line', () => {
    const r = act(sleeping(80), 'male', 'hug', 40);
    expect(ofType(r.events, 'wake')).toHaveLength(0);
    expect(r.s.embrace).toBe(true);
    expect(r.s.intimacy).toBe(13);
    expect(r.s.chars.female.sleep).toBeCloseTo(80 - 35 * 0.15 - 5);
    expect(r.notes).toContain('sneakHug');
    expect(r.lines).toEqual([]);
  });

  it('hug that wakes an intimacy-goal partner: embrace, intimacy +6, mood +8 (after −5), gather', () => {
    const r = act(sleeping(70), 'male', 'hug', 70); // N 59.5 > T 46.5
    expect(ofType(r.events, 'wake')).toEqual([{ type: 'wake', who: 'female', by: 'male' }]);
    expect(r.s.embrace).toBe(true);
    expect(r.s.intimacy).toBe(16);
    expect(r.s.chars.female.mood).toBe(63);
    expect(r.s.chars.female.annoyance).toBeCloseTo(8 + (59.5 - 46.5) / 2); // no firm +4 on a sleeper
    expect(r.s.chars.male.lateral).toBe(-0.15);
    expect(r.lines).toEqual(['female:wake']);
  });

  it('hug that wakes a sleep-goal partner: annoyance +12 on top of the wake, no embrace', () => {
    const r = act(sleeping(70, 'sleep'), 'male', 'hug', 70);
    expect(r.s.embrace).toBe(false);
    expect(r.s.intimacy).toBe(10);
    expect(r.s.chars.female.annoyance).toBeCloseTo(8 + 6.5 + 12);
  });

  it('sneak kiss / caress: intimacy +2, sleep −5, sneak notes', () => {
    const k = act(sleeping(80), 'male', 'kiss', 35);
    expect(k.s.intimacy).toBe(12);
    expect(k.s.chars.female.sleep).toBeCloseTo(80 - 4.5 - 5);
    expect(k.notes).toContain('sneakKiss');
    const c = act(sleeping(80), 'male', 'caress', 35);
    expect(c.s.intimacy).toBe(12);
    expect(c.notes).toContain('sneakCaress');
  });

  it('kiss / caress that wake: intimacy partner mood +8 & intimacy +6; sleep partner annoyance +12', () => {
    const k = act(sleeping(70), 'male', 'kiss', 60); // 51 > 46.5
    expect(k.s.intimacy).toBe(16);
    expect(k.s.chars.female.mood).toBe(63);
    const ks = act(sleeping(70, 'sleep'), 'male', 'kiss', 60);
    expect(ks.s.intimacy).toBe(10);
    expect(ks.s.chars.female.annoyance).toBeCloseTo(8 + (51 - 46.5) / 2 + 12);
    const c = act(sleeping(70), 'male', 'caress', 60); // 47.6 > 46.5
    expect(ofType(c.events, 'wake')).toHaveLength(1);
    expect(c.s.intimacy).toBe(16);
    expect(c.s.chars.female.mood).toBe(63);
  });

  it('rough affection on a sleeper always wakes and gives nothing positive', () => {
    for (const id of ['kiss', 'caress', 'hug'] as const) {
      const r = act(sleeping(100), 'male', id, 100);
      expect(ofType(r.events, 'wake'), id).toHaveLength(1);
      expect(r.s.intimacy, id).toBe(10);
      expect(r.s.embrace, id).toBe(false);
      expect(r.s.chars.female.mood, id).toBe(55);
    }
  });

  it('whisper to a sleeper only runs the noise check (sleep −2.25), no line, no gain', () => {
    const r = act(sleeping(80), 'male', 'whisper');
    expect(r.s.chars.female.sleep).toBeCloseTo(80 - 2.25);
    expect(r.s.intimacy).toBe(10);
    expect(r.lines).toEqual([]);
  });
});

describe('§5 pat', () => {
  it('pat: annoyance −12×eff, sleep +patSleep×eff, mood +2; intimacy partner awake gets +2 intimacy and patReply', () => {
    const s = scene({}, (_s, _me, ai) => {
      ai.annoyance = 30;
      ai.sleep = 20;
    });
    const r = act(s, 'male', 'pat', 30);
    expect(r.s.chars.female).toMatchObject({ annoyance: 18, sleep: 20 + BAL.patSleep, mood: 62 });
    expect(r.s.intimacy).toBe(12);
    expect(r.lines).toEqual(['female:patReply']);
    const timid = act(s, 'male', 'pat', 5);
    expect(timid.s.chars.female).toMatchObject({ annoyance: 24, sleep: 20 + BAL.patSleep * 0.5 });
    const firm = act(s, 'male', 'pat', 60);
    expect(firm.s.chars.female.annoyance).toBeCloseTo(30 + 4 - 15);
    const sleepGoal = act(scene({ partnerGoal: 'sleep' }), 'male', 'pat', 30);
    expect(sleepGoal.s.intimacy).toBe(10);
    expect(sleepGoal.lines).toEqual([]);
  });

  it('rough pat: +15 annoyance, no soothing, noise 31.2, roughComplaint', () => {
    const r = act(
      scene({}, (_s, _me, ai) => {
        ai.annoyance = 30;
        ai.sleep = 20;
      }),
      'male',
      'pat',
      100,
    );
    expect(r.s.chars.female).toMatchObject({ annoyance: 45, sleep: 20, mood: 60 });
    expect(r.s.intimacy).toBe(10);
    expect(r.action.noise).toBe(31.2);
    expect(r.lines).toEqual(['female:roughComplaint']);
  });

  it('pat rolls a snoring (supine, asleep) partner onto the side without waking; r < 0.5 → sideFacing', () => {
    const snorer = scene({}, (_s, _me, ai) => {
      asleep(ai, 85);
      ai.posture = 'supine';
    });
    const a = act(snorer, 'male', 'pat', 30, constRng(0.1));
    expect(a.s.chars.female.posture).toBe('sideFacing');
    expect(a.notes).toContain('patRollOver');
    expect(ofType(a.events, 'wake')).toHaveLength(0);
    expect(ofType(a.events, 'posture')).toEqual([{ type: 'posture', who: 'female', posture: 'sideFacing' }]);
    expect(snoreLevel(a.s.chars.female)).toBe(1);
    const b = act(snorer, 'male', 'pat', 30, constRng(0.9));
    expect(b.s.chars.female.posture).toBe('sideAway');
  });

  it('a snorer who is embracing or on the arm pillow always rolls to face the partner (§14.2)', () => {
    const hugging = scene({}, (st, _me, ai) => {
      asleep(ai, 85);
      ai.posture = 'supine';
      st.embrace = true;
    });
    expect(act(hugging, 'male', 'pat', 30, constRng(0.9)).s.chars.female.posture).toBe('sideFacing');
    const pillow = scene({}, (st, _me, ai) => {
      asleep(ai, 85);
      ai.posture = 'supine';
      st.armPillow.offered = st.armPillow.inUse = true;
    });
    const r = act(pillow, 'male', 'pat', 30, constRng(0.9));
    expect(r.s.chars.female.posture).toBe('sideFacing');
    expect(r.s.armPillow.inUse).toBe(true);
  });

  it('no roll-over for a side sleeper, an awake supine partner, or a rough pat', () => {
    const side = scene({}, (_s, _me, ai) => asleep(ai, 85));
    expect(act(side, 'male', 'pat', 30, constRng(0.9)).notes).not.toContain('patRollOver');
    const awakeSupine = scene({}, (_s, _me, ai) => (ai.posture = 'supine'));
    expect(act(awakeSupine, 'male', 'pat', 30).s.chars.female.posture).toBe('supine');
    const snorer = scene({}, (_s, _me, ai) => {
      asleep(ai, 85);
      ai.posture = 'supine';
    });
    expect(act(snorer, 'male', 'pat', 100).s.chars.female.posture).toBe('supine');
  });
});

describe('§5 arm pillow', () => {
  it('offerArm: offered, armPillow event, the man says armOffered', () => {
    const r = act(scene(), 'male', 'offerArm');
    expect(r.s.armPillow).toEqual({ offered: true, inUse: false, numbness: 0 });
    expect(ofType(r.events, 'armPillow')).toEqual([{ type: 'armPillow', offered: true, inUse: false }]);
    expect(r.lines).toEqual(['male:armOffered']);
  });

  it('restOnArm: inUse, intimacy +5, his mood +4, she moves to ≤ 0.15 and turns sideFacing, restless +15', () => {
    const s = scene({ role: 'female' }, (st, me) => {
      st.armPillow.offered = true;
      me.posture = 'supine';
    });
    const r = act(s, 'female', 'restOnArm');
    expect(r.s.armPillow.inUse).toBe(true);
    expect(r.s.intimacy).toBe(15);
    expect(r.s.chars.male.mood).toBe(64);
    expect(r.s.chars.female).toMatchObject({ lateral: 0.15, posture: 'sideFacing', restless: 15 });
    expect(ofType(r.events, 'posture')).toEqual([{ type: 'posture', who: 'female', posture: 'sideFacing' }]);
    expect(r.lines).toEqual(['female:armAccepted']);
    // already sideFacing: no posture event
    const t = act(
      scene({ role: 'female' }, (st) => (st.armPillow.offered = true)),
      'female',
      'restOnArm',
    );
    expect(ofType(t.events, 'posture')).toHaveLength(0);
  });

  it('leaveArm: inUse off, restless +15; numbness >= 50 relieves him (mood +3, annoyance −5, armRelieved)', () => {
    const at = (numbness: number) =>
      scene({ role: 'female' }, (st) => {
        st.armPillow = { offered: true, inUse: true, numbness };
        st.chars.male.annoyance = 10;
      });
    const r = act(at(50), 'female', 'leaveArm');
    expect(r.s.armPillow).toMatchObject({ offered: true, inUse: false });
    expect(r.s.chars.female.restless).toBe(15);
    expect(r.s.chars.male).toMatchObject({ mood: 63, annoyance: 5 });
    expect(r.lines).toEqual(['male:armRelieved']);
    const n = act(at(49), 'female', 'leaveArm');
    expect(n.s.chars.male).toMatchObject({ mood: 60, annoyance: 10 });
    expect(n.lines).toEqual([]);
  });

  it('withdrawArm: gentle clears offered/inUse/numbness; an awake partner loses 3 mood when it was in use', () => {
    const s = scene({}, (st) => (st.armPillow = { offered: true, inUse: true, numbness: 50 }));
    const r = act(s, 'male', 'withdrawArm', 30);
    expect(r.action.success).toBe(true);
    expect(r.s.armPillow).toEqual({ offered: false, inUse: false, numbness: 0 });
    expect(r.s.chars.female.mood).toBe(57);
    const notUsed = act(
      scene({}, (st) => (st.armPillow.offered = true)),
      'male',
      'withdrawArm',
      30,
    );
    expect(notUsed.s.chars.female.mood).toBe(60);
  });

  it('withdrawArm timid fails only while the arm is pinned (§14.2): armStuck, arm stays, numbness kept', () => {
    const pinned = scene({}, (st) => (st.armPillow = { offered: true, inUse: true, numbness: 50 }));
    const r = act(pinned, 'male', 'withdrawArm', 10);
    expect(r.action.success).toBe(false);
    expect(r.notes).toContain('armStuck');
    expect(r.s.armPillow).toEqual({ offered: true, inUse: true, numbness: 50 });
    expect(r.action.noise).toBe(21);
    const free = act(
      scene({}, (st) => (st.armPillow.offered = true)),
      'male',
      'withdrawArm',
      10,
    );
    expect(free.action.success).toBe(true);
    expect(free.s.armPillow.offered).toBe(false);
  });

  it('withdrawArm under a sleeping partner goes through the wake check (N 35 gentle, 59.5 firm)', () => {
    const s = scene({}, (st, _me, ai) => {
      st.armPillow = { offered: true, inUse: true, numbness: 25 };
      asleep(ai, 80); // T 51
    });
    const g = act(s, 'male', 'withdrawArm', 30);
    expect(ofType(g.events, 'wake')).toHaveLength(0);
    expect(g.s.chars.female.sleep).toBeCloseTo(80 - 35 * 0.15);
    expect(g.s.chars.female.mood).toBe(60); // asleep: no mood −3
    const f = act(s, 'male', 'withdrawArm', 60);
    expect(ofType(f.events, 'wake')).toHaveLength(1);
  });
});

describe('§5 blanket', () => {
  it('pullBlanket moves the blanket 0.3×eff toward the actor and adds restless +10', () => {
    const s = scene();
    expect(act(s, 'male', 'pullBlanket', 50).s.blanketOffset).toBeCloseTo(-0.3);
    expect(act(s, 'male', 'pullBlanket', 20).s.blanketOffset).toBeCloseTo(-0.15);
    expect(act(s, 'male', 'pullBlanket', 80).s.blanketOffset).toBeCloseTo(-0.375);
    expect(act(s, 'male', 'pullBlanket', 100).s.blanketOffset).toBeCloseTo(-0.45);
    expect(act(s, 'female', 'pullBlanket', 50).s.blanketOffset).toBeCloseTo(0.3);
    expect(act(s, 'male', 'pullBlanket', 50).s.chars.male.restless).toBe(10);
    const edge = act(
      scene({}, (st) => (st.blanketOffset = -0.8)),
      'male',
      'pullBlanket',
      50,
    );
    expect(edge.s.blanketOffset).toBe(-1);
    expect(canUse(edge.s, 'male', 'pullBlanket')).toBe(false);
  });

  it('leaving the partner under 0.5 cover while awake: mood −4 and blanketPulled', () => {
    const s = scene({}, (st) => (st.blanketOffset = -0.3));
    const r = act(s, 'male', 'pullBlanket', 50); // → −0.6, her cover 0.39
    expect(r.s.chars.female.mood).toBe(56);
    expect(r.lines).toEqual(['female:blanketPulled']);
    const mild = act(scene(), 'male', 'pullBlanket', 50); // → −0.3, cover 0.57
    expect(mild.s.chars.female.mood).toBe(60);
  });

  it('pulling the blanket off a sleeper hard enough to wake them: coldAwake and +10 annoyance', () => {
    const s = scene({}, (st, _me, ai) => {
      st.blanketOffset = -0.3;
      asleep(ai, 70);
    });
    const r = act(s, 'male', 'pullBlanket', 80); // firm: N 51 > 46.5; offset → −0.675, cover 0.345
    expect(ofType(r.events, 'wake')).toHaveLength(1);
    expect(r.s.chars.female.annoyance).toBeCloseTo(8 + (51 - 46.5) / 2 + 10);
    expect(r.lines).toEqual(['female:coldAwake']);
  });

  it('male with his arm pinned pulls one-handed: ×0.6 and the oneHandPull note (§5.2)', () => {
    const r = act(
      scene({}, (st) => (st.armPillow.offered = st.armPillow.inUse = true)),
      'male',
      'pullBlanket',
      50,
    );
    expect(r.s.blanketOffset).toBeCloseTo(-0.18);
    expect(r.notes).toContain('oneHandPull');
  });

  it('tuckBlanket moves 0.25×eff toward the partner; an awake partner gets mood +5 / intimacy +3', () => {
    const r = act(scene(), 'male', 'tuckBlanket', 30);
    expect(r.s.blanketOffset).toBeCloseTo(0.25);
    expect(r.s.chars.female.mood).toBe(65);
    expect(r.s.intimacy).toBe(13);
    expect(r.lines).toEqual(['female:blanketTucked']);
    expect(act(scene(), 'female', 'tuckBlanket', 30).s.blanketOffset).toBeCloseTo(-0.25);
  });

  it('tuckBlanket gives nothing when it barely moves (< 0.05), when the partner sleeps, or when rough', () => {
    const edge = act(
      scene({}, (st) => (st.blanketOffset = 0.97)),
      'male',
      'tuckBlanket',
      30,
    );
    expect(edge.s.blanketOffset).toBe(1);
    expect(edge.s.intimacy).toBe(10);
    expect(canUse(edge.s, 'male', 'tuckBlanket')).toBe(false);
    const sleeper = act(
      scene({}, (_s, _me, ai) => asleep(ai, 80)),
      'male',
      'tuckBlanket',
      30,
    );
    expect(sleeper.s.blanketOffset).toBeCloseTo(0.25);
    expect(sleeper.s.intimacy).toBe(10);
    const rough = act(scene(), 'male', 'tuckBlanket', 100);
    expect(rough.s.blanketOffset).toBeCloseTo(0.375);
    expect(rough.s.intimacy).toBe(10);
    expect(rough.s.chars.female.mood).toBe(60);
  });
});

describe('§5 moves', () => {
  const lat = (m: number, f: number) =>
    scene({}, (st) => {
      st.chars.male.lateral = m;
      st.chars.female.lateral = f;
    });

  it('scootIn moves 0.2×eff toward the centre, never past ±0.1, restless +20', () => {
    const r = act(lat(-0.3, 0.3), 'male', 'scootIn', 30);
    expect(r.s.chars.male.lateral).toBeCloseTo(-0.1);
    expect(r.s.chars.male.restless).toBe(20);
    expect(act(lat(-0.5, 0.3), 'male', 'scootIn', 5).s.chars.male.lateral).toBeCloseTo(-0.4);
    expect(act(lat(-0.15, 0.3), 'male', 'scootIn', 70).s.chars.male.lateral).toBeCloseTo(-0.1);
    expect(act(lat(-0.3, 0.3), 'female', 'scootIn', 30).s.chars.female.lateral).toBeCloseTo(0.1);
  });

  it('scootIn ending closer than 0.3: receptive partner mood +2 (not when rough), otherwise annoyance +4', () => {
    const close = act(lat(-0.3, 0.15), 'male', 'scootIn', 30);
    expect(close.s.chars.female.mood).toBe(62);
    const grumpy = act(
      scene({}, (st, _me, ai) => {
        st.chars.male.lateral = -0.3;
        st.chars.female.lateral = 0.15;
        ai.annoyance = 50;
      }),
      'male',
      'scootIn',
      30,
    );
    expect(grumpy.s.chars.female.annoyance).toBe(54);
    const rough = act(lat(-0.3, 0.15), 'male', 'scootIn', 100);
    expect(rough.s.chars.female.mood).toBe(60);
    expect(rough.s.chars.female.annoyance).toBe(15);
    expect(act(lat(-0.3, 0.3), 'male', 'scootIn', 30).s.chars.female.mood).toBe(60); // ended at 0.4
  });

  it('scootOut moves outward 0.2×eff, ends the embrace, restless +20; edge note at ≥ 0.65; player can roll off', () => {
    const r = act(
      scene({}, (st) => (st.embrace = true)),
      'male',
      'scootOut',
      30,
    );
    expect(r.s.chars.male.lateral).toBeCloseTo(-0.5);
    expect(r.s.embrace).toBe(false);
    expect(r.s.chars.male.restless).toBe(20);
    expect(act(lat(-0.5, 0.3), 'male', 'scootOut', 30).notes).toContain('edgePlayer');
    const off = act(lat(-0.9, 0.3), 'male', 'scootOut', 30);
    expect(off.s.chars.male.lateral).toBe(-1);
    expect(off.notes).toContain('fellOffEdge');
    // the AI is clamped at ±0.9 and never falls
    const ai = act(lat(-0.3, 0.8), 'female', 'scootOut', 30);
    expect(ai.s.chars.female.lateral).toBeCloseTo(0.9);
    expect(ai.notes).toContain('edgePartner');
  });

  it('female scootOut while on the arm pillow leaves the arm', () => {
    const r = act(
      scene({ role: 'female' }, (st) => (st.armPillow.offered = st.armPillow.inUse = true)),
      'female',
      'scootOut',
      30,
    );
    expect(r.s.armPillow).toMatchObject({ offered: true, inUse: false });
  });
});

describe('§5 sleep and push', () => {
  const sleeper = (mut?: (me: CharacterState, s: GameState) => void) =>
    scene({}, (st, me) => {
      me.eyes = 'closed';
      me.sleep = 20;
      mut?.(me, st);
    });

  it('sleep: +18, +12 once asleep; cold ×0.5, bad mood ×0.75, pinned arm ×0.75, embrace +4, numb arm cap 8', () => {
    expect(act(sleeper(), 'male', 'sleep').s.chars.male.sleep).toBe(38);
    expect(act(sleeper((me) => (me.sleep = 70)), 'male', 'sleep').s.chars.male.sleep).toBe(82);
    const cold = act(sleeper((me) => (me.warmth = 29)), 'male', 'sleep');
    expect(cold.s.chars.male.sleep).toBe(29);
    expect(cold.notes).toContain('sleepCold');
    const moody = act(sleeper((me) => (me.mood = 39)), 'male', 'sleep');
    expect(moody.s.chars.male.sleep).toBe(20 + 13.5);
    expect(moody.notes).toContain('sleepBadMood');
    const pinned = act(sleeper((_me, st) => (st.armPillow.offered = st.armPillow.inUse = true)), 'male', 'sleep');
    expect(pinned.s.chars.male.sleep).toBe(20 + 13.5);
    expect(pinned.notes).toContain('sleepArmPinned');
    expect(act(sleeper((_me, st) => (st.embrace = true)), 'male', 'sleep').s.chars.male.sleep).toBe(42);
    const all = act(
      sleeper((me, st) => {
        me.warmth = 20;
        me.mood = 30;
        st.armPillow = { offered: true, inUse: true, numbness: 0 };
        st.embrace = true;
      }),
      'male',
      'sleep',
    );
    expect(all.s.chars.male.sleep).toBeCloseTo(20 + 18 * 0.5 * 0.75 * 0.75 + 4);
    const numb = act(sleeper((_me, st) => (st.armPillow = { offered: true, inUse: true, numbness: 75 })), 'male', 'sleep');
    expect(numb.s.chars.male.sleep).toBe(28);
    // the cap is the man's: a woman is not limited by his numb arm
    const her = act(
      scene({ role: 'female' }, (st, me) => {
        me.eyes = 'closed';
        me.sleep = 20;
        st.armPillow = { offered: true, inUse: true, numbness: 100 };
      }),
      'female',
      'sleep',
    );
    expect(her.s.chars.female.sleep).toBe(38);
  });

  it('push (AI): player shoved 0.35 outward, AI turns away, embrace/arm cleared, AI annoyance −20, push line + event', () => {
    const s = scene({ role: 'female' }, (st, _me, ai) => {
      ai.annoyance = 80;
      st.embrace = true;
      st.armPillow = { offered: true, inUse: true, numbness: 30 };
    });
    const r = act(s, 'male', 'push');
    expect(r.s.chars.female.lateral).toBeCloseTo(0.65);
    expect(r.s.chars.male).toMatchObject({ posture: 'sideAway', annoyance: 60 });
    expect(r.s.embrace).toBe(false);
    expect(r.s.armPillow).toMatchObject({ offered: false, inUse: false });
    expect(r.lines).toEqual(['male:push']);
    expect(ofType(r.events, 'push')).toEqual([{ type: 'push', who: 'male', target: 'female' }]);
    expect(r.s.memo.pushedOff).toBe(false);
  });

  it('push that shoves the player to the edge sets memo.pushedOff (→ kickedOff, not fellOff)', () => {
    const r = act(
      scene({ role: 'female' }, (st, _me, ai) => {
        ai.annoyance = 80;
        st.chars.female.lateral = 0.7;
      }),
      'male',
      'push',
    );
    expect(r.s.chars.female.lateral).toBe(1);
    expect(r.s.memo.pushedOff).toBe(true);
  });
});

// ───────────────────────── §5.1 / §5.2 links ─────────────────────────

describe('§5.1 posture changes', () => {
  it('restless +35; sleep −8 only when sleep >= 30', () => {
    const r = act(
      scene({}, (_s, me) => (me.sleep = 30)),
      'male',
      'lieSupine',
    );
    expect(r.s.chars.male).toMatchObject({ posture: 'supine', restless: 35, sleep: 22 });
    expect(ofType(r.events, 'posture')).toEqual([{ type: 'posture', who: 'male', posture: 'supine' }]);
    expect(
      act(
        scene({}, (_s, me) => (me.sleep = 29)),
        'male',
        'lieSupine',
      ).s.chars.male.sleep,
    ).toBe(29);
  });

  it('embrace breaks when anyone turns to a non-facing posture; an awake intimacy partner loses 5 mood', () => {
    const s = scene({}, (st) => (st.embrace = true));
    const r = act(s, 'male', 'lieSupine');
    expect(r.s.embrace).toBe(false);
    expect(r.s.chars.female.mood).toBe(55);
    expect(ofType(r.events, 'embrace')).toEqual([{ type: 'embrace', on: false }]);
    const away = act(s, 'male', 'lieSideAway');
    expect(away.s.chars.female.mood).toBe(52); // −5 (embrace) −3 (turned away)
    const sleepGoal = act(
      scene({ partnerGoal: 'sleep' }, (st) => (st.embrace = true)),
      'male',
      'lieSupine',
    );
    expect(sleepGoal.s.chars.female.mood).toBe(60);
    const sleeping = act(
      scene({}, (st, _me, ai) => {
        st.embrace = true;
        asleep(ai, 80);
      }),
      'male',
      'lieSupine',
    );
    expect(sleeping.s.embrace).toBe(false);
    expect(sleeping.s.chars.female.mood).toBe(60);
  });

  it('the hugged partner turning to face keeps the embrace (spooning → facing)', () => {
    const s = scene({}, (st, _me, ai) => {
      st.embrace = true;
      ai.posture = 'sideAway';
    });
    expect(act(s, 'female', 'lieSideFacing').s.embrace).toBe(true);
    expect(act(s, 'female', 'lieSupine').s.embrace).toBe(false);
  });

  it('lieSideAway disappoints an awake intimacy-goal partner (mood −3) but not a sleeper or a sleep-goal partner', () => {
    expect(act(scene(), 'male', 'lieSideAway').s.chars.female.mood).toBe(57);
    expect(act(scene({ partnerGoal: 'sleep' }), 'male', 'lieSideAway').s.chars.female.mood).toBe(60);
    expect(
      act(
        scene({}, (_s, _me, ai) => asleep(ai, 80)),
        'male',
        'lieSideAway',
      ).s.chars.female.mood,
    ).toBe(60);
  });

  it('woman on the arm turning away / prone leaves the arm (+5 noise); turning supine keeps it', () => {
    const s = scene({ role: 'female' }, (st) => (st.armPillow = { offered: true, inUse: true, numbness: 25 }));
    const away = act(s, 'female', 'lieSideAway');
    expect(away.s.armPillow).toEqual({ offered: true, inUse: false, numbness: 25 });
    expect(away.action.noise).toBe(25);
    expect(ofType(away.events, 'armPillow')).toEqual([{ type: 'armPillow', offered: true, inUse: false }]);
    const supine = act(s, 'female', 'lieSupine');
    expect(supine.s.armPillow.inUse).toBe(true);
    // AI woman going prone in her sleep also leaves the arm
    const prone = act(
      scene({}, (st, _me, ai) => {
        st.armPillow = { offered: true, inUse: true, numbness: 25 };
        asleep(ai, 80);
      }),
      'female',
      'lieProne',
      0,
      constRng(0.5),
      { unconscious: true },
    );
    expect(prone.s.armPillow.inUse).toBe(false);
  });

  it('man with the arm offered turning away withdraws it automatically (offered/inUse off, numbness 0, +10 noise)', () => {
    const s = scene({}, (st) => (st.armPillow = { offered: true, inUse: false, numbness: 40 }));
    const r = act(s, 'male', 'lieSideAway');
    expect(r.s.armPillow).toEqual({ offered: false, inUse: false, numbness: 0 });
    expect(r.action.noise).toBe(30);
    const ai = act(
      scene({ role: 'female' }, (st) => (st.armPillow = { offered: true, inUse: false, numbness: 0 })),
      'male',
      'lieProne',
    );
    expect(ai.s.armPillow.offered).toBe(false);
    expect(ai.action.noise).toBe(35);
    expect(act(s, 'male', 'lieSupine').s.armPillow.offered).toBe(true);
  });

  it('an unconscious (sleeping AI) posture change costs no restless and no sleep (§14.2)', () => {
    const s = scene({}, (_s, _me, ai) => asleep(ai, 80));
    const r = act(s, 'female', 'lieSupine', 0, constRng(0.5), { unconscious: true });
    expect(r.s.chars.female).toMatchObject({ posture: 'supine', restless: 0, sleep: 80 });
    const awake = act(s, 'female', 'lieSupine');
    expect(awake.s.chars.female).toMatchObject({ restless: 35, sleep: 72 });
    const pull = act(s, 'female', 'pullBlanket', 55, constRng(0.5), { unconscious: true, notes: ['partnerStoleBlanket'] });
    expect(pull.s.chars.female.restless).toBe(0);
    expect(pull.s.blanketOffset).toBeCloseTo(0.3);
    expect(pull.notes).toEqual(['partnerStoleBlanket']);
  });
});

describe('§5.2 man with his arm pinned (inUse)', () => {
  const pinned = (mut?: (st: GameState) => void) =>
    scene({}, (st) => {
      st.armPillow = { offered: true, inUse: true, numbness: 25 };
      mut?.(st);
    });

  it('cannot lieSideAway or scootOut (armPinned); withdrawArm is the way out', () => {
    expect(checkAction(pinned(), 'male', 'lieSideAway')).toMatchObject({ ok: false, reasonKey: 'armPinned' });
    expect(checkAction(pinned(), 'male', 'scootOut')).toMatchObject({ ok: false, reasonKey: 'armPinned' });
    expect(canUse(pinned(), 'male', 'withdrawArm')).toBe(true);
    const out = act(pinned(), 'male', 'withdrawArm', 30).s;
    expect(canUse(out, 'male', 'lieSideAway')).toBe(true);
    expect(canUse(out, 'male', 'scootOut')).toBe(true);
  });

  it('supine ↔ sideFacing stays possible with +5 noise and keeps the arm', () => {
    const r = act(pinned(), 'male', 'lieSupine');
    expect(r.action.noise).toBe(25);
    expect(r.s.armPillow.inUse).toBe(true);
    const back = act(r.s, 'male', 'lieSideFacing');
    expect(back.action.noise).toBe(25);
    expect(back.s.armPillow.inUse).toBe(true);
  });

  it('the other hand still works: hug / caress / kiss / whisper / pat / tuckBlanket / pullBlanket', () => {
    for (const id of ['hug', 'caress', 'kiss', 'whisper', 'pat', 'tuckBlanket', 'pullBlanket'] as const) {
      expect(canUse(pinned(), 'male', id), id).toBe(true);
    }
  });
});

// ───────────────────────── §6 end of turn ─────────────────────────

describe('§6 end of turn', () => {
  it('warmth += (cover − 0.55) × 80 for each side', () => {
    const cases = [
      [0, 16, 16],
      [0.5, -8, 36],
      [-0.6, 36, -12.8],
      [0.6, -12.8, 36],
      [0.9, -27.2, 36],
      [1, -32, 36],
    ] as const;
    for (const [offset, dm, df] of cases) {
      const r = eot(scene({}, (st) => (st.blanketOffset = offset)));
      expect(r.s.chars.male.warmth, `offset ${offset}`).toBeCloseTo(60 + dm);
      expect(r.s.chars.female.warmth, `offset ${offset}`).toBeCloseTo(Math.min(100, 60 + df));
    }
  });

  it('cold: event every turn below 30; coldAwake only when crossing while awake; a cold sleeper loses 8 sleep', () => {
    const first = eot(
      scene({}, (st, me) => {
        st.blanketOffset = 1;
        me.warmth = 40;
      }),
    );
    expect(first.s.chars.male.warmth).toBe(8);
    expect(ofType(first.events, 'cold')).toEqual([{ type: 'cold', who: 'male' }]);
    expect(first.lines).toContain('male:coldAwake');
    const second = eot(first.s);
    expect(ofType(second.events, 'cold')).toEqual([{ type: 'cold', who: 'male' }]);
    expect(second.lines).not.toContain('male:coldAwake');

    const sleeper = eot(
      scene({}, (st, me) => {
        st.blanketOffset = 1;
        me.warmth = 40;
        me.eyes = 'closed';
        me.sleep = 80;
      }),
    );
    expect(ofType(sleeper.events, 'cold')).toHaveLength(1);
    expect(sleeper.lines).not.toContain('male:coldAwake');
    expect(sleeper.s.chars.male.sleep).toBe(80 - 8 + 6);
  });

  it('embrace: both +2 extra sleep while both are at least drowsy (>= 30)', () => {
    const both = eot(
      scene({}, (st, me, ai) => {
        st.embrace = true;
        me.sleep = 30;
        ai.sleep = 30;
      }),
    );
    expect(both.s.chars.male.sleep).toBe(32);
    expect(both.s.chars.female.sleep).toBe(32);
    const one = eot(
      scene({}, (st, me, ai) => {
        st.embrace = true;
        me.sleep = 30;
        ai.sleep = 29;
      }),
    );
    expect(one.s.chars.male.sleep).toBe(30);
  });

  describe('snoring', () => {
    const snorer = (sleep: number, posture: Posture, mut?: (me: CharacterState) => void) =>
      scene({}, (_s, me, ai) => {
        asleep(ai, sleep); // +6 from time passage before the snore step
        ai.posture = posture;
        me.posture = 'supine';
        me.annoyance = 20;
        mut?.(me);
      });

    it('level 3 (supine ≥ 90): snore event, awake listener +6 annoyance and a snore line', () => {
      const r = eot(snorer(88, 'supine'));
      expect(ofType(r.events, 'snore')).toEqual([{ type: 'snore', who: 'female', level: 3 }]);
      expect(r.s.chars.male.annoyance).toBe(20 + 6 - 5);
      expect(r.lines).toContain('male:snore');
    });

    it('level 2 (supine < 90): +4 annoyance; level 1 (side): no annoyance; prone: silent', () => {
      const l2 = eot(snorer(75, 'supine'));
      expect(ofType(l2.events, 'snore')).toEqual([{ type: 'snore', who: 'female', level: 2 }]);
      expect(l2.s.chars.male.annoyance).toBe(19);
      const l1 = eot(snorer(75, 'sideAway'));
      expect(ofType(l1.events, 'snore')).toEqual([{ type: 'snore', who: 'female', level: 1 }]);
      expect(l1.s.chars.male.annoyance).toBe(15);
      expect(l1.lines).not.toContain('male:snore');
      expect(ofType(eot(snorer(95, 'prone')).events, 'snore')).toHaveLength(0);
    });

    it('snore noise goes through §4: a drowsy listener loses N×0.15 sleep and gets no annoyance', () => {
      const r = eot(snorer(88, 'supine', (me) => (me.sleep = 50))); // noise 30 < T 37.5
      expect(ofType(r.events, 'wake')).toHaveLength(0);
      expect(r.s.chars.male.sleep).toBeCloseTo(50 - 30 * 0.15);
      expect(r.s.chars.male.annoyance).toBe(15);
    });

    it('the snore complaint line is said at most once per 3 turns', () => {
      let s = snorer(95, 'supine');
      const said: number[] = [];
      for (let t = 1; t <= 7; t++) {
        s.turn = t;
        const r = eot(s);
        if (r.lines.includes('male:snore')) said.push(t);
        s = r.s;
      }
      expect(said).toEqual([1, 4, 7]);
    });
  });

  describe('numb arm', () => {
    const pillow = (numbness: number, inUse = true) =>
      scene({}, (st) => {
        st.armPillow = { offered: true, inUse, numbness };
        st.chars.male.sleep = 50;
        st.chars.female.sleep = 10;
        st.chars.male.lastAction = 'whisper'; // attempted affection → no intimacy decay
      });

    it('+25 numbness per turn in use; she gets +3 sleep, +2 mood; intimacy +2', () => {
      const r = eot(pillow(0));
      expect(r.s.armPillow.numbness).toBe(25);
      expect(r.s.chars.female.sleep).toBe(13);
      expect(r.s.intimacy).toBe(12);
      expect(ofType(r.events, 'numb')).toHaveLength(0);
    });

    it('at 75: his mood −8, numb event, numbArm line the first time only', () => {
      const r = eot(pillow(50));
      expect(r.s.armPillow.numbness).toBe(75);
      expect(r.s.chars.male.mood).toBe(60 - 8 + 2);
      expect(ofType(r.events, 'numb')).toEqual([{ type: 'numb', who: 'male' }]);
      expect(r.lines).toContain('male:numbArm');
      const again = eot(r.s);
      expect(ofType(again.events, 'numb')).toHaveLength(1);
      expect(again.lines).not.toContain('male:numbArm');
    });

    it('at 100: additionally annoyance +10 and sleep −6, repeated every turn', () => {
      let s = pillow(75);
      for (let i = 0; i < 3; i++) {
        const r = eot(s);
        expect(r.s.armPillow.numbness).toBe(100);
        expect(r.s.chars.male.annoyance).toBe(s.chars.male.annoyance + 10 - 5);
        expect(r.s.chars.male.sleep).toBe(s.chars.male.sleep - 6);
        s = r.s;
      }
    });

    it('not in use: numbness recovers by 50 per turn down to 0', () => {
      const a = eot(pillow(100, false));
      expect(a.s.armPillow.numbness).toBe(50);
      expect(eot(a.s).s.armPillow.numbness).toBe(0);
      expect(eot(pillow(30, false)).s.armPillow.numbness).toBe(0);
    });
  });

  describe('noticed (§6.5)', () => {
    it('restless >= 50 is noticed by an awake partner: restless → 20 (then decays), sleep-goal partner +6 annoyance', () => {
      const r = eot(
        scene({ partnerGoal: 'sleep' }, (_s, me, ai) => {
          me.posture = 'supine'; // no stare
          me.restless = 60;
          ai.annoyance = 20;
        }),
      );
      expect(ofType(r.events, 'noticed')).toEqual([{ type: 'noticed', who: 'male', by: 'female' }]);
      expect(r.s.chars.male.restless).toBe(5);
      expect(r.s.chars.female.annoyance).toBe(21);
      expect(r.lines).toContain('female:noticedSleep');
    });

    it('an intimacy-goal partner is pleased instead (mood +5, noticedIntimacy)', () => {
      const r = eot(
        scene({}, (_s, me, ai) => {
          me.restless = 50;
          ai.mood = 50;
        }),
      );
      expect(ofType(r.events, 'noticed')).toHaveLength(1);
      expect(r.s.chars.female.mood).toBe(57);
      expect(r.lines).toContain('female:noticedIntimacy');
    });

    it('in play: two posture changes in a row (35 → 20 after decay → 55) get the player noticed that night', () => {
      for (const role of ['male', 'female'] as Role[]) {
        const t0 = playTurn(createGame(role, 3), 'lieSideFacing', 0);
        expect(t0.state.chars[role].restless).toBe(20);
        expect(ofType(t0.events, 'noticed').filter((e) => e.who === role)).toHaveLength(0);
        const t1 = playTurn(t0.state, 'lieSupine', 0);
        expect(ofType(splitPhases(t1.events).endOfTurn, 'noticed')).toContainEqual({ type: 'noticed', who: role, by: partnerOf(role) });
        expect(t1.state.chars[role].restless).toBe(5);
      }
    });

    it('the AI can be noticed too, and it works symmetrically', () => {
      const r = eot(scene({}, (_s, _me, ai) => (ai.restless = 70)));
      expect(ofType(r.events, 'noticed')).toEqual([{ type: 'noticed', who: 'female', by: 'male' }]);
      expect(r.lines).toContain('male:noticedIntimacy');
    });

    it('not noticed below 50, by a sleeping partner, or when actually asleep (§14.2)', () => {
      const cases: ((me: CharacterState, ai: CharacterState) => void)[] = [
        (me) => (me.restless = 49),
        (me, ai) => {
          me.restless = 60; // …but the partner is asleep
          asleep(ai, 70);
        },
        (me) => {
          me.restless = 60; // …but actually asleep (§14.2)
          me.sleep = 70;
          me.eyes = 'closed';
        },
      ];
      for (const c of cases) {
        const r = eot(scene({}, (_s, me, ai) => c(me, ai)));
        expect(ofType(r.events, 'noticed')).toHaveLength(0);
      }
    });

    it('breath tell: a faking player (lastAction sleep, sleep < 30) is caught when r < 0.25', () => {
      const faking = (sleep: number) =>
        scene({}, (_s, me) => {
          me.eyes = 'closed';
          me.lastAction = 'sleep';
          me.sleep = sleep; // +6 time passage happens before the check
        });
      const caught = eot(faking(18), constRng(0.2));
      expect(ofType(caught.events, 'noticed')).toEqual([{ type: 'noticed', who: 'male', by: 'female' }]);
      expect(caught.lines).toContain('female:breathTell');
      expect(ofType(eot(faking(18), constRng(0.3)).events, 'noticed')).toHaveLength(0);
      expect(ofType(eot(faking(24), constRng(0)).events, 'noticed')).toHaveLength(0); // 30 after time passage
    });

    it('breath tell in real turns (fixed seeds 0..399 × both roles): caught about 25% of the time, deterministically', () => {
      const caughtSeeds: string[] = [];
      let n = 0;
      for (const role of ['male', 'female'] as Role[]) {
        for (let seed = 0; seed < 400; seed++) {
          const setup = () =>
            scene({ role, seed, playerGoal: 'sleep', partnerGoal: 'sleep' }, (st, me, ai) => {
              st.turn = 5;
              me.eyes = 'closed';
              me.sleep = 5; // +18 +6 → 29: still faking at the check
              ai.sleep = 40; // awake enough to notice, not faking herself
            });
          const r = playTurn(setup(), 'sleep', 0);
          const noticed = ofType(r.events, 'noticed');
          const tells = ofType(r.events, 'speech').filter((e) => e.key === 'breathTell');
          expect(noticed.length).toBe(tells.length);
          if (tells.length) {
            expect(noticed).toEqual([{ type: 'noticed', who: role, by: partnerOf(role) }]);
            expect(tells[0].who).toBe(partnerOf(role));
            caughtSeeds.push(`${role}/${seed}`);
          }
          n++;
        }
      }
      const rate = caughtSeeds.length / n;
      expect(rate, `breath tell rate ${rate}`).toBeGreaterThan(0.19);
      expect(rate, `breath tell rate ${rate}`).toBeLessThan(0.31);
    });
  });

  it('decay: annoyance −5, mood 2 toward 60, restless −15 open / −20 closed', () => {
    const r = eot(
      scene({}, (_s, me, ai) => {
        me.annoyance = 3;
        me.mood = 65;
        me.restless = 30;
        ai.mood = 59;
        ai.annoyance = 40;
        ai.restless = 30;
        ai.eyes = 'closed';
      }),
    );
    expect(r.s.chars.male).toMatchObject({ annoyance: 0, mood: 63, restless: 15 });
    expect(r.s.chars.female).toMatchObject({ annoyance: 35, mood: 60, restless: 10 });
  });

  it('intimacy −3 unless someone attempted affection this turn; never decays at 100', () => {
    expect(eot(scene()).s.intimacy).toBe(7);
    expect(eot(scene({}, (_s, me) => (me.lastAction = 'kiss'))).s.intimacy).toBe(10);
    expect(eot(scene({}, (_s, _me, ai) => (ai.lastAction = 'whisper'))).s.intimacy).toBe(10);
    expect(eot(scene({}, (_s, me) => (me.lastAction = 'pat'))).s.intimacy).toBe(7); // pat is not affection
    expect(eot(scene({}, (st) => (st.intimacy = 100))).s.intimacy).toBe(100);
  });

  it('sleepScore: +1 at >= 70, +0.5 at 30–69, nothing below', () => {
    const score = (sleep: number) => eot(scene({}, (_s, me) => (me.sleep = sleep))).s.sleepScore;
    expect(score(70)).toBe(1);
    expect(score(69)).toBe(0.5);
    expect(score(30)).toBe(0.5);
    expect(score(29)).toBe(0);
  });
});

// ───────────────────────── events, eyes, speech, clues ─────────────────────────

describe('§6.8 event policy', () => {
  it('each action emits at most one annoyed / mood event per character (net delta) and one intimacy event, never zero', () => {
    const rough = act(scene(), 'male', 'kiss', 90);
    expect(ofType(rough.events, 'annoyed')).toEqual([{ type: 'annoyed', who: 'female', delta: 25 }]);
    expect(ofType(rough.events, 'mood')).toEqual([{ type: 'mood', who: 'female', delta: -3 }]);
    expect(ofType(rough.events, 'intimacy')).toEqual([]);

    // band + wake + branch annoyance merged into one event
    const woke = act(
      scene({ partnerGoal: 'sleep' }, (_s, _me, ai) => asleep(ai, 70)),
      'male',
      'kiss',
      60,
    );
    expect(ofType(woke.events, 'annoyed')).toEqual([{ type: 'annoyed', who: 'female', delta: round1(8 + (51 - 46.5) / 2 + 12) }]);

    const quiet = act(
      scene({}, (_s, _me, ai) => asleep(ai, 80)),
      'male',
      'whisper',
    );
    expect(quiet.events.filter((e) => e.type === 'annoyed' || e.type === 'mood' || e.type === 'intimacy')).toEqual([]);

    const kiss = act(scene(), 'male', 'kiss', 35);
    expect(ofType(kiss.events, 'intimacy')).toEqual([{ type: 'intimacy', delta: 12 }]);
    expect(ofType(kiss.events, 'mood')).toEqual([{ type: 'mood', who: 'female', delta: 6 }]);
  });

  it('the action event comes first, and deltas agree with the state change (random fuzz)', () => {
    const rnd = mulberry32(5150);
    const bad: string[] = [];
    for (let i = 0; i < 2000; i++) {
      const s = randomState(rnd);
      const actor: Role = rnd() < 0.5 ? 'male' : 'female';
      const id = ALL_ACTIONS[Math.floor(rnd() * ALL_ACTIONS.length)];
      const r = act(s, actor, id, rnd() * 100, rnd);
      if (r.events[0]?.type !== 'action') bad.push(`#${i} first event ${r.events[0]?.type}`);
      for (const who of ['male', 'female'] as Role[]) {
        const a = ofType(r.events, 'annoyed').filter((e) => e.who === who);
        const m = ofType(r.events, 'mood').filter((e) => e.who === who);
        const da = r.s.chars[who].annoyance - s.chars[who].annoyance;
        const dm = r.s.chars[who].mood - s.chars[who].mood;
        if (a.length > 1 || m.length > 1) bad.push(`#${i} ${id}: duplicate delta events`);
        // an event exactly when the real change is non-zero; payload = change rounded to 0.1
        if (a.length !== (Math.abs(da) > 1e-9 ? 1 : 0) || (a[0] && a[0].delta !== round1(da))) bad.push(`#${i} ${id}: annoyed ${a[0]?.delta} vs ${da}`);
        if (m.length !== (Math.abs(dm) > 1e-9 ? 1 : 0) || (m[0] && m[0].delta !== round1(dm))) bad.push(`#${i} ${id}: mood ${m[0]?.delta} vs ${dm}`);
      }
      const di = r.s.intimacy - s.intimacy;
      const ie = ofType(r.events, 'intimacy');
      if (ie.length !== (Math.abs(di) > 1e-9 ? 1 : 0) || (ie[0] && ie[0].delta !== round1(di))) bad.push(`#${i} ${id}: intimacy ${ie[0]?.delta} vs ${di}`);
      // §14.2: at most one line per character per action
      for (const who of ['male', 'female'] as Role[]) {
        if (ofType(r.events, 'speech').filter((e) => e.who === who).length > 1) bad.push(`#${i} ${id}: ${who} speaks twice`);
      }
      if (bad.length > 10) break;
    }
    expect(bad).toEqual([]);
  });

  it('endOfTurn never emits action-style events (no annoyed / mood / intimacy / posture / move / blanket / embrace / armPillow)', () => {
    const rnd = mulberry32(8086);
    const seen = new Set<string>();
    const forbidden = new Set(['action', 'annoyed', 'mood', 'intimacy', 'posture', 'move', 'blanket', 'embrace', 'armPillow', 'push', 'kick', 'fell', 'ending']);
    for (let i = 0; i < 3000; i++) {
      for (const e of eot(randomState(rnd), rnd).events) seen.add(e.type);
    }
    expect([...seen].filter((t) => forbidden.has(t))).toEqual([]);
    for (const t of ['cold', 'snore', 'numb', 'noticed', 'speech']) expect(seen.has(t), t).toBe(true);
  });
});

describe('AI eyes (§1)', () => {
  it('resolveAction re-derives the AI eyes and emits an eyes event when they change', () => {
    const chooseSleep = act(scene(), 'female', 'sleep');
    expect(chooseSleep.s.chars.female.eyes).toBe('closed');
    expect(chooseSleep.events.at(-1)).toEqual({ type: 'eyes', who: 'female', eyes: 'closed' });

    // woken by the player while her last action was not `sleep` → eyes open
    const s = scene({}, (_s, _me, ai) => {
      ai.sleep = 70;
      ai.eyes = 'closed';
      ai.lastAction = 'lieSideFacing';
    });
    const woke = act(s, 'male', 'kiss', 90);
    expect(woke.s.chars.female.eyes).toBe('open');
    expect(ofType(woke.events, 'eyes')).toEqual([{ type: 'eyes', who: 'female', eyes: 'open' }]);
    // …but after choosing sleep the eyes stay closed even when woken
    const stubborn = act(
      scene({}, (_s, _me, ai) => asleep(ai, 70)),
      'male',
      'kiss',
      90,
    );
    expect(stubborn.s.chars.female.eyes).toBe('closed');
    expect(ofType(stubborn.events, 'eyes')).toEqual([]);
  });

  it('the player\'s eyes are never changed by the rules', () => {
    const rnd = mulberry32(6502);
    for (let i = 0; i < 1500; i++) {
      const s = randomState(rnd);
      const P = s.playerRole;
      const r = act(s, rnd() < 0.5 ? 'male' : 'female', ALL_ACTIONS[Math.floor(rnd() * ALL_ACTIONS.length)], rnd() * 100, rnd);
      expect(r.s.chars[P].eyes).toBe(s.chars[P].eyes);
      expect(eot(r.s, rnd).s.chars[P].eyes).toBe(s.chars[P].eyes);
    }
  });
});

describe('speech (§8 pools, §14.2 priorities)', () => {
  it('every pool has at least 3 lines; the two opening pools share their first third', () => {
    for (const [key, pool] of Object.entries(ZH.speech)) expect(pool.length, key).toBeGreaterThanOrEqual(3);
    const gs = ZH.speech.goodnight_sleep;
    const gi = ZH.speech.goodnight_intimacy;
    expect(SHARED_GOODNIGHT_LINES).toBe(gs.length / 3);
    expect(gs.slice(0, SHARED_GOODNIGHT_LINES)).toEqual(gi.slice(0, SHARED_GOODNIGHT_LINES));
    expect(gs.slice(SHARED_GOODNIGHT_LINES).some((l) => gi.includes(l))).toBe(false);
  });

  it('roughComplaint outranks the wake line', () => {
    const r = act(
      scene({}, (_s, _me, ai) => asleep(ai, 70)),
      'male',
      'kiss',
      90,
    );
    expect(ofType(r.events, 'wake')).toHaveLength(1);
    expect(r.lines).toEqual(['female:roughComplaint']);
  });

  it('intimacyHigh: said once when intimacy first reaches 60 — by the awake partner, deferred if they already spoke', () => {
    const s = scene({}, (st) => (st.intimacy = 58));
    const whisper = act(s, 'male', 'whisper'); // +4 → 62, she already says whisperReply
    expect(whisper.lines).toEqual(['female:whisperReply']);
    expect(whisper.s.memo.intimacyHighSpoken).toBe(false);
    const next = act(whisper.s, 'female', 'lieSupine'); // her own quiet action
    expect(next.lines).toEqual(['female:intimacyHigh']);
    expect(next.s.memo.intimacyHighSpoken).toBe(true);
    expect(act(next.s, 'female', 'lieSideFacing').lines).toEqual([]);
  });

  it('intimacyHigh with the partner asleep is the player\'s inner voice', () => {
    const r = act(
      scene({}, (st, _me, ai) => {
        st.intimacy = 58;
        asleep(ai, 90);
      }),
      'male',
      'hug',
      40,
    ); // sneak hug +3 → 61; she stays asleep (90 − 5.25 − 5 ≥ 70)
    expect(r.s.chars.female.sleep).toBeGreaterThanOrEqual(70);
    expect(r.lines).toEqual(['male:intimacyHigh']);
  });
});

describe('clues (§14.4)', () => {
  const opening = (rng: number, goal: 'sleep' | 'intimacy') =>
    act(
      scene({}, (_s, _me, ai) => (ai.posture = 'supine')),
      'female',
      'lieSideFacing',
      0,
      constRng(rng),
      { speech: `goodnight_${goal}` },
    );

  it('goal-revealing opening lines count as clues, the shared ambiguous ones do not', () => {
    const tell = opening(0.99, 'sleep');
    expect(ofType(tell.events, 'speech')[0]).toMatchObject({ key: 'goodnight_sleep', index: ZH.speech.goodnight_sleep.length - 1 });
    expect(ofType(tell.events, 'clue')).toEqual([{ type: 'clue', goal: 'sleep' }]);
    expect(tell.s.memo.clues).toEqual({ sleep: 1, intimacy: 0 });
    const vague = opening(0, 'intimacy');
    expect(ofType(vague.events, 'speech')[0]).toMatchObject({ key: 'goodnight_intimacy', index: 0 });
    expect(ofType(vague.events, 'clue')).toEqual([]);
  });

  it('partner actions reveal a goal when no line already did (kiss → intimacy, pat → sleep, okFine kiss → sleep only)', () => {
    expect(ofType(act(scene(), 'female', 'kiss', 40).events, 'clue')).toEqual([{ type: 'clue', goal: 'intimacy' }]);
    expect(ofType(act(scene(), 'female', 'pat', 30).events, 'clue')).toEqual([{ type: 'clue', goal: 'sleep' }]);
    const okFine = act(scene(), 'female', 'kiss', 40, constRng(0.5), { speech: 'okFine' });
    expect(ofType(okFine.events, 'clue')).toEqual([{ type: 'clue', goal: 'sleep' }]);
    expect(ofType(act(scene(), 'female', 'lieSupine').events, 'clue')).toEqual([]);
  });

  it('the player\'s own lines and actions are never clues', () => {
    expect(ofType(act(scene(), 'male', 'kiss', 35).events, 'clue')).toEqual([]);
    const r = eot(
      scene({ playerGoal: 'sleep' }, (_s, me, ai) => {
        me.posture = 'supine';
        ai.restless = 60;
      }),
    );
    expect(r.lines).toContain('male:noticedSleep');
    expect(ofType(r.events, 'clue')).toEqual([]);
    expect(r.s.memo.clues).toEqual({ sleep: 0, intimacy: 0 });
  });
});

// ───────────────────────── spec inconsistencies (documented, expected to fail) ─────────────────────────

describe('spec self-consistency (§4 design intent, §6.3, §8) — known contradictions', () => {
  /** every player force action at the top of the firm band, in the noisiest reachable setups */
  function loudestFirm(sleeperAt: number) {
    const setups: GameState[] = [
      scene({}, (_s, _me, ai) => asleep(ai, sleeperAt)),
      scene({}, (_s, me, ai) => {
        asleep(ai, sleeperAt);
        me.eyes = 'closed';
      }),
      scene({}, (st, me, ai) => {
        asleep(ai, sleeperAt);
        st.armPillow = { offered: true, inUse: true, numbness: 0 };
        me.eyes = 'closed';
      }),
      scene({}, (st, _me, ai) => {
        asleep(ai, sleeperAt);
        st.armPillow = { offered: true, inUse: true, numbness: 0 };
      }),
    ];
    const woke: string[] = [];
    for (const s of setups) {
      for (const a of listAvailableActions(s, 'male').filter((x) => x.ok && x.def.usesForce)) {
        const f = forceWindow(s, 'male', a.def.id)[1] + 25; // firmest firm
        const r = act(s, 'male', a.def.id, f);
        if (ofType(r.events, 'wake').length) woke.push(`${a.def.id}${s.chars.male.eyes === 'closed' ? '(eyes closed)' : ''}${s.armPillow.inUse ? '(arm in use)' : ''} N=${r.action.noise}`);
      }
    }
    return woke;
  }

  // §4 "設計意圖(測試依據)… firm 只在 70–80 有機會". Contradicted by the spec's own numbers: firm hug = 35×1.7 = 59.5
  // wakes anyone below sleep ≈ 98.9 (T = 15 + 0.45·sleep); likewise closed-eyes caress (56.1), closed-eyes pullBlanket
  // (59.5) and withdrawArm with the arm in use (59.5 / 68). Only actions with effective noise ≤ 30 honour "70–80".
  it.fails('§4 intent: firm force never wakes a sleeper above 80', () => {
    expect(loudestFirm(85)).toEqual([]);
  });

  // §4 "熟睡(100,T=60)只有 rough 吵得醒". Holds for kiss/hug, but a closed-eyes man withdrawing the arm she lies on
  // at firm force makes N = (25 + 10 inUse + 5 eyes) × 1.7 = 68 > 60 and wakes even a sleep-100 partner.
  it.fails('§4 intent: at sleep 100 only rough force wakes', () => {
    expect(loudestFirm(100)).toEqual([]);
  });

  // §6.3 says the snore noise "可把 45–69 的昏沉者吵回去" (can wake a drowsy 45–69 listener), but the loudest snore is 30
  // (SNORE_NOISE[3]) while the lowest wake threshold is T(45) = 35.25 — a snore can never wake anyone.
  it.fails('§6.3: a level-3 snore can wake a drowsy (45–69) listener', () => {
    let woke = false;
    for (let sleep = 45; sleep < 70 && !woke; sleep += 0.5) {
      const s = scene({}, (_s, me, ai) => {
        asleep(ai, 90);
        ai.posture = 'supine';
        me.sleep = sleep;
        me.eyes = 'open';
      });
      woke = ofType(eot(s).events, 'wake').length > 0;
    }
    expect(woke).toBe(true);
  });

  // §8: "force: 85% → 40;15% → 80(rough,對方也會粗魯)". For hug the green zone is [25,55], so 80 = hi+25 is only
  // *firm* (rough starts above 80) — the AI's "rough" hug is not rough.
  it.fails('§8: the AI\'s 15% "rough" pick (force 80) is rough for every affection it can pick', () => {
    for (const id of ['kiss', 'caress', 'hug'] as const) expect(forceBand(ACTIONS[id].forceWindow, 80), id).toBe('rough');
  });
});

// ───────────────────────── clamping ─────────────────────────

describe('clamping (§2): every stat stays in 0..100, lateral/offset in range, no NaN', () => {
  it('extreme states through every action and endOfTurn', () => {
    const problems: string[] = [];
    for (const role of ['male', 'female'] as Role[]) {
      for (const extreme of [0, 100]) {
        const s = scene({ role }, (st) => {
          for (const r of ['male', 'female'] as Role[]) {
            const c = st.chars[r];
            c.sleep = c.mood = c.annoyance = c.warmth = c.restless = extreme;
          }
          st.intimacy = extreme;
          st.armPillow = { offered: true, inUse: true, numbness: extreme };
          st.blanketOffset = extreme ? 1 : -1;
        });
        for (const actor of ['male', 'female'] as Role[]) {
          for (const id of ALL_ACTIONS) {
            for (const f of [0, 30, 70, 100]) {
              const r = act(s, actor, id, f);
              problems.push(...stateViolations(r.s, `${role}/${extreme} ${actor} ${id} f${f}`));
              problems.push(...stateViolations(eot(r.s).s, `${role}/${extreme} ${actor} ${id} f${f} +eot`));
            }
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('random states × random actions × random forces (seeded fuzz)', () => {
    const rnd = mulberry32(12345);
    const problems: string[] = [];
    const postures: Posture[] = ['supine', 'sideFacing', 'sideAway', 'prone'];
    for (let i = 0; i < 3000; i++) {
      const role: Role = rnd() < 0.5 ? 'male' : 'female';
      const s = scene({ role, playerGoal: rnd() < 0.5 ? 'sleep' : 'intimacy', partnerGoal: rnd() < 0.5 ? 'sleep' : 'intimacy' }, (st) => {
        for (const r of ['male', 'female'] as Role[]) {
          const c = st.chars[r];
          c.sleep = rnd() * 100;
          c.mood = rnd() * 100;
          c.annoyance = rnd() * 100;
          c.warmth = rnd() * 100;
          c.restless = rnd() * 100;
          c.posture = postures[Math.floor(rnd() * 4)];
          c.eyes = rnd() < 0.5 ? 'open' : 'closed';
        }
        st.chars.male.lateral = -0.1 - rnd() * (st.playerRole === 'male' ? 0.9 : 0.8);
        st.chars.female.lateral = 0.1 + rnd() * (st.playerRole === 'female' ? 0.9 : 0.8);
        st.blanketOffset = rnd() * 2 - 1;
        st.intimacy = rnd() * 100;
        st.embrace = rnd() < 0.3;
        const offered = rnd() < 0.4;
        st.armPillow = { offered, inUse: offered && rnd() < 0.5, numbness: rnd() * 100 };
        st.turn = Math.floor(rnd() * 12);
      });
      const actor: Role = rnd() < 0.5 ? 'male' : 'female';
      const id = ALL_ACTIONS[Math.floor(rnd() * ALL_ACTIONS.length)];
      const force = [Number.NaN, -20, rnd() * 100, 140][Math.floor(rnd() * 4)];
      const r = act(s, actor, id, force, rnd);
      problems.push(...stateViolations(r.s, `#${i} ${actor} ${id}`));
      problems.push(...stateViolations(eot(r.s, rnd).s, `#${i} ${actor} ${id} +eot`));
      if (problems.length > 20) break;
    }
    expect(problems).toEqual([]);
  });
});
