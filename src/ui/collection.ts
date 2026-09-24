// 組合圖鑑的收集紀錄(localStorage)。存不了(無痕模式、被擋)時退回這次開著的期間記在記憶體,NEW 與計數仍然一致。
import { COMBO_IDS, type ComboId } from '../game/titles';

const KEY = 'som.combos';
const VALID = new Set<string>(COMBO_IDS);
/** 存不進 localStorage 的(這次開著期間仍算收集過) */
const session = new Set<ComboId>();

function stored(): ComboId[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr: unknown = raw ? JSON.parse(raw) : [];
    if (Array.isArray(arr)) return arr.filter((x): x is ComboId => typeof x === 'string' && VALID.has(x));
  } catch {
    /* ignore */
  }
  return [];
}

export function loadCollection(): Set<ComboId> {
  return new Set([...stored(), ...session]);
}

/** 記下這次的組合;第一次拿到 → true */
export function recordCombo(id: ComboId): boolean {
  const all = loadCollection();
  if (all.has(id)) return false;
  try {
    localStorage.setItem(KEY, JSON.stringify([...stored(), id]));
  } catch {
    session.add(id); // 存不了:記在記憶體
  }
  return true;
}
