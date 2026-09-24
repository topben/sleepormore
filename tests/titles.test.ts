// 組合結局:行為統計、睡姿人格、64 組合與稀有度(src/game/titles.ts)
import { describe, expect, it } from 'vitest';
import { canUse, listAvailableActions } from '../src/game/actions';
import { mulberry32 } from '../src/game/rng';
import {
  COMBO_IDS,
  comboOf,
  comboRarity,
  EDGE_LATERAL,
  newTally,
  personaOf,
  PERSONAS,
  type Persona,
  type Rarity,
} from '../src/game/titles';
import { createGame, playTurn, toggleEyes } from '../src/game/turn';
import type { ActionId, GameState, Role } from '../src/game/types';
import { partnerOf } from '../src/game/types';
import { scene } from './helpers';

/** 只改玩家的統計,其他歸零(人格只看「比一般人突出」的那一項) */
function withTally(mutate: (s: GameState) => void, role: Role = 'male'): GameState {
  const s = scene({ role });
  s.memo.tally = newTally();
  mutate(s);
  return s;
}

describe('tally: playTurn keeps per-game counters', () => {
  it('counts the player’s actions, posture changes and turns asleep', () => {
    let s = scene({ role: 'female' });
    s = playTurn(s, 'whisper', 0).state;
    s = playTurn(s, 'whisper', 0).state;
    s = playTurn(s, 'lieSupine', 0).state;
    const t = s.memo.tally.female;
    expect(t.acts.whisper).toBe(2);
    expect(t.acts.lieSupine).toBe(1);
    expect(t.turned).toBeGreaterThanOrEqual(1);
    // 對方(AI)的動作記在對方身上
    const aiActs = Object.values(s.memo.tally.male.acts).reduce((a, b) => a + (b ?? 0), 0);
    expect(aiActs).toBe(3);
  });

  it('counts turns spent on the bed edge and the first turn asleep', () => {
    let s = scene({ role: 'male' }, (st) => {
      st.chars.male.lateral = -(EDGE_LATERAL + 0.05);
    });
    s = toggleEyes(s, 'closed').state;
    for (let i = 0; i < 3 && !s.ending; i++) s = playTurn(s, 'sleep', 0).state;
    const t = s.memo.tally.male;
    expect(t.edge).toBeGreaterThan(0);
    expect(t.acts.sleep).toBe(3);
    if (s.chars.male.sleep >= 70) expect(t.asleepAt).toBeGreaterThan(0);
  });
});

describe('persona: the most outstanding behaviour of the night', () => {
  const cases: [Persona, (s: GameState) => void][] = [
    ['bandit', (s) => (s.memo.tally.male.acts.pullBlanket = 6)],
    ['talker', (s) => (s.memo.tally.male.acts.whisper = 6)],
    ['koala', (s) => (s.memo.tally.male.acts = { hug: 3, kiss: 3, caress: 3 })],
    ['nanny', (s) => (s.memo.tally.male.acts = { pat: 5, tuckBlanket: 3 })],
    ['sleeper', (s) => Object.assign(s.memo.tally.male, { slept: 10, snored: 4, asleepAt: 2 })],
    ['faker', (s) => Object.assign(s.memo.tally.male, { faked: 8, caught: 2 })],
    ['spinner', (s) => (s.memo.tally.male.turned = 9)],
    ['iceberg', (s) => (s.memo.tally.male.acts = { lieSideAway: 3, scootOut: 3 })],
  ];
  for (const [p, mutate] of cases) {
    it(`${p}`, () => expect(personaOf(withTally(mutate), 'male')).toBe(p));
  }

  it('the partner is judged against the partner’s own baseline (a little turning over is already a lot for the AI)', () => {
    const s = withTally((st) => (st.memo.tally.female.turned = 4));
    expect(personaOf(s, 'female')).toBe('spinner');
  });

  it('really falling asleep is not faking: long sleep outweighs the eyes-closed-awake turns before it', () => {
    const s = withTally((st) => Object.assign(st.memo.tally.male, { faked: 3, slept: 8, asleepAt: 4 }));
    expect(personaOf(s, 'male')).toBe('sleeper');
  });
});

