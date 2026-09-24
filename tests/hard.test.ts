// 困難模式(DESIGN §15):開局、結局、舒適度、世界規則(體溫 / 親密度 / 天亮)、對方 AI、提示與進度、勝率表。
// 簡單模式完全不變 —— 那部分由其他測試檔(規則、AI、§12 勝率表)照舊把關。
import { describe, expect, it } from 'vitest';
import { COMFORT, HARD, SLEEP_WIN_SCORE, clockLabel } from '../src/game/constants';
import { checkEnding, makeEnding, sleepTarget } from '../src/game/endings';
import { goalProgress, maxSleepGain, suggestAction } from '../src/game/hints';
import { choosePartnerAction } from '../src/game/partner';
import { behaviorGoal, comfortOf, endOfTurn, isComfy, resolveAction, warmthTarget } from '../src/game/rules';
import { createGame, playTurn, toggleEyes } from '../src/game/turn';
import type { CharacterState, GameEvent, GameState, Goal, IntimacyTiming, Role } from '../src/game/types';
import { partnerOf } from '../src/game/types';
import { canUse } from '../src/game/actions';
import { mulberry32 } from '../src/game/rng';
import { apparentlyAsleep, snoreLevel } from '../src/game/rules';
import { ZH } from '../src/game/text';
import { easyFingerprint } from './easyFingerprint';
import { act, asleep, constRng, eventViolations, lines, ofType, randomState, scene, stateViolations, type SceneOpts } from './helpers';
import { runGame, STRATS, type Strategy } from './strategies';

const ROLES: Role[] = ['male', 'female'];

interface HardOpts extends SceneOpts {
  timing?: IntimacyTiming;
  partnerTiming?: IntimacyTiming;
}

/** scene() 的困難模式版本(turn 1、兩人醒著、面對面、體溫 60、親密度 = 困難模式的開局) */
function hard(opts: HardOpts = {}, mut?: (s: GameState, me: CharacterState, ai: CharacterState) => void): GameState {
  return scene(opts, (s, me, ai) => {
    s.mode = 'hard';
    s.intimacy = HARD.startIntimacy;
    if (me.goal === 'intimacy') me.timing = opts.timing ?? 'now';
    if (ai.goal === 'intimacy') ai.timing = opts.partnerTiming ?? 'now';
    mut?.(s, me, ai);
  });
}

const me = (s: GameState) => s.chars[s.playerRole];
const ai = (s: GameState) => s.chars[partnerOf(s.playerRole)];
const endId = (s: GameState) => checkEnding(s, 'end')?.id ?? null;

describe('createGame: easy is the default and unchanged, hard adds the intimacy timing', () => {
  it('easy (default): no timing', () => {
    for (const role of ROLES) {
      for (let seed = 0; seed < 30; seed++) {
        const e = createGame(role, seed);
        expect(e.mode).toBe('easy');
        expect(e.chars.male.timing).toBeUndefined();
        expect(e.chars.female.timing).toBeUndefined();
        expect(createGame(role, seed, { mode: 'easy' })).toEqual(e);
      }
    }
  });

  it('easy is bit-for-bit what it was before hard mode existed (1200 games: events, states, hints, actions)', () => {
    // 這個雜湊是同一個 tests/easyFingerprint.ts 在困難模式加入前的版本(8e3de83)算出來的
    expect(easyFingerprint()).toEqual({ hash: '315272f20ddf89e8', games: 1200, turns: 12284 });
  });

  it('hard: same goals and moods as easy for the seed; only intimacy goals get a timing; higher start intimacy', () => {
    const seen = new Set<string>();
    for (const role of ROLES) {
      for (let seed = 0; seed < 40; seed++) {
        const e = createGame(role, seed);
        const h = createGame(role, seed, { mode: 'hard' });
        expect(h.mode).toBe('hard');
        expect(h.intimacy).toBe(HARD.startIntimacy);
        for (const r of ROLES) {
          expect(h.chars[r].goal).toBe(e.chars[r].goal);
          expect(h.chars[r].mood).toBe(e.chars[r].mood);
          if (h.chars[r].goal === 'intimacy') {
            expect(['now', 'morning']).toContain(h.chars[r].timing);
            seen.add(h.chars[r].timing!);
          } else expect(h.chars[r].timing).toBeUndefined();
        }
      }
    }
    expect([...seen].sort()).toEqual(['morning', 'now']);
  });

  it('timings can be forced (practice / tests)', () => {
    const s = createGame('male', 3, { mode: 'hard', playerGoal: 'intimacy', playerTiming: 'morning', partnerGoal: 'intimacy', partnerTiming: 'now' });
    expect(s.chars.male.timing).toBe('morning');
    expect(s.chars.female.timing).toBe('now');
  });
});

