// 結局圖卡(1080 × 1350 直式 4:5,IG / Threads / LINE 都好用):
// 結局當下的 3D 場景截圖 + 結局 + 今晚的組合(稀有度、你 × 對方、說明)+ 收集進度 + 網址,畫在 canvas 上輸出 PNG。
import { COMBO_IDS, PERSONA_EMOJI, type Persona, type Rarity } from '../game/titles';
import type { GameState } from '../game/types';
import { fmt, m } from '../i18n';
import type { ComboView } from './screens';

export const CARD_W = 1080;
export const CARD_H = 1350;

const FONT_STACK =
  "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'PingFang TC', 'Hiragino Sans', 'Noto Sans CJK TC', 'Microsoft JhengHei', 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
const font = (px: number, weight = 700) => `${weight} ${px}px ${FONT_STACK}`;

/** [底色 1, 底色 2, 字色](和 CSS 的稀有度徽章同色) */
const RARITY_FILL: Record<Rarity, [string, string, string]> = {
  N: ['#3a3658', '#3a3658', '#d6d1ee'],
  R: ['#1f4f86', '#2a64a8', '#d5ebff'],
  SR: ['#5b2b8f', '#7a3cc0', '#f0dcff'],
  SSR: ['#ffd54a', '#ff9f1a', '#3a2400'],
};
const RARITY_STARS: Record<Rarity, string> = { N: '★', R: '★★', SR: '★★★', SSR: '★★★★' };
/** 結局風格 → 標籤 [底色, 字色] */
const STYLE_FILL: Record<'wasted' | 'passed' | 'neutral', [string, string]> = {
  wasted: ['#b3001b', '#ffffff'],
  passed: ['#e6b422', '#2a1d00'],
  neutral: ['#b98bb0', '#ffffff'],
};

// ───────────── 斷行(純函式,有測試) ─────────────

/** 中日文字(逐字可斷行) */
const CJK = /[⺀-⿿぀-ヿ㐀-䶿一-鿿豈-﫿　-〿＀-￯]/;
/** 不放在行首的標點(接回上一行) */
const NO_LINE_START = /^[,.!?;:，。、！？；：」』）)…〜~]$/;

/**
 * 依寬度斷行:中日文逐字、其他語言以空白分詞(韓文也是);單一個詞比一整行還寬就逐字切。
 * 超過 maxLines 行時截斷,最後一行補「…」。measure 回傳字串的寬度(canvas 的 measureText)。
 */
export function wrapLines(text: string, maxWidth: number, measure: (s: string) => number, maxLines = Infinity): string[] {
  const tokens: string[] = [];
  for (const part of text.split(/(\s+)/)) {
    if (!part) continue;
    if (/^\s+$/.test(part)) {
      tokens.push(' ');
      continue;
    }
    let buf = '';
    for (const ch of part) {
      if (CJK.test(ch)) {
        if (buf) tokens.push(buf);
        buf = '';
        tokens.push(ch);
      } else buf += ch;
    }
    if (buf) tokens.push(buf);
  }

  const lines: string[] = [];
  let line = '';
  const flush = () => {
    const t = line.trim();
    if (t) lines.push(t);
    line = '';
  };
  for (const tok of tokens) {
    if (tok === ' ') {
      if (line) line += ' ';
      continue;
    }
    if (measure((line + tok).trim()) <= maxWidth) {
      line += tok;
      continue;
    }
    if (NO_LINE_START.test(tok) && line.trim()) {
      line += tok; // 標點不換到下一行開頭(允許稍微超出)
      continue;
    }
    flush();
    if (measure(tok) > maxWidth) {
      for (const ch of tok) {
        if (line && measure(line + ch) > maxWidth) flush();
        line += ch;
      }
    } else line = tok;
  }
  flush();

  if (lines.length <= maxLines) return lines;
  const keep = lines.slice(0, maxLines);
  let last = [...keep[maxLines - 1]];
  while (last.length && measure(last.join('') + '…') > maxWidth) last = last.slice(0, -1);
  keep[maxLines - 1] = last.join('').trimEnd() + '…';
  return keep;
}

// ───────────── 繪製 ─────────────

export interface CardInput {
  state: GameState;
  combo: ComboView;
  /** 3D 場景截圖(沒有 WebGL 時 null → 換成插圖) */
  snapshot: HTMLCanvasElement | null;
  /** 顯示在卡片底部的網址(不含 https://) */
  host: string;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}

