// Endings (DESIGN §7) + morning line. Direct checkEnding() tests for the priority table and playTurn() tests for
// how endings are reached in play.
import { describe, expect, it } from 'vitest';
import { checkEnding, makeEnding, morningLine } from '../src/game/endings';
import { ZH } from '../src/game/text';
import { playTurn } from '../src/game/turn';
import type { Ending, EndingId, GameState, Goal, Role } from '../src/game/types';
import { partnerOf } from '../src/game/types';
import { asleep, ofType, scene, type SceneOpts } from './helpers';

const SPEC: Record<EndingId, Pick<Ending, 'outcome' | 'style' | 'caption'>> = {
  kickedOff: { outcome: 'lose', style: 'wasted', caption: 'KICKED OUT' },
  fellOff: { outcome: 'lose', style: 'wasted', caption: 'FELL OFF' },
  intimacyWin: { outcome: 'win', style: 'passed', caption: 'LIGHTS OUT' },
  accidentalIntimacy: { outcome: 'draw', style: 'neutral', caption: 'PLOT TWIST' },
  sleepWin: { outcome: 'win', style: 'passed', caption: 'SWEET DREAMS' },
  sleepLoseTired: { outcome: 'lose', style: 'wasted', caption: 'SLEEPLESS' },
  intimacyLoseFellAsleep: { outcome: 'lose', style: 'wasted', caption: 'OUT COLD' },
  intimacyLoseMorning: { outcome: 'lose', style: 'wasted', caption: 'TOO LATE' },
};
const ALL_ENDINGS = Object.keys(SPEC) as EndingId[];

describe('Ending objects', () => {
  it.each(ALL_ENDINGS)('%s has every field, with the §7 outcome/style/caption', (id) => {
    const e = makeEnding(id);
    expect(Object.keys(e).sort()).toEqual(['caption', 'description', 'id', 'outcome', 'style', 'title']);
    expect(e).toMatchObject({ id, ...SPEC[id] });
    for (const k of ['title', 'caption', 'description'] as const) {
      expect(typeof e[k]).toBe('string');
      expect(e[k].trim().length).toBeGreaterThan(0);
    }
    expect(e.title).toBe(ZH.ending[id].title);
    expect(e.description).toBe(ZH.ending[id].description);
  });
});

describe('checkEnding priority (§7)', () => {
  /** A state where every ending condition holds at once; each test switches conditions off one by one. */
  const everything = (opts: SceneOpts = {}, mut?: (s: GameState) => void) =>
    scene({ playerGoal: 'intimacy', ...opts }, (st, me, ai) => {
      ai.annoyance = 100; // #1
      me.lateral = st.playerRole === 'male' ? -1 : 1; // #2
      st.intimacy = 100; // #3 (partner awake)
      st.turn = 12; // #4/#5
      st.sleepScore = 7;
      me.sleep = 80;
      mut?.(st);
    });
  const ai = (s: GameState) => s.chars[partnerOf(s.playerRole)];
  const me = (s: GameState) => s.chars[s.playerRole];
  const id = (s: GameState, phase: 'mid' | 'end' = 'end') => checkEnding(s, phase)?.id ?? null;

  it('#1 kickedOff beats everything', () => {
    for (const role of ['male', 'female'] as Role[]) expect(id(everything({ role }))).toBe('kickedOff');
  });

  it('#2 fellOff next — unless the fall was a push, which is kickedOff', () => {
    const s = everything({}, (st) => (ai(st).annoyance = 99));
    expect(id(s)).toBe('fellOff');
    s.memo.pushedOff = true;
    expect(id(s)).toBe('kickedOff');
    const f = everything({ role: 'female' }, (st) => (ai(st).annoyance = 99));
    expect(id(f)).toBe('fellOff');
  });

  it('#3 intimacy 100 with the partner not asleep: intimacyWin, or accidentalIntimacy for a sleep-goal player', () => {
    const calm = (goal: Goal) =>
      everything({ playerGoal: goal }, (st) => {
        ai(st).annoyance = 99;
        me(st).lateral = st.playerRole === 'male' ? -0.99 : 0.99;
      });
    expect(id(calm('intimacy'))).toBe('intimacyWin');
    expect(id(calm('sleep'))).toBe('accidentalIntimacy');
    const s = calm('intimacy');
    ai(s).sleep = 69.9;
    expect(id(s)).toBe('intimacyWin');
  });

  it('intimacy 100 while the partner is asleep (>= 70) is not an intimacy ending', () => {
    const s = everything({}, (st) => {
      ai(st).annoyance = 0;
      me(st).lateral = -0.3;
      asleep(ai(st), 70);
      st.turn = 5;
    });
    expect(id(s)).toBeNull();
    s.turn = 12;
    expect(id(s)).toBe('intimacyLoseFellAsleep');
  });

  it('#4 / #5 at turn 12 by goal, sleepScore and the player\'s own sleep', () => {
    const morning = (goal: Goal, score: number, mySleep: number) =>
      scene({ playerGoal: goal }, (st, m) => {
        st.turn = 12;
        st.sleepScore = score;
        m.sleep = mySleep;
      });
    expect(id(morning('sleep', 7, 0))).toBe('sleepWin');
    expect(id(morning('sleep', 12, 90))).toBe('sleepWin');
    expect(id(morning('sleep', 6.5, 90))).toBe('sleepLoseTired');
    expect(id(morning('intimacy', 12, 70))).toBe('intimacyLoseFellAsleep');
    expect(id(morning('intimacy', 12, 69))).toBe('intimacyLoseMorning');
  });

  it('before turn 12 with nothing else going on: no ending', () => {
    expect(id(scene({}, (st) => (st.turn = 11)))).toBeNull();
    const rested = scene({ playerGoal: 'sleep' }, (st) => {
      st.turn = 11;
      st.sleepScore = 11;
    });
    expect(id(rested)).toBeNull(); // no early finish, even with the score in the bag
  });

  it("mid phase only checks #1 and #2 (no intimacy or morning ending mid-turn)", () => {
    const s = scene({}, (st) => {
      st.turn = 12;
      st.intimacy = 100;
    });
    expect(id(s, 'mid')).toBeNull();
    expect(id(s, 'end')).toBe('intimacyWin');
    expect(id(scene({}, (_st, _m, a) => (a.annoyance = 100)), 'mid')).toBe('kickedOff');
    expect(id(scene({}, (_st, m) => (m.lateral = -1)), 'mid')).toBe('fellOff');
  });
});