describe('hard-mode endings', () => {
  it('right now: intimacy 100 by the deadline wins (even on the deadline turn); after that, time is up', () => {
    const s = hard({ playerGoal: 'intimacy', timing: 'now' }, (st) => {
      st.turn = HARD.nowDeadline;
      st.intimacy = 100;
    });
    expect(endId(s)).toBe('intimacyWin');
    s.intimacy = 99;
    expect(endId(s)).toBe('intimacyLoseDeadline');
    s.turn = HARD.nowDeadline - 1;
    expect(endId(s)).toBeNull();
    s.turn = HARD.nowDeadline;
    s.mode = 'easy'; // 簡單模式沒有時限
    expect(endId(s)).toBeNull();
    expect(makeEnding('intimacyLoseDeadline').description).toContain(clockLabel(HARD.nowDeadline));
  });

  it('morning: counts only from the morning and after enough sleep; earlier is too eager (a draw)', () => {
    const m = (turn: number, score: number) =>
      hard({ playerGoal: 'intimacy', timing: 'morning' }, (st) => {
        st.turn = turn;
        st.sleepScore = score;
        st.intimacy = 100;
      });
    expect(endId(m(HARD.morningTurn - 1, 10))).toBe('intimacyTooEarly');
    expect(endId(m(HARD.morningTurn, HARD.morningSleep - 0.5))).toBe('intimacyTooEarly');
    expect(endId(m(HARD.morningTurn, HARD.morningSleep))).toBe('intimacyMorningWin');
    expect(makeEnding('intimacyTooEarly').outcome).toBe('draw');
  });

  it('morning: at 06:00 still lying there with closed eyes = overslept, otherwise nothing happened', () => {
    const s = hard({ playerGoal: 'intimacy', timing: 'morning' }, (st, m) => {
      st.turn = 12;
      m.eyes = 'closed';
    });
    expect(endId(s)).toBe('intimacyLoseOverslept');
    me(s).eyes = 'open';
    expect(endId(s)).toBe('intimacyLoseMorning');
  });

  it('sleep: the hard target is lower (comfort decides the points)', () => {
    const s = hard({ playerGoal: 'sleep' }, (st) => {
      st.turn = 12;
      st.sleepScore = HARD.sleepWin;
    });
    expect(sleepTarget(s)).toBe(HARD.sleepWin);
    expect(endId(s)).toBe('sleepWin');
    s.sleepScore = HARD.sleepWin - 0.5;
    expect(endId(s)).toBe('sleepLoseTired');
    s.mode = 'easy';
    expect(sleepTarget(s)).toBe(SLEEP_WIN_SCORE);
  });
});

describe('comfort (body types)', () => {
  it('easy: only "cold" (< 30); hard: the bear runs hot, the bunny runs cold and needs more closeness', () => {
    const e = scene({}, (_st, m) => (m.warmth = 25));
    expect(comfortOf(e, e.playerRole)).toEqual({ hot: false, cold: true, lonely: false });

    const bear = hard({ role: 'male' });
    const b = me(bear);
    b.warmth = COMFORT.male.warmHi + 1;
    expect(comfortOf(bear, 'male').hot).toBe(true);
    b.warmth = COMFORT.male.warmLo - 1;
    expect(comfortOf(bear, 'male').cold).toBe(true);
    b.warmth = 50;
    bear.intimacy = COMFORT.male.intimacy;
    expect(isComfy(bear, 'male')).toBe(true);
    bear.intimacy = COMFORT.male.intimacy - 1;
    expect(comfortOf(bear, 'male').lonely).toBe(true);

    const bunny = hard({ role: 'female' });
    me(bunny).warmth = 100;
    expect(comfortOf(bunny, 'female').hot).toBe(false);
    me(bunny).warmth = COMFORT.female.warmLo - 1;
    expect(comfortOf(bunny, 'female').cold).toBe(true);
    expect(COMFORT.female.intimacy).toBeGreaterThan(COMFORT.male.intimacy);
  });

  it('"close eyes and sleep" gains less when too hot / cold / lonely, with a note', () => {
    const run = (role: Role, mut: (s: GameState, m: CharacterState) => void) => {
      const s = hard({ role, playerGoal: 'sleep' }, (st, m) => {
        m.eyes = 'closed';
        m.warmth = role === 'male' ? 50 : 70;
        st.intimacy = 50;
        mut(st, m);
      });
      const before = me(s).sleep;
      const ev: GameEvent[] = [];
      resolveAction(s, s.playerRole, 'sleep', 0, constRng(0.5), ev);
      return { gain: me(s).sleep - before, notes: ofType(ev, 'action')[0].noteKeys ?? [] };
    };
    expect(run('male', () => undefined)).toEqual({ gain: 18, notes: [] });
    expect(run('male', (_s, m) => (m.warmth = 80))).toEqual({ gain: 18 * HARD.hotSleep, notes: ['sleepHot'] });
    expect(run('male', (st) => (st.intimacy = COMFORT.male.intimacy - 1))).toEqual({ gain: 18 * HARD.lonelySleep, notes: ['sleepLonely'] });
    expect(run('female', (_s, m) => (m.warmth = COMFORT.female.warmLo - 1))).toEqual({ gain: 18 * HARD.coldSleep, notes: ['sleepCold'] });
  });
});

