// 狀態小工具(無規則語意,actions / rules / scene / ui 共用)
import type { GameState, Role } from './types';

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);
export const clamp100 = (v: number): number => clamp(v, 0, 100);

/** 兩人距離 = female.lateral − male.lateral */
export const distanceOf = (s: GameState): number => s.chars.female.lateral - s.chars.male.lateral;

/** 棉被覆蓋率 0..1(offset 負 = 偏男方) */
export function coverOf(role: Role, offset: number): number {
  return role === 'male' ? clamp(0.75 - 0.6 * offset, 0, 1) : clamp(0.75 + 0.6 * offset, 0, 1);
}

/** 往自己那側的方向:male = −1(左)、female = +1(右) */
export const sideSign = (role: Role): number => (role === 'male' ? -1 : 1);

export function cloneState(s: GameState): GameState {
  return structuredClone(s);
}
