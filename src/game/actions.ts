// 動作表(DESIGN §5)。available() 只檢查狀態需求,不含 roles。
// label / hint / reason 是繁中參考字串;UI 以 id 與 reasonKey 依語系翻譯。
import { CENTER_MIN, REACH, SCOOT_MIN_DISTANCE } from './constants';
import { ZH, type MsgKey } from './text';
import type { ActionCategory, ActionDef, ActionId, AvailableAction, GameState, Posture, Role } from './types';
import { partnerOf } from './types';
import { distanceOf } from './util';

type Avail = ReturnType<ActionDef['available']>;
const OK: Avail = { ok: true };
export const no = (key: MsgKey): Avail => ({ ok: false, reason: ZH.msg[key], reasonKey: key });

const BOTH: Role[] = ['male', 'female'];

export const POSTURE_OF: Partial<Record<ActionId, Posture>> = {
  lieSupine: 'supine',
  lieSideFacing: 'sideFacing',
  lieSideAway: 'sideAway',
  lieProne: 'prone',
};

export const CATEGORY_ORDER: ActionCategory[] = ['rest', 'posture', 'affection', 'blanket', 'move', 'arm', 'partner'];

/** 選單顯示順序(依類別分組) */
export const ACTION_ORDER: ActionId[] = [
  'sleep',
  'pat',
  'lieSupine',
  'lieSideFacing',
  'lieSideAway',
  'lieProne',
  'kiss',
  'hug',
  'caress',
  'whisper',
  'pullBlanket',
  'tuckBlanket',
  'scootIn',
  'scootOut',
  'offerArm',
  'restOnArm',
  'leaveArm',
  'withdrawArm',
  'push',
];

const isPlayer = (s: GameState, actor: Role) => s.playerRole === actor;
const flatOrFacing = (p: Posture) => p === 'supine' || p === 'sideFacing';

interface Spec {
  emoji: string;
  category: ActionCategory;
  roles: Role[];
  usesForce?: boolean;
  forceWindow?: [number, number];
  baseNoise: number;
  available: ActionDef['available'];
}

function def(id: ActionId, spec: Spec): ActionDef {
  return {
    id,
    label: ZH.action[id].label,
    hint: ZH.action[id].hint,
    emoji: spec.emoji,
    category: spec.category,
    roles: spec.roles,
    usesForce: spec.usesForce ?? false,
    forceWindow: spec.forceWindow ?? [0, 0],
    baseNoise: spec.baseNoise,
    available: spec.available,
  };
}

function lie(id: ActionId, emoji: string, noise: number, roles: Role[]): ActionDef {
  const target = POSTURE_OF[id]!;
  return def(id, {
    emoji,
    category: 'posture',
    roles,
    baseNoise: noise,
    available: (s, actor) => {
      if (s.chars[actor].posture === target) return no('alreadyPosture');
      if (actor === 'male' && s.armPillow.inUse && !flatOrFacing(target)) return no('armPinned');
      return OK;
    },
  });
}

