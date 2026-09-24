// 棉被(SCENE-RIG §3):PlaneGeometry 高度場,每幀依兩人的身體線段重寫 position / normal / color attribute(不 new 任何東西)。
// offset 只平移 mesh(x = offset × 0.9);鼓包一律用世界座標算,所以人挪動時鼓包跟著人走、棉被被拉走時人就露出來。
// 精緻化(DESIGN §14.6):一格一格鋪棉鼓起(幾何 + 法線貼圖)、外圍滾邊與捲起的邊條、凹處變暗(AO)、
// 被拉扯時順著拉的方向起皺、搶贏的那一側堆出摺子;絨布 sheen。
import * as THREE from 'three';
import { blanketNormalTexture, blanketTexture, quiltHeight } from './textures';

const WIDTH = 1.8;
const LENGTH = 1.62; // 規格 1.6(從胸口蓋到床尾並垂下)
// 鋪棉的細節靠法線貼圖,幾何只需要看得出輪廓與皺摺(每格約 5 cm)
const SEG_X = 36;
const SEG_Z = 32;
/** 棉被靠床頭那條邊的世界 z(胸口) */
const TOP_Z = -0.2; // 規格 −0.35;露出肩膀與睡衣顏色
export const BLANKET_Z = TOP_Z + LENGTH / 2;
export const BLANKET_HALF_W = WIDTH / 2;

const BASE = 0.58; // 平鋪在床墊(0.55)上
const THICK = 0.03; // 蓋在身體上的厚度
const CAP = 1.0; // 鼓包最高(坐起來時被子停在腰腹)
const FLOOR = 0.025;
const SIDE_EDGE = 1.05; // 超過這條線開始垂下(床墊 ±1.1、床架 ±1.15)
const FOOT_EDGE = 1.13; // 床墊尾端 z = 1.2
/** 鋪棉鼓起的幾何高度(法線貼圖負責細節,這裡讓輪廓也有起伏) */
const PUFF = 0.016;
/** 邊條(捲起的滾邊)半徑 */
const PIPING_R = 0.013;
const PIPING_RADIAL = 8;

export class Blanket {
  readonly mesh: THREE.Mesh;
  /** 皺摺幅度倍率(firm ×2、rough ×3、大幅拉扯 ×2.5,場景負責衰減回 1) */
  rippleAmp = 1;
  /** 皺摺相位(幅度放大時往前推,看起來像被子被扯動的波) */
  ripplePhase = 0;
  /** 拉扯張力 −1..1(正負 = 往 +x / −x 拉):順著拉的方向起皺(場景依棉被位移的速度寫入) */
  tension = 0;
  /** 堆在某一側的摺子 0..1 與方向(±1) */
  bunch = 0;
  bunchSide = 1;

  private readonly geo: THREE.PlaneGeometry;
  private readonly mat: THREE.MeshPhysicalMaterial;
  private readonly tex: THREE.CanvasTexture;
  private readonly normalTex: THREE.CanvasTexture;
  private readonly pos: Float32Array;
  private readonly nor: Float32Array;
  private readonly col: Float32Array;
  private readonly base: Float32Array;
  private readonly puff: Float32Array;
  private readonly hgt: Float32Array;
  private readonly cols = SEG_X + 1;
  private readonly rows = SEG_Z + 1;
  // 邊條
  private readonly piping: THREE.Mesh;
  private readonly pipeGeo: THREE.BufferGeometry;
  private readonly pipeMat: THREE.MeshStandardMaterial;
  private readonly pipePos: Float32Array;
  private readonly pipeNor: Float32Array;
  private readonly rim: Int32Array;

