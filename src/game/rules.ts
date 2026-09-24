// 規則核心:§1 衍生純函式、§3 力道、§4 噪音與吵醒、§5 動作結算、§6 回合末結算;困難模式的差異見 §15。
// resolveAction / endOfTurn 直接修改傳入的 state(呼叫端 turn.ts 負責先 clone)。
import { ACTIONS, POSTURE_OF, checkAction, isAffection } from './actions';
import {
  AI_LATERAL_MAX,
  BAL,
  BANDS,
  CENTER_MIN,
  CLOSED_EYES_NOISE,
  CLOSED_EYES_PULL_WINDOW,
  COLD,
  COMFORT,
  EDGE_WARN,
  FIRM_ANNOY,
  FIRM_SPAN,
  HARD,
  NUMB_PER_TURN,
  RESTLESS_NOTICE,
  ROUGH_ANNOY,
  SCOOT_MIN_DISTANCE,
  SLEEP_ASLEEP,
  SLEEP_AWAKE,
  SNORE_NOISE,
  WAKE_CHECK_MIN,
} from './constants';
import type { Rng } from './rng';
import { CLUE_OF, lineClue, pickLine, type SpeechKey } from './speech';
import { ZH, type MsgKey } from './text';
import type { ActionId, CharacterState, Eyes, ForceBand, GameEvent, GameState, Goal, Posture, Role } from './types';
import { partnerOf } from './types';
import { clamp, clamp100, coverOf, distanceOf, sideSign } from './util';

const ROLES: Role[] = ['male', 'female'];
const round1 = (v: number) => Math.round(v * 10) / 10;

// ───────────────────────── 衍生純函式(scene / UI 也用) ─────────────────────────

/** 裝睡:上一動作是 sleep 但其實還醒著 */
export const isFakingSleep = (c: CharacterState): boolean => c.lastAction === 'sleep' && c.sleep < SLEEP_AWAKE;

/** 呼吸頻率(次/分)。裝睡 = 14 且完全等幅(regular) */
export function breathRate(c: CharacterState): { rate: number; regular: boolean } {
  if (isFakingSleep(c)) return { rate: 14, regular: true };
  if (c.sleep < SLEEP_AWAKE) return { rate: 16, regular: false };
  if (c.sleep < SLEEP_ASLEEP) return { rate: 12, regular: false };
  if (c.sleep < 100) return { rate: 8, regular: false };
  return { rate: 6, regular: false };
}

export function snoreLevel(c: CharacterState): 0 | 1 | 2 | 3 {
  if (c.sleep < SLEEP_ASLEEP || c.posture === 'prone') return 0;
  if (c.posture === 'supine') return c.sleep >= 90 ? 3 : 2;
  return 1;
}

export const isHard = (s: GameState): boolean => s.mode === 'hard';

export interface Comfort {
  hot: boolean;
  cold: boolean;
  /** 親密度不夠,睡不安穩(困難模式) */
  lonely: boolean;
}

/** 舒適度:困難模式依體質(COMFORT);簡單模式只有「冷」(warmth < 30) */
export function comfortOf(s: GameState, r: Role): Comfort {
  const c = s.chars[r];
  if (!isHard(s)) return { hot: false, cold: c.warmth < COLD, lonely: false };
  const k = COMFORT[r];
  return { hot: c.warmth > k.warmHi, cold: c.warmth < k.warmLo, lonely: s.intimacy < k.intimacy };
}

/** 困難模式:體溫會靠攏的目標(蓋被比例、深夜變冷、抱著 / 枕著手臂的體溫) */
export function warmthTarget(s: GameState, r: Role): number {
  let t = HARD.warmBase + coverOf(r, s.blanketOffset) * HARD.warmCover;
  if (s.turn >= HARD.chillTurn) t -= HARD.chill;
  if (s.embrace) t += HARD.hugHeat;
  if (s.armPillow.inUse) t += HARD.pillowHeat;
  return t;
}

export const isComfy = (s: GameState, r: Role): boolean => {
  const k = comfortOf(s, r);
  return !k.hot && !k.cold && !k.lonely;
};

/**
 * 對方 AI 行為上的目標(困難模式):立即親熱的對方過了時限就放棄去睡;
 * 早上親熱的對方天亮前像想睡的人一樣先睡。其他情況 = 真正的目標。
 */
