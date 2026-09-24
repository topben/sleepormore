// 多語系:繁體中文(參考)、简体中文、日本語、한국어、Tiếng Việt、English、Español。
// 繁中打包在主程式裡(也是缺字時的後備);其他語系動態載入。
import type { Locale, Messages } from './types';
import zhTWGame from './zh-TW/game';
import zhTWUi from './zh-TW/ui';

export type { GameMessages, Locale, Messages, UiMessages } from './types';

export const LOCALES: ReadonlyArray<{ id: Locale; name: string }> = [
  { id: 'zh-TW', name: '繁體中文' },
  { id: 'zh-CN', name: '简体中文' },
  { id: 'ja', name: '日本語' },
  { id: 'ko', name: '한국어' },
  { id: 'vi', name: 'Tiếng Việt' },
  { id: 'en', name: 'English' },
  { id: 'es', name: 'Español' },
];

const ZH_TW: Messages = { game: zhTWGame, ui: zhTWUi };

const loaders: Record<Locale, () => Promise<Messages>> = {
  'zh-TW': async () => ZH_TW,
  'zh-CN': () => import('./zh-CN').then((mod) => mod.default),
  ja: () => import('./ja').then((mod) => mod.default),
  ko: () => import('./ko').then((mod) => mod.default),
  vi: () => import('./vi').then((mod) => mod.default),
  en: () => import('./en').then((mod) => mod.default),
  es: () => import('./es').then((mod) => mod.default),
};

const STORAGE_KEY = 'som.locale';
let current: Locale = 'zh-TW';
let messages: Messages = ZH_TW;
const listeners = new Set<(l: Locale) => void>();

export const isLocale = (v: unknown): v is Locale => LOCALES.some((l) => l.id === v);

/** 目前語系的字典 */
export const m = (): Messages => messages;
export const getLocale = (): Locale => current;

export function onLocaleChange(fn: (l: Locale) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function setLocale(l: Locale): Promise<void> {
  const msgs = await loaders[l]();
  current = l;
  messages = msgs;
  try {
    localStorage.setItem(STORAGE_KEY, l);
  } catch {
    /* 私密模式等 */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.lang = l;
    document.title = msgs.ui.meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute('content', msgs.ui.meta.description);
  }
  listeners.forEach((fn) => fn(l));
}

/** 把瀏覽器語言標籤對應到支援的語系 */
export function matchLocale(tag: string): Locale | null {
  const t = tag.toLowerCase();
  if (t.startsWith('zh')) {
    if (t.includes('hans') || t === 'zh-cn' || t === 'zh-sg' || t === 'zh-my') return 'zh-CN';
    return 'zh-TW'; // zh-TW / zh-HK / zh-MO / zh-Hant / zh
  }
  const base = t.split('-')[0];
  if (base === 'ja' || base === 'ko' || base === 'vi' || base === 'en' || base === 'es') return base;
  return null;
}

/** ?lang= → 上次選擇 → 瀏覽器語言 → English */
export function detectLocale(): Locale {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    const fromQuery = q && (isLocale(q) ? q : matchLocale(q));
    if (fromQuery) return fromQuery;
  } catch {
    /* 非瀏覽器環境 */
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) return saved;
  } catch {
    /* ignore */
  }
  const langs = typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : [];
  for (const tag of langs) {
    const l = tag && matchLocale(tag);
    if (l) return l;
  }
  return 'en';
}

/** 代入 {name} 佔位符 */
export function fmt(tpl: string, params: Record<string, string | number> = {}): string {
  return tpl.replace(/\{(\w+)\}/g, (all, k: string) => (k in params ? String(params[k]) : all));
}

/** 對話池的第 index 句(目前語系;缺句時退回繁中) */
export function speechLine(key: keyof Messages['game']['speech'], index: number): string {
  const pool = messages.game.speech[key] ?? ZH_TW.game.speech[key];
  return pool[index % pool.length] ?? ZH_TW.game.speech[key][index % ZH_TW.game.speech[key].length];
}
