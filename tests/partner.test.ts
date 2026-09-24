// Partner AI (DESIGN §8 as amended by §14.2/§14.3). The AI is driven with scripted RNGs so each branch is hit
// deterministically. Default scene: player = male, AI = female, both awake, facing each other within reach.
import { describe, expect, it } from 'vitest';
import { canUse } from '../src/game/actions';
import { BAL } from '../src/game/constants';
import { choosePartnerAction, type PartnerChoice } from '../src/game/partner';
import { mulberry32, type Rng } from '../src/game/rng';
import { apparentlyAsleep, snoreLevel } from '../src/game/rules';
import { SHARED_GOODNIGHT_LINES } from '../src/game/speech';
import { ZH } from '../src/game/text';
import { createGame, playTurn } from '../src/game/turn';
import type { ActionId, CharacterState, GameState, Goal, Posture, Role } from '../src/game/types';
import { partnerOf } from '../src/game/types';
import { act, asleep, constRng, ofType, randomState, scene, seqRng, type SceneOpts } from './helpers';

type Mut = (st: GameState, me: CharacterState, ai: CharacterState) => void;
const pick = (s: GameState, rng: Rng = constRng(0.99)): PartnerChoice => choosePartnerAction(s, rng);
const sleepAI = (mut?: Mut, opts: SceneOpts = {}) => scene({ partnerGoal: 'sleep', ...opts }, mut);
const loveAI = (mut?: Mut, opts: SceneOpts = {}) => scene({ partnerGoal: 'intimacy', ...opts }, mut);
/** player looks asleep to the AI: eyes closed + just chose sleep */
const playerLooksAsleep = (me: CharacterState) => {
  me.eyes = 'closed';
  me.lastAction = 'sleep';
};

describe('§8 turn 0: opening move does not reveal the goal', () => {
  it('from the initial supine posture the AI always turns sideFacing ("if already, the other one") with goodnight_{goal}', () => {
    for (const goal of ['sleep', 'intimacy'] as const) {
      for (const r of [0.1, 0.9]) {
        const s = scene({ partnerGoal: goal }, (st, _me, ai) => {
          st.turn = 0;
          ai.posture = 'supine';
        });
        expect(pick(s, constRng(r))).toMatchObject({ actionId: 'lieSideFacing', speech: `goodnight_${goal}` });
      }
    }
  });

  /** Share of shared/ambiguous goodnight lines in real turn-0 openings, per partner goal (random goals, first move lieSideFacing) */
  function openingAmbiguity(role: Role): Record<Goal, number> {
    const n = { sleep: 0, intimacy: 0 };
    const shared = { sleep: 0, intimacy: 0 };
    for (let seed = 0; seed < 600; seed++) {
      const s = createGame(role, seed);
      const ai = partnerOf(role);
      const line = ofType(playTurn(s, 'lieSideFacing', 0).events, 'speech').find((e) => e.who === ai && e.key?.startsWith('goodnight_'))!;
      const g = s.chars[ai].goal;
      n[g]++;
      if (line.index! < SHARED_GOODNIGHT_LINES) shared[g]++;
    }
    return { sleep: shared.sleep / n.sleep, intimacy: shared.intimacy / n.intimacy };
  }

  it('real openings by a male partner use the shared ambiguous lines about 1/3 of the time for either goal', () => {
    const r = openingAmbiguity('female');
    for (const g of ['sleep', 'intimacy'] as Goal[]) {
      expect(r[g], g).toBeGreaterThan(0.2);
      expect(r[g], g).toBeLessThan(0.47);
    }
  });

  // BUG (RNG stream collision, §2 × §8): turnRng(seed, 0) = mulberry32(seed ^ imul(0, …)) = mulberry32(seed), i.e. the
  // very stream createGame used to draw male.goal (r1), female.goal (r2), moods (r3, r4). When the player's first move
  // draws no RNG (lieSideFacing / sleep …), the female AI's goodnight line index is floor(r2 × 6) with the same r2 that
  // decided her goal (r2 < 0.5 ⇒ sleep): a sleep-goal woman only ever says lines 0–2 (shared 2/3 of the time) and an
  // intimacy-goal woman only lines 3–5 — never an ambiguous one — so her opening line always gives her goal away,
  // against "開場:不暴露目標 … 各池 1/3 是共用的曖昧句". (Same collision: the turn-0 breath-tell roll is the male-mood
  // roll.) Measured over seeds 0..599: shared share sleep ≈ 0.65, intimacy = 0.00.
  it.fails('real openings by a female partner use the shared ambiguous lines about 1/3 of the time for either goal', () => {
    const r = openingAmbiguity('male');
    for (const g of ['sleep', 'intimacy'] as Goal[]) {
      expect(r[g], g).toBeGreaterThan(0.2);
      expect(r[g], g).toBeLessThan(0.47);
    }
  });

  it('r < 0.5 → lieSideFacing, otherwise lieSupine; the other one when already in it', () => {
    const from = (p: Posture, r: number) =>
      pick(
        scene({}, (st, _me, ai) => {
          st.turn = 0;
          ai.posture = p;
        }),
        constRng(r),
      ).actionId;
    expect(from('sideAway', 0.1)).toBe('lieSideFacing');
    expect(from('sideAway', 0.9)).toBe('lieSupine');
    expect(from('sideFacing', 0.1)).toBe('lieSupine');
  });
});