describe('combos: 8 × 8 = 64, each with a rarity', () => {
  it('ids and grid indexes are unique and cover all 64', () => {
    expect(COMBO_IDS).toHaveLength(64);
    expect(new Set(COMBO_IDS).size).toBe(64);
    const seen = new Set<number>();
    for (const a of PERSONAS) {
      for (const b of PERSONAS) {
        const id = `${a}_${b}`;
        const index = PERSONAS.indexOf(a) * 8 + PERSONAS.indexOf(b);
        expect(COMBO_IDS[index]).toBe(id);
        seen.add(index);
      }
    }
    expect(seen.size).toBe(64);
  });

  it('comboOf pairs the player’s persona (row) with the partner’s (column)', () => {
    const s = withTally((st) => {
      st.memo.tally.female.acts.whisper = 6; // 玩家 = female
      st.memo.tally.male.turned = 5; // 對方(AI)翻來翻去
    }, 'female');
    const c = comboOf(s);
    expect(c).toMatchObject({ me: 'talker', partner: 'spinner', id: 'talker_spinner' });
    expect(COMBO_IDS[c.index]).toBe(c.id);
  });

  it('rarity tiers: 24 common, 20 rare, 12 super rare, 8 legendary', () => {
    const count: Record<Rarity, number> = { N: 0, R: 0, SR: 0, SSR: 0 };
    for (const id of COMBO_IDS) count[comboRarity(id)] += 1;
    expect(count).toEqual({ N: 24, R: 20, SR: 12, SSR: 8 });
  });
});

describe('every persona shows up for both the player and the partner (simulated nights)', () => {
  type Pick = { id: ActionId; force: number; eyes?: 'open' | 'closed' };
  const random = (s: GameState, r: () => number): Pick => {
    const ok = listAvailableActions(s, s.playerRole).filter((a) => a.ok);
    return { id: ok[Math.floor(r() * ok.length)].def.id, force: 20 + Math.floor(r() * 60), eyes: r() < 0.2 ? (r() < 0.5 ? 'open' : 'closed') : undefined };
  };
  /** 偏好某些動作的玩家(70% 照偏好,其餘隨機) */
  const styled =
    (ids: ActionId[], eyes?: 'open' | 'closed') =>
    (s: GameState, r: () => number): Pick => {
      const id = r() < 0.7 ? ids.find((x) => canUse(s, s.playerRole, x)) : undefined;
      return id ? { id, force: 35, eyes } : random(s, r);
    };
  const STYLES = [
    random,
    styled(['pullBlanket']),
    styled(['whisper']),
    styled(['lieSideFacing', 'hug', 'kiss', 'caress'], 'open'),
    styled(['pat', 'tuckBlanket']),
    styled(['sleep'], 'closed'),
    styled(['lieSideAway', 'lieSupine', 'lieSideFacing']),
    styled(['lieSideAway', 'scootOut']),
    styled(['sleep', 'lieSideAway', 'lieSupine'], 'closed'),
  ];

  it('600 nights reach all 8 personas on each side', () => {
    const r = mulberry32(2024);
    const mine = new Set<Persona>();
    const theirs = new Set<Persona>();
    for (let i = 0; i < 600; i++) {
      const role: Role = i % 2 ? 'male' : 'female';
      const policy = STYLES[i % STYLES.length];
      let s = createGame(role, 1000 + i);
      for (let guard = 0; !s.ending && guard < 20; guard++) {
        const d = policy(s, r);
        if (d.eyes && s.chars[role].eyes !== d.eyes) s = toggleEyes(s, d.eyes).state;
        s = playTurn(s, d.id, d.force).state;
      }
      mine.add(personaOf(s, role));
      theirs.add(personaOf(s, partnerOf(role)));
    }
    expect([...mine].sort()).toEqual([...PERSONAS].sort());
    expect([...theirs].sort()).toEqual([...PERSONAS].sort());
  });
});