describe('world rules (end of turn)', () => {
  it('warmth eases toward the target and then wobbles by at most ±warmDrift', () => {
    const at = (r: number) => {
      const s = hard({ playerGoal: 'sleep' }, (_st, m, a) => (m.warmth = a.warmth = 40));
      const target = warmthTarget(s, s.playerRole);
      endOfTurn(s, constRng(r), []);
      return { w: me(s).warmth, eased: 40 + (target - 40) * HARD.warmRate };
    };
    const mid = at(0.5); // rng 0.5 → 不亂跳
    expect(mid.w).toBeCloseTo(mid.eased);
    expect(at(0).w).toBeCloseTo(mid.eased - HARD.warmDrift);
    expect(at(0.999999).w).toBeCloseTo(mid.eased + HARD.warmDrift, 3);
  });

  it('the target: more blanket = warmer, the night gets colder, cuddling adds body heat', () => {
    const s = hard();
    const P = s.playerRole;
    const t0 = warmthTarget(s, P);
    s.blanketOffset = P === 'male' ? -0.3 : 0.3; // 棉被往你這邊
    expect(warmthTarget(s, P)).toBeGreaterThan(t0);
    s.blanketOffset = 0;
    s.turn = HARD.chillTurn;
    expect(warmthTarget(s, P)).toBe(t0 - HARD.chill);
    s.embrace = true;
    expect(warmthTarget(s, P)).toBe(t0 - HARD.chill + HARD.hugHeat);
  });

  it('getting too hot while awake: a "hot" event and a complaint', () => {
    const s = hard({ role: 'male', playerGoal: 'sleep' }, (_st, m) => (m.warmth = COMFORT.male.warmHi - 2));
    const ev: GameEvent[] = [];
    endOfTurn(s, constRng(0.5), ev);
    expect(me(s).warmth).toBeGreaterThan(COMFORT.male.warmHi);
    expect(ev).toContainEqual({ type: 'hot', who: 'male' });
    expect(lines(ev)).toContain('male:tooHot');
  });

  it('intimacy drops only while both are awake and nothing sweet happened; cuddling or sleeping holds it', () => {
    const run = (mut: (s: GameState) => void) => {
      const s = hard({}, (st) => {
        st.intimacy = 50;
        mut(st);
      });
      endOfTurn(s, constRng(0.5), []); // rng 0.5 → 不亂跳
      return s.intimacy;
    };
    expect(run(() => undefined)).toBe(50 - HARD.intimacyDecay);
    expect(run((st) => asleep(ai(st), 90))).toBe(50);
    expect(run((st) => (st.embrace = true))).toBe(50 + HARD.hugIntimacy);
    expect(run((st) => (st.mode = 'easy'))).toBe(47); // 簡單模式照舊 −3
  });

  it('end-of-turn changes (wobble, hugging, the arm pillow) never finish intimacy by themselves', () => {
    const s = hard({}, (st) => {
      st.intimacy = 99;
      st.embrace = true;
    });
    endOfTurn(s, constRng(0.999999), []);
    expect(s.intimacy).toBe(99);
    const pillow = hard({ role: 'male' }, (st, _m, a) => {
      st.intimacy = 98.5;
      st.armPillow = { offered: true, inUse: true, numbness: 0 };
      a.posture = 'sideFacing';
    });
    endOfTurn(pillow, constRng(0.999999), []);
    expect(pillow.intimacy).toBe(99);
    expect(endId(pillow)).toBeNull();
    // 簡單模式照舊:枕手臂的 +2 可以衝到 100
    const easy = scene({ role: 'male' }, (st) => {
      st.intimacy = 98.5;
      st.armPillow = { offered: true, inUse: true, numbness: 0 };
    });
    endOfTurn(easy, constRng(0.5), []);
    expect(easy.intimacy).toBe(100);
  });

  it('while the partner sleeps, intimacy stops at 99: the last step needs them awake', () => {
    const run = (partnerAsleep: boolean) => {
      const s = hard({ playerGoal: 'intimacy', timing: 'now' }, (st, _m, a) => {
        st.intimacy = 100; // 這回合剛親到 100
        if (partnerAsleep) asleep(a, 95);
      });
      endOfTurn(s, constRng(0.5), []);
      return s;
    };
    expect(run(true).intimacy).toBe(99);
    const awake = run(false);
    expect(awake.intimacy).toBe(100);
    expect(endId(awake)).toBe('intimacyWin');
  });

  it('morning: filling intimacy at night while the partner sleeps does not win at dawn', () => {
    const wins: string[] = [];
    for (const role of ROLES) {
      for (let seed = 0; seed < 40; seed++) {
        let s = createGame(role, seed, { mode: 'hard', playerGoal: 'intimacy', playerTiming: 'morning', partnerGoal: 'sleep' });
        s.turn = 5;
        s.intimacy = 99;
        asleep(ai(s), 95);
        me(s).posture = 'sideFacing';
        const kissed = playTurn(s, 'kiss', 30).state; // 偷親一下:對方睡著
        expect(kissed.intimacy).toBeLessThan(100);
        s = kissed;
        while (!s.ending) {
          if (me(s).eyes !== 'closed') s = toggleEyes(s, 'closed').state;
          s = playTurn(s, 'sleep', 0).state;
        }
        if (s.ending.id === 'intimacyMorningWin') wins.push(`${role}/${seed}`);
      }
    }
    expect(wins).toEqual([]);
  });

  it('dawn: from 03:20 sleep is capped lower every turn, and whoever slept wakes up in a better mood', () => {
    const at = (turn: number) => {
      const s = hard({ playerGoal: 'sleep' }, (st, m, a) => {
        st.turn = turn;
        asleep(m, 100);
        asleep(a, 100);
        m.mood = a.mood = 40;
      });
      endOfTurn(s, constRng(0.5), []);
      return s;
    };
    const night = at(HARD.dawnTurn - 1);
    expect(me(night).sleep).toBeGreaterThan(HARD.dawnCap); // 天亮前沒有上限
    expect(me(night).mood).toBe(42); // 心情每回合往 60 回歸 +2
    for (let k = 0; k < 4; k++) {
      const s = at(HARD.dawnTurn + k);
      const cap = HARD.dawnCap - k * HARD.dawnStep;
      // 上限之後還有對方的鼾聲(一點點噪音),所以是「上限附近」
      for (const c of [me(s), ai(s)]) {
        expect(c.sleep).toBeLessThanOrEqual(cap);
        expect(c.sleep).toBeGreaterThan(cap - 2);
      }
      expect(me(s).mood).toBeGreaterThan(me(night).mood); // 睡飽了,醒來心情比較好
      expect(me(s).mood).toBe(42 + HARD.restedMood);
    }
  });

  it('asleep but too hot / cold: sleep drops by uncomfySleep at the end of the turn', () => {
    const sleepAfter = (hot: boolean) => {
      const s = hard({ role: 'male', playerGoal: 'sleep' }, (st, m) => {
        st.intimacy = 50;
        asleep(m, 90);
        m.warmth = hot ? 100 : 50;
        st.blanketOffset = hot ? -1 : 0.5;
      });
      endOfTurn(s, constRng(0.5), []);
      return me(s).sleep;
    };
    expect(sleepAfter(true)).toBeLessThan(sleepAfter(false));
    expect(sleepAfter(false) - sleepAfter(true)).toBe(HARD.uncomfySleep);
  });

  it('sleep score: +1 only when asleep and comfortable', () => {
    const score = (mut: (s: GameState, m: CharacterState) => void) => {
      const s = hard({ role: 'male', playerGoal: 'sleep' }, (st, m) => {
        st.intimacy = 50;
        st.blanketOffset = 0.5; // 小熊蓋少一點:目標體溫剛好
        m.warmth = 50;
        mut(st, m);
      });
      endOfTurn(s, constRng(0.5), []);
      return s.sleepScore;
    };
    expect(score((_s, m) => asleep(m, 90))).toBe(1);
    expect(
      score((st, m) => {
        asleep(m, 90);
        m.warmth = 100;
        st.blanketOffset = -1; // 全蓋在小熊身上:太熱
      }),
    ).toBe(0.5);
    expect(score((_s, m) => (m.sleep = 50))).toBe(0.5); // 昏沉但舒服
    expect(score((st, m) => ((m.sleep = 50), (st.intimacy = 5)))).toBe(0); // 昏沉又沒安全感
  });

  it('morning affection counts double (from 04:00)', () => {
    const gain = (turn: number) => {
      const s = hard({}, (st) => (st.turn = turn));
      const before = s.intimacy;
      resolveAction(s, s.playerRole, 'whisper', 0, constRng(0.99), []);
      return s.intimacy - before;
    };
    expect(gain(1)).toBe(4);
    expect(gain(HARD.wakeTurn - 1)).toBe(4);
    expect(gain(HARD.wakeTurn)).toBe(4 * HARD.morningBoost);
  });
});

