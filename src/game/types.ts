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
  /** 目前狀態下此動作是否可用(不含 roles 檢查)。reasonKey = i18n 的 msg key(UI 依此翻譯) */
  available: (state: GameState, actor: Role) => { ok: true } | { ok: false; reason: string; reasonKey?: string };
}

export interface AvailableAction {
  def: ActionDef;
  ok: boolean;
  reason?: string; // zh-TW
  reasonKey?: string; // i18n msg key
}

export type Eyes = 'open' | 'closed';

export interface CharacterState {
  role: Role;
  goal: Goal;
  posture: Posture;
  eyes: Eyes; // 閉眼才能累積睡意/裝睡;張眼才看得到對方狀態(§1.1)
  lateral: number; // -1..1
  sleep: number; // 0..100
  mood: number; // 0..100
  annoyance: number; // 0..100
  warmth: number; // 0..100
  restless: number; // 0..100 翻身指數;>=50 會被清醒的對方察覺「你根本沒睡」
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

/** 結局演出風格:wasted = GTA「WASTED」式失敗演出;passed = 金色過關;neutral = 平手 */
export type EndingStyle = 'wasted' | 'passed' | 'neutral';

export interface Ending {
  id: EndingId;
  outcome: 'win' | 'lose' | 'draw';
  style: EndingStyle;
  title: string; // 大字(zh-TW),例:「被踢下床」
  caption: string; // 英文小字,例:"KICKED OUT"
  description: string;
}

/** 遊戲內部備忘:對話頻率限制、連續行為計數、線索統計。UI/scene 可以讀,但不影響既有欄位語意。 */
export interface GameMemo {
  /** 上次說 stare 台詞的回合(−99 = 從未) */
  lastStareTurn: number;
  /** 各角色上次抱怨打呼的回合 */
  lastSnoreLineTurn: Record<Role, number>;
  /** numbArm 台詞已說過(只說一次) */
  numbSpoken: boolean;
  /** intimacyHigh 台詞已說過(首次 >= 60) */
  intimacyHighSpoken: boolean;
  /** AI 第一次選 sleep 時說過晚安 */
  goodnightSpoken: boolean;
  /** tooLate 台詞已說過 */
  tooLateSpoken: boolean;
  /** AI 睡夢中連續搶棉被次數(第二次起 note「春捲」) */
  pullStreak: number;
  /** 本回合玩家被推下床(→ kickedOff 而不是 fellOff) */
  pushedOff: boolean;
  /** 玩家觀察到的「對方目標」線索次數(對話/行為推得,結局前不直接揭曉) */
  clues: Record<Goal, number>;
  /** 本局的行為統計(結局的趣味稱號用) */
  tally: Tally;
}

/** 單一角色本局的行為統計 */
export interface RoleTally {
  /** 做過的動作次數(不論成功與否) */
  acts: Partial<Record<ActionId, number>>;
  /** 翻身(換姿勢)次數 */
  turned: number;
  /** 冷到發抖的次數 */
  cold: number;
  /** 打呼的回合數 */
  snored: number;
  /** 把對方吵醒的次數 */
  woke: number;
  /** 裝睡被抓包的次數 */
  caught: number;
  /** 回合結束時貼在自己那側床緣的回合數 */
  edge: number;
  /** 回合結束時閉著眼卻醒著(裝睡)的回合數 */
  faked: number;
  /** 回合結束時睡著(sleep >= 70)的回合數 */
  slept: number;
  /** 第一次睡著(sleep >= 70)時的回合(1 起算);−1 = 還沒睡著過 */
  asleepAt: number;
}

export interface Tally {
  male: RoleTally;
  female: RoleTally;
  /** 回合結束時抱在一起的回合數 */
  embraced: number;
  /** 回合結束時手臂枕使用中的回合數 */
  pillow: number;
  /** 手麻最高值 */
  maxNumb: number;
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
  memo: GameMemo;
}

export type TurnPhase = 'player' | 'partner' | 'endOfTurn';

export type GameEvent =
  | { type: 'phase'; phase: TurnPhase } // playTurn 保證 events 依 phase 分段,場景/UI 以此切段
  | { type: 'action'; who: Role; action: ActionId; force: number; band: ForceBand; noise: number; success: boolean; note?: string; noteKeys?: string[] } // noise = 實際 N(§4);note = zh-TW,noteKeys = i18n msg keys
  | { type: 'eyes'; who: Role; eyes: Eyes } // 切換閉眼/張眼(玩家由 toggleEyes 發;AI 由 resolveAction 依規則發)
  | { type: 'speech'; who: Role; text: string; key?: string; index?: number } // text = zh-TW;key/index = 對話池與句子序號(UI 依語系翻譯)
  | { type: 'note'; who: Role; text: string; key?: string } // 不屬於某個動作的旁白(例:閉眼→張眼把自己弄醒);key = i18n msg key
  | { type: 'clue'; goal: Goal } // 玩家觀察到一條關於對方目標的線索
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
  | { type: 'noticed'; who: Role; by: Role } // by 察覺 who 其實醒著
  | { type: 'snore'; who: Role; level: 1 | 2 | 3 } // who 在打呼(回合末發,level 依姿勢/深度)
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