describe('§8 P asleep (sleep >= 70): unconscious moves, never wakes itself', () => {
  const sleeping = (mut?: Mut, opts: SceneOpts = {}) =>
    scene(opts, (st, me, ai) => {
      asleep(ai, 80);
      mut?.(st, me, ai);
    });

  it('cold (warmth < 30) → pullBlanket 70 with the partnerStoleBlanket note', () => {
    const c = pick(sleeping((_s, _me, ai) => (ai.warmth = 29)));
    expect(c).toMatchObject({ actionId: 'pullBlanket', force: 70, unconscious: true, notes: ['partnerStoleBlanket'] });
  });

  it('a second pull in a row is the burrito note (memo.pullStreak >= 1)', () => {
    const c = pick(
      sleeping((st, _me, ai) => {
        ai.warmth = 29;
        st.memo.pullStreak = 1;
      }),
    );
    expect(c.notes).toEqual(['partnerBurrito']);
  });

  it('r < 0.25 → pullBlanket 55; when the blanket is already all theirs it falls down the ladder', () => {
    expect(pick(sleeping(), constRng(0.2))).toMatchObject({ actionId: 'pullBlanket', force: 55, unconscious: true });
    const hogging = sleeping((st, _me, ai) => {
      st.blanketOffset = 1; // female AI already has it all
      ai.warmth = 10;
    });
    expect(pick(hogging, constRng(0.2)).actionId).not.toBe('pullBlanket');
    expect(pick(hogging, constRng(0.99)).actionId).toBe('sleep');
  });

  it('0.25 ≤ r < 0.35 → roll into one of the other postures (force 0, unconscious)', () => {
    const s = sleeping(); // AI sideFacing
    expect(pick(s, seqRng(0.3, 0))).toMatchObject({ actionId: 'lieSupine', force: 0, unconscious: true });
    const seen = new Set<ActionId>();
    for (let i = 0; i < 20; i++) seen.add(pick(s, seqRng(0.3, i / 20)).actionId);
    expect([...seen].sort()).toEqual(['lieProne', 'lieSideAway', 'lieSupine']);
  });

  it('a sleeping man with his arm pinned can only roll supine ↔ sideFacing', () => {
    const s = sleeping(
      (st, _me, ai) => {
        st.armPillow = { offered: true, inUse: true, numbness: 25 };
        ai.posture = 'supine';
      },
      { role: 'female' },
    );
    for (let i = 0; i < 10; i++) expect(pick(s, seqRng(0.3, i / 10)).actionId).toBe('lieSideFacing');
  });

  it('0.35 ≤ r < 0.45 → sleep-talk: sleep + sleepTalk_{goal} with +8 noise', () => {
    for (const goal of ['sleep', 'intimacy'] as const) {
      expect(pick(sleeping(undefined, { partnerGoal: goal }), constRng(0.4))).toMatchObject({
        actionId: 'sleep',
        speech: `sleepTalk_${goal}`,
        noiseBonus: 8,
        unconscious: true,
      });
    }
  });

  it('otherwise → sleep; even at annoyance 80 a sleeper does not push', () => {
    expect(pick(sleeping(), constRng(0.5))).toMatchObject({ actionId: 'sleep', unconscious: true });
    expect(pick(sleeping((_s, _me, ai) => (ai.annoyance = 80)), constRng(0.99)).actionId).toBe('sleep');
  });
});