  constructor() {
    this.geo = new THREE.PlaneGeometry(WIDTH, LENGTH, SEG_X, SEG_Z);
    this.geo.rotateX(-Math.PI / 2); // 局部 (x, 0, z),y = 高度;第 0 列 = 床頭端(v = 1)
    const posAttr = this.geo.getAttribute('position') as THREE.BufferAttribute;
    const norAttr = this.geo.getAttribute('normal') as THREE.BufferAttribute;
    const uvAttr = this.geo.getAttribute('uv') as THREE.BufferAttribute;
    posAttr.setUsage(THREE.DynamicDrawUsage);
    norAttr.setUsage(THREE.DynamicDrawUsage);
    this.pos = posAttr.array as Float32Array;
    this.nor = norAttr.array as Float32Array;
    const count = posAttr.count;
    this.base = new Float32Array(count * 2);
    this.puff = new Float32Array(count);
    this.hgt = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.base[i * 2] = this.pos[i * 3];
      this.base[i * 2 + 1] = this.pos[i * 3 + 2];
      this.puff[i] = PUFF * (quiltHeight(uvAttr.getX(i), uvAttr.getY(i)) - 0.5);
    }
    this.col = new Float32Array(count * 3).fill(1);
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));

    this.tex = blanketTexture();
    this.normalTex = blanketNormalTexture();
    this.mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: this.tex,
      normalMap: this.normalTex,
      normalScale: new THREE.Vector2(0.85, 0.85),
      vertexColors: true,
      roughness: 0.9,
      metalness: 0,
      sheen: 0.9,
      sheenRoughness: 0.6,
      sheenColor: new THREE.Color(0x9aaee8),
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.name = 'blanket';
    this.mesh.position.set(0, 0, BLANKET_Z);
    this.mesh.frustumCulled = false; // 頂點每幀改,bounding sphere 不可信

    // 邊條:沿外圍一圈的細管(床頭那條邊最顯眼,像羽絨被捲起的滾邊)
    const cols = this.cols;
    const rows = this.rows;
    const rim: number[] = [];
    for (let ix = 0; ix < cols; ix++) rim.push(ix);
    for (let iz = 1; iz < rows; iz++) rim.push(iz * cols + cols - 1);
    for (let ix = cols - 2; ix >= 0; ix--) rim.push((rows - 1) * cols + ix);
    for (let iz = rows - 2; iz >= 1; iz--) rim.push(iz * cols);
    this.rim = Int32Array.from(rim);
    const n = rim.length;
    const vcount = (n + 1) * (PIPING_RADIAL + 1);
    this.pipePos = new Float32Array(vcount * 3);
    this.pipeNor = new Float32Array(vcount * 3);
    const idx: number[] = [];
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < PIPING_RADIAL; j++) {
        const a = i * (PIPING_RADIAL + 1) + j;
        const b = a + PIPING_RADIAL + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1); // 外側為正面
      }
    }
    this.pipeGeo = new THREE.BufferGeometry();
    this.pipeGeo.setAttribute('position', new THREE.BufferAttribute(this.pipePos, 3).setUsage(THREE.DynamicDrawUsage));
    this.pipeGeo.setAttribute('normal', new THREE.BufferAttribute(this.pipeNor, 3).setUsage(THREE.DynamicDrawUsage));
    this.pipeGeo.setIndex(idx);
    this.pipeMat = new THREE.MeshStandardMaterial({ color: 0xd9d2ef, roughness: 0.78, metalness: 0 });
    this.piping = new THREE.Mesh(this.pipeGeo, this.pipeMat);
    this.piping.frustumCulled = false;
    this.mesh.add(this.piping);
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
    const ten = this.tension;
    const tenAbs = Math.abs(ten);
    const tenSide = ten >= 0 ? 1 : -1;
    const bunch = this.bunch;
    const count = this.cols * this.rows;

    for (let i = 0; i < count; i++) {
      const lx = this.base[i * 2];
      const wx = lx + mx;
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
      h += this.puff[i];
      h += amp * (0.012 * Math.sin(5.1 * wx + 3.7 * wz + ph) + 0.008 * Math.sin(7.3 * wz - 0.8 * ph));
      // 拉扯:順著拉的方向(x)的長條皺摺,拉的那側最明顯
      if (tenAbs > 0.01) {
        const env = 0.25 + 0.75 * Math.max(0, Math.min(1, 0.5 + (0.5 * tenSide * lx) / (WIDTH / 2)));
        h += tenAbs * 0.024 * env * Math.sin(13 * wz + 1.7 * Math.sin(4.3 * wx) + ph * 0.5);
      }
      // 搶贏的那側堆出直向的摺子
      if (bunch > 0.01) {
        const side = Math.max(0, Math.min(1, ((this.bunchSide * lx) / (WIDTH / 2) - 0.05) / 0.6));
        h += bunch * 0.02 * side * Math.sin(17 * wx + 2.2 * Math.sin(3.1 * wz));
      }

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
      this.hgt[i] = h;
    }
    this.computeNormals();
    this.computeShade();
    this.buildPiping();
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
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

  /** 凹處變暗(近似 AO):比周圍低的頂點(兩人之間的凹谷、皺摺的谷底)顏色壓暗 */
  private computeShade(): void {
    const cols = this.cols;
    const rows = this.rows;
    const h = this.hgt;
    const c = this.col;
    for (let iz = 0; iz < rows; iz++) {
      for (let ix = 0; ix < cols; ix++) {
        const i = iz * cols + ix;
        const l = h[iz * cols + Math.max(0, ix - 2)];
        const r = h[iz * cols + Math.min(cols - 1, ix + 2)];
        const u = h[Math.max(0, iz - 2) * cols + ix];
        const d = h[Math.min(rows - 1, iz + 2) * cols + ix];
        const dip = (l + r + u + d) * 0.25 - h[i];
        const ao = 1 - Math.max(0, Math.min(0.3, dip * 4.5));
        c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = ao;
      }
    }
  }

  /** 邊條:沿外圍頂點建細管,截面用該點的被面法線(翻過床沿時跟著轉) */
  private buildPiping(): void {
    const rim = this.rim;
    const n = rim.length;
    const p = this.pos;
    const nr = this.nor;
    const out = this.pipePos;
    const on = this.pipeNor;
    for (let k = 0; k <= n; k++) {
      const i = rim[k % n];
      const prev = rim[(k - 1 + n) % n];
      const next = rim[(k + 1) % n];
      let tx = p[next * 3] - p[prev * 3];
      let ty = p[next * 3 + 1] - p[prev * 3 + 1];
      let tz = p[next * 3 + 2] - p[prev * 3 + 2];
      const tl = Math.hypot(tx, ty, tz) || 1;
      tx /= tl;
      ty /= tl;
      tz /= tl;
      // 法線去掉切線分量
      let nx = nr[i * 3];
      let ny = nr[i * 3 + 1];
      let nz = nr[i * 3 + 2];
      const dot = nx * tx + ny * ty + nz * tz;
      nx -= dot * tx;
      ny -= dot * ty;
      nz -= dot * tz;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl;
      ny /= nl;
      nz /= nl;
      // b = t × n
      const bx = ty * nz - tz * ny;
      const by = tz * nx - tx * nz;
      const bz = tx * ny - ty * nx;
      const cx = p[i * 3];
      const cy = p[i * 3 + 1];
      const cz = p[i * 3 + 2];
      for (let j = 0; j <= PIPING_RADIAL; j++) {
        const a = (j / PIPING_RADIAL) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const dx = ca * nx + sa * bx;
        const dy = ca * ny + sa * by;
        const dz = ca * nz + sa * bz;
        const o = (k * (PIPING_RADIAL + 1) + j) * 3;
        out[o] = cx + dx * PIPING_R;
        out[o + 1] = cy + dy * PIPING_R;
        out[o + 2] = cz + dz * PIPING_R;
        on[o] = dx;
        on[o + 1] = dy;
        on[o + 2] = dz;
      }
    }
    this.pipeGeo.attributes.position.needsUpdate = true;
    this.pipeGeo.attributes.normal.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    this.mat.dispose();
    this.tex.dispose();
    this.normalTex.dispose();
    this.pipeGeo.dispose();
    this.pipeMat.dispose();
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