describe('endings reached through playTurn', () => {
  const endingOf = (s: GameState) => s.ending?.id ?? null;

  it('a push over the edge is kickedOff with a kick event, never fellOff', () => {
    const s = scene({}, (st, m, a) => {
      st.turn = 3;
      m.lateral = -0.7;
      m.posture = 'supine';
      a.annoyance = 80; // AI will push
    });
    const r = playTurn(s, 'lieSideFacing', 0);
    expect(ofType(r.events, 'push')).toEqual([{ type: 'push', who: 'female', target: 'male' }]);
    expect(r.state.chars.male.lateral).toBe(-1);
    expect(endingOf(r.state)).toBe('kickedOff');
    expect(ofType(r.events, 'kick')).toEqual([{ type: 'kick', who: 'female', target: 'male' }]);
    expect(ofType(r.events, 'fell')).toHaveLength(0);
    expect(r.events.at(-1)).toEqual({ type: 'ending', ending: r.state.ending });
    expect(r.state.chars.female.annoyance).toBeLessThan(100); // it was the push, not the annoyance
  });

  it('rolling off by yourself is fellOff, decided mid-turn (no partner phase)', () => {
    const s = scene({}, (st, m) => {
      st.turn = 3;
      m.lateral = -0.9;
    });
    const r = playTurn(s, 'scootOut', 30);
    expect(endingOf(r.state)).toBe('fellOff');
    expect(ofType(r.events, 'fell')).toEqual([{ type: 'fell', who: 'male' }]);
    expect(ofType(r.events, 'phase').map((e) => e.phase)).toEqual(['player']);
    expect(r.state.turn).toBe(3);
  });

  it('reaching intimacy 100 on a sleeping partner does not end the night (tooLate); waking them later does', () => {
    const s = scene({ playerGoal: 'intimacy', partnerGoal: 'intimacy' }, (st, _m, a) => {
      st.turn = 5;
      st.intimacy = 97;
      asleep(a, 90);
    });
    const r = playTurn(s, 'hug', 40); // sneak hug, N 35 < T 55.5, +3 intimacy
    const hug = ofType(r.events, 'action')[0];
    expect(hug.noteKeys).toContain('tooLateAsleep');
    expect(ofType(r.events, 'speech').map((e) => e.key)).toContain('tooLate');
    expect(r.state.intimacy).toBe(100);
    expect(r.state.chars.female.sleep).toBeGreaterThanOrEqual(70);
    expect(r.state.ending).toBeNull();
    expect(r.state.turn).toBe(6);

    // intimacy stays at 100; next turn a rough kiss wakes them and the end-of-turn check awards the win
    const next = structuredClone(r.state);
    next.chars.female.sleep = 72;
    next.chars.female.posture = 'sideFacing';
    next.chars.male.posture = 'sideFacing';
    const w = playTurn(next, 'kiss', 100);
    expect(ofType(w.events, 'wake')[0]).toEqual({ type: 'wake', who: 'female', by: 'male' });
    expect(w.state.intimacy).toBe(100);
    expect(endingOf(w.state)).toBe('intimacyWin');
  });

  it('intimacy 100 with an awake partner wins at the end of the turn (after the partner phase)', () => {
    const s = scene({}, (st) => {
      st.turn = 4;
      st.intimacy = 95;
    });
    const r = playTurn(s, 'kiss', 35);
    expect(endingOf(r.state)).toBe('intimacyWin');
    expect(ofType(r.events, 'phase').map((e) => e.phase)).toEqual(['player', 'partner', 'endOfTurn']);
    const types = r.events.map((e) => e.type);
    expect(types.indexOf('turnEnd')).toBeLessThan(types.indexOf('ending'));
  });

  it('a sleep-goal player who gets carried away: accidentalIntimacy (draw)', () => {
    const s = scene({ playerGoal: 'sleep' }, (st) => {
      st.turn = 4;
      st.intimacy = 95;
    });
    const r = playTurn(s, 'kiss', 35);
    expect(r.state.ending).toMatchObject({ id: 'accidentalIntimacy', outcome: 'draw', style: 'neutral' });
  });

  it('morning endings after the 12th turn', () => {
    const last = (goal: Goal, mut: (st: GameState) => void) =>
      scene({ playerGoal: goal, partnerGoal: 'sleep' }, (st) => {
        st.turn = 11;
        mut(st);
      });
    const sleeper = (score: number) =>
      last('sleep', (st) => {
        st.sleepScore = score;
        asleep(st.chars.male, 90);
      });
    expect(endingOf(playTurn(sleeper(6.5), 'sleep', 0).state)).toBe('sleepWin');
    expect(endingOf(playTurn(sleeper(0), 'sleep', 0).state)).toBe('sleepLoseTired');
    expect(endingOf(playTurn(last('intimacy', () => {}), 'whisper', 0).state)).toBe('intimacyLoseMorning');
    expect(endingOf(playTurn(last('intimacy', (st) => asleep(st.chars.male, 90)), 'sleep', 0).state)).toBe('intimacyLoseFellAsleep');
    const r = playTurn(sleeper(6.5), 'sleep', 0);
    expect(r.state.turn).toBe(12);
    expect(ofType(r.events, 'ending')).toEqual([{ type: 'ending', ending: r.state.ending }]);
  });
});