describe('§8 shared branches', () => {
  it('70 ≤ annoyance < 100 → push (either goal)', () => {
    for (const goal of ['sleep', 'intimacy'] as const) {
      for (const a of [70, 99]) {
        expect(pick(scene({ partnerGoal: goal }, (_s, _me, ai) => (ai.annoyance = a))).actionId).toBe('push');
      }
      expect(pick(scene({ partnerGoal: goal }, (_s, _me, ai) => (ai.annoyance = 69))).actionId).not.toBe('push');
      expect(pick(scene({ partnerGoal: goal }, (_s, _me, ai) => (ai.annoyance = 100))).actionId).not.toBe('push');
    }
  });

  it('male AI with the arm out and numbness >= 75 → withdrawArm 40 (either goal)', () => {
    for (const goal of ['sleep', 'intimacy'] as const) {
      const at = (numbness: number) =>
        pick(scene({ role: 'female', partnerGoal: goal }, (st) => (st.armPillow = { offered: true, inUse: true, numbness })));
      expect(at(75)).toMatchObject({ actionId: 'withdrawArm', force: 40 });
      expect(at(74).actionId).not.toBe('withdrawArm');
    }
  });
});

describe('§8 sleep-goal partner', () => {
  it('warmth < 55 → pullBlanket 50 (skipped when impossible)', () => {
    expect(pick(sleepAI((_s, _me, ai) => (ai.warmth = 54)))).toMatchObject({ actionId: 'pullBlanket', force: 50 });
    expect(pick(sleepAI((_s, _me, ai) => (ai.warmth = 55))).actionId).not.toBe('pullBlanket');
    const hog = sleepAI((st, _me, ai) => {
      ai.warmth = 10;
      st.blanketOffset = 1;
    });
    expect(pick(hog).actionId).not.toBe('pullBlanket');
  });

  it('female with an offered arm, mood >= 40, supine/facing: restOnArm half the time', () => {
    const offered = (mut?: Mut) =>
      sleepAI((st, me, ai) => {
        st.armPillow.offered = true;
        mut?.(st, me, ai);
      });
    expect(pick(offered(), constRng(0.4)).actionId).toBe('restOnArm');
    expect(pick(offered(), constRng(0.6)).actionId).not.toBe('restOnArm');
    expect(pick(offered((_s, _me, ai) => (ai.mood = 39)), constRng(0.1)).actionId).not.toBe('restOnArm');
    expect(pick(offered((_s, _me, ai) => (ai.posture = 'sideAway')), constRng(0.1)).actionId).not.toBe('restOnArm');
  });

  it('pestered (player tried affection) while annoyance >= 30 → lieSideAway + sleepyDecline', () => {
    for (const last of ['kiss', 'hug', 'caress', 'whisper'] as const) {
      const s = sleepAI((_s, me, ai) => {
        me.lastAction = last;
        ai.annoyance = 30;
      });
      expect(pick(s)).toMatchObject({ actionId: 'lieSideAway', speech: 'sleepyDecline' });
    }
    const alreadyAway = sleepAI((_s, me, ai) => {
      me.lastAction = 'kiss';
      ai.annoyance = 30;
      ai.posture = 'sideAway';
    });
    expect(pick(alreadyAway).actionId).not.toBe('lieSideAway');
    const notAffection = sleepAI((_s, me, ai) => {
      me.lastAction = 'pat';
      ai.annoyance = 30;
    });
    expect(pick(notAffection).actionId).not.toBe('lieSideAway');
  });

  it('§14.3 drowsy turn-away: already drowsy (>= 30) and courted → lieSideAway with probability drowsyTurnAway', () => {
    const drowsy = (sleep: number, mood = 60) =>
      sleepAI((_s, me, ai) => {
        me.lastAction = 'hug';
        ai.sleep = sleep;
        ai.mood = mood;
      });
    expect(pick(drowsy(30), constRng(BAL.drowsyTurnAway - 0.01))).toMatchObject({ actionId: 'lieSideAway', speech: 'sleepyDecline' });
    expect(pick(drowsy(30), constRng(BAL.drowsyTurnAway)).actionId).not.toBe('lieSideAway');
    expect(pick(drowsy(29), constRng(0)).actionId).not.toBe('lieSideAway'); // still awake: no turn-away
    expect(pick(drowsy(30, BAL.sleepyMood), constRng(0)).actionId).not.toBe('lieSideAway'); // in the mood
  });

  it('okFine ("fine… just a little"): mood >= sleepyMood, intimacy >= 55, annoyance < 40, player visibly awake', () => {
    const ok = (mut?: Mut) =>
      sleepAI((st, me, ai) => {
        ai.mood = BAL.sleepyMood;
        st.intimacy = 55;
        mut?.(st, me, ai);
      });
    expect(pick(ok(), constRng(0.1))).toMatchObject({ actionId: 'kiss', force: 40, speech: 'okFine' });
    expect(pick(ok(), constRng(0.9))).toMatchObject({ actionId: 'caress', force: 40, speech: 'okFine' });
    expect(pick(ok((_s, _me, ai) => (ai.posture = 'supine')))).toMatchObject({ actionId: 'lieSideFacing', speech: 'okFine' });
    // kiss impossible (player turned away) → caress
    expect(pick(ok((_s, me) => (me.posture = 'sideAway')), constRng(0.1))).toMatchObject({ actionId: 'caress', speech: 'okFine' });
    // thresholds
    expect(pick(ok((_s, _me, ai) => (ai.mood = BAL.sleepyMood - 1))).speech).not.toBe('okFine');
    expect(pick(ok((st) => (st.intimacy = 54))).speech).not.toBe('okFine');
    expect(pick(ok((_s, _me, ai) => (ai.annoyance = 40))).speech).not.toBe('okFine');
    expect(pick(ok((_s, me) => playerLooksAsleep(me))).speech).not.toBe('okFine');
  });

  it('reply: after whisper / tuckBlanket / offerArm / pat, an awake calm partner whispers back (replyChance)', () => {
    for (const last of ['whisper', 'tuckBlanket', 'offerArm', 'pat'] as const) {
      const s = sleepAI((_s, me) => (me.lastAction = last));
      expect(pick(s, constRng(BAL.replyChance - 0.01)).actionId, last).toBe('whisper');
    }
    const base = (mut: Mut) =>
      sleepAI((st, me, ai) => {
        me.lastAction = 'tuckBlanket';
        mut(st, me, ai);
      });
    const r = constRng(BAL.replyChance - 0.01);
    expect(pick(base(() => {}), constRng(BAL.replyChance)).actionId).not.toBe('whisper');
    expect(pick(base((_s, _me, ai) => (ai.sleep = 30)), r).actionId).not.toBe('whisper'); // §14.3: only while awake
    expect(pick(base((_s, _me, ai) => (ai.mood = 59)), r).actionId).not.toBe('whisper');
    expect(pick(base((_s, _me, ai) => (ai.annoyance = 30)), r).actionId).not.toBe('whisper');
  });

  it('player snoring (asleep, supine) while not apparently asleep → pat 30 (60%)', () => {
    const snoring = sleepAI((_s, me) => {
      me.sleep = 80;
      me.posture = 'supine';
    });
    expect(snoreLevel(snoring.chars.male)).toBe(2);
    expect(pick(snoring, constRng(0.5))).toMatchObject({ actionId: 'pat', force: 30 });
    expect(pick(snoring, constRng(0.65)).actionId).toBe('sleep');
  });

  it('player visibly awake → pat 30 to lull them (30%); otherwise sleep', () => {
    expect(pick(sleepAI(), constRng(0.2))).toMatchObject({ actionId: 'pat', force: 30 });
    expect(pick(sleepAI(), constRng(0.3)).actionId).toBe('sleep');
    expect(pick(sleepAI((_s, me) => playerLooksAsleep(me)), constRng(0)).actionId).toBe('sleep');
  });

  it('default → sleep, with a goodnight line only the first time', () => {
    expect(pick(sleepAI())).toMatchObject({ actionId: 'sleep', speech: 'goodnight' });
    const c = pick(sleepAI((st) => (st.memo.goodnightSpoken = true)));
    expect(c.actionId).toBe('sleep');
    expect(c.speech).toBeUndefined();
  });
});

