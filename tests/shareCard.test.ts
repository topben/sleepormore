// 結局圖卡的斷行(畫面本身在瀏覽器 E2E 截圖驗證)
import { describe, expect, it } from 'vitest';
import { wrapLines } from '../src/ui/shareCard';

/** 假的量字:每個字 10 px */
const measure = (s: string) => [...s].length * 10;

describe('wrapLines', () => {
  it('CJK breaks between any two characters', () => {
    expect(wrapLines('你一句、對方一句,聊到天都快亮了。', 60, measure)).toEqual(['你一句、對方', '一句,聊到天', '都快亮了。']);
  });

  it('Latin text breaks at spaces', () => {
    expect(wrapLines('You tuck them in nice and snug', 120, measure)).toEqual(['You tuck', 'them in nice', 'and snug']);
  });

  it('closing punctuation never starts a line', () => {
    const lines = wrapLines('一二三四五。六', 50, measure);
    expect(lines[0]).toBe('一二三四五。');
    expect(lines.every((l) => !/^[。,、]/.test(l))).toBe(true);
  });

  it('a word longer than the line is split by characters', () => {
    expect(wrapLines('supercalifragilistic', 80, measure)).toEqual(['supercal', 'ifragili', 'stic']);
  });

  it('truncates to maxLines with an ellipsis that still fits', () => {
    const lines = wrapLines('一二三四五六七八九十一二三四五', 50, measure, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
    expect(measure(lines[1])).toBeLessThanOrEqual(50);
  });

  it('keeps emoji (surrogate pairs) intact', () => {
    const lines = wrapLines('🧲 拉棉被大師', 40, measure);
    expect(lines.join('')).toContain('🧲');
    for (const l of lines) expect(l).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });
});
