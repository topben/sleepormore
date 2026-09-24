// 豆豆人姿勢表與疊加規則(SCENE-RIG §2)。純數字、不 import three.js → vitest 可在 node 直接測。
import type { GameState, Posture, Role } from '../game/types';
import { partnerOf } from '../game/types';

/** Euler [x, y, z](rad,order XYZ) */
export type Euler3 = [number, number, number];
export type LimbName = 'armL' | 'armR' | 'legL' | 'legR' | 'head';
export const LIMB_NAMES: readonly LimbName[] = ['armL', 'armR', 'legL', 'legR', 'head'];
export type Limbs = Record<LimbName, Euler3>;

export interface Pose {
  /** root 的 Ry(繞身體長軸自轉) */
  roll: number;
  limbs: Limbs;
  /** 加在 root y 上(女方枕在手臂上 +0.05) */
  rootYOffset: number;
}

/** resolvePose 只需要這幾個欄位(完整 GameState 也可以直接傳) */
export type PoseState = Pick<GameState, 'chars' | 'embrace' | 'armPillow'>;

const H = Math.PI / 2;

/** 世界座標(§1):root x = lateral × 1.1、y = 0.74、z = +0.20;躺平 = rotation.x −π/2 */
export const RIG = {
  lateralScale: 1.1,
  rootY: 0.74,
  rootZ: 0.2,
  lyingPitch: -H,
} as const;

/** roll 表:posture 只差這一個純量 */
export const ROLL: Record<Role, Record<Posture, number>> = {
  male: { supine: 0, sideFacing: H, sideAway: -H, prone: Math.PI },
  female: { supine: 0, sideFacing: -H, sideAway: H, prone: Math.PI },
};

type Table = 'supine' | 'sideLDown' | 'sideRDown' | 'prone';

/** 肢體表:只取決於「哪一側在下」,兩個角色共用 */
const TABLES: Record<Table, Limbs> = {
  supine: { armL: [0, 0, 0.25], armR: [0, 0, -0.25], legL: [0, 0, 0.08], legR: [0, 0, -0.08], head: [0, 0, 0] },
  // roll > 0 → 左側(L)在下:male sideFacing / female sideAway
  sideLDown: { armL: [-1.3, 0, 0.2], armR: [-1.0, 0, -0.1], legL: [-0.35, 0, 0], legR: [-0.6, 0, -0.05], head: [0.1, 0, 0] },
  // roll < 0 → 右側(R)在下:female sideFacing / male sideAway
  sideRDown: { armR: [-1.3, 0, -0.2], armL: [-1.0, 0, 0.1], legR: [-0.35, 0, 0], legL: [-0.6, 0, 0.05], head: [0.1, 0, 0] },
  // 仙人掌式雙臂舉在頭旁;頭轉向對方那側(下面依角色覆寫)
  prone: { armL: [0, 0, 2.3], armR: [0, 0, -2.3], legL: [0, 0, 0.08], legR: [0, 0, -0.08], head: [0, 0, 0] },
};

/** 趴睡時臉轉向對方:male 朝 +x、female 朝 −x */
export const PRONE_HEAD_YAW: Record<Role, number> = { male: -1.1, female: 1.1 };

/**
 * 擁抱時 sideFacing 那一方的上臂(z 分量 = 往「在下那側」垂,手落在對方背上)。
 * 規格值(男 [−π/2+0.3,0,0] → 手在 z≈−0.30、女 [−π/2−0.3,0,0] → z≈−0.60,手臂水平在 y≈0.94)
 * 實際渲染時兩隻手臂剛好橫在兩人臉前;改成往腳的方向、往下搭在對方背上(一部分鑽進棉被),
 * 兩手 z 仍錯開 0.15 以上,避免中線互穿。
 */
export const EMBRACE_ARM: Record<Role, Euler3> = {
  male: [-H + 0.8, 0, 0.1], // 手搭在她背上(z≈−0.08,棉被下)
  female: [-H + 0.4, 0, -0.15], // 手搭在他肩背(z≈−0.25)
};