export function behaviorGoal(s: GameState, r: Role): Goal {
  const c = s.chars[r];
  if (!isHard(s) || c.goal !== 'intimacy') return c.goal;
  if (c.timing === 'now' && s.turn >= HARD.nowDeadline) return 'sleep';
  if (c.timing === 'morning' && s.turn < HARD.wakeTurn) return 'sleep';
  return 'intimacy';
}

/** AI 只看表象判斷玩家睡了沒 */
export const apparentlyAsleep = (c: CharacterState): boolean =>
  c.eyes === 'closed' && (c.sleep >= SLEEP_ASLEEP || c.lastAction === 'sleep') && c.restless < RESTLESS_NOTICE;

/** §4 吵醒門檻 T;睡意 < 45 → Infinity(不會被吵醒) */
export const wakeThreshold = (c: CharacterState): number => (c.sleep >= WAKE_CHECK_MIN ? 15 + 0.45 * c.sleep : Infinity);

export const receptive = (c: CharacterState): boolean => c.sleep < SLEEP_ASLEEP && c.annoyance < 50 && c.mood >= 40;

export const sleepyDecline = (c: CharacterState): boolean => c.goal === 'sleep' && c.mood < BAL.sleepyMood;

/** AI 的眼睛:睡著或剛選了 sleep → 閉眼 */
export const aiEyes = (c: CharacterState): Eyes => (c.sleep >= SLEEP_ASLEEP || c.lastAction === 'sleep' ? 'closed' : 'open');

/** 綠區(玩家閉眼時 pullBlanket 縮成 [40,60]) */
export function forceWindow(s: GameState, actor: Role, id: ActionId): [number, number] {
  if (id === 'pullBlanket' && actor === s.playerRole && s.chars[actor].eyes === 'closed') return [...CLOSED_EYES_PULL_WINDOW];
  return [...ACTIONS[id].forceWindow];
}

export function forceBand(win: readonly [number, number], f: number): ForceBand {
  const [lo, hi] = win;
  if (f < lo) return 'timid';
  if (f <= hi) return 'gentle';
  if (f <= hi + FIRM_SPAN) return 'firm';
  return 'rough';
}

const flatOrFacing = (p: Posture) => p === 'supine' || p === 'sideFacing';

/** baseNoise + 狀態加成(§5 註明)+ 玩家閉眼蓄力 +5 */
export function effectiveNoise(s: GameState, actor: Role, id: ActionId): number {
  const def = ACTIONS[id];
  const c = s.chars[actor];
  const ap = s.armPillow;
  let n = def.baseNoise;
  if (id === 'withdrawArm' && ap.inUse) n += 10;
  const target = POSTURE_OF[id];
  if (target) {
    if (actor === 'female' && ap.inUse && !flatOrFacing(target)) n += 5;
    if (actor === 'male' && ap.offered && !flatOrFacing(target)) n += 10;
    if (actor === 'male' && ap.inUse && flatOrFacing(c.posture) && flatOrFacing(target)) n += 5;
  }
  if (def.usesForce && actor === s.playerRole && c.eyes === 'closed') n += CLOSED_EYES_NOISE;
  return n;
}

/** 以 gentle 執行時的 N(UI 標示按鈕顏色用) */
export const projectedNoise = (s: GameState, actor: Role, id: ActionId): number => effectiveNoise(s, actor, id);

export type NoiseRisk = 'safe' | 'risky' | 'loud';

/** 綠 = N < 0.8T、黃 = 0.8T ≤ N ≤ T、紅 = N > T;對方未達 45 睡意 → 一律綠 */
export function noiseRisk(s: GameState, actor: Role, id: ActionId, noise = projectedNoise(s, actor, id)): NoiseRisk {
  const T = wakeThreshold(s.chars[partnerOf(actor)]);
  if (!Number.isFinite(T) || noise < T * 0.8) return 'safe';
  return noise <= T ? 'risky' : 'loud';
}

// ───────────────────────── 小工具 ─────────────────────────

type Stat = 'sleep' | 'mood' | 'annoyance' | 'warmth' | 'restless';
export function bump(c: CharacterState, k: Stat, d: number): void {
  c[k] = clamp100(c[k] + d);
}
const bumpIntimacy = (s: GameState, d: number) => {
  s.intimacy = clamp100(s.intimacy + d);
};

/** 說一句話(從池裡挑);對方(AI)說出的線索台詞會記入 memo.clues */
export function emitSpeech(s: GameState, who: Role, key: SpeechKey, rng: Rng, events: GameEvent[]): void {
  const { index, text } = pickLine(key, rng);
  events.push({ type: 'speech', who, text, key, index });
  const goal = lineClue(key, index);
  if (goal && who !== s.playerRole) addClue(s, goal, events);
}