/** 字距加寬的一行(canvas letterSpacing 不是每個瀏覽器都有,逐字畫) */
function spaced(g: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number): void {
  const chars = [...text];
  const widths = chars.map((c) => g.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = cx - total / 2;
  g.textAlign = 'left';
  chars.forEach((c, i) => {
    g.fillText(c, x, y);
    x += widths[i] + spacing;
  });
  g.textAlign = 'center';
}

/** 圓角膠囊 + 文字;回傳寬度。x 是左緣,y 是中線 */
function pill(g: CanvasRenderingContext2D, x: number, y: number, text: string, px: number, fill: string | CanvasGradient, color: string, padX = 20): number {
  g.font = font(px, 800);
  const w = g.measureText(text).width + padX * 2;
  const h = px * 1.7;
  roundRect(g, x, y - h / 2, w, h, h / 2);
  g.fillStyle = fill;
  g.fill();
  g.fillStyle = color;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(text, x + padX, y + 1);
  g.textBaseline = 'alphabetic';
  g.textAlign = 'center';
  return w;
}

// 截圖下方各段的間距(量文字高度、決定截圖高度時共用)
const ROW_GAP = 62;
const NAME_GAP = 48;
const CHIP_GAP = 32;
const CHIP_H = 92;
const DESC_GAP = 52;
const DESC_LH = 46;

export function drawShareCard(g: CanvasRenderingContext2D, o: CardInput): void {
  const W = CARD_W;
  const H = CARD_H;
  const PAD = 44;
  const ui = m().ui;
  const gm = m().game;
  const c = o.combo;
  const r = c.rarity;

  // 背景:夜空漸層 + 上方粉色光暈 + 依組合固定的星星
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#221a48');
  bg.addColorStop(0.55, '#150f2e');
  bg.addColorStop(1, '#0b0916');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const glow = g.createRadialGradient(W / 2, 0, 40, W / 2, 0, 760);
  glow.addColorStop(0, 'rgba(255,126,182,0.24)');
  glow.addColorStop(1, 'rgba(255,126,182,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, W, H);
  let seed = c.index * 9301 + 49297;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 80; i++) {
    g.fillStyle = `rgba(236,232,255,${0.2 + rnd() * 0.55})`;
    g.beginPath();
    g.arc(rnd() * W, rnd() * H, 0.6 + rnd() * 1.8, 0, Math.PI * 2);
    g.fill();
  }

  // 稀有卡片的外框:超稀有紫、傳說金
  if (r === 'SR' || r === 'SSR') {
    const frame = g.createLinearGradient(0, 0, W, H);
    frame.addColorStop(0, RARITY_FILL[r][0]);
    frame.addColorStop(1, RARITY_FILL[r][1]);
    g.lineWidth = 10;
    g.strokeStyle = frame;
    roundRect(g, 14, 14, W - 28, H - 28, 40);
    g.stroke();
  }

  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';

  // 標題
  const title = ui.start.title;
  let size = 66;
  g.font = font(size, 900);
  while (g.measureText(title).width > W - 2 * PAD - 60 && size > 34) g.font = font((size -= 2), 900);
  const tg = g.createLinearGradient(0, 40, 0, 104);
  tg.addColorStop(0, '#ffffff');
  tg.addColorStop(1, '#ffc1dc');
  g.fillStyle = tg;
  g.fillText(title, W / 2, 98);
  g.font = font(22, 600);
  g.fillStyle = 'rgba(214,209,238,0.85)';
  spaced(g, ui.start.subtitle, W / 2, 134, 9);

  // 先量好文字(組合名稱最多兩行、說明最多兩行),再決定截圖能多高:文字永遠完整,截圖讓位
  const maxW = W - 2 * PAD - 20;
  const name = gm.combo[c.id].name;
  let nameSize = 84;
  g.font = font(nameSize, 900);
  let nameLines = wrapLines(name, maxW, (s) => g.measureText(s).width, 2);
  while (nameLines.length > 1 && nameSize > 60) {
    g.font = font((nameSize -= 6), 900);
    nameLines = wrapLines(name, maxW, (s) => g.measureText(s).width, 2);
  }
  g.font = font(33, 500);
  const descLines = wrapLines(gm.combo[c.id].desc, maxW, (s) => g.measureText(s).width, 2);
  const below =
    ROW_GAP + NAME_GAP + nameSize * 0.85 + (nameLines.length - 1) * nameSize * 1.12 + CHIP_GAP + CHIP_H + DESC_GAP + (descLines.length - 1) * DESC_LH + 14;
  const footerTop = H - 150;

  // 3D 場景截圖(裁成框的比例,圓角)
  const ix = PAD;
  const iy = 158;
  const iw = W - 2 * PAD;
  const ih = Math.max(470, Math.min(660, footerTop - iy - below));
  g.save();
  roundRect(g, ix, iy, iw, ih, 34);
  g.clip();
  if (o.snapshot && o.snapshot.width > 0 && o.snapshot.height > 0) {
    const s = o.snapshot;
    const sa = s.width / s.height;
    const ta = iw / ih;
    let sw = s.width;
    let sh = s.height;
    if (sa > ta) sw = sh * ta;
    else sh = sw / ta;
    g.drawImage(s, (s.width - sw) / 2, (s.height - sh) / 2, sw, sh, ix, iy, iw, ih);
  } else {
    const ph = g.createLinearGradient(0, iy, 0, iy + ih);
    ph.addColorStop(0, '#2a2350');
    ph.addColorStop(1, '#141030');
    g.fillStyle = ph;
    g.fillRect(ix, iy, iw, ih);
    g.font = font(220, 400);
    g.fillStyle = '#ffffff';
    g.textBaseline = 'middle';
    g.fillText('🛏️', W / 2, iy + ih / 2);
    g.textBaseline = 'alphabetic';
  }
  const shade = g.createLinearGradient(0, iy + ih - 170, 0, iy + ih);
  shade.addColorStop(0, 'rgba(10,8,22,0)');
  shade.addColorStop(1, 'rgba(10,8,22,0.7)');
  g.fillStyle = shade;
  g.fillRect(ix, iy + ih - 170, iw, 170);
  g.restore();
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(255,255,255,0.16)';
  roundRect(g, ix, iy, iw, ih, 34);
  g.stroke();
  // 結局標籤(截圖左下)
  const e = o.state.ending;
  if (e) {
    const [fill, color] = STYLE_FILL[e.style];
    pill(g, ix + 26, iy + ih - 50, `${gm.ending[e.id].title} · ${e.caption}`, 30, fill, color, 24);
  }

  // 今晚的組合:稀有度 + 標籤 + NEW
  let y = iy + ih + ROW_GAP;
  g.font = font(28, 800);
  const rarityText = `${RARITY_STARS[r]} ${ui.ending.rarity[r]}`;
  const labelText = ui.ending.comboLabel;
  const rw = g.measureText(rarityText).width + 40;
  g.font = font(28, 700);
  const lw = g.measureText(labelText).width;
  g.font = font(26, 900);
  const nw = c.isNew ? g.measureText(ui.ending.newCombo).width + 32 : 0;
  const rowW = rw + 18 + lw + (c.isNew ? 18 + nw : 0);
  let x = W / 2 - rowW / 2;
  const rfill = g.createLinearGradient(x, 0, x + rw, 0);
  rfill.addColorStop(0, RARITY_FILL[r][0]);
  rfill.addColorStop(1, RARITY_FILL[r][1]);
  if (r === 'SSR') {
    g.save();
    g.shadowColor = 'rgba(255,190,60,0.85)';
    g.shadowBlur = 26;
  }
  x += pill(g, x, y, rarityText, 28, rfill, RARITY_FILL[r][2]) + 18;
  if (r === 'SSR') g.restore();
  g.font = font(28, 700);
  g.fillStyle = 'rgba(214,209,238,0.95)';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(labelText, x, y + 1);
  g.textBaseline = 'alphabetic';
  g.textAlign = 'center';
  x += lw + 18;
  if (c.isNew) pill(g, x, y, ui.ending.newCombo, 26, '#ff4d6d', '#ffffff', 16);

  // 組合名稱(最多兩行,太長就縮字)
  y += NAME_GAP + nameSize * 0.85;
  g.font = font(nameSize, 900);
  g.fillStyle = '#fff4c9';
  for (const [i, l] of nameLines.entries()) g.fillText(l, W / 2, y + i * nameSize * 1.12);
  y += (nameLines.length - 1) * nameSize * 1.12 + CHIP_GAP;

  // 你 × 對方
  const chip = (p: Persona, label: string) => ({ label, text: `${PERSONA_EMOJI[p]} ${gm.persona[p].name}` });
  const chips = [chip(c.me, ui.common.you), chip(c.partner, ui.common.partner)];
  g.font = font(32, 800);
  const cws = chips.map((ch) => Math.max(g.measureText(ch.text).width, 60) + 48);
  const xw = 56;
  const chipH = CHIP_H;
  let cx = W / 2 - (cws[0] + xw + cws[1]) / 2;
  chips.forEach((ch, i) => {
    roundRect(g, cx, y, cws[i], chipH, 22);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.fill();
    g.font = font(22, 600);
    g.fillStyle = 'rgba(214,209,238,0.8)';
    g.fillText(ch.label, cx + cws[i] / 2, y + 32);
    g.font = font(32, 800);
    g.fillStyle = '#ffffff';
    g.fillText(ch.text, cx + cws[i] / 2, y + 74);
    cx += cws[i];
    if (i === 0) {
      g.font = font(36, 800);
      g.fillStyle = 'rgba(214,209,238,0.7)';
      g.fillText('×', cx + xw / 2, y + chipH / 2 + 13);
      cx += xw;
    }
  });
  y += chipH + DESC_GAP;

  // 說明(最多兩行)
  g.font = font(33, 500);
  g.fillStyle = '#e2dbfb';
  for (const [i, l] of descLines.entries()) g.fillText(l, W / 2, y + i * DESC_LH);

  // 底部:你能收集到幾種? + 網址 · 收集進度
  g.font = font(34, 800);
  g.fillStyle = '#ffffff';
  g.fillText(ui.shareCard.cta, W / 2, H - 92);
  g.font = font(26, 600);
  g.fillStyle = 'rgba(214,209,238,0.85)';
  g.fillText(`${o.host}  ·  🏆 ${fmt(ui.gallery.progress, { n: c.collected, max: COMBO_IDS.length })}`, W / 2, H - 48);
}

/** 畫好輸出 PNG */
export async function renderShareCard(o: CardInput): Promise<Blob> {
  const cv = document.createElement('canvas');
  cv.width = CARD_W;
  cv.height = CARD_H;
  const g = cv.getContext('2d');
  if (!g) throw new Error('canvas 2d unavailable');
  drawShareCard(g, o);
  return new Promise((resolve, reject) => cv.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/png'));
}
