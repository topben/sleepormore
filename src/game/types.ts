// 型別契約:game / scene / ui 三個模組共用。介面已定案,只能新增欄位,不可改動既有欄位語意。
// 數值語意見 docs/DESIGN.md §1。

export type Role = 'male' | 'female';
export type Goal = 'sleep' | 'intimacy';
export type Posture = 'supine' | 'sideFacing' | 'sideAway' | 'prone';

export type ActionId =
  | 'lieSupine'
  | 'lieSideFacing'
  | 'lieSideAway'
  | 'lieProne'
  | 'hug'
  | 'kiss'
  | 'caress'
  | 'whisper'
  | 'pat'
  | 'offerArm'
  | 'restOnArm'
  | 'leaveArm'
  | 'withdrawArm'
  | 'pullBlanket'
  | 'tuckBlanket'
  | 'scootIn'
  | 'scootOut'
  | 'sleep'
  | 'push';

export type ActionCategory = 'posture' | 'affection' | 'arm' | 'blanket' | 'move' | 'rest' | 'partner';

export type ForceBand = 'timid' | 'gentle' | 'firm' | 'rough';

export interface ActionDef {
  id: ActionId;
  label: string; // zh-TW
  emoji: string;
  category: ActionCategory;
  roles: Role[]; // 可用角色;[] = 只有 AI 使用
  usesForce: boolean;
  forceWindow: [number, number]; // 綠區 [lo, hi];usesForce=false 時忽略
  baseNoise: number; // 0..100
  hint: string; // 一行說明
  /** 目前狀態下此動作是否可用(不含 roles 檢查) */
  available: (state: GameState, actor: Role) => { ok: true } | { ok: false; reason: string };
}

export interface AvailableAction {
  def: ActionDef;
  ok: boolean;
  reason?: string;
}

export interface CharacterState {
  role: Role;
  goal: Goal;
  posture: Posture;
  lateral: number; // -1..1
  sleep: number; // 0..100
  mood: number; // 0..100
  annoyance: number; // 0..100
  warmth: number; // 0..100
  lastAction: ActionId | null;
}

export interface ArmPillowState {
  offered: boolean;
  inUse: boolean;
  numbness: number; // 0..100
}

export type EndingId =
  | 'sleepWin'
  | 'sleepLoseTired'
  | 'intimacyWin'
  | 'intimacyLoseMorning'
  | 'intimacyLoseFellAsleep'
  | 'accidentalIntimacy'
  | 'kickedOff'
  | 'fellOff';

export interface Ending {
  id: EndingId;
  outcome: 'win' | 'lose' | 'draw';
  title: string;
  description: string;
}

export interface GameState {
  turn: number; // 0..MAX_TURNS
  playerRole: Role;
  chars: Record<Role, CharacterState>;
  blanketOffset: number; // -1..1
  intimacy: number; // 0..100
  embrace: boolean;
  armPillow: ArmPillowState;
  sleepScore: number;
  ending: Ending | null;
  seed: number;
}

export type GameEvent =
  | { type: 'action'; who: Role; action: ActionId; force: number; band: ForceBand; success: boolean; note?: string }
  | { type: 'speech'; who: Role; text: string }
  | { type: 'wake'; who: Role; by: Role }
  | { type: 'intimacy'; delta: number }
  | { type: 'annoyed'; who: Role; delta: number }
  | { type: 'mood'; who: Role; delta: number }
  | { type: 'posture'; who: Role; posture: Posture }
  | { type: 'move'; who: Role; lateral: number }
  | { type: 'blanket'; offset: number }
  | { type: 'embrace'; on: boolean }
  | { type: 'armPillow'; offered: boolean; inUse: boolean }
  | { type: 'cold'; who: Role }
  | { type: 'numb'; who: Role }
  | { type: 'push'; who: Role; target: Role }
  | { type: 'kick'; who: Role; target: Role }
  | { type: 'fell'; who: Role }
  | { type: 'ending'; ending: Ending }
  | { type: 'turnEnd'; turn: number };

export interface TurnResult {
  state: GameState;
  /** 玩家行動後、對方行動前的狀態(3D 場景分兩段 tween 用) */
  intermediate: GameState;
  events: GameEvent[];
}

export const partnerOf = (role: Role): Role => (role === 'male' ? 'female' : 'male');