/** 湯匙式(對方 sideAway):從背後環過對方腰側 */
export const SPOON_ARM: Record<Role, Euler3> = {
  male: [-H + 0.6, 0, 0.2],
  female: [-H + 0.6, 0, -0.2],
};

/** 男方手臂枕(offered || inUse)的左臂,依男方自己的姿勢 */
export const ARM_PILLOW_ARM: Partial<Record<Posture, Euler3>> = {
  // 臂朝 +x 並偏向床頭,末端從她頭下穿過。規格 [0,0,2.2] 的手臂高度 = 她的頭心,看起來像橫過她臉上;
  // 加 x = −0.33 讓手臂往下貼到枕頭上(末端 y≈0.70),真的墊在她頭下
  supine: [-0.33, 0, 2.2],
  // 在下那隻朝 +x、偏向床頭。規格 [−π/2−0.35,0,0] 的手臂在 y≈0.54,整隻埋在枕頭裡(手麻變紫也看不到);
  // 加 z = −0.3 讓它斜斜擱到枕頭面上,末端在她下巴/頭下
  sideFacing: [-H - 0.35, 0, -0.3],
};

/**
 * inUse 且女方 sideFacing(沒在擁抱)時,她上面那隻手(armL)搭在他胸口(手在 z≈−0.08,棉被邊緣)。
 * 規格是肢體不變,但原本的上臂剛好朝他的臉伸、從床尾俯視正好蓋住墊在她頭下的那隻手臂(手麻變紫也看不到)。
 */
export const ARM_PILLOW_CUDDLE: Euler3 = [-H + 0.8, 0, -0.1];

/** inUse 時女方頭墊高在臂上 */
export const ARM_PILLOW_LIFT = 0.05;

const e3 = (v: Euler3): Euler3 => [v[0], v[1], v[2]];

function copyLimbs(l: Limbs): Limbs {
  return { armL: e3(l.armL), armR: e3(l.armR), legL: e3(l.legL), legR: e3(l.legR), head: e3(l.head) };
}

/** 該姿勢的基本 rig(不含擁抱/手臂枕) */
export function basePose(role: Role, posture: Posture): Pose {
  const roll = ROLL[role][posture];
  let table: Table;
  if (posture === 'supine') table = 'supine';
  else if (posture === 'prone') table = 'prone';
  else table = roll > 0 ? 'sideLDown' : 'sideRDown';
  const limbs = copyLimbs(TABLES[table]);
  if (posture === 'prone') limbs.head = [0, PRONE_HEAD_YAW[role], 0];
  return { roll, limbs, rootYOffset: 0 };
}

/**
 * 疊加規則:basePose(posture) → embrace 覆寫 → armPillow 覆寫。
 * - embrace:sideFacing 的一方把上臂擺成抱姿(對方 sideAway → 湯匙式);sideAway 的一方肢體不變。
 * - armPillow:男方左臂當枕頭(supine / sideFacing 才有);inUse 時女方 rootYOffset +0.05,
 *   她側躺面向他且沒在擁抱時,上面那隻手搭在他胸口(不擋住枕頭手臂)。
 * - embrace 與 inUse 可並存:男方上臂(armR)抱、下臂(armL)當枕頭,互不衝突。
 */
export function resolvePose(role: Role, state: PoseState): Pose {
  const me = state.chars[role];
  const other = state.chars[partnerOf(role)];
  const pose = basePose(role, me.posture);

  if (state.embrace && me.posture === 'sideFacing') {
    const upper: LimbName = role === 'male' ? 'armR' : 'armL';
    pose.limbs[upper] = e3(other.posture === 'sideAway' ? SPOON_ARM[role] : EMBRACE_ARM[role]);
  }

  const ap = state.armPillow;
  if (ap.offered || ap.inUse) {
    if (role === 'male') {
      const arm = ARM_PILLOW_ARM[me.posture];
      if (arm) pose.limbs.armL = e3(arm);
    } else if (ap.inUse) {
      pose.rootYOffset = ARM_PILLOW_LIFT;
      if (me.posture === 'sideFacing' && !state.embrace) pose.limbs.armL = e3(ARM_PILLOW_CUDDLE);
    }
  }
  return pose;
}