function addClue(s: GameState, goal: Goal, events: GameEvent[]) {
  s.memo.clues[goal] += 1;
  events.push({ type: 'clue', goal });
}

/** AI eyes 依規則重算,改變時發事件 */
export function syncAiEyes(s: GameState, events: GameEvent[]): void {
  const ai = partnerOf(s.playerRole);
  const c = s.chars[ai];
  const e = aiEyes(c);
  if (c.eyes !== e) {
    c.eyes = e;
    events.push({ type: 'eyes', who: ai, eyes: e });
  }
}

/**
 * §4 噪音:對 target 套用噪音 N。回傳是否吵醒與該說的台詞 key。
 * 不發事件(呼叫端決定事件順序)。
 */
export function applyNoise(s: GameState, target: Role, N: number, fromPull = false): { woke: boolean; key?: SpeechKey } {
  if (!(N > 0)) return { woke: false };
  const B = s.chars[target];
  if (B.sleep >= WAKE_CHECK_MIN) {
    const T = 15 + 0.45 * B.sleep;
    if (N > T) {
      B.sleep = Math.max(0, B.sleep - (N - T) * 1.5 - 10);
      bump(B, 'annoyance', 8 + (N - T) / 2);
      bump(B, 'mood', -5);
      const key: SpeechKey = fromPull ? 'coldAwake' : B.annoyance < 50 ? 'wake' : 'wakeAngry';
      return { woke: true, key };
    }
    bump(B, 'sleep', -N * 0.15);
  } else if (B.sleep >= SLEEP_AWAKE) {
    bump(B, 'sleep', -N * 0.15);
  }
  return { woke: false };
}

// ───────────────────────── §5 動作結算 ─────────────────────────

export interface ResolveOpts {
  /** 額外噪音(AI 夢話 +8) */
  noiseBonus?: number;
  /** 行動者自己附帶的台詞(AI 的 okFine、partnerInitiate…) */
  speech?: SpeechKey;
  /** 額外 note key(自己弄醒、AI 睡夢中搶棉被…) */
  notes?: MsgKey[];
  /** 睡著的 AI 無意識動作:不扣自己睡意、不加翻身指數 */
  unconscious?: boolean;
  /** 困難模式:早上親熱的對方天亮自己醒來(睡意壓到 HARD.wakeSleep) */
  wakeUp?: boolean;
}

/** AI 行為本身透露的線索(沒有台詞線索時才算) */
function actionClue(id: ActionId): Goal | null {
  if (id === 'hug' || id === 'kiss' || id === 'caress' || id === 'offerArm') return 'intimacy';
  if (id === 'pat') return 'sleep';
  return null;
}

