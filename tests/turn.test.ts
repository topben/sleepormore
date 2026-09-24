// Turn flow (DESIGN §2): createGame, toggleEyes, playTurn, splitPhases.
import { describe, expect, it } from 'vitest';
import { listAvailableActions } from '../src/game/actions';
import { INITIAL, clockLabel } from '../src/game/constants';
import { choosePartnerAction } from '../src/game/partner';
import { mulberry32, turnRng } from '../src/game/rng';
import { aiEyes, endOfTurn, resolveAction } from '../src/game/rules';
import { createGame, playTurn, splitPhases, toggleEyes } from '../src/game/turn';
import { tallyTurn } from '../src/game/titles';
import type { ActionId, GameEvent, GameState, Role, TurnResult } from '../src/game/types';
import { partnerOf } from '../src/game/types';
import { asleep, deepFreeze, ofType, scene } from './helpers';

const ENDOFTURN_ONLY = new Set<GameEvent['type']>(['cold', 'snore', 'numb', 'noticed', 'turnEnd']);

/** Structural problems of one playTurn result (empty = OK) */
function turnProblems(before: GameState, actionId: ActionId, r: TurnResult): string[] {
  const out: string[] = [];
  const P = before.playerRole;
  const AI = partnerOf(P);
  const ev = r.events;
  const phases = ofType(ev, 'phase').map((e) => e.phase);
  const mid = !ev.some((e) => e.type === 'turnEnd');
  const want = mid ? ['player'] : ['player', 'partner', 'endOfTurn'];
  if (JSON.stringify(phases) !== JSON.stringify(want)) out.push(`phases ${phases}`);
  if (ev[0]?.type !== 'phase') out.push('first event is not the player phase');
  const seg = splitPhases(ev);
  const pa = ofType(seg.player, 'action');
  if (pa.length !== 1 || pa[0].who !== P || pa[0].action !== actionId || seg.player[0] !== pa[0]) out.push('player segment must open with the player action');
  if (!mid) {
    const aa = ofType(seg.partner, 'action');
    if (aa.length !== 1 || aa[0].who !== AI || seg.partner[0] !== aa[0]) out.push('partner segment must open with the AI action');
    if (ofType(seg.endOfTurn, 'action').length) out.push('action event in endOfTurn');
    const te = ofType(ev, 'turnEnd');
    if (te.length !== 1 || te[0].turn !== before.turn + 1 || r.state.turn !== before.turn + 1) out.push('turnEnd/turn mismatch');
  } else {
    if (r.state.turn !== before.turn) out.push('mid-turn ending advanced the turn');
    if (r.intermediate !== r.state) out.push('mid-turn ending: intermediate must be the state');
    if (!r.state.ending || !['kickedOff', 'fellOff'].includes(r.state.ending.id)) out.push('mid-turn stop without kick/fell ending');
  }
  for (const k of ['player', 'partner'] as const) {
    for (const e of seg[k]) if (ENDOFTURN_ONLY.has(e.type)) out.push(`${e.type} in ${k} phase`);
  }
  const endings = ofType(ev, 'ending');
  if (r.state.ending) {
    if (endings.length !== 1 || ev.at(-1) !== endings[0] || endings[0].ending !== r.state.ending) out.push('ending event must be last and match state');
    const kicks = ofType(ev, 'kick').length;
    const falls = ofType(ev, 'fell').length;
    if (kicks !== (r.state.ending.id === 'kickedOff' ? 1 : 0) || falls !== (r.state.ending.id === 'fellOff' ? 1 : 0)) out.push('kick/fell events');
  } else if (endings.length) out.push('ending event without state.ending');
  if (r.state.chars[P].eyes !== before.chars[P].eyes || r.intermediate.chars[P].eyes !== before.chars[P].eyes) out.push('player eyes changed by playTurn');
  const ai = r.state.chars[AI];
  if (ai.eyes !== aiEyes(ai)) out.push('AI eyes out of sync');
  const mi = r.intermediate.chars[AI];
  if (mi.eyes !== aiEyes(mi)) out.push('AI eyes out of sync in intermediate');
  return out;
}

