// 程式產生的貼圖(canvas):睡衣花紋、棉被(顏色 + 鋪棉法線)、漫畫符號、接觸陰影。不用外部圖檔、不用 emoji。
import * as THREE from 'three';
import type { Role } from '../game/types';

function canvas(w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function colorTex(c: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ───────────── 睡衣 ─────────────

/** 睡衣底色與滾邊色(同一套:上衣、褲子、袖口、領口) */
export const PAJAMA_STYLE: Record<Role, { top: string; pants: string; trim: number; button: number; sheen: number }> = {
  male: { top: '#4a6fa5', pants: '#3e5d8f', trim: 0xd9e5f7, button: 0xf3e7c8, sheen: 0x9fb8e8 },
  female: { top: '#c98bb9', pants: '#b477a6', trim: 0xf8e0ee, button: 0xfff7fb, sheen: 0xf2c4e3 },
};

/**
 * 睡衣花紋(64×64 無縫):男方寬直條紋 + 細白線,女方奶油色圓點。
 * 膠囊的 u 繞圓周、v 沿身長 → 直條紋只沿 u 變化;圓點用 u:v 接近實際周長:長度的比例重複。
 */
export function pajamaTexture(role: Role, base: string): THREE.CanvasTexture {
  const S = 64;
  const [c, g] = canvas(S);
  g.fillStyle = base;
  g.fillRect(0, 0, S, S);
  if (role === 'male') {
    g.fillStyle = 'rgba(255,255,255,0.16)';
    g.fillRect(34, 0, 24, S);
    g.fillStyle = 'rgba(236,243,255,0.85)';
    g.fillRect(16, 0, 3, S);
  } else {
    g.fillStyle = '#fff1f8';
    const dot = (x: number, y: number, r: number) => {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    };
    dot(S / 2, S / 2, 8);
    for (const [x, y] of [
      [0, 0],
      [S, 0],
      [0, S],
      [S, S],
    ])
      dot(x, y, 8);
  }
  const tex = colorTex(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** 同一張圖、不同重複次數(共用 image,各自的 repeat) */
export function repeated(tex: THREE.Texture, u: number, v: number): THREE.Texture {
  const t = tex.clone();
  t.repeat.set(u, v);
  t.needsUpdate = true;
  return t;
}

// ───────────── 棉被 ─────────────

/** 棉被格子配置(貼圖與幾何鼓起共用):內區 COLS × ROWS 格,外圍一圈滾邊 */
export const QUILT = { cols: 6, rows: 5, border: 0.035 } as const;

/**
 * 整張棉被一張圖(不重複):外圍奶油色滾邊帶、內區一格一格的鋪棉(中間亮、縫線處暗)、星星與月亮。
 * u = 0 → 男方那側(−x),v = 1 → 床頭那端(canvas 上緣)。
 */
export function blanketTexture(): THREE.CanvasTexture {
  const W = 1024;
  const H = 922; // 1.8 × 1.62 的比例
  const [c, g] = canvas(W, H);
  const bx = QUILT.border * W;
  const by = QUILT.border * H;
  // 滾邊帶
  g.fillStyle = '#d8d1ee';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(120,108,170,0.55)';
  g.lineWidth = 2.5;
  g.setLineDash([9, 6]);
  g.strokeRect(bx * 0.45, by * 0.45, W - bx * 0.9, H - by * 0.9);
  g.setLineDash([]);

  const iw = W - 2 * bx;
  const ih = H - 2 * by;
  const cw = iw / QUILT.cols;
  const ch = ih / QUILT.rows;
  for (let j = 0; j < QUILT.rows; j++) {
    for (let i = 0; i < QUILT.cols; i++) {
      const x = bx + i * cw;
      const y = by + j * ch;
      const cx = x + cw / 2;
      const cy = y + ch / 2;
      g.fillStyle = (i + j) % 2 ? '#6479ad' : '#6b7fb3';
      g.fillRect(x, y, cw + 0.5, ch + 0.5);
      // 鋪棉鼓起:中間亮、邊緣暗(和法線貼圖同一個形狀)
      const grad = g.createRadialGradient(cx, cy - ch * 0.08, 4, cx, cy, Math.max(cw, ch) * 0.62);
      grad.addColorStop(0, 'rgba(255,255,255,0.14)');
      grad.addColorStop(0.65, 'rgba(255,255,255,0)');
      grad.addColorStop(1, 'rgba(10,14,50,0.22)');
      g.fillStyle = grad;
      g.fillRect(x, y, cw + 0.5, ch + 0.5);
      // 圖案:星星、月亮交錯,再點幾顆小星點
      g.fillStyle = '#e4e9fb';
      if ((i + j) % 2 === 0) star(g, cx, cy, 20, 8.5);
      else moon(g, cx, cy, 17);
      g.fillStyle = 'rgba(228,233,251,0.8)';
      for (const [dx, dy] of [
        [-0.3, -0.28],
        [0.31, 0.26],
        [0.26, -0.33],
      ]) {
        g.beginPath();
        g.arc(cx + dx * cw, cy + dy * ch, 3.2, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  // 縫線(虛線):格子之間與內區外框
  g.strokeStyle = 'rgba(38,48,98,0.6)';
  g.lineWidth = 3;
  g.setLineDash([12, 8]);
  g.beginPath();
  for (let i = 0; i <= QUILT.cols; i++) {
    g.moveTo(bx + i * cw, by);
    g.lineTo(bx + i * cw, H - by);
  }
  for (let j = 0; j <= QUILT.rows; j++) {
    g.moveTo(bx, by + j * ch);
    g.lineTo(W - bx, by + j * ch);
  }
  g.stroke();
  g.setLineDash([]);

  const tex = colorTex(c);
  tex.anisotropy = 8;
  return tex;
}

/** 鋪棉高度(0..1):內區每格中間鼓、縫線處凹;滾邊帶平。u,v ∈ [0,1] */
export function quiltHeight(u: number, v: number): number {
  const b = QUILT.border;
  if (u < b || u > 1 - b || v < b || v > 1 - b) return 0.35;
  const fx = (((u - b) / (1 - 2 * b)) * QUILT.cols) % 1;
  const fy = (((v - b) / (1 - 2 * b)) * QUILT.rows) % 1;
  return Math.pow(Math.sin(Math.PI * fx) * Math.sin(Math.PI * fy), 0.55);
}

/** 鋪棉的法線貼圖(切線空間,線性色彩):讓每一格在燈光下看起來是鼓起來的 */
export function blanketNormalTexture(): THREE.CanvasTexture {
  const W = 512;
  const H = 461;
  const [c, g] = canvas(W, H);
  const img = g.createImageData(W, H);
  const hgt = new Float32Array(W * H);
  // canvas 第 y 列 = v = 1 − y/(H−1)(CanvasTexture 預設 flipY)
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) hgt[y * W + x] = quiltHeight(x / (W - 1), 1 - y / (H - 1));
  const k = 5.5; // 坡度 → 法線傾斜
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const l = hgt[y * W + Math.max(0, x - 1)];
      const r = hgt[y * W + Math.min(W - 1, x + 1)];
      const u = hgt[Math.max(0, y - 1) * W + x];
      const d = hgt[Math.min(H - 1, y + 1) * W + x];
      const dhdu = (r - l) * 0.5 * k;
      const dhdv = (u - d) * 0.5 * k; // v 往上 = canvas y 往下的反方向
      let nx = -dhdu;
      let ny = -dhdv;
      let nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len;
      ny /= len;
      nz /= len;
      const o = (y * W + x) * 4;
      img.data[o] = (nx * 0.5 + 0.5) * 255;
      img.data[o + 1] = (ny * 0.5 + 0.5) * 255;
      img.data[o + 2] = (nz * 0.5 + 0.5) * 255;
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ───────────── 漫畫符號(sprite 用,128×128;透明背景) ─────────────

export type SymbolKind = 'vein' | 'sweat' | 'gloom' | 'sparkle' | 'dizzy' | 'zap' | 'shiver';

export function symbolTexture(kind: SymbolKind): THREE.CanvasTexture {
  const wide = kind === 'shiver';
  const [c, g] = canvas(wide ? 256 : 128, 128);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  switch (kind) {
    case 'vein': {
      // 💢:四段往中心凸的弧,白邊紅芯
      const piece = (w: number, color: string) => {
        g.strokeStyle = color;
        g.lineWidth = w;
        for (let k = 0; k < 4; k++) {
          g.save();
          g.translate(64, 64);
          g.rotate((k * Math.PI) / 2);
          g.beginPath();
          g.moveTo(-46, -12);
          g.quadraticCurveTo(-13, -13, -12, -46);
          g.stroke();
          g.restore();
        }
      };
      piece(24, '#ffffff');
      piece(12, '#e8283c');
      break;
    }
    case 'sweat': {
      const drop = () => {
        g.beginPath();
        g.moveTo(64, 12);
        g.bezierCurveTo(70, 34, 98, 62, 98, 84);
        g.arc(64, 84, 34, 0, Math.PI);
        g.bezierCurveTo(30, 62, 58, 34, 64, 12);
        g.closePath();
      };
      drop();
      g.fillStyle = '#9fdcff';
      g.fill();
      g.lineWidth = 7;
      g.strokeStyle = '#2d6fae';
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath();
      g.ellipse(52, 86, 7, 12, -0.4, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'gloom': {
      // 額頭三條黑線(上深下淡)
      for (const [x, len] of [
        [38, 84],
        [64, 104],
        [90, 76],
      ]) {
        const grad = g.createLinearGradient(0, 10, 0, 10 + len);
        grad.addColorStop(0, 'rgba(38,24,70,0.95)');
        grad.addColorStop(1, 'rgba(38,24,70,0)');
        g.strokeStyle = grad;
        g.lineWidth = 9;
        g.beginPath();
        g.moveTo(x, 12);
        g.lineTo(x, 10 + len);
        g.stroke();
      }
      break;
    }
    case 'sparkle': {
      g.beginPath();
      const pts = 4;
      for (let k = 0; k < pts * 2; k++) {
        const r = k % 2 ? 13 : 56;
        const a = -Math.PI / 2 + (k * Math.PI) / pts;
        g.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
      }
      g.closePath();
      g.fillStyle = '#fff6c2';
      g.fill();
      g.lineWidth = 6;
      g.strokeStyle = '#e2a400';
      g.stroke();
      break;
    }
    case 'dizzy': {
      g.fillStyle = '#ffd84a';
      g.strokeStyle = '#8a5a00';
      g.lineWidth = 7;
      star(g, 64, 66, 52, 23);
      g.stroke();
      break;
    }
    case 'zap': {
      g.beginPath();
      g.moveTo(58, 6);
      g.lineTo(26, 70);
      g.lineTo(58, 70);
      g.lineTo(44, 122);
      g.lineTo(102, 48);
      g.lineTo(68, 48);
      g.lineTo(86, 6);
      g.closePath();
      g.fillStyle = '#ffe95c';
      g.fill();
      g.lineWidth = 7;
      g.strokeStyle = '#6b4f00';
      g.stroke();
      break;
    }
    case 'shiver': {
      // 冷得發抖:左右各兩道短弧 (( ))
      g.strokeStyle = '#bfe6ff';
      g.lineWidth = 9;
      for (const s of [-1, 1]) {
        for (const k of [0, 1]) {
          const x = 128 + s * (70 + k * 26);
          g.beginPath();
          g.arc(x - s * 40, 64, 44, s > 0 ? -0.6 : Math.PI - 0.6, s > 0 ? 0.6 : Math.PI + 0.6);
          g.stroke();
        }
      }
      break;
    }
  }
  return colorTex(c);
}

/** 臉紅加強的三條斜線(貼在腮紅上) */
export function blushHatchTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(64);
  g.strokeStyle = '#ff5c86';
  g.lineWidth = 5;
  g.lineCap = 'round';
  for (const x of [16, 30, 44]) {
    g.beginPath();
    g.moveTo(x - 5, 46);
    g.lineTo(x + 5, 18);
    g.stroke();
  }
  return colorTex(c);
}

// ───────────── 接觸陰影 ─────────────

/** 柔和的圓形陰影(中心深、邊緣透明);非等比縮放成橢圓 */
export function softShadowTexture(): THREE.CanvasTexture {
  const S = 128;
  const [c, g] = canvas(S);
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(8,6,20,0.62)');
  grad.addColorStop(0.45, 'rgba(8,6,20,0.38)');
  grad.addColorStop(1, 'rgba(8,6,20,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  return colorTex(c);
}

/** 棉被邊緣落在床單上的陰影帶:u = 0 在被緣(深)→ u = 1 淡出 */
export function edgeShadowTexture(): THREE.CanvasTexture {
  const [c, g] = canvas(64, 4);
  const grad = g.createLinearGradient(0, 0, 64, 0);
  grad.addColorStop(0, 'rgba(8,6,20,0.5)');
  grad.addColorStop(1, 'rgba(8,6,20,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 4);
  return colorTex(c);
}

// ───────────── 小工具 ─────────────

export function star(g: CanvasRenderingContext2D, cx: number, cy: number, ro: number, ri: number): void {
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const r = k % 2 ? ri : ro;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
}

/** 彎月:在小畫布上畫圓、再挖掉偏移的圓,貼回去(底色是漸層,不能用蓋色的方式挖) */
function moon(g: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  const S = Math.ceil(r * 2 + 4);
  const [c, m] = canvas(S);
  m.fillStyle = g.fillStyle;
  m.beginPath();
  m.arc(S / 2, S / 2, r, 0, Math.PI * 2);
  m.fill();
  m.globalCompositeOperation = 'destination-out';
  m.beginPath();
  m.arc(S / 2 + r * 0.45, S / 2 - r * 0.3, r * 0.85, 0, Math.PI * 2);
  m.fill();
  g.drawImage(c, cx - S / 2, cy - S / 2);
}
