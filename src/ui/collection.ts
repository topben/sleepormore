// 組合圖鑑的收集紀錄(localStorage;讀寫失敗時當作還沒收集,遊戲照常)
import { COMBO_IDS, type ComboId } from '../game/titles';

const KEY = 'som.combos';
const VALID = new Set<string>(COMBO_IDS);

export function loadCollection(): Set<ComboId> {
  try {
    const raw = localStorage.getItem(KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr)) return new Set(arr.filter((x): x is ComboId => typeof x === 'string' && VALID.has(x)));
  } catch {
    /* ignore */
  }
  return new Set();
}

/** 記下這次的組合;第一次拿到 → true */
export function recordCombo(id: ComboId): boolean {
  const set = loadCollection();
  if (set.has(id)) return false;
  set.add(id);
  try {
    localStorage.setItem(KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
  return true;
}