export const ACTIONS: Record<ActionId, ActionDef> = {
  lieSupine: lie('lieSupine', '🛏️', 20, BOTH),
  lieSideFacing: lie('lieSideFacing', '🙂', 20, BOTH),
  lieSideAway: lie('lieSideAway', '🙃', 20, BOTH),
  lieProne: lie('lieProne', '😴', 25, []),

  hug: def('hug', {
    emoji: '🤗',
    category: 'affection',
    roles: BOTH,
    usesForce: true,
    forceWindow: [25, 55],
    baseNoise: 35,
    available: (s, actor) => {
      const c = s.chars[actor];
      const b = s.chars[partnerOf(actor)];
      if (isPlayer(s, actor) && c.eyes === 'closed') return no('eyesClosedHug');
      if (s.embrace) return no('alreadyEmbrace');
      if (c.posture !== 'sideFacing') return no('needFacing');
      if (b.posture !== 'sideFacing' && b.posture !== 'sideAway') return no('partnerNotSide');
      if (distanceOf(s) > REACH) return no('tooFar');
      return OK;
    },
  }),

  kiss: def('kiss', {
    emoji: '💋',
    category: 'affection',
    roles: BOTH,
    usesForce: true,
    forceWindow: [20, 50],
    baseNoise: 30,
    available: (s, actor) => {
      const c = s.chars[actor];
      const b = s.chars[partnerOf(actor)];
      if (isPlayer(s, actor) && c.eyes === 'closed') return no('eyesClosedKiss');
      if (c.posture !== 'sideFacing') return no('needFacing');
      if (b.posture === 'sideAway') return no('partnerFacingAway');
      if (b.posture === 'prone') return no('partnerProne');
      if (distanceOf(s) > REACH) return no('tooFar');
      return OK;
    },
  }),

  caress: def('caress', {
    emoji: '🖐️',
    category: 'affection',
    roles: BOTH,
    usesForce: true,
    forceWindow: [20, 50],
    baseNoise: 28,
    available: (s, actor) => {
      if (s.chars[actor].posture !== 'sideFacing') return no('needFacing');
      if (distanceOf(s) > REACH) return no('tooFar');
      return OK;
    },
  }),

  whisper: def('whisper', { emoji: '💬', category: 'affection', roles: BOTH, baseNoise: 15, available: () => OK }),

  pat: def('pat', {
    emoji: '🤲',
    category: 'rest',
    roles: BOTH,
    usesForce: true,
    forceWindow: [15, 45],
    baseNoise: 12,
    available: () => OK,
  }),

  offerArm: def('offerArm', {
    emoji: '💪',
    category: 'arm',
    roles: ['male'],
    baseNoise: 15,
    available: (s, actor) => {
      const c = s.chars[actor];
      const b = s.chars[partnerOf(actor)];
      if (s.armPillow.offered) return no('armAlreadyOffered');
      if (!flatOrFacing(c.posture)) return no('offerNeedPosture');
      if (!flatOrFacing(b.posture)) return no('herBackTurned');
      if (distanceOf(s) > REACH) return no('tooFar');
      return OK;
    },
  }),

  restOnArm: def('restOnArm', {
    emoji: '😌',
    category: 'arm',
    roles: ['female'],
    baseNoise: 15,
    available: (s, actor) => {
      if (!s.armPillow.offered) return no('armNotOffered');
      if (s.armPillow.inUse) return no('alreadyOnArm');
      if (!flatOrFacing(s.chars[actor].posture)) return no('restNeedPosture');
      if (distanceOf(s) > REACH) return no('tooFar');
      return OK;
    },
  }),

  leaveArm: def('leaveArm', {
    emoji: '↩️',
    category: 'arm',
    roles: ['female'],
    baseNoise: 12,
    available: (s) => (s.armPillow.inUse ? OK : no('notOnArm')),
  }),

  withdrawArm: def('withdrawArm', {
    emoji: '🤚',
    category: 'arm',
    roles: ['male'],
    usesForce: true,
    forceWindow: [15, 45],
    baseNoise: 25,
    available: (s) => (s.armPillow.offered ? OK : no('armNotOut')),
  }),

  pullBlanket: def('pullBlanket', {
    emoji: '🧣',
    category: 'blanket',
    roles: BOTH,
    usesForce: true,
    forceWindow: [35, 65],
    baseNoise: 30,
    available: (s, actor) => ((actor === 'male' ? s.blanketOffset <= -1 : s.blanketOffset >= 1) ? no('blanketAllMine') : OK),
  }),

  tuckBlanket: def('tuckBlanket', {
    emoji: '🛌',
    category: 'blanket',
    roles: BOTH,
    usesForce: true,
    forceWindow: [15, 50],
    baseNoise: 10,
    available: (s, actor) => ((actor === 'male' ? s.blanketOffset >= 1 : s.blanketOffset <= -1) ? no('blanketAllTheirs') : OK),
  }),

  scootIn: def('scootIn', {
    emoji: '➡️',
    category: 'move',
    roles: BOTH,
    usesForce: true,
    forceWindow: [15, 50],
    baseNoise: 15,
    available: (s, actor) => {
      if (distanceOf(s) <= SCOOT_MIN_DISTANCE) return no('alreadyClose');
      if (Math.abs(s.chars[actor].lateral) <= CENTER_MIN + 1e-9) return no('atCenter');
      return OK;
    },
  }),

  scootOut: def('scootOut', {
    emoji: '⬅️',
    category: 'move',
    roles: BOTH,
    usesForce: true,
    forceWindow: [15, 50],
    baseNoise: 15,
    available: (s, actor) => (actor === 'male' && s.armPillow.inUse ? no('armPinned') : OK),
  }),

  sleep: def('sleep', {
    emoji: '💤',
    category: 'rest',
    roles: BOTH,
    baseNoise: 0,
    available: (s, actor) => (isPlayer(s, actor) && s.chars[actor].eyes === 'open' ? no('closeEyesFirst') : OK),
  }),

  push: def('push', {
    emoji: '💢',
    category: 'partner',
    roles: [],
    baseNoise: 20,
    available: (s, actor) => {
      if (isPlayer(s, actor)) return no('onlyPartnerPushes');
      const a = s.chars[actor].annoyance;
      return a >= 70 && a < 100 ? OK : no('notAngryEnough');
    },
  }),
};

export const AFFECTION_ACTIONS: ReadonlySet<ActionId> = new Set<ActionId>(['hug', 'kiss', 'caress', 'whisper']);
export const isAffection = (id: ActionId | null): boolean => id !== null && AFFECTION_ACTIONS.has(id);

/** 含 roles 檢查的可用性:roles=[] 的動作只有 AI 能用 */
export function checkAction(state: GameState, actor: Role, id: ActionId): Avail {
  const d = ACTIONS[id];
  const isP = state.playerRole === actor;
  if (d.roles.length === 0 ? isP : !d.roles.includes(actor)) return no('notAllowed');
  return d.available(state, actor);
}

export const canUse = (state: GameState, actor: Role, id: ActionId): boolean => checkAction(state, actor, id).ok;

/** 玩家/AI 選單:roles 含 actor 的動作,並填 ok/reason */
export function listAvailableActions(state: GameState, actor: Role): AvailableAction[] {
  const out: AvailableAction[] = [];
  for (const id of ACTION_ORDER) {
    const d = ACTIONS[id];
    if (!d.roles.includes(actor)) continue;
    const r = d.available(state, actor);
    out.push(r.ok ? { def: d, ok: true } : { def: d, ok: false, reason: r.reason, reasonKey: r.reasonKey });
  }
  return out;
}