export function resolveAction(
  s: GameState,
  actor: Role,
  id: ActionId,
  force: number,
  rng: Rng,
  events: GameEvent[],
  opts: ResolveOpts = {},
): void {
  const def = ACTIONS[id];
  const bRole = partnerOf(actor);
  const A = s.chars[actor];
  const B = s.chars[bRole];
  const ap = s.armPillow;
  const isPlayer = actor === s.playerRole;
  const aiRole = partnerOf(s.playerRole);
  const unconscious = !!opts.unconscious;
  if (opts.wakeUp) A.sleep = Math.min(A.sleep, HARD.wakeSleep);
  // 困難模式:早晨的親熱加倍甜(只加成動作帶來的親密度)
  const boost = isHard(s) && s.turn >= HARD.wakeTurn ? HARD.morningBoost : 1;
  const love = (d: number) => bumpIntimacy(s, d > 0 ? d * boost : d);

  const f = def.usesForce ? clamp(Number.isFinite(force) ? force : 0, 0, 100) : 0;
  const band: ForceBand = def.usesForce ? forceBand(forceWindow(s, actor, id), f) : 'gentle';
  const { eff, noise: mult } = BANDS[band];
  const rough = band === 'rough';
  const notes: MsgKey[] = [...(opts.notes ?? [])];
  const sub: GameEvent[] = [];
  const lines = new Map<Role, { key: SpeechKey; prio: number }>();
  const say = (who: Role, key: SpeechKey, prio = 50) => {
    const cur = lines.get(who);
    if (!cur || prio > cur.prio) lines.set(who, { key, prio });
  };

  const before = {
    male: { a: s.chars.male.annoyance, m: s.chars.male.mood },
    female: { a: s.chars.female.annoyance, m: s.chars.female.mood },
  };
  const intimacyBefore = s.intimacy;

  const setPosture = (who: Role, p: Posture) => {
    if (s.chars[who].posture === p) return;
    s.chars[who].posture = p;
    sub.push({ type: 'posture', who, posture: p });
  };
  const setLateral = (who: Role, v: number) => {
    const lim = who === s.playerRole ? 1 : AI_LATERAL_MAX;
    const nv = clamp(v, -lim, lim);
    if (Math.abs(nv - s.chars[who].lateral) < 1e-9) return;
    s.chars[who].lateral = nv;
    sub.push({ type: 'move', who, lateral: nv });
  };
  const setEmbrace = (on: boolean) => {
    if (s.embrace === on) return;
    s.embrace = on;
    sub.push({ type: 'embrace', on });
  };
  const armEvt = () => sub.push({ type: 'armPillow', offered: ap.offered, inUse: ap.inUse });
  /** 擁抱成立時兩人往中間收攏 */
  const gather = () => {
    setLateral('male', Math.max(s.chars.male.lateral, -0.15));
    setLateral('female', Math.min(s.chars.female.lateral, 0.15));
  };

  // (1) 噪音前的判斷
  const bAsleep = B.sleep >= SLEEP_ASLEEP;
  const bRecv = receptive(B);
  const bDecline = sleepyDecline(B);
  const bSnore0 = snoreLevel(B);
  const refuseKey: SpeechKey = before[bRole].a >= 50 ? 'refuseAnnoyed' : 'refuseMood';

  const avail = checkAction(s, actor, id);
  let success = avail.ok;
  const N = avail.ok ? (effectiveNoise(s, actor, id) + (opts.noiseBonus ?? 0)) * mult : def.baseNoise * 0.5 * mult;
  if (!avail.ok) notes.push((avail.reasonKey ?? 'notAllowed') as MsgKey);

  // (2) 力道的火氣
  if (band === 'firm' && !bAsleep) bump(B, 'annoyance', FIRM_ANNOY);
  if (rough) {
    bump(B, 'annoyance', ROUGH_ANNOY);
    notes.push('tooRough');
  }

  // (3) 噪音 / 吵醒
  const nz = applyNoise(s, bRole, N, id === 'pullBlanket');
  const woke = nz.woke;
  if (woke) {
    sub.push({ type: 'wake', who: bRole, by: actor });
    say(bRole, nz.key!, 80);
  }

  // (4) 分支效果
  if (avail.ok) {
    switch (id) {
      case 'lieSupine':
      case 'lieSideFacing':
      case 'lieSideAway':
      case 'lieProne': {
        const target = POSTURE_OF[id]!;
        setPosture(actor, target);
        if (!unconscious) {
          bump(A, 'restless', 35);
          if (A.sleep >= SLEEP_AWAKE) bump(A, 'sleep', -8);
        }
        if (s.embrace && target !== 'sideFacing') {
          setEmbrace(false);
          if (B.goal === 'intimacy' && !bAsleep) bump(B, 'mood', -5);
        }
        if (id === 'lieSideAway' && B.goal === 'intimacy' && !bAsleep) bump(B, 'mood', -3);
        if (actor === 'female' && ap.inUse && !flatOrFacing(target)) {
          ap.inUse = false;
          armEvt();
        }
        if (actor === 'male' && ap.offered && !flatOrFacing(target)) {
          ap.offered = false;
          ap.inUse = false;
          ap.numbness = 0;
          armEvt();
        }
        break;
      }

      case 'hug': {
        if (!bAsleep) {
          if (bRecv && !rough) {
            const k = bDecline ? 0.5 : 1;
            if (bDecline) {
              bump(B, 'annoyance', 6);
              say(bRole, 'sleepyDecline');
            } else say(bRole, 'receptiveHug');
            setEmbrace(true);
            love(8 * eff * k);
            bump(B, 'mood', 5 * k);
            gather();
            bump(B, 'sleep', -5);
          } else {
            bump(B, 'annoyance', 8);
            say(bRole, refuseKey);
          }
        } else if (!woke) {
          if (!rough) {
            setEmbrace(true);
            love(3);
            notes.push('sneakHug');
          }
          bump(B, 'sleep', -5);
        } else if (B.goal === 'intimacy') {
          if (!rough) {
            setEmbrace(true);
            love(6);
            bump(B, 'mood', 8);
            gather();
          }
        } else {
          bump(B, 'annoyance', 12);
        }
        break;
      }

      case 'kiss':
      case 'caress': {
        const kiss = id === 'kiss';
        if (!bAsleep) {
          // 粗魯 = 被拒絕:正面效果取消,只留拒絕的負面效果
          if (bRecv && !rough) {
            const k = bDecline ? 0.5 : 1;
            if (bDecline) {
              bump(B, 'annoyance', 6);
              say(bRole, 'sleepyDecline');
            } else say(bRole, kiss ? 'receptiveKiss' : 'receptiveCaress');
            love((kiss ? 12 : 10) * eff * k);
            bump(B, 'mood', (kiss ? 6 : 4) * k);
            bump(B, 'sleep', -5);
            if (kiss && band === 'timid') notes.push('ticklish');
          } else {
            bump(B, 'annoyance', kiss ? 10 : 8);
            bump(B, 'mood', kiss ? -3 : -2);
            say(bRole, refuseKey);
          }
        } else if (!woke) {
          if (!rough) {
            love(2);
            notes.push(kiss ? 'sneakKiss' : 'sneakCaress');
          }
          bump(B, 'sleep', -5);
        } else if (B.goal === 'intimacy') {
          if (!rough) {
            bump(B, 'mood', 8);
            love(6);
          }
        } else {
          bump(B, 'annoyance', 12);
        }
        break;
      }

      case 'whisper': {
        if (!bAsleep) {
          if (bRecv) {
            bump(B, 'mood', 6);
            love(4);
            say(bRole, 'whisperReply');
          } else {
            bump(B, 'annoyance', 3);
            say(bRole, refuseKey);
          }
        }
        break;
      }

      case 'pat': {
        if (rough) break; // 正面效果全取消;火氣 +15 與吵醒判定已處理
        bump(B, 'annoyance', -12 * eff);
        bump(B, 'sleep', BAL.patSleep * eff);
        bump(B, 'mood', 2);
        if (B.goal === 'intimacy' && !bAsleep) {
          love(2);
          say(bRole, 'patReply');
        }
        if (bAsleep && !woke && bSnore0 >= 2) {
          // 拍一下就翻身:牽涉擁抱/手臂時翻向對方,避免拆散
          const safe = s.embrace || ap.offered || ap.inUse;
          setPosture(bRole, safe || rng() < 0.5 ? 'sideFacing' : 'sideAway');
          notes.push('patRollOver');
        }
        break;
      }

      case 'offerArm': {
        ap.offered = true;
        armEvt();
        say(actor, 'armOffered');
        break;
      }

      case 'restOnArm': {
        ap.inUse = true;
        armEvt();
        love(5);
        bump(s.chars.male, 'mood', 4);
        setLateral('female', Math.min(s.chars.female.lateral, 0.15));
        setPosture('female', 'sideFacing');
        if (!unconscious) bump(A, 'restless', 15);
        say(actor, 'armAccepted');
        break;
      }

      case 'leaveArm': {
        ap.inUse = false;
        armEvt();
        bump(A, 'restless', 15);
        if (ap.numbness >= 50) {
          bump(s.chars.male, 'mood', 3);
          bump(s.chars.male, 'annoyance', -5);
          say('male', 'armRelieved');
        }
        break;
      }

      case 'withdrawArm': {
        if (band === 'timid' && ap.inUse) {
          success = false;
          notes.push('armStuck');
          break;
        }
        const wasInUse = ap.inUse;
        ap.offered = false;
        ap.inUse = false;
        ap.numbness = 0;
        armEvt();
        if (wasInUse && !bAsleep) bump(B, 'mood', -3);
        break;
      }

      case 'pullBlanket': {
        let move = 0.3 * eff;
        if (actor === 'male' && ap.inUse) {
          move *= 0.6;
          notes.push('oneHandPull');
        }
        s.blanketOffset = clamp(s.blanketOffset + sideSign(actor) * move, -1, 1);
        sub.push({ type: 'blanket', offset: s.blanketOffset });
        if (coverOf(bRole, s.blanketOffset) < 0.5) {
          if (!bAsleep) {
            bump(B, 'mood', -4);
            say(bRole, 'blanketPulled');
          } else if (woke) {
            bump(B, 'annoyance', 10);
          }
        }
        if (!unconscious) bump(A, 'restless', 10);
        break;
      }

      case 'tuckBlanket': {
        const o0 = s.blanketOffset;
        s.blanketOffset = clamp(o0 - sideSign(actor) * 0.25 * eff, -1, 1);
        sub.push({ type: 'blanket', offset: s.blanketOffset });
        if (Math.abs(s.blanketOffset - o0) >= 0.05 && !bAsleep && !rough) {
          bump(B, 'mood', 5);
          love(3);
          say(bRole, 'blanketTucked');
        }
        break;
      }

      case 'scootIn': {
        let lat = A.lateral - sideSign(actor) * 0.2 * eff;
        lat = actor === 'male' ? Math.min(lat, -CENTER_MIN) : Math.max(lat, CENTER_MIN);
        setLateral(actor, lat);
        if (distanceOf(s) < SCOOT_MIN_DISTANCE) {
          if (bRecv) {
            if (!rough) bump(B, 'mood', 2);
          } else bump(B, 'annoyance', 4);
        }
        if (!unconscious) bump(A, 'restless', 20);
        break;
      }

      case 'scootOut': {
        setLateral(actor, A.lateral + sideSign(actor) * 0.2 * eff);
        setEmbrace(false);
        if (actor === 'female' && ap.inUse) {
          ap.inUse = false;
          armEvt();
        }
        if (Math.abs(A.lateral) >= 1) notes.push(isPlayer ? 'fellOffEdge' : 'partnerFellEdge');
        else if (Math.abs(A.lateral) >= EDGE_WARN) notes.push(isPlayer ? 'edgePlayer' : 'edgePartner');
        if (!unconscious) bump(A, 'restless', 20);
        break;
      }

      case 'sleep': {
        let gain = A.sleep >= SLEEP_ASLEEP ? 12 : 18;
        const cf = comfortOf(s, actor);
        if (cf.cold) {
          gain *= isHard(s) ? HARD.coldSleep : 0.5;
          notes.push('sleepCold');
        }
        if (cf.hot) {
          gain *= HARD.hotSleep;
          notes.push('sleepHot');
        }
        if (cf.lonely) {
          gain *= HARD.lonelySleep;
          notes.push('sleepLonely');
        }
        if (A.mood < 40) {
          gain *= 0.75;
          notes.push('sleepBadMood');
        }
        if (actor === 'male' && ap.inUse) {
          gain *= 0.75;
          notes.push('sleepArmPinned');
        }
        if (s.embrace) gain += 4;
        if (actor === 'male' && ap.numbness >= 75) gain = Math.min(gain, 8);
        bump(A, 'sleep', gain);
        break;
      }

      case 'push': {
        setLateral(bRole, B.lateral + sideSign(bRole) * 0.35);
        setPosture(actor, 'sideAway');
        setEmbrace(false);
        if (ap.inUse || ap.offered) {
          ap.inUse = false;
          ap.offered = false;
          armEvt();
        }
        bump(A, 'annoyance', -20);
        say(actor, 'push');
        sub.push({ type: 'push', who: actor, target: bRole });
        if (bRole === s.playerRole && Math.abs(B.lateral) >= 1) s.memo.pushedOff = true;
        break;
      }
    }
  }

  if (rough && B.sleep < SLEEP_ASLEEP) say(bRole, 'roughComplaint', 100);
  if (opts.speech) say(actor, opts.speech, 60);
  A.lastAction = id;

  // 親密度門檻
  const ai = s.chars[aiRole];
  if (s.intimacy >= 100 && intimacyBefore < 100 && ai.sleep >= SLEEP_ASLEEP) {
    notes.push('tooLateAsleep');
    if (!s.memo.tooLateSpoken) {
      s.memo.tooLateSpoken = true;
      say(s.playerRole, 'tooLate', 40);
    }
  }

  // ── 事件輸出:action → 狀態變化 → 數值 delta → 台詞 → 眼睛 ──
  events.push({
    type: 'action',
    who: actor,
    action: id,
    force: round1(f),
    band,
    noise: round1(N),
    success,
    ...(notes.length ? { note: notes.map((k) => ZH.msg[k]).join(','), noteKeys: notes } : {}),
  });
  events.push(...sub);
  // 數值變化事件(四捨五入到 0.1;四捨五入後為 0 的極小變化不發)
  for (const r of ROLES) {
    const da = round1(s.chars[r].annoyance - before[r].a);
    if (da !== 0) events.push({ type: 'annoyed', who: r, delta: da });
    const dm = round1(s.chars[r].mood - before[r].m);
    if (dm !== 0) events.push({ type: 'mood', who: r, delta: dm });
  }
  const di = round1(s.intimacy - intimacyBefore);
  if (di !== 0) events.push({ type: 'intimacy', delta: di });

  const aiSpokeClue = (() => {
    const l = lines.get(aiRole);
    return !!(l && CLUE_OF[l.key]);
  })();
  for (const who of [actor, bRole]) {
    const l = lines.get(who);
    if (l) emitSpeech(s, who, l.key, rng, events);
  }
  if (!isPlayer && !aiSpokeClue) {
    const g = actionClue(id);
    if (g) addClue(s, g, events);
  }
  if (s.intimacy >= 60 && !s.memo.intimacyHighSpoken) {
    const speaker = ai.sleep < SLEEP_ASLEEP ? aiRole : s.playerRole;
    if (!lines.has(speaker)) {
      s.memo.intimacyHighSpoken = true;
      emitSpeech(s, speaker, 'intimacyHigh', rng, events);
    }
  }
  syncAiEyes(s, events);
}

