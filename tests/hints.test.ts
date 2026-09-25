// Hints (DESIGN §14.4): suggestAction / goalProgress / clueLean / greenCenter.
import { describe, expect, it } from 'vitest';
import { ACTIONS, canUse, listAvailableActions } from '../src/game/actions';
import { clueLean, goalProgress, greenCenter, suggestAction, type Suggestion } from '../src/game/hints';
import { mulberry32 } from '../src/game/rng';
import { breathRate, forceBand, forceWindow } from '../src/game/rules';
import { ZH } from '../src/game/text';
import { createGame, playTurn, toggleEyes } from '../src/game/turn';
import type { GameState, Role } from '../src/game/types';
import { partnerOf } from '../src/game/types';
import { asleep, randomState, scene } from './helpers';

/** What is wrong with a suggestion for this state (empty = fine) */
function suggestionProblems(s: GameState, sg: Suggestion | null): string[] {
  const out: string[] = [];
  if (!sg) return s.ending ? [] : ['null suggestion for a running game'];
  if (!(sg.key in ZH.hint)) out.push(`unknown hint key ${sg.key}`);
  const P = s.playerRole;
  if (sg.eyes) {
    if (sg.actionId) out.push('both an eyes toggle and an action');
    if (sg.eyes === s.chars[P].eyes) out.push(`suggests eyes ${sg.eyes} which are already ${sg.eyes}`);
  } else if (!sg.actionId) {
    // 只有「睡太熟、現在叫不醒」可以不附動作(棉被也已經都在自己這邊時)
    if (sg.key !== 'partnerDeepSleep') out.push('neither action nor eyes');
  }
  else {
    if (!canUse(s, P, sg.actionId)) out.push(`suggests unavailable ${sg.actionId}`);
    const d = ACTIONS[sg.actionId];
    if (d.usesForce !== (sg.force !== undefined)) out.push(`force presence mismatch for ${sg.actionId}`);
    if (sg.force !== undefined && !(sg.force >= 0 && sg.force <= 100)) out.push(`force ${sg.force}`);
  }
  return out;
}