describe('createGame', () => {
  it('draws male.goal, female.goal, male.mood, female.mood from mulberry32(seed), in that order', () => {
    for (let seed = 0; seed < 50; seed++) {
      const r = mulberry32(seed);
      const mg = r() < 0.5 ? 'sleep' : 'intimacy';
      const fg = r() < 0.5 ? 'sleep' : 'intimacy';
      const mm = 50 + Math.floor(r() * 21);
      const fm = 50 + Math.floor(r() * 21);
      for (const role of ['male', 'female'] as Role[]) {
        const s = createGame(role, seed);
        expect(s.chars.male).toMatchObject({ goal: mg, mood: mm });
        expect(s.chars.female).toMatchObject({ goal: fg, mood: fm });
        expect(s.playerRole).toBe(role);
        expect(s.seed).toBe(seed);
      }
    }
  });

  it('initial values follow §1', () => {
    const s = createGame('female', 3);
    expect(s).toMatchObject({ turn: 0, blanketOffset: 0, intimacy: 10, embrace: false, sleepScore: 0, ending: null });
    expect(s.armPillow).toEqual({ offered: false, inUse: false, numbness: 0 });
    for (const r of ['male', 'female'] as Role[]) {
      expect(s.chars[r]).toMatchObject({ role: r, posture: 'supine', eyes: 'open', sleep: 0, annoyance: 0, warmth: 60, restless: 0, lastAction: null });
      expect(s.chars[r].mood).toBeGreaterThanOrEqual(50);
      expect(s.chars[r].mood).toBeLessThanOrEqual(70);
    }
    expect(s.chars.male.lateral).toBe(-INITIAL.lateral);
    expect(s.chars.female.lateral).toBe(INITIAL.lateral);
    expect(s.chars.female.lateral - s.chars.male.lateral).toBeCloseTo(0.7);
  });

  it('goal options override the draw without changing the moods', () => {
    const plain = createGame('male', 11);
    const set = createGame('male', 11, { playerGoal: 'sleep', partnerGoal: 'intimacy' });
    expect(set.chars.male.goal).toBe('sleep');
    expect(set.chars.female.goal).toBe('intimacy');
    expect(set.chars.male.mood).toBe(plain.chars.male.mood);
    expect(set.chars.female.mood).toBe(plain.chars.female.mood);
    expect(createGame('female', 11, { playerGoal: 'intimacy' }).chars.female.goal).toBe('intimacy');
  });

  it('per-turn RNG = mulberry32((seed ^ imul(turn, 0x9E3779B1)) >>> 0)', () => {
    for (const [seed, turn] of [
      [0, 0],
      [5, 3],
      [0xffffffff, 11],
    ]) {
      const a = turnRng(seed, turn);
      const b = mulberry32((seed ^ Math.imul(turn + 1, 0x9e3779b1)) >>> 0); // 加鹽版(DESIGN §14.2)
      for (let i = 0; i < 5; i++) expect(a()).toBe(b());
    }
  });
});

describe('toggleEyes', () => {
  it('does not advance the turn or touch the partner; returns a new state', () => {
    const s = scene({}, (st) => (st.turn = 4));
    const r = toggleEyes(s, 'closed');
    expect(r.state).not.toBe(s);
    expect(r.state.turn).toBe(4);
    expect(r.state.chars.female).toEqual(s.chars.female);
    expect(r.state.chars.male.eyes).toBe('closed');
    expect(s.chars.male.eyes).toBe('open');
    expect(r.events).toEqual([{ type: 'eyes', who: 'male', eyes: 'closed' }]);
  });

  it('toggling to the current mode is a no-op; several toggles in one turn are allowed', () => {
    const s = scene();
    expect(toggleEyes(s, 'open').events).toEqual([]);
    const back = toggleEyes(toggleEyes(s, 'closed').state, 'open');
    expect(back.state).toEqual(s);
  });

  it('is ignored once the game has ended', () => {
    const s = scene({}, (st) => (st.ending = { id: 'fellOff', outcome: 'lose', style: 'wasted', title: 't', caption: 'c', description: 'd' }));
    const r = toggleEyes(s, 'closed');
    expect(r.state).toBe(s);
    expect(r.events).toEqual([]);
  });

  it('the mode at action time is what counts: close eyes → sleep works in the same turn', () => {
    const s = scene({}, (st) => (st.turn = 2));
    const r = playTurn(toggleEyes(s, 'closed').state, 'sleep', 0);
    expect(ofType(r.events, 'action')[0]).toMatchObject({ who: 'male', action: 'sleep', success: true });
    expect(r.intermediate.chars.male.sleep).toBe(18);
  });
});