// ───────────────────────── §6 回合末 ─────────────────────────

export function endOfTurn(s: GameState, rng: Rng, events: GameEvent[]): void {
  const P = s.playerRole;
  const AI = partnerOf(P);
  const say = (who: Role, key: SpeechKey) => emitSpeech(s, who, key, rng, events);
  const intimacyBefore = s.intimacy;

  // 1. 溫暖(困難模式:往蓋被 / 夜裡 / 抱著決定的目標體溫靠攏,再隨機亂跳;冷熱依體質)
  const hard = isHard(s);
  for (const r of ROLES) {
    const c = s.chars[r];
    const wasComfort = comfortOf(s, r);
    const dw = hard ? (warmthTarget(s, r) - c.warmth) * HARD.warmRate + (rng() * 2 - 1) * HARD.warmDrift : (coverOf(r, s.blanketOffset) - 0.55) * 80;
    bump(c, 'warmth', dw);
    const cf = comfortOf(s, r);
    if (cf.cold) {
      events.push({ type: 'cold', who: r });
      if (!wasComfort.cold && c.sleep < SLEEP_ASLEEP) say(r, 'coldAwake');
    }
    if (cf.hot) {
      events.push({ type: 'hot', who: r });
      if (!wasComfort.hot && c.sleep < SLEEP_ASLEEP) say(r, 'tooHot');
    }
    if ((cf.cold || cf.hot) && c.sleep >= SLEEP_ASLEEP) bump(c, 'sleep', hard ? -HARD.uncomfySleep : -8);
  }

  // 2. 時間流逝
  for (const r of ROLES) {
    const c = s.chars[r];
    bump(c, 'sleep', (c.eyes === 'closed' ? 6 : 0) + (s.turn >= 6 ? 2 : 0));
  }
  if (s.embrace && s.chars.male.sleep >= SLEEP_AWAKE && s.chars.female.sleep >= SLEEP_AWAKE) {
    for (const r of ROLES) bump(s.chars[r], 'sleep', 2);
  }
  // 困難模式:天漸漸亮了,睡得越來越淺(睡意上限一回合比一回合低)
  if (hard && s.turn >= HARD.dawnTurn) {
    const cap = HARD.dawnCap - (s.turn - HARD.dawnTurn) * HARD.dawnStep;
    for (const r of ROLES) {
      const c = s.chars[r];
      if (c.sleep >= SLEEP_ASLEEP) bump(c, 'mood', HARD.restedMood); // 睡飽了,醒來心情好
      c.sleep = Math.min(c.sleep, cap);
    }
  }

  // 2b. 盯著看
  const p = s.chars[P];
  const ai = s.chars[AI];
  if (p.eyes === 'open' && p.posture === 'sideFacing' && ai.goal === 'sleep' && ai.sleep < SLEEP_AWAKE) {
    bump(ai, 'annoyance', 2);
    if (s.turn - s.memo.lastStareTurn >= 3) {
      s.memo.lastStareTurn = s.turn;
      say(AI, 'stare');
    }
  }

  // 3. 打呼
  for (const x of ROLES) {
    const L = snoreLevel(s.chars[x]);
    if (L === 0) continue;
    const y = partnerOf(x);
    const Y = s.chars[y];
    events.push({ type: 'snore', who: x, level: L });
    const nz = applyNoise(s, y, SNORE_NOISE[L]);
    if (nz.woke) {
      events.push({ type: 'wake', who: y, by: x });
      say(y, nz.key!);
    }
    if (Y.sleep < SLEEP_AWAKE && L >= 2) {
      bump(Y, 'annoyance', L * 2);
      if (!nz.woke && s.turn - s.memo.lastSnoreLineTurn[y] >= 3) {
        s.memo.lastSnoreLineTurn[y] = s.turn;
        say(y, 'snore');
      }
    }
  }

  // 4. 手麻
  const ap = s.armPillow;
  const m = s.chars.male;
  const fe = s.chars.female;
  if (ap.inUse) {
    ap.numbness = clamp100(ap.numbness + NUMB_PER_TURN);
    bumpIntimacy(s, 2);
    bump(fe, 'sleep', 3);
    bump(fe, 'mood', 2);
    if (ap.numbness >= 75) {
      bump(m, 'mood', -8);
      events.push({ type: 'numb', who: 'male' });
      if (!s.memo.numbSpoken) {
        s.memo.numbSpoken = true;
        say('male', 'numbArm');
      }
      if (ap.numbness >= 100) {
        bump(m, 'annoyance', 10);
        bump(m, 'sleep', -6);
      }
    }
  } else {
    ap.numbness = Math.max(0, ap.numbness - 50);
  }

  // 5. 察覺(真的睡著的人不會被說「你根本沒睡」)
  for (const a of [P, AI]) {
    const b = partnerOf(a);
    const A = s.chars[a];
    const B = s.chars[b];
    if (B.sleep >= SLEEP_ASLEEP || A.sleep >= SLEEP_ASLEEP) continue;
    let how: 'restless' | 'breath' | null = null;
    if (A.restless >= RESTLESS_NOTICE) {
      how = 'restless';
      A.restless = 20;
    } else if (isFakingSleep(A) && rng() < 0.25) {
      how = 'breath';
    }
    if (!how) continue;
    events.push({ type: 'noticed', who: a, by: b });
    if (B.goal === 'intimacy') bump(B, 'mood', 5);
    else bump(B, 'annoyance', 6);
    say(b, how === 'breath' ? 'breathTell' : B.goal === 'intimacy' ? 'noticedIntimacy' : 'noticedSleep');
  }

  // 6. 衰減
  for (const r of ROLES) {
    const c = s.chars[r];
    bump(c, 'annoyance', -5);
    c.mood = c.mood > 60 ? Math.max(60, c.mood - 2) : Math.min(60, c.mood + 2);
    bump(c, 'restless', c.eyes === 'closed' ? -20 : -15);
  }
  const affection = isAffection(p.lastAction) || isAffection(ai.lastAction);
  if (!hard) {
    if (!affection && s.intimacy < 100) bumpIntimacy(s, -3);
  } else if (s.intimacy < 100) {
    // 困難模式:親密度不穩定 —— 兩人都醒著又沒有互動就往下掉(抱著 / 枕著手臂、有人睡著時撐得住);
    // 另外每回合小幅亂跳(不會跳到 100)
    const cuddling = s.embrace || ap.inUse;
    const bothAwake = p.sleep < SLEEP_ASLEEP && ai.sleep < SLEEP_ASLEEP;
    if (s.embrace) bumpIntimacy(s, HARD.hugIntimacy);
    if (!affection && !cuddling && bothAwake) bumpIntimacy(s, -HARD.intimacyDecay);
    s.intimacy = clamp(s.intimacy + (rng() * 2 - 1) * HARD.intimacyJitter, 0, 99);
  }

  // 親密度在回合末(手臂枕)衝到 100,但對方睡著
  if (s.intimacy >= 100 && intimacyBefore < 100 && ai.sleep >= SLEEP_ASLEEP) {
    events.push({ type: 'note', who: P, text: ZH.msg.tooLateEndTurn, key: 'tooLateEndTurn' });
  }

  // 7. 睡眠分數(困難模式:要舒服才算滿分 —— 睡著 +1 / 不舒服 +0.5;昏沉且舒服 +0.5)
  if (!hard) {
    if (p.sleep >= SLEEP_ASLEEP) s.sleepScore += 1;
    else if (p.sleep >= SLEEP_AWAKE) s.sleepScore += 0.5;
  } else {
    const comfy = isComfy(s, P);
    if (p.sleep >= SLEEP_ASLEEP) s.sleepScore += comfy ? 1 : 0.5;
    else if (p.sleep >= SLEEP_AWAKE && comfy) s.sleepScore += 0.5;
  }

  syncAiEyes(s, events);
}
