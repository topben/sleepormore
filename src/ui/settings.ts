// 玩家偏好(存在 localStorage;讀寫失敗時用預設值)
import type { Mode } from '../game/types';

export interface Settings {
  /** 難度(開始畫面選;DESIGN §15) */
  mode: Mode;
  sound: boolean;
  /** 顯示 💡 建議與按鈕高亮 */
  hints: boolean;
  /** 跳過蓄力條,一律用綠區中心 */
  autoForce: boolean;
}

const KEY = 'som.settings';
const DEFAULTS: Settings = { mode: 'easy', sound: true, hints: true, autoForce: false };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
      if (s.mode !== 'easy' && s.mode !== 'hard') s.mode = 'easy';
      return s;
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