describe('playTurn', () => {
  it('phase event order: player → partner → endOfTurn → turnEnd (many seeds, both roles)', () => {
    const problems: string[] = [];
    for (const role of ['male', 'female'] as Role[]) {
      for (let seed = 0; seed < 40; seed++) {
        let s = createGame(role, seed);
        const pick = mulberry32(seed + 1000);
        while (!s.ending) {
          if (pick() < 0.3) s = toggleEyes(s, s.chars[role].eyes === 'open' ? 'closed' : 'open').state;
          const ok = listAvailableActions(s, role).filter((a) => a.ok);
          const a = ok[Math.floor(pick() * ok.length)];
          const before = s;
          const id = a.def.id;
          const r = playTurn(s, id, pick() * 100);
          for (const p of turnProblems(before, id, r)) problems.push(`${role}/${seed} t${before.turn} ${id}: ${p}`);
          s = r.state;
        }
        if (problems.length > 10) break;
      }
    }
    expect(problems).toEqual([]);
  });

  it('events are segmented: player action first, AI action opens the partner phase, turnEnd last', () => {
    const r = playTurn(scene({}, (st) => (st.turn = 1)), 'kiss', 35);
    const types = r.events.map((e) => e.type);
    expect(r.events[0]).toEqual({ type: 'phase', phase: 'player' });
    expect(r.events[1]).toMatchObject({ type: 'action', who: 'male', action: 'kiss' });
    const iPartner = r.events.findIndex((e) => e.type === 'phase' && e.phase === 'partner');
    const iEnd = r.events.findIndex((e) => e.type === 'phase' && e.phase === 'endOfTurn');
    expect(iPartner).toBeGreaterThan(1);
    expect(iEnd).toBeGreaterThan(iPartner);
    expect(r.events[iPartner + 1]).toMatchObject({ type: 'action', who: 'female' });
    expect(types.at(-1)).toBe('turnEnd');
    expect(r.events.at(-1)).toEqual({ type: 'turnEnd', turn: 2 });
  });

  it('intermediate = state after the player phase only (replicated by hand), a separate snapshot', () => {
    const s = scene({}, (st) => (st.turn = 3));
    const r = playTurn(s, 'kiss', 35);
    const manual = structuredClone(s);
    resolveAction(manual, 'male', 'kiss', 35, turnRng(manual.seed, manual.turn), []);
    expect(r.intermediate).toEqual(manual);
    expect(r.intermediate.turn).toBe(3);
    expect(r.intermediate.chars.male.lastAction).toBe('kiss');
    expect(r.intermediate.chars.female.lastAction).toBeNull(); // AI has not acted yet
    expect(r.state.chars.female.lastAction).not.toBeNull();
    expect(r.state.turn).toBe(4);
    expect(r.intermediate).not.toBe(r.state);
    r.state.chars.male.mood = -1;
    r.state.memo.clues.sleep = 99;
    expect(r.intermediate.chars.male.mood).not.toBe(-1);
    expect(r.intermediate.memo.clues.sleep).not.toBe(99);
  });

  it('does not mutate its input (deep-frozen state works, snapshot unchanged)', () => {
    for (const role of ['male', 'female'] as Role[]) {
      let s = createGame(role, 5);
      for (let t = 0; t < 12 && !s.ending; t++) {
        const snapshot = structuredClone(s);
        deepFreeze(s);
        const id: ActionId = t % 3 === 0 ? 'lieSideFacing' : t % 3 === 1 ? 'whisper' : 'pat';
        const r = playTurn(s, id, 30);
        expect(s).toEqual(snapshot);
        const e = toggleEyes(s, s.chars[role].eyes === 'open' ? 'closed' : 'open');
        expect(s).toEqual(snapshot);
        s = t % 2 ? e.state : r.state;
      }
    }
  });

  it('is deterministic: same seed + same actions → identical states and events', () => {
    const script: [ActionId, number, 'open' | 'closed'][] = [
      ['lieSideFacing', 0, 'open'],
      ['whisper', 0, 'open'],
      ['kiss', 35, 'open'],
      ['tuckBlanket', 30, 'open'],
      ['sleep', 0, 'closed'],
      ['pat', 30, 'closed'],
      ['sleep', 0, 'closed'],
      ['caress', 80, 'closed'],
      ['sleep', 0, 'closed'],
      ['pullBlanket', 50, 'closed'],
      ['sleep', 0, 'closed'],
      ['sleep', 0, 'closed'],
    ];
    const run = (role: Role, seed: number) => {
      let s = createGame(role, seed);
      const log: TurnResult[] = [];
      for (const [id, f, eyes] of script) {
        if (s.ending) break;
        s = toggleEyes(s, eyes).state;
        const r = playTurn(s, id, f);
        log.push(r);
        s = r.state;
      }
      return log;
    };
    for (const role of ['male', 'female'] as Role[]) {
      for (const seed of [0, 1, 99, 123456]) {
        expect(run(role, seed)).toEqual(run(role, seed));
      }
    }
    // and the seed matters
    expect(JSON.stringify(run('male', 1))).not.toBe(JSON.stringify(run('male', 2)));
  });

  it('mid-turn ending (kicked) returns early: no partner phase, no endOfTurn, turn not advanced', () => {
    const s = scene({}, (st, _me, ai) => {
      st.turn = 2;
      ai.annoyance = 80;
    });
    const r = playTurn(s, 'hug', 100); // rough +15, refused +8 → 100
    expect(r.state.ending?.id).toBe('kickedOff');
    expect(r.state.turn).toBe(2);
    expect(r.intermediate).toBe(r.state);
    expect(ofType(r.events, 'phase').map((e) => e.phase)).toEqual(['player']);
    expect(ofType(r.events, 'turnEnd')).toHaveLength(0);
    expect(ofType(r.events, 'action')).toHaveLength(1);
    expect(r.state.chars.female.lastAction).toBeNull();
    expect(ofType(r.events, 'kick')).toEqual([{ type: 'kick', who: 'female', target: 'male' }]);
    expect(r.events.at(-1)).toEqual({ type: 'ending', ending: r.state.ending });
  });

  it('an ended game is returned untouched', () => {
    const s = scene({}, (st, me) => {
      st.turn = 2;
      me.lateral = -0.9;
    });
    const ended = playTurn(s, 'scootOut', 30).state;
    expect(ended.ending?.id).toBe('fellOff');
    const r = playTurn(ended, 'sleep', 0);
    expect(r.state).toBe(ended);
    expect(r.intermediate).toBe(ended);
    expect(r.events).toEqual([]);
  });

  it('player asleep acting (≠ sleep) wakes themself first: −20 posture/affection/move/arm, −10 blanket, pat free', () => {
    const cases: [ActionId, number, number, string | null][] = [
      ['whisper', 0, 80 - 20, 'rubEyes'],
      ['offerArm', 0, 80 - 20, 'rubEyes'],
      ['pullBlanket', 50, 80 - 10, 'rubEyes'],
      ['scootIn', 30, 80 - 20, 'wokeYourself'],
      ['lieSupine', 0, 80 - 20 - 8, 'wokeYourself'], // then §5.1 −8
      ['pat', 30, 80, null],
      ['sleep', 0, 80 + 12, null],
    ];
    for (const [id, f, sleepAfter, note] of cases) {
      const s = scene({ partnerGoal: 'sleep' }, (st, me) => {
        st.turn = 3;
        asleep(me, 80);
      });
      const r = playTurn(s, id, f);
      const a = ofType(r.events, 'action')[0];
      expect(r.intermediate.chars.male.sleep, id).toBeCloseTo(sleepAfter);
      if (note) expect(a.noteKeys, id).toContain(note);
      else {
        expect(a.noteKeys ?? [], id).not.toContain('rubEyes');
        expect(a.noteKeys ?? [], id).not.toContain('wokeYourself');
      }
    }
    // not asleep yet → no self-wake
    const awake = playTurn(
      scene({}, (st, me) => {
        st.turn = 3;
        me.sleep = 69;
      }),
      'whisper',
      0,
    );
    expect(awake.intermediate.chars.male.sleep).toBe(69);
  });

  it('memo bookkeeping: goodnight said once; consecutive unconscious blanket pulls become a burrito', () => {
    // goodnight
    const g = playTurn(
      scene({ partnerGoal: 'sleep' }, (st, me) => {
        st.turn = 2;
        me.eyes = 'closed';
        me.lastAction = 'sleep';
      }),
      'sleep',
      0,
    );
    const said = ofType(g.events, 'speech').filter((e) => e.who === 'female' && e.key === 'goodnight');
    expect(said).toHaveLength(1);
    expect(g.state.memo.goodnightSpoken).toBe(true);

    // burrito: a cold sleeping AI pulls twice in a row
    const cold = (s: GameState) => {
      const t = structuredClone(s);
      asleep(t.chars.female, 90);
      t.chars.female.warmth = 5;
      return t;
    };
    const t1 = playTurn(
      cold(
        scene({}, (st, me) => {
          st.turn = 2;
          asleep(me, 20); // player faking with closed eyes
        }),
      ),
      'sleep',
      0,
    );
    const pull1 = ofType(t1.events, 'action').find((e) => e.who === 'female')!;
    expect(pull1).toMatchObject({ action: 'pullBlanket', noteKeys: ['partnerStoleBlanket'] });
    expect(t1.state.memo.pullStreak).toBe(1);
    const t2 = playTurn(cold(t1.state), 'sleep', 0);
    const pull2 = ofType(t2.events, 'action').find((e) => e.who === 'female')!;
    expect(pull2).toMatchObject({ action: 'pullBlanket', noteKeys: ['partnerBurrito'] });
    expect(t2.state.memo.pullStreak).toBe(2);
  });
});