describe('suggestAction', () => {
  it('always suggests an available action or an eyes toggle (random states)', () => {
    const rnd = mulberry32(31337);
    const bad: string[] = [];
    for (let i = 0; i < 5000; i++) {
      const s = randomState(rnd);
      for (const p of suggestionProblems(s, suggestAction(s))) bad.push(`#${i}: ${p}`);
      if (bad.length > 10) break;
    }
    expect(bad).toEqual([]);
  });

  it('always suggests an available action or an eyes toggle along real games (following the hint)', () => {
    const bad: string[] = [];
    for (const role of ['male', 'female'] as Role[]) {
      for (let seed = 0; seed < 40; seed++) {
        let s = createGame(role, seed);
        while (!s.ending) {
          let sg = suggestAction(s);
          bad.push(...suggestionProblems(s, sg).map((p) => `${role}/${seed} t${s.turn}: ${p}`));
          if (sg?.eyes) {
            s = toggleEyes(s, sg.eyes).state;
            sg = suggestAction(s);
            bad.push(...suggestionProblems(s, sg).map((p) => `${role}/${seed} t${s.turn} after toggle: ${p}`));
          }
          const id = sg?.actionId ?? listAvailableActions(s, role).find((a) => a.ok)!.def.id;
          s = playTurn(s, id, sg?.force ?? 0).state;
        }
        expect(suggestAction(s)).toBeNull();
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  it('sleep-goal player with open eyes → close your eyes', () => {
    for (const role of ['male', 'female'] as Role[]) {
      const s = createGame(role, 1, { playerGoal: 'sleep' });
      expect(suggestAction(s)).toMatchObject({ key: 'closeEyes', eyes: 'closed' });
      expect(suggestAction(s)?.actionId).toBeUndefined();
    }
  });

  it('intimacy-goal player with closed eyes → open your eyes', () => {
    for (const role of ['male', 'female'] as Role[]) {
      const s = toggleEyes(createGame(role, 1, { playerGoal: 'intimacy' }), 'closed').state;
      expect(suggestAction(s)).toMatchObject({ key: 'openEyes', eyes: 'open' });
    }
  });

  it('with closed eyes the hint never depends on the partner\'s hidden stats (annoyance, mood, goal, warmth…)', () => {
    // explicit pair: only the partner's annoyance differs
    const calm = scene({ playerGoal: 'sleep', partnerGoal: 'sleep' }, (_s, me, ai) => {
      me.eyes = 'closed';
      ai.annoyance = 5;
    });
    const angry = structuredClone(calm);
    angry.chars.female.annoyance = 90;
    expect(suggestAction(angry)).toEqual(suggestAction(calm));
    // …whereas with open eyes the angry partner is visible and changes the hint
    const openCalm = structuredClone(calm);
    const openAngry = structuredClone(angry);
    openCalm.chars.male.eyes = openAngry.chars.male.eyes = 'open';
    expect(suggestAction(openAngry)).not.toEqual(suggestAction(openCalm));

    // property over random states
    const rnd = mulberry32(4242);
    const diffs: string[] = [];
    for (let i = 0; i < 4000; i++) {
      const s = randomState(rnd);
      s.chars[s.playerRole].eyes = 'closed';
      const t = structuredClone(s);
      const q = t.chars[partnerOf(t.playerRole)];
      q.annoyance = rnd() * 100;
      q.mood = rnd() * 100;
      q.warmth = rnd() * 100;
      q.restless = rnd() * 100;
      q.goal = q.goal === 'sleep' ? 'intimacy' : 'sleep';
      q.eyes = q.eyes === 'open' ? 'closed' : 'open';
      // sleep may move within what the breathing sound gives away
      const probe = { ...q, sleep: rnd() * 100 };
      if (JSON.stringify(breathRate(probe)) === JSON.stringify(breathRate(q))) q.sleep = probe.sleep;
      const a = suggestAction(s);
      const b = suggestAction(t);
      if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(`#${i}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
      if (diffs.length > 5) break;
    }
    expect(diffs).toEqual([]);
  });

  it('with closed eyes, "lull the partner" is judged by the audible breathing only (review #4)', () => {
    const lull = (sleep: number, posture: 'supine' | 'prone' = 'supine') =>
      suggestAction(
        scene({ playerGoal: 'sleep' }, (_s, me, ai) => {
          me.eyes = 'closed';
          ai.lastAction = 'kiss';
          ai.posture = posture; // 趴睡不打呼:只剩呼吸聲可以判斷
          ai.sleep = sleep;
        }),
      )?.key;
    // 急促/平穩的呼吸 = 還醒著 → 哄睡;緩慢的呼吸 = 睡著了 → 自己睡
    expect(breathRate({ ...createGame('male', 1).chars.female, sleep: 60 }).rate).toBeGreaterThanOrEqual(10);
    expect(lull(60)).toBe('lullPartner');
    expect(lull(60, 'prone')).toBe('lullPartner');
    expect(lull(75)).not.toBe('lullPartner');
    expect(lull(75, 'prone')).not.toBe('lullPartner');
  });

  it('danger first: near the edge → scoot in (urgent); an angry awake partner seen with open eyes → pat (urgent)', () => {
    const edge = scene({ playerGoal: 'sleep' }, (_s, me) => (me.lateral = -0.7));
    expect(suggestAction(edge)).toMatchObject({ key: 'edgeDanger', actionId: 'scootIn', urgent: true, force: greenCenter(edge, 'scootIn') });
    const angry = scene({ playerGoal: 'intimacy' }, (_s, _me, ai) => (ai.annoyance = 60));
    expect(suggestAction(angry)).toMatchObject({ key: 'calmPartner', actionId: 'pat', urgent: true, force: 30 });
    const angryAsleep = scene({ playerGoal: 'intimacy' }, (_s, _me, ai) => {
      ai.annoyance = 60;
      asleep(ai, 80);
    });
    expect(suggestAction(angryAsleep)?.key).not.toBe('calmPartner');
  });

  it('sleep goal: warm up when the next turn would be cold, then the sleep routine', () => {
    const cold = scene({ playerGoal: 'sleep' }, (st, me) => {
      me.eyes = 'closed';
      me.warmth = 35;
      st.blanketOffset = 0.5; // his cover 0.45 → −8 next turn
    });
    expect(suggestAction(cold)).toMatchObject({ key: 'warmUp', actionId: 'pullBlanket', urgent: false });
    const closed = (mut?: (st: GameState) => void) =>
      scene({ playerGoal: 'sleep', partnerGoal: 'sleep' }, (st, me, ai) => {
        me.eyes = 'closed';
        asleep(ai, 80);
        mut?.(st);
      });
    expect(suggestAction(closed())).toMatchObject({ key: 'keepSleeping', actionId: 'sleep' });
    expect(suggestAction(closed((st) => (st.chars.male.restless = 35)))).toMatchObject({ key: 'stayStill', actionId: 'sleep' });
    expect(suggestAction(closed((st) => (st.sleepScore = 7)))).toMatchObject({ key: 'sleepDone', actionId: 'sleep' });
    const pestered = scene({ playerGoal: 'sleep' }, (_s, me, ai) => {
      me.eyes = 'closed';
      ai.lastAction = 'kiss';
    });
    expect(suggestAction(pestered)).toMatchObject({ key: 'lullPartner', actionId: 'pat', force: 30 });
  });

  it('intimacy goal: face them → get close → wake a sleeper firmly → mood → kiss', () => {
    const P = (mut?: (st: GameState) => void) => scene({ playerGoal: 'intimacy' }, (st) => mut?.(st));
    expect(suggestAction(P((st) => (st.chars.male.posture = 'supine')))).toMatchObject({ key: 'faceThem', actionId: 'lieSideFacing' });
    const far = P((st) => {
      st.chars.male.lateral = -0.5;
      st.chars.female.lateral = 0.5;
    });
    expect(suggestAction(far)).toMatchObject({
      key: 'scootCloser',
      actionId: 'scootIn',
    });
    // 睡意 72:T = 47.4,用力的親吻 N = 51 叫得醒 → 建議用力親吻,而且照做真的會吵醒
    const light = P((st) => asleep(st.chars.female, 72));
    const firm = suggestAction(light)!;
    expect(firm).toMatchObject({ key: 'partnerAsleep', actionId: 'kiss' });
    expect(forceBand(forceWindow(light, 'male', 'kiss'), firm.force!)).toBe('firm');
    const woke = playTurn(light, firm.actionId!, firm.force!).events;
    expect(woke).toContainEqual({ type: 'wake', who: 'female', by: 'male' });
    // 睡意 80:T = 51,用力也叫不醒(只剩粗魯)→ 老實說,改建議拉棉被讓對方冷到睡淺
    const deep = P((st) => asleep(st.chars.female, 80));
    expect(suggestAction(deep)).toMatchObject({ key: 'partnerDeepSleep', actionId: 'pullBlanket' });
    const allMine = P((st) => {
      asleep(st.chars.female, 80);
      st.blanketOffset = -1; // 棉被已經都在男方(玩家)這邊
    });
    expect(suggestAction(allMine)).toEqual({ key: 'partnerDeepSleep' });
    expect(suggestAction(P((st) => (st.chars.female.mood = 39)))).toMatchObject({ key: 'cheerUp', actionId: 'whisper' });
    expect(
      suggestAction(
        P((st) => {
          st.memo.clues.sleep = 2;
          st.chars.female.mood = 60;
        }),
      ),
    ).toMatchObject({ key: 'moodUp', actionId: 'tuckBlanket' });
    // 想睡的對方要心情 >= BAL.sleepyMood(75)才正常接受:72 時還要繼續養
    expect(
      suggestAction(
        P((st) => {
          st.memo.clues.sleep = 2;
          st.chars.female.mood = 72;
        }),
      ),
    ).toMatchObject({ key: 'moodUp' });
    expect(suggestAction(P((st) => (st.intimacy = 80)))).toMatchObject({ key: 'almostThere', actionId: 'kiss', force: 35 });
    expect(suggestAction(P())).toMatchObject({ key: 'kiss', actionId: 'kiss', force: 35 });
    expect(suggestAction(P((st) => (st.chars.female.posture = 'sideAway')))).toMatchObject({ key: 'hug', actionId: 'hug', force: 40 });
  });

  it('returns null once the game has ended', () => {
    const s = scene({}, (st, me) => {
      st.turn = 2;
      me.lateral = -0.9;
    });
    const ended = playTurn(s, 'scootOut', 30).state;
    expect(ended.ending).not.toBeNull();
    expect(suggestAction(ended)).toBeNull();
  });
});

describe('goalProgress', () => {
  const sleepAt = (turn: number, score: number) =>
    goalProgress(
      scene({ playerGoal: 'sleep' }, (st) => {
        st.turn = turn;
        st.sleepScore = score;
      }),
    );
  const loveAt = (turn: number, intimacy: number) =>
    goalProgress(
      scene({ playerGoal: 'intimacy' }, (st) => {
        st.turn = turn;
        st.intimacy = intimacy;
      }),
    );

  it('sleep goal: sleepScore toward 7 over the remaining turns', () => {
    expect(goalProgress(createGame('male', 1, { playerGoal: 'sleep' }))).toEqual({ goal: 'sleep', kind: 'sleep', value: 0, target: 7, remainingTurns: 12, status: 'onTrack' });
    expect(sleepAt(2, 0).status).toBe('onTrack'); // need 7 of 10 (≤ 7.5)
    expect(sleepAt(3, 0).status).toBe('tight'); // need 7 > 9 × 0.75
    expect(sleepAt(5, 0).status).toBe('tight'); // need 7 of 7
    expect(sleepAt(6, 0).status).toBe('impossible'); // need 7 of 6
    expect(sleepAt(9, 7).status).toBe('done');
    expect(sleepAt(12, 6.5)).toMatchObject({ remainingTurns: 0, status: 'impossible' });
  });

  it('intimacy goal: intimacy toward 100 (≤ 10/turn on track, ≤ 20/turn tight)', () => {
    expect(goalProgress(createGame('female', 1, { playerGoal: 'intimacy' }))).toEqual({
      goal: 'intimacy',
      kind: 'intimacy',
      value: 10,
      target: 100,
      remainingTurns: 12,
      status: 'onTrack',
    });
    expect(loveAt(3, 10).status).toBe('onTrack'); // 90 of 9 turns
    expect(loveAt(4, 10).status).toBe('tight'); // 90 > 80
    expect(loveAt(7, 10).status).toBe('tight'); // 90 ≤ 100
    expect(loveAt(8, 10).status).toBe('impossible'); // 90 > 80
    expect(loveAt(11, 100).status).toBe('done');
  });
});

describe('clueLean / greenCenter', () => {
  it('clueLean follows the clue majority, null on a tie', () => {
    const lean = (sleep: number, intimacy: number) => clueLean(scene({}, (st) => (st.memo.clues = { sleep, intimacy })));
    expect(lean(0, 0)).toBeNull();
    expect(lean(2, 2)).toBeNull();
    expect(lean(2, 1)).toBe('sleep');
    expect(lean(0, 1)).toBe('intimacy');
  });

  it('greenCenter is the middle of the (possibly eyes-closed) window', () => {
    const s = scene();
    expect(greenCenter(s, 'kiss')).toBe(35);
    expect(greenCenter(s, 'hug')).toBe(40);
    expect(greenCenter(s, 'pat')).toBe(30);
    expect(greenCenter(s, 'pullBlanket')).toBe(50);
    expect(greenCenter(s, 'tuckBlanket')).toBe(33);
    const closed = scene({}, (_s, me) => (me.eyes = 'closed'));
    expect(greenCenter(closed, 'pullBlanket')).toBe(50);
    for (const id of ['kiss', 'hug', 'caress', 'pat', 'pullBlanket', 'tuckBlanket', 'scootIn', 'scootOut', 'withdrawArm'] as const) {
      expect(forceBand(forceWindow(closed, 'male', id), greenCenter(closed, id)), id).toBe('gentle');
    }
  });
});
