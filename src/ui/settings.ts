// 玩家偏好(存在 localStorage;讀寫失敗時用預設值)
export interface Settings {
  sound: boolean;
  /** 顯示 💡 建議與按鈕高亮 */
  hints: boolean;
  /** 跳過蓄力條,一律用綠區中心 */
  autoForce: boolean;
}

const KEY = 'som.settings';
const DEFAULTS: Settings = { sound: true, hints: true, autoForce: false };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
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