describe('morningLine', () => {
  const pools = ZH.speech as Record<string, readonly string[]>;
  it('returns a valid pool key and index for every ending × goal pair', () => {
    for (const role of ['male', 'female'] as Role[]) {
      for (const pg of ['sleep', 'intimacy'] as Goal[]) {
        for (const qg of ['sleep', 'intimacy'] as Goal[]) {
          for (const id of ALL_ENDINGS) {
            for (const seed of [0, 1, 7, 12345, 0xffffffff]) {
              const s = scene({ role, playerGoal: pg, partnerGoal: qg, seed }, (st) => {
                st.turn = (seed % 13) as number;
                st.ending = makeEnding(id);
              });
              const { key, index } = morningLine(s);
              const expected =
                id === 'intimacyWin' || id === 'accidentalIntimacy'
                  ? 'morning_together'
                  : id === 'kickedOff' || id === 'fellOff'
                    ? 'morning_floor'
                    : `morning_${pg}_${qg}`;
              expect(key).toBe(expected);
              expect(pools[key]?.length).toBeGreaterThan(0);
              expect(Number.isInteger(index)).toBe(true);
              expect(index).toBeGreaterThanOrEqual(0);
              expect(index).toBeLessThan(pools[key].length);
            }
          }
        }
      }
    }
  });

  it('is deterministic for a given state', () => {
    const s = scene({ seed: 42 }, (st) => (st.ending = makeEnding('sleepWin')));
    expect(morningLine(s)).toEqual(morningLine(structuredClone(s)));
  });
});
