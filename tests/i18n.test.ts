// 多語系字典一致性:結構、陣列長度(對話池用序號對應)、佔位符都要和繁中參考一致。
import { describe, expect, it } from 'vitest';
import { LOCALES, fmt, matchLocale } from '../src/i18n';
import type { Messages } from '../src/i18n/types';
import zhTWGame from '../src/i18n/zh-TW/game';
import zhTWUi from '../src/i18n/zh-TW/ui';
import en from '../src/i18n/en';
import es from '../src/i18n/es';
import ja from '../src/i18n/ja';
import ko from '../src/i18n/ko';
import vi from '../src/i18n/vi';
import zhCN from '../src/i18n/zh-CN';

const REF: Messages = { game: zhTWGame, ui: zhTWUi };
const ALL: Record<string, Messages> = { 'zh-CN': zhCN, ja, ko, vi, en, es };

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort();

function compare(ref: unknown, got: unknown, path: string, errors: string[]) {
  if (typeof ref === 'string') {
    if (typeof got !== 'string') return void errors.push(`${path}: expected string`);
    if (!got.trim()) errors.push(`${path}: empty`);
    const a = placeholders(ref).join(',');
    const b = placeholders(got).join(',');
    if (a !== b) errors.push(`${path}: placeholders {${a}} vs {${b}}`);
    return;
  }
  if (Array.isArray(ref)) {
    if (!Array.isArray(got)) return void errors.push(`${path}: expected array`);
    if (got.length !== ref.length) errors.push(`${path}: length ${got.length} ≠ ${ref.length}`);
    ref.forEach((r, i) => compare(r, got[i], `${path}[${i}]`, errors));
    return;
  }
  if (ref && typeof ref === 'object') {
    if (!got || typeof got !== 'object') return void errors.push(`${path}: expected object`);
    for (const k of Object.keys(ref)) compare((ref as Record<string, unknown>)[k], (got as Record<string, unknown>)[k], `${path}.${k}`, errors);
    for (const k of Object.keys(got)) if (!(k in (ref as object))) errors.push(`${path}.${k}: extra key`);
  }
}

describe('combo endings text', () => {
  for (const [id, msgs] of Object.entries({ 'zh-TW': REF, ...ALL })) {
    it(`${id}: 64 unique combo names, distinct from the 8 persona names`, () => {
      const combos = Object.values(msgs.game.combo).map((c) => c.name.trim());
      const personas = Object.values(msgs.game.persona).map((p) => p.name.trim());
      expect(combos).toHaveLength(64);
      expect(new Set(combos).size).toBe(64);
      expect(new Set(personas).size).toBe(8);
      for (const p of personas) expect(combos).not.toContain(p);
    });
  }
});

describe('i18n dictionaries', () => {
  it('lists 7 locales', () => {
    expect(LOCALES.map((l) => l.id)).toEqual(['zh-TW', 'zh-CN', 'ja', 'ko', 'vi', 'en', 'es']);
  });

  for (const [id, msgs] of Object.entries(ALL)) {
    describe(id, () => {
      it('is translated (not the zh-TW placeholder)', () => {
        expect(msgs.game).not.toBe(zhTWGame);
        expect(msgs.ui).not.toBe(zhTWUi);
      });

      it('matches the zh-TW structure, array lengths and placeholders', () => {
        const errors: string[] = [];
        compare(REF, msgs, id, errors);
        expect(errors).toEqual([]);
      });

      it('keeps the English ending captions', () => {
        for (const [k, v] of Object.entries(REF.game.ending)) {
          expect(msgs.game.ending[k as keyof typeof REF.game.ending].caption).toBe(v.caption);
        }
      });
    });
  }

  it('fmt fills placeholders and keeps unknown ones', () => {
    expect(fmt('{a} / {b}', { a: 1 })).toBe('1 / {b}');
  });

  it('maps browser language tags', () => {
    expect(matchLocale('zh-Hant-TW')).toBe('zh-TW');
    expect(matchLocale('zh-HK')).toBe('zh-TW');
    expect(matchLocale('zh-CN')).toBe('zh-CN');
    expect(matchLocale('zh-Hans')).toBe('zh-CN');
    expect(matchLocale('ja-JP')).toBe('ja');
    expect(matchLocale('ko-KR')).toBe('ko');
    expect(matchLocale('vi')).toBe('vi');
    expect(matchLocale('en-GB')).toBe('en');
    expect(matchLocale('es-419')).toBe('es');
    expect(matchLocale('fr-FR')).toBeNull();
  });
});