describe('partner AI (hard mode)', () => {
  it('a "right now" partner gives up after the deadline (says so once), then acts like a sleeper', () => {
    const s = hard({ playerGoal: 'sleep', partnerGoal: 'intimacy', partnerTiming: 'now' }, (st) => (st.turn = HARD.nowDeadline - 1));
    const Q = partnerOf(s.playerRole);
    expect(behaviorGoal(s, Q)).toBe('intimacy');
    s.turn = HARD.nowDeadline;
    expect(behaviorGoal(s, Q)).toBe('sleep');
    expect(choosePartnerAction(s, constRng(0.99)).speech).toBe('giveUp');
    s.memo.gaveUpSpoken = true;
    expect(choosePartnerAction(s, constRng(0.99)).speech).not.toBe('giveUp');
  });

  it('a "morning" partner sleeps first, then wakes itself at 04:00 and turns to you', () => {
    const s0 = createGame('male', 5, { mode: 'hard', playerGoal: 'sleep', partnerGoal: 'intimacy', partnerTiming: 'morning' });
    const s = structuredClone(s0);
    s.turn = 3;
    expect(behaviorGoal(s, 'female')).toBe('sleep');
    s.turn = HARD.wakeTurn;
    asleep(s.chars.female, 95);
    const pick = choosePartnerAction(s, constRng(0.99));
    expect(pick).toMatchObject({ wakeUp: true, speech: 'goodMorning' });
    const r = playTurn(s, 'sleep', 0);
    expect(r.state.chars.female.sleep).toBeLessThan(70);
    expect(r.state.chars.female.eyes).toBe('open');
    expect(r.state.memo.morningSpoken).toBe(true);
    expect(lines(r.events)).toContain('female:goodMorning');
  });

  it('a hot partner hands you the blanket; asleep, it kicks the blanket off in its sleep', () => {
    const awake = hard({ role: 'female', playerGoal: 'sleep', partnerGoal: 'sleep' }, (_st, _m, a) => (a.warmth = COMFORT.male.warmHi + 5));
    expect(choosePartnerAction(awake, constRng(0.99)).actionId).toBe('tuckBlanket');
    const sleeping = hard({ role: 'female', playerGoal: 'sleep', partnerGoal: 'sleep' }, (_st, _m, a) => {
      a.warmth = COMFORT.male.warmHi + 5;
      asleep(a, 90);
    });
    expect(choosePartnerAction(sleeping, constRng(0.99))).toMatchObject({ actionId: 'tuckBlanket', unconscious: true, notes: ['partnerKickedBlanket'] });
  });

  it('a sleepy partner short on closeness asks for a goodnight word first', () => {
    const s = hard({ role: 'male', playerGoal: 'sleep', partnerGoal: 'sleep' }, (st) => (st.intimacy = COMFORT.female.intimacy - 10));
    expect(choosePartnerAction(s, constRng(0))).toMatchObject({ actionId: 'whisper', speech: 'needCuddle' });
  });

  it('the morning partner wakes itself only once: fallen asleep again, it stays asleep', () => {
    const s = hard({ playerGoal: 'sleep', partnerGoal: 'intimacy', partnerTiming: 'morning' }, (st, _m, a) => {
      st.turn = HARD.wakeTurn + 1;
      asleep(a, 90);
    });
    expect(choosePartnerAction(s, constRng(0.99))).toMatchObject({ wakeUp: true, speech: 'goodMorning' });
    s.memo.morningSpoken = true;
    const again = choosePartnerAction(s, constRng(0.99));
    expect(again.wakeUp).toBeUndefined();
    expect(again.speech).not.toBe('goodMorning');
  });

  it('asleep and warm enough, the partner never rolls up the blanket (easy mode still does)', () => {
    for (const role of ROLES) {
      const Q = partnerOf(role);
      for (const r of [0, 0.1, 0.2]) {
        const s = hard({ role, playerGoal: 'sleep', partnerGoal: 'sleep' }, (_st, _m, a) => {
          a.warmth = Math.min(COMFORT[Q].warmLo + 30, COMFORT[Q].warmHi);
          asleep(a, 90);
        });
        expect(choosePartnerAction(s, constRng(r)).actionId).not.toBe('pullBlanket');
        s.mode = 'easy';
        expect(choosePartnerAction(s, constRng(r)).actionId).toBe('pullBlanket');
      }
    }
  });

  it('kicking the blanket over in its sleep is not a kindness: no thanks, no intimacy', () => {
    const s = hard({ role: 'female', playerGoal: 'sleep', partnerGoal: 'sleep' }, (st, _m, a) => {
      st.intimacy = 50;
      a.warmth = COMFORT.male.warmHi + 5;
      asleep(a, 90);
    });
    const pick = choosePartnerAction(s, constRng(0.99));
    expect(pick).toMatchObject({ actionId: 'tuckBlanket', unconscious: true });
    const { actionId, force, ...opts } = pick;
    const mood0 = me(s).mood;
    const offset0 = s.blanketOffset;
    const r = act(s, 'male', actionId, force, constRng(0.5), opts);
    expect(r.s.blanketOffset).not.toBe(offset0); // 棉被真的過來了
    expect(r.s.intimacy).toBe(50);
    expect(me(r.s).mood).toBe(mood0);
    expect(lines(r.events)).not.toContain('female:blanketTucked');
    // 醒著、有意識地幫你蓋 → 照舊道謝、親密度 +3
    const kind = act(hard({ role: 'female', playerGoal: 'sleep', partnerGoal: 'sleep' }, (st) => (st.intimacy = 50)), 'male', 'tuckBlanket', 30, constRng(0.5));
    expect(kind.s.intimacy).toBe(53);
    expect(lines(kind.events)).toContain('female:blanketTucked');
  });
});

