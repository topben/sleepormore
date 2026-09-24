// 回合流程(DESIGN §2):createGame / toggleEyes / playTurn。全部是純函式(回傳新 state)。
import { ACTIONS } from './actions';
import { INITIAL, SLEEP_ASLEEP } from './constants';
import { checkEnding } from './endings';
import { choosePartnerAction } from './partner';
import { mulberry32, turnRng } from './rng';
import { bump, emitSpeech, endOfTurn, resolveAction } from './rules';
import { newTally, tallyTurn } from './titles';
import { ZH, type MsgKey } from './text';
import type { ActionId, CharacterState, Ending, Eyes, GameEvent, GameState, Goal, Role, TurnResult } from './types';
import { partnerOf } from './types';
import { cloneState } from './util';

function makeChar(role: Role, goal: Goal, mood: number): CharacterState {
  return {
    role,
    goal,
    posture: 'supine',
    eyes: 'open',
    lateral: role === 'male' ? -INITIAL.lateral : INITIAL.lateral,
    sleep: 0,
    mood,
    annoyance: 0,
    warmth: INITIAL.warmth,
    restless: 0,
    lastAction: null,
  };
}

export interface GameOptions {
  /** 指定玩家目標(練習用);不指定 = 依 seed 隨機 */
  playerGoal?: Goal;
  /** 指定對方目標(測試用) */
  partnerGoal?: Goal;
}

export function createGame(role: Role, seed: number, opts: GameOptions = {}): GameState {
  const r = mulberry32(seed);
  const goals: Record<Role, Goal> = {
    male: r() < 0.5 ? 'sleep' : 'intimacy',
    female: r() < 0.5 ? 'sleep' : 'intimacy',
  };
  const moodM = INITIAL.moodBase + Math.floor(r() * INITIAL.moodSpread);
  const moodF = INITIAL.moodBase + Math.floor(r() * INITIAL.moodSpread);
  if (opts.playerGoal) goals[role] = opts.playerGoal;
  if (opts.partnerGoal) goals[partnerOf(role)] = opts.partnerGoal;
  return {
    turn: 0,
    playerRole: role,
    chars: { male: makeChar('male', goals.male, moodM), female: makeChar('female', goals.female, moodF) },
    blanketOffset: 0,
    intimacy: INITIAL.intimacy,
    embrace: false,
    armPillow: { offered: false, inUse: false, numbness: 0 },
    sleepScore: 0,
    ending: null,
    seed: seed >>> 0,
    memo: {
      lastStareTurn: -99,
      lastSnoreLineTurn: { male: -99, female: -99 },
      numbSpoken: false,
      intimacyHighSpoken: false,
      goodnightSpoken: false,
      tooLateSpoken: false,
      pullStreak: 0,
      pushedOff: false,
      clues: { sleep: 0, intimacy: 0 },
      tally: newTally(),
    },
  };
}

/** 閉眼/張眼切換(不是回合動作,不推進 turn) */
export function toggleEyes(state: GameState, eyes: Eyes): { state: GameState; events: GameEvent[] } {
  if (state.ending) return { state, events: [] };
  const s = cloneState(state);
  const events: GameEvent[] = [];
  const p = s.chars[s.playerRole];
  if (p.eyes === eyes) return { state: s, events };
  const was = p.eyes;
  p.eyes = eyes;
  events.push({ type: 'eyes', who: s.playerRole, eyes });
  if (was === 'closed' && eyes === 'open' && p.sleep >= SLEEP_ASLEEP) {
    bump(p, 'sleep', -20);
    events.push({ type: 'note', who: s.playerRole, text: ZH.msg.wokeYourself, key: 'wokeYourself' });
  }
  return { state: s, events };
}

function finish(s: GameState, ending: Ending, events: GameEvent[], rng: () => number) {
  const P = s.playerRole;
  const AI = partnerOf(P);
  if (ending.id === 'kickedOff') {
    events.push({ type: 'kick', who: AI, target: P });
    emitSpeech(s, AI, 'kick', rng, events);
  } else if (ending.id === 'fellOff') {
    events.push({ type: 'fell', who: P });
    emitSpeech(s, P, 'fellOff', rng, events);
  }
  s.ending = ending;
  events.push({ type: 'ending', ending });
}

export function playTurn(state: GameState, actionId: ActionId, force: number): TurnResult {
  if (state.ending) return { state, intermediate: state, events: [] };
  const s = cloneState(state);
  const events: GameEvent[] = [];
  const rng = turnRng(s.seed, s.turn);
  const P = s.playerRole;
  const AI = partnerOf(P);
  s.memo.pushedOff = false;

  // 1. 玩家
  events.push({ type: 'phase', phase: 'player' });
  const p = s.chars[P];
  const notes: MsgKey[] = [];
  if (p.sleep >= SLEEP_ASLEEP && actionId !== 'sleep') {
    const cat = ACTIONS[actionId].category;
    const d = cat === 'blanket' ? 10 : cat === 'posture' || cat === 'affection' || cat === 'move' || cat === 'arm' ? 20 : 0;
    if (d > 0) {
      bump(p, 'sleep', -d);
      notes.push(cat === 'affection' || cat === 'arm' || cat === 'blanket' ? 'rubEyes' : 'wokeYourself');
    }
  }
  resolveAction(s, P, actionId, force, rng, events, { notes });

  // 2. 即時結局(被踢、掉床)
  const mid = checkEnding(s, 'mid');
  if (mid) {
    finish(s, mid, events, rng);
    tallyTurn(s, events, s.turn + 1);
    return { state: s, intermediate: s, events };
  }
  const intermediate = cloneState(s);

  // 3. 對方
  events.push({ type: 'phase', phase: 'partner' });
  const choice = choosePartnerAction(s, rng);
  const { actionId: aiAction, force: aiForce, ...opts } = choice;
  if (opts.speech === 'goodnight') s.memo.goodnightSpoken = true;
  s.memo.pullStreak = aiAction === 'pullBlanket' && opts.unconscious ? s.memo.pullStreak + 1 : 0;
  resolveAction(s, AI, aiAction, aiForce, rng, events, opts);

  // 4. 回合末
  events.push({ type: 'phase', phase: 'endOfTurn' });
  endOfTurn(s, rng, events);

  // 5. 推進時間 + 全表結局
  s.turn += 1;
  events.push({ type: 'turnEnd', turn: s.turn });
  const end = checkEnding(s, 'end');
  if (end) finish(s, end, events, rng);
  tallyTurn(s, events);
  return { state: s, intermediate, events };
}

/** 把 events 依 phase 切段(scene / UI 分段播放用) */
export function splitPhases(events: GameEvent[]): Record<'player' | 'partner' | 'endOfTurn', GameEvent[]> {
  const out = { player: [] as GameEvent[], partner: [] as GameEvent[], endOfTurn: [] as GameEvent[] };
  let cur: keyof typeof out = 'player';
  for (const e of events) {
    if (e.type === 'phase') {
      cur = e.phase;
      continue;
    }
    out[cur].push(e);
  }
  return out;
}