describe('§8 intimacy-goal partner', () => {
  it('§14.3 momentum: already sleeping (lastAction sleep, sleep >= momentumMinSleep) and undisturbed → keeps sleeping', () => {
    const dozing = (last: ActionId | null, sleep: number = BAL.momentumMinSleep) =>
      loveAI((_s, me, ai) => {
        ai.lastAction = 'sleep';
        ai.eyes = 'closed';
        ai.sleep = sleep;
        me.lastAction = last;
      });
    expect(pick(dozing(null), constRng(0.5))).toMatchObject({ actionId: 'sleep' });
    expect(pick(dozing('lieSupine'), constRng(0.5)).actionId).toBe('sleep');
    for (const d of ['kiss', 'hug', 'caress', 'whisper', 'scootIn', 'pullBlanket'] as const) {
      expect(pick(dozing(d), constRng(0.99)).actionId, `disturbed by ${d}`).not.toBe('sleep');
    }
    expect(pick(dozing(null, BAL.momentumMinSleep - 1), constRng(0.99)).actionId).not.toBe('sleep');
  });

  it('§14.3 lull: after a pat, goes to sleep with probability lullChance', () => {
    const patted = loveAI((_s, me) => (me.lastAction = 'pat'));
    expect(pick(patted, constRng(BAL.lullChance - 0.01)).actionId).toBe('sleep');
    expect(pick(patted, constRng(BAL.lullChance)).actionId).not.toBe('sleep');
  });

  it('female with an offered arm (mood >= 40, annoyance < 50, supine/facing) → restOnArm', () => {
    const s = (mut?: Mut) =>
      loveAI((st, me, ai) => {
        st.armPillow.offered = true;
        mut?.(st, me, ai);
      });
    expect(pick(s()).actionId).toBe('restOnArm');
    expect(pick(s((_s, _me, ai) => (ai.annoyance = 50))).actionId).not.toBe('restOnArm');
    expect(pick(s((_s, _me, ai) => (ai.posture = 'sideAway'))).actionId).not.toBe('restOnArm');
  });

  describe('player visibly awake, mood >= 50, annoyance < 40: approach', () => {
    it('not facing → lieSideFacing', () => {
      expect(pick(loveAI((_s, _me, ai) => (ai.posture = 'supine'))).actionId).toBe('lieSideFacing');
    });

    it('too far → scootIn 40 + partnerInitiate (whisper if it cannot scoot)', () => {
      const far = loveAI((st) => {
        st.chars.male.lateral = -0.5;
        st.chars.female.lateral = 0.5;
      });
      expect(pick(far)).toMatchObject({ actionId: 'scootIn', force: 40, speech: 'partnerInitiate' });
      const stuck = loveAI((st) => {
        st.chars.male.lateral = -0.7;
        st.chars.female.lateral = 0.1;
      });
      expect(pick(stuck).actionId).toBe('whisper');
    });

    it('male AI without the arm out, player supine/facing → offerArm (30%)', () => {
      const s = loveAI(undefined, { role: 'female' });
      expect(pick(s, constRng(0.2)).actionId).toBe('offerArm');
      expect(pick(s, constRng(0.3)).actionId).not.toBe('offerArm');
      expect(pick(loveAI((_s, me) => (me.posture = 'sideAway'), { role: 'female' }), constRng(0.2)).actionId).not.toBe('offerArm');
    });

    it('player turned away and no embrace → hug 40 (spooning)', () => {
      expect(pick(loveAI((_s, me) => (me.posture = 'sideAway')))).toMatchObject({ actionId: 'hug', force: 40 });
      // embracing already → falls to whisper
      const spooning = loveAI((st, me) => {
        me.posture = 'sideAway';
        st.embrace = true;
      });
      expect(pick(spooning).actionId).toBe('whisper');
    });

    it('player facing / supine → kiss 35% / caress 35% / hug 20% / whisper 10%, force 40 (85%) or rough 80 (15%)', () => {
      const s = loveAI();
      expect(pick(s, seqRng(0.1, 0.5))).toMatchObject({ actionId: 'kiss', force: 40 });
      expect(pick(s, seqRng(0.5, 0.5))).toMatchObject({ actionId: 'caress', force: 40 });
      expect(pick(s, seqRng(0.8, 0.5))).toMatchObject({ actionId: 'hug', force: 40 });
      expect(pick(s, seqRng(0.95, 0.5))).toMatchObject({ actionId: 'whisper', force: 0 });
      expect(pick(s, seqRng(0.1, 0.9))).toMatchObject({ actionId: 'kiss', force: 80 });
      // hug becomes caress when already embracing or when the player is supine
      expect(pick(loveAI((st) => (st.embrace = true)), seqRng(0.8, 0.5)).actionId).toBe('caress');
      expect(pick(loveAI((_s, me) => (me.posture = 'supine')), seqRng(0.8, 0.5)).actionId).toBe('caress');
    });

    it('the pick distribution matches 35/35/20/10 and 15% rough', () => {
      const rng = mulberry32(99);
      const n = 4000;
      const count: Record<string, number> = {};
      let rough = 0;
      for (let i = 0; i < n; i++) {
        const c = pick(loveAI(), rng);
        count[c.actionId] = (count[c.actionId] ?? 0) + 1;
        if (c.force === 80) rough++;
      }
      expect(count.kiss / n).toBeCloseTo(0.35, 1);
      expect(count.caress / n).toBeCloseTo(0.35, 1);
      expect(count.hug / n).toBeCloseTo(0.2, 1);
      expect(count.whisper / n).toBeCloseTo(0.1, 1);
      expect(rough / (n - count.whisper)).toBeCloseTo(0.15, 1);
    });

    it('player prone (not a player posture, but defined) → whisper', () => {
      expect(pick(loveAI((_s, me) => (me.posture = 'prone'))).actionId).toBe('whisper');
    });
  });

  describe('player apparently asleep, mood >= 50: probe / wake them', () => {
    it('r < 0.2 → whisper; not facing → lieSideFacing; else rough caress 80 with wakeUp', () => {
      const s = loveAI((_s, me) => playerLooksAsleep(me));
      expect(pick(s, constRng(0.1)).actionId).toBe('whisper');
      expect(pick(s, constRng(0.5))).toMatchObject({ actionId: 'caress', force: 80, speech: 'wakeUp' });
      const lyingFlat = loveAI((_s, me, ai) => {
        playerLooksAsleep(me);
        ai.posture = 'supine';
      });
      expect(pick(lyingFlat, constRng(0.5)).actionId).toBe('lieSideFacing');
    });

    it('rough caress unavailable (too far) → scootIn 40', () => {
      const far = loveAI((st, me) => {
        playerLooksAsleep(me);
        st.chars.male.lateral = -0.5;
        st.chars.female.lateral = 0.5;
      });
      expect(pick(far, constRng(0.5))).toMatchObject({ actionId: 'scootIn', force: 40 });
    });

    it('§14.3 shield: player asleep with their back turned → sneak hug 15% / whisper 10% / give up 5% / else wake them', () => {
      const s = loveAI((_s, me) => {
        playerLooksAsleep(me);
        me.posture = 'sideAway';
      });
      const h = BAL.shieldHug;
      const w = h + BAL.shieldWhisper;
      const g = w + BAL.shieldGiveUp;
      expect(pick(s, seqRng(h - 0.01))).toMatchObject({ actionId: 'hug', force: 40 });
      expect(pick(s, seqRng(w - 0.01)).actionId).toBe('whisper');
      expect(pick(s, seqRng(g - 0.01)).actionId).toBe('sleep');
      expect(pick(s, seqRng(g, 0.5))).toMatchObject({ actionId: 'caress', force: 80, speech: 'wakeUp' });
    });
  });

  it('§14.3 sulk (mood < 50): whisper 35% / tuckBlanket 30 20% / otherwise sleep', () => {
    const s = loveAI((_s, _me, ai) => (ai.mood = 49));
    expect(pick(s, constRng(BAL.sulkWhisper - 0.01)).actionId).toBe('whisper');
    expect(pick(s, constRng(BAL.sulkWhisper + BAL.sulkTuck - 0.01))).toMatchObject({ actionId: 'tuckBlanket', force: 30 });
    expect(pick(s, constRng(BAL.sulkWhisper + BAL.sulkTuck)).actionId).toBe('sleep');
  });

  it('otherwise (in the mood but annoyed 40–69, player awake) → sleep', () => {
    expect(pick(loveAI((_s, _me, ai) => (ai.annoyance = 40)), constRng(0)).actionId).toBe('sleep');
  });
});