/** randomState() 換成困難模式:親熱的目標抽一種時機,記憶裡的「說過早安 / 放棄」也隨機 */
function randomHardState(rnd: () => number): GameState {
  const s = randomState(rnd);
  s.mode = 'hard';
  for (const r of ROLES) if (s.chars[r].goal === 'intimacy') s.chars[r].timing = rnd() < 0.5 ? 'now' : 'morning';
  s.memo.morningSpoken = rnd() < 0.3;
  s.memo.gaveUpSpoken = rnd() < 0.3;
  return s;
}

describe('partner AI properties (hard mode, random states)', () => {
  it('always picks a usable action that succeeds, with known speech and notes', () => {
    const rnd = mulberry32(4242);
    const bad: string[] = [];
    for (let i = 0; i < 6000; i++) {
      const s = randomHardState(rnd);
      const Q = partnerOf(s.playerRole);
      const seed = Math.floor(rnd() * 1e9);
      const c = choosePartnerAction(s, mulberry32(seed));
      const where = `#${i} seed ${seed} → ${c.actionId}`;
      if (!canUse(s, Q, c.actionId)) bad.push(`${where} not usable`);
      if (!(c.force >= 0 && c.force <= 100)) bad.push(`${where} force ${c.force}`);
      if (c.speech && !(c.speech in ZH.speech)) bad.push(`${where} unknown speech ${c.speech}`);
      for (const n of c.notes ?? []) if (!(n in ZH.msg)) bad.push(`${where} unknown note ${n}`);
      const { actionId, force, ...opts } = c;
      const r = act(s, Q, actionId, force, mulberry32(seed), opts);
      if (!r.action.success) bad.push(`${where} failed: ${r.notes.join(',')}`);
      if (bad.length > 10) break;
    }
    expect(bad).toEqual([]);
  });

  it('judges the player only by appearances: hidden player stats (and goal / timing) never change its choice', () => {
    const rnd = mulberry32(99);
    const diffs: string[] = [];
    for (let i = 0; i < 3000; i++) {
      const s = randomHardState(rnd);
      const mine = s.chars[s.playerRole];
      const t = structuredClone(s);
      const you = t.chars[t.playerRole];
      you.mood = rnd() * 100;
      you.annoyance = rnd() * 100;
      you.warmth = rnd() * 100;
      you.goal = you.goal === 'sleep' ? 'intimacy' : 'sleep';
      you.timing = you.goal === 'intimacy' ? (rnd() < 0.5 ? 'now' : 'morning') : undefined;
      const newSleep = rnd() * 100;
      const probe = { ...you, sleep: newSleep };
      if (apparentlyAsleep(probe) === apparentlyAsleep(mine) && snoreLevel(probe) === snoreLevel(mine)) you.sleep = newSleep;
      const seed = Math.floor(rnd() * 1e9);
      const a = choosePartnerAction(s, mulberry32(seed));
      const b = choosePartnerAction(t, mulberry32(seed));
      if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(`#${i}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
      if (diffs.length > 5) break;
    }
    expect(diffs).toEqual([]);
  });
});

describe('hints and progress (hard mode)', () => {
  it('how much sleep score is still reachable: +1 a turn, but after dawn only what the sleep cap allows', () => {
    const at = (turn: number, mode: 'easy' | 'hard') => maxSleepGain(hard({}, (st) => ((st.turn = turn), (st.mode = mode))));
    expect(at(0, 'easy')).toBe(12);
    expect(at(9, 'easy')).toBe(3);
    // 困難:03:20 那回合末上限 80(還睡得著 +1)、之後 60 / 40(只剩昏沉 +0.5)、最後 20(0)
    expect(at(HARD.dawnTurn, 'hard')).toBe(2);
    expect(at(HARD.dawnTurn + 1, 'hard')).toBe(1);
    expect(at(11, 'hard')).toBe(0);
    expect(at(0, 'hard')).toBe(HARD.dawnTurn + 2);
  });

  it('progress knows the dawn cap: a sleep goal that can no longer be reached says so', () => {
    const sleep = (turn: number, score: number) =>
      goalProgress(
        hard({ playerGoal: 'sleep' }, (st) => {
          st.turn = turn;
          st.sleepScore = score;
        }),
      ).status;
    expect(sleep(11, HARD.sleepWin - 0.5)).toBe('impossible');
    expect(sleep(9, HARD.sleepWin - 1.5)).toBe('impossible');
    expect(sleep(9, HARD.sleepWin - 1)).toBe('tight');
    expect(sleep(HARD.dawnTurn, HARD.sleepWin - 1.5)).toBe('onTrack');
    const morning = hard({ playerGoal: 'intimacy', timing: 'morning' }, (st) => {
      st.turn = 10;
      st.sleepScore = HARD.morningSleep - 1;
    });
    expect(goalProgress(morning)).toMatchObject({ kind: 'morningSleep', status: 'impossible' });
  });

  it('progress: "right now" counts down to the deadline; "morning" is sleep first, then intimacy', () => {
    const now = hard({ playerGoal: 'intimacy', timing: 'now' }, (st) => (st.turn = 2));
    expect(goalProgress(now)).toMatchObject({ kind: 'now', remainingTurns: HARD.nowDeadline - 2, target: 100 });
    const morning = hard({ playerGoal: 'intimacy', timing: 'morning' }, (st) => (st.turn = 2));
    expect(goalProgress(morning)).toMatchObject({ kind: 'morningSleep', target: HARD.morningSleep });
    morning.sleepScore = HARD.morningSleep;
    expect(goalProgress(morning)).toMatchObject({ kind: 'morningLove', target: 100 });
  });

  it('sleep: too hot → share the blanket; lonely → hug or whisper', () => {
    const hot = hard({ role: 'male', playerGoal: 'sleep' }, (st, m) => {
      m.warmth = COMFORT.male.warmHi + 5;
      st.intimacy = 50;
    });
    expect(suggestAction(hot)).toMatchObject({ key: 'tooHot', actionId: 'tuckBlanket' });
    const lonely = hard({ role: 'female', playerGoal: 'sleep' }, (st, m) => {
      m.warmth = 80;
      st.intimacy = COMFORT.female.intimacy - 10;
    });
    expect(suggestAction(lonely)).toMatchObject({ key: 'needCloseness', actionId: 'hug' });
  });

  it('morning at night: sleep first, and stop before intimacy fills up; right now near the deadline: hurry', () => {
    const night = hard({ role: 'female', playerGoal: 'intimacy', timing: 'morning' }, (st, m) => {
      st.turn = 5;
      st.intimacy = 50;
      m.warmth = 80;
      m.eyes = 'closed';
    });
    expect(suggestAction(night)).toMatchObject({ key: 'morningSleepFirst', actionId: 'sleep' });
    night.intimacy = 85;
    expect(suggestAction(night)?.key).toBe('tooEarlyWarn');
    const now = hard({ playerGoal: 'intimacy', timing: 'now' }, (st) => (st.turn = HARD.nowDeadline - 1));
    expect(suggestAction(now)).toMatchObject({ key: 'hurry', urgent: true });
  });

  it('"too early" when already facing away: close your eyes (never a button you cannot press)', () => {
    const s = hard({ role: 'female', playerGoal: 'intimacy', timing: 'morning' }, (st, m) => {
      st.turn = 3;
      st.intimacy = 85;
      m.posture = 'sideAway';
      m.warmth = 80;
    });
    expect(suggestAction(s)).toEqual({ key: 'tooEarlyWarn', eyes: 'closed', urgent: true });
    const closed = toggleEyes(s, 'closed').state;
    const sug = suggestAction(closed);
    expect(sug).toMatchObject({ key: 'tooEarlyWarn', actionId: 'sleep' });
    expect(canUse(closed, closed.playerRole, sug!.actionId!)).toBe(true);
  });

  it('"hurry" only relabels a sweet move while the partner is awake', () => {
    const s = hard({ playerGoal: 'intimacy', timing: 'now' }, (st, _m, a) => {
      st.turn = HARD.nowDeadline - 1;
      asleep(a, 100);
    });
    expect(suggestAction(s)?.key).not.toBe('hurry');
    expect(['partnerAsleep', 'partnerDeepSleep']).toContain(suggestAction(s)?.key);
  });
});

describe('hard-mode win rates (200 games per row; seeds 0..99 × both roles)', () => {
  const HARD_ROWS: { n: string; player: [Goal, IntimacyTiming?]; partner: [Goal, IntimacyTiming?]; strat: keyof typeof STRATS; lo: number; hi: number }[] = [
    // 目前的值見 DESIGN §15.6;範圍大約 ±0.1,平衡改動時跟著更新
    { n: 'sleep vs sleep, following hints', player: ['sleep'], partner: ['sleep'], strat: 'followHints', lo: 0.6, hi: 0.82 },
    { n: 'sleep vs sleep, just sleeping (comfort matters)', player: ['sleep'], partner: ['sleep'], strat: 'sleepOnly', lo: 0, hi: 0.05 },
    { n: 'sleep vs morning, following hints', player: ['sleep'], partner: ['intimacy', 'morning'], strat: 'followHints', lo: 0.48, hi: 0.7 },
    { n: 'sleep vs right now, following hints', player: ['sleep'], partner: ['intimacy', 'now'], strat: 'followHints', lo: 0.15, hi: 0.36 },
    { n: 'right now vs right now, following hints', player: ['intimacy', 'now'], partner: ['intimacy', 'now'], strat: 'followHints', lo: 0.67, hi: 0.88 },
    { n: 'right now vs morning, following hints', player: ['intimacy', 'now'], partner: ['intimacy', 'morning'], strat: 'followHints', lo: 0.15, hi: 0.37 },
    { n: 'right now vs sleep: the long shot', player: ['intimacy', 'now'], partner: ['sleep'], strat: 'followHints', lo: 0, hi: 0.05 },
    { n: 'morning vs morning, following hints', player: ['intimacy', 'morning'], partner: ['intimacy', 'morning'], strat: 'followHints', lo: 0.66, hi: 0.87 },
    { n: 'morning vs sleep, following hints', player: ['intimacy', 'morning'], partner: ['sleep'], strat: 'followHints', lo: 0.23, hi: 0.45 },
    { n: 'morning vs right now, following hints', player: ['intimacy', 'morning'], partner: ['intimacy', 'now'], strat: 'followHints', lo: 0.1, hi: 0.3 },
    { n: 'morning, naive sleep-then-kiss', player: ['intimacy', 'morning'], partner: ['intimacy', 'morning'], strat: 'sleepThenKiss', lo: 0, hi: 0.08 },
  ];

  it.each(HARD_ROWS.map((r) => [r.n, r] as const))('%s', (_n, row) => {
    let wins = 0;
    const problems: string[] = [];
    for (const role of ROLES) {
      for (let seed = 0; seed < 100; seed++) {
        const strat: Strategy = STRATS[row.strat];
        const { state } = runGame(role, seed, row.player[0], row.partner[0], (s) => {
          problems.push(...stateViolations(s, `${role}/${seed} t${s.turn}`));
          return strat(s);
        }, { mode: 'hard', playerTiming: row.player[1], partnerTiming: row.partner[1] });
        problems.push(...stateViolations(state, `${role}/${seed} end`));
        if (state.ending!.outcome === 'win') wins++;
      }
    }
    expect(problems.slice(0, 5)).toEqual([]);
    const rate = wins / 200;
    expect(rate).toBeGreaterThanOrEqual(row.lo);
    expect(rate).toBeLessThanOrEqual(row.hi);
  });

  it('hard games never produce bad numbers or unknown text keys in their events', () => {
    const problems: string[] = [];
    for (const role of ROLES) {
      for (let seed = 0; seed < 40; seed++) {
        let s = createGame(role, seed, { mode: 'hard' });
        while (!s.ending) {
          const d = STRATS.followHints(s);
          if (d.eyes && s.chars[role].eyes !== d.eyes) s = toggleEyes(s, d.eyes).state;
          const r = playTurn(s, d.id, d.force);
          problems.push(...eventViolations(r.events, `${role}/${seed} t${s.turn}`), ...stateViolations(r.state, `${role}/${seed} t${s.turn}`));
          s = r.state;
        }
      }
    }
    expect(problems.slice(0, 5)).toEqual([]);
  });
});