describe('playTurn: order of resolution', () => {
  it('RNG call order (§2): player resolve → choosePartnerAction → AI resolve → endOfTurn, all on turnRng(seed, turn)', () => {
    for (const role of ['male', 'female'] as Role[]) {
      for (const seed of [3, 17, 256]) {
        let s = createGame(role, seed);
        for (let t = 0; t < 6 && !s.ending; t++) {
          const id: ActionId = t === 0 ? 'lieSideFacing' : (['whisper', 'kiss', 'pat', 'tuckBlanket', 'caress'] as ActionId[])[t - 1];
          const r = playTurn(s, id, 35);
          if (r.state.ending) break;
          // replay §2 by hand
          const m = structuredClone(s);
          const ev: GameEvent[] = [{ type: 'phase', phase: 'player' }];
          const rng = turnRng(m.seed, m.turn);
          resolveAction(m, role, id, 35, rng, ev);
          ev.push({ type: 'phase', phase: 'partner' });
          const { actionId, force, ...opts } = choosePartnerAction(m, rng);
          if (opts.speech === 'goodnight') m.memo.goodnightSpoken = true;
          m.memo.pullStreak = actionId === 'pullBlanket' && opts.unconscious ? m.memo.pullStreak + 1 : 0;
          resolveAction(m, partnerOf(role), actionId, force, rng, ev, opts);
          ev.push({ type: 'phase', phase: 'endOfTurn' });
          endOfTurn(m, rng, ev);
          m.turn += 1;
          ev.push({ type: 'turnEnd', turn: m.turn });
          tallyTurn(m, ev); // 組合結局用的行為統計(不耗 RNG)
          expect(r.state, `${role}/${seed} t${t}`).toEqual(m);
          expect(r.events, `${role}/${seed} t${t}`).toEqual(ev);
          s = r.state;
        }
      }
    }
  });

  it('the AI reacts to what the player did this turn (sleep-goal partner turns away after a kiss)', () => {
    const s = scene({ partnerGoal: 'sleep' }, (st, _me, ai) => {
      st.turn = 3;
      ai.annoyance = 30;
    });
    const r = playTurn(s, 'kiss', 35);
    const aiAction = ofType(r.events, 'action').find((e) => e.who === 'female')!;
    expect(aiAction.action).toBe('lieSideAway');
    expect(ofType(r.events, 'speech').filter((e) => e.who === 'female').map((e) => e.key)).toContain('sleepyDecline');
    expect(r.state.chars.female.posture).toBe('sideAway');
  });

  it('clock: 22:00 + 40 min per turn, 06:00 at turn 12', () => {
    expect(clockLabel(0)).toBe('22:00');
    expect(clockLabel(1)).toBe('22:40');
    expect(clockLabel(3)).toBe('00:00');
    expect(clockLabel(6)).toBe('02:00');
    expect(clockLabel(12)).toBe('06:00');
  });
});