// ───────────────────────── properties ─────────────────────────

describe('§8 properties', () => {
  it('over thousands of random states/seeds the AI only returns actions canUse() accepts, and they succeed', () => {
    const rnd = mulberry32(2024);
    const bad: string[] = [];
    for (let i = 0; i < 6000; i++) {
      const s = randomState(rnd);
      const ai = partnerOf(s.playerRole);
      const seed = Math.floor(rnd() * 1e9);
      const c = choosePartnerAction(s, mulberry32(seed));
      const where = `#${i} seed ${seed} → ${c.actionId}`;
      if (!canUse(s, ai, c.actionId)) bad.push(`${where} not usable`);
      if (!(c.force >= 0 && c.force <= 100)) bad.push(`${where} force ${c.force}`);
      if (c.speech && !(c.speech in ZH.speech)) bad.push(`${where} unknown speech ${c.speech}`);
      for (const n of c.notes ?? []) if (!(n in ZH.msg)) bad.push(`${where} unknown note ${n}`);
      const { actionId, force, ...opts } = c;
      const r = act(s, ai, actionId, force, mulberry32(seed), opts);
      if (!r.action.success) bad.push(`${where} failed: ${r.notes.join(',')}`);
      if (bad.length > 10) break;
    }
    expect(bad).toEqual([]);
  });

  it('the AI judges the player only by appearances: hidden player stats never change its choice', () => {
    const rnd = mulberry32(77);
    const diffs: string[] = [];
    for (let i = 0; i < 3000; i++) {
      const s = randomState(rnd);
      const me = s.chars[s.playerRole];
      const t = structuredClone(s);
      const you = t.chars[t.playerRole];
      you.mood = rnd() * 100;
      you.annoyance = rnd() * 100;
      you.warmth = rnd() * 100;
      you.goal = you.goal === 'sleep' ? 'intimacy' : 'sleep';
      // sleep may change as long as what the AI can perceive stays the same
      const newSleep = rnd() * 100;
      const probe = { ...you, sleep: newSleep };
      if (apparentlyAsleep(probe) === apparentlyAsleep(me) && snoreLevel(probe) === snoreLevel(me)) you.sleep = newSleep;
      const seed = Math.floor(rnd() * 1e9);
      const a = choosePartnerAction(s, mulberry32(seed));
      const b = choosePartnerAction(t, mulberry32(seed));
      if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(`#${i}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
      if (diffs.length > 5) break;
    }
    expect(diffs).toEqual([]);
  });
});
