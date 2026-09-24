// 棉被(SCENE-RIG §3):PlaneGeometry 高度場,每幀依兩人的身體線段重寫 position / normal attribute(不 new 任何東西)。
// offset 只平移 mesh(x = offset × 0.9);鼓包一律用世界座標算,所以人挪動時鼓包跟著人走、棉被被拉走時人就露出來。
import * as THREE from 'three';

const WIDTH = 1.8;
const LENGTH = 1.62; // 規格 1.6(從胸口蓋到床尾並垂下)
const SEG_X = 24;
const SEG_Z = 20;
/** 棉被靠床頭那條邊的世界 z(胸口) */
const TOP_Z = -0.2; // 規格 −0.35;露出肩膀與睡衣顏色
export const BLANKET_Z = TOP_Z + LENGTH / 2;

const BASE = 0.58; // 平鋪在床墊(0.55)上
const THICK = 0.03; // 蓋在身體上的厚度
const CAP = 1.0; // 鼓包最高(坐起來時被子停在腰腹)
const FLOOR = 0.025;
const SIDE_EDGE = 1.05; // 超過這條線開始垂下(床墊 ±1.1、床架 ±1.15)
const FOOT_EDGE = 1.13; // 床墊尾端 z = 1.2

export class Blanket {
  readonly mesh: THREE.Mesh;
  /** 皺摺幅度倍率(firm ×2、rough ×3、大幅拉扯 ×2.5,場景負責衰減回 1) */
  rippleAmp = 1;
  /** 皺摺相位(幅度放大時往前推,看起來像被子被扯動的波) */
  ripplePhase = 0;

  private readonly geo: THREE.PlaneGeometry;
  private readonly mat: THREE.MeshStandardMaterial;
  private readonly tex: THREE.CanvasTexture;
  private readonly pos: Float32Array;
  private readonly nor: Float32Array;
  private readonly base: Float32Array;
  private readonly cols = SEG_X + 1;
  private readonly rows = SEG_Z + 1;

  constructor() {
    this.geo = new THREE.PlaneGeometry(WIDTH, LENGTH, SEG_X, SEG_Z);
    this.geo.rotateX(-Math.PI / 2); // 局部 (x, 0, z),y = 高度
    const posAttr = this.geo.getAttribute('position') as THREE.BufferAttribute;
    const norAttr = this.geo.getAttribute('normal') as THREE.BufferAttribute;
    posAttr.setUsage(THREE.DynamicDrawUsage);
    norAttr.setUsage(THREE.DynamicDrawUsage);
    this.pos = posAttr.array as Float32Array;
    this.nor = norAttr.array as Float32Array;
    this.base = new Float32Array(posAttr.count * 2);
    for (let i = 0; i < posAttr.count; i++) {
      this.base[i * 2] = this.pos[i * 3];
      this.base[i * 2 + 1] = this.pos[i * 3 + 2];
    }

    this.tex = quiltTexture();
    this.mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.tex,
      roughness: 0.95,
      metalness: 0,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.name = 'blanket';
    this.mesh.position.set(0, 0, BLANKET_Z);
    this.mesh.frustumCulled = false; // 頂點每幀改,bounding sphere 不可信
  }

  /**
   * @param segs 身體線段(每段 9 個數:ax ay az bx by bz r σ w,世界座標)
   * @param n 線段數
   */
  rebuild(segs: Float32Array, n: number): void {
    const p = this.pos;
    const mx = this.mesh.position.x;
    const mz = this.mesh.position.z;
    const my = this.mesh.position.y;
    const amp = this.rippleAmp;
    const ph = this.ripplePhase;
    const count = this.cols * this.rows;

    for (let i = 0; i < count; i++) {
      const wx = this.base[i * 2] + mx;
      const wz = this.base[i * 2 + 1] + mz;

      // 鼓包:對每條身體線段取 XZ 最近點,平頂高斯(super-Gaussian)隆起;取 max 不加總
      let h = BASE;
      for (let s = 0; s < n; s++) {
        const o = s * 9;
        const w = segs[o + 8];
        if (w <= 0) continue;
        const ax = segs[o];
        const ay = segs[o + 1];
        const az = segs[o + 2];
        const dx = segs[o + 3] - ax;
        const dy = segs[o + 4] - ay;
        const dz = segs[o + 5] - az;
        const len2 = dx * dx + dz * dz;
        let u = len2 > 1e-8 ? ((wx - ax) * dx + (wz - az) * dz) / len2 : 0;
        u = u < 0 ? 0 : u > 1 ? 1 : u;
        let top = ay + dy * u + segs[o + 6] + THICK;
        if (top > CAP) top = CAP;
        const peak = (top - BASE) * w;
        if (peak <= 0) continue;
        const ex = wx - (ax + dx * u);
        const ez = wz - (az + dz * u);
        const sig = segs[o + 7];
        const q = (ex * ex + ez * ez) / (2 * sig * sig);
        const hh = BASE + peak * Math.exp(-q * q);
        if (hh > h) h = hh;
      }
      h += amp * (0.012 * Math.sin(5.1 * wx + 3.7 * wz + ph) + 0.008 * Math.sin(7.3 * wz - 0.8 * ph));

      // 垂下床沿:先圓滑地翻過床墊邊,再幾乎垂直往下,碰到地板就攤平
      let ox = wx;
      let oz = wz;
      const overX = Math.abs(wx) - SIDE_EDGE;
      if (overX > 0) {
        const hang = drape(overX, Math.min(h, BASE + 0.02) + my);
        ox = Math.sign(wx) * (SIDE_EDGE + hang.out);
        h = hang.y - my;
      }
      const overZ = wz - FOOT_EDGE;
      if (overZ > 0) {
        const hang = drape(overZ, Math.min(h, BASE + 0.05) + my);
        oz = FOOT_EDGE + hang.out;
        h = Math.min(h, hang.y - my);
      }
      if (h + my < FLOOR) h = FLOOR - my;

      p[i * 3] = ox - mx;
      p[i * 3 + 1] = h;
      p[i * 3 + 2] = oz - mz;
    }
    this.computeNormals();
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
  }