describe('splitPhases', () => {
  it('splits by phase markers (dropping them); events before any marker count as player', () => {
    const ev: GameEvent[] = [
      { type: 'eyes', who: 'male', eyes: 'closed' },
      { type: 'phase', phase: 'player' },
      { type: 'intimacy', delta: 2 },
      { type: 'phase', phase: 'partner' },
      { type: 'mood', who: 'female', delta: 1 },
      { type: 'phase', phase: 'endOfTurn' },
      { type: 'cold', who: 'male' },
      { type: 'turnEnd', turn: 3 },
    ];
    expect(splitPhases(ev)).toEqual({
      player: [ev[0], ev[2]],
      partner: [ev[4]],
      endOfTurn: [ev[6], ev[7]],
    });
    expect(splitPhases([])).toEqual({ player: [], partner: [], endOfTurn: [] });
  });

  it('round-trips a real turn: every non-phase event lands in exactly one segment, in order', () => {
    const r = playTurn(createGame('female', 8), 'lieSideFacing', 0);
    const seg = splitPhases(r.events);
    expect([...seg.player, ...seg.partner, ...seg.endOfTurn]).toEqual(r.events.filter((e) => e.type !== 'phase'));
    expect(seg.endOfTurn.at(-1)).toEqual({ type: 'turnEnd', turn: 1 });
  });
});