  /** 規則網格 → 中央差分法線(比 computeVertexNormals 省,且不配置物件) */
  private computeNormals(): void {
    const p = this.pos;
    const nrm = this.nor;
    const cols = this.cols;
    const rows = this.rows;
    for (let iz = 0; iz < rows; iz++) {
      const zu = (iz > 0 ? iz - 1 : iz) * cols;
      const zd = (iz < rows - 1 ? iz + 1 : iz) * cols;
      for (let ix = 0; ix < cols; ix++) {
        const i = iz * cols + ix;
        const l = (iz * cols + (ix > 0 ? ix - 1 : ix)) * 3;
        const r = (iz * cols + (ix < cols - 1 ? ix + 1 : ix)) * 3;
        const u = (zu + ix) * 3;
        const d = (zd + ix) * 3;
        const tx = p[r] - p[l];
        const ty = p[r + 1] - p[l + 1];
        const tz = p[r + 2] - p[l + 2];
        const bx = p[d] - p[u];
        const by = p[d + 1] - p[u + 1];
        const bz = p[d + 2] - p[u + 2];
        // n = b × t
        let nx = by * tz - bz * ty;
        let ny = bz * tx - bx * tz;
        let nz = bx * ty - by * tx;
        const len = Math.hypot(nx, ny, nz) || 1;
        nx /= len;
        ny /= len;
        nz /= len;
        nrm[i * 3] = nx;
        nrm[i * 3 + 1] = ny;
        nrm[i * 3 + 2] = nz;
      }
    }
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
    this.tex.dispose();
  }
}

const hangOut = { out: 0, y: 0 };

/** 超出床沿的布長 s → 水平外移與高度(共用輸出物件,不配置) */
function drape(s: number, y0: number): { out: number; y: number } {
  const bend = 0.12;
  if (s <= bend) {
    hangOut.out = s * 0.95;
    hangOut.y = y0 - s * s * 2.5;
  } else {
    const yb = y0 - bend * bend * 2.5;
    const fall = s - bend;
    const toFloor = (yb - FLOOR) / 0.99;
    if (fall <= toFloor) {
      hangOut.out = bend * 0.95 + fall * 0.08;
      hangOut.y = yb - fall * 0.99;
    } else {
      hangOut.out = bend * 0.95 + toFloor * 0.08 + (fall - toFloor) * 0.9;
      hangOut.y = FLOOR;
    }
  }
  return hangOut;
}

/** 絎縫格紋 + 小星星(直接畫成被子的顏色,material.color 用白) */
function quiltTexture(): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = '#6b7fb3';
  g.fillRect(0, 0, S, S);
  // 格子間微微的明暗(像鋪棉鼓起)
  const grad = g.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S * 0.62);
  grad.addColorStop(0, 'rgba(255,255,255,0.10)');
  grad.addColorStop(1, 'rgba(0,0,30,0.10)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  // 絎縫線(虛線)
  g.strokeStyle = 'rgba(40,50,95,0.55)';
  g.lineWidth = 3;
  g.setLineDash([10, 7]);
  g.strokeRect(1.5, 1.5, S - 3, S - 3);
  g.setLineDash([]);
  // 中央小星星
  g.fillStyle = '#d9e0f7';
  star(g, S / 2, S / 2, 16, 7);
  for (const [x, y] of [
    [S * 0.22, S * 0.25],
    [S * 0.78, S * 0.74],
  ]) {
    g.beginPath();
    g.arc(x, y, 4, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = 4;
  return tex;
}

function star(g: CanvasRenderingContext2D, cx: number, cy: number, ro: number, ri: number): void {
  g.beginPath();
  for (let k = 0; k < 10; k++) {
    const r = k % 2 ? ri : ro;
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
}
