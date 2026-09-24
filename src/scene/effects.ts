// 特效(SCENE-RIG §6):Zzz、♥、!!、?、聲波環、小鳥。全部用物件池,CanvasTexture 畫可靠字元(不用 emoji)。
import * as THREE from 'three';
import type { Role } from '../game/types';

const ROLES: readonly Role[] = ['male', 'female'];
/** Z 往外側飄:男方往左、女方往右,兩人的 Zzz 不會疊在中間 */
const OUT: Record<Role, number> = { male: -1, female: 1 };

type HeadFn = (role: Role, out: THREE.Vector3) => THREE.Vector3;

interface Particle {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  active: boolean;
  age: number;
  life: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  s0: number;
  s1: number;
  wob: number;
  alpha: number;
}

interface Mark {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  t: number;
  dur: number;
  dx: number;
}

interface Ring {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  active: boolean;
  age: number;
  delay: number;
  maxR: number;
}

const RING_LIFE = 0.6;
const Z_LIFE = 2.6;
const HEART_LIFE = 1.9;

export class Effects {
  readonly group = new THREE.Group();
  private readonly headPos: HeadFn;
  private readonly tex: Record<'z' | 'heart' | 'bang' | 'what' | 'bird', THREE.CanvasTexture>;
  private readonly ringGeo = new THREE.RingGeometry(0.9, 1, 48);
  private readonly zs: Record<Role, Particle[]>;
  private readonly zTimer: Record<Role, number> = { male: 0.5, female: 1.2 };
  private readonly heartPool: Particle[] = [];
  private readonly marks: Record<Role, { bang: Mark; what: Mark }>;
  private readonly markList: { role: Role; m: Mark }[];
  private readonly rings: Ring[] = [];
  private readonly birds: Particle[] = [];
  private readonly v = new THREE.Vector3();
  private readonly w = new THREE.Vector3();
  private heartRainT = -1;

  /** 睡著(sleep >= 70)才冒 Z */
  readonly zOn: Record<Role, boolean> = { male: false, female: false };
  /** 打呼等級 0..3:Z 放大、間隔變短 */
  readonly zLevel: Record<Role, number> = { male: 0, female: 0 };
  /** 額外倍率(intimacyLoseFellAsleep ×3) */
  readonly zMult: Record<Role, number> = { male: 1, female: 1 };

  constructor(headPos: HeadFn) {
    this.headPos = headPos;
    this.group.name = 'effects';
    this.tex = {
      z: glyph('Z', '#ece8ff', '#2b2456', 'bold 104px sans-serif'),
      heart: glyph('♥', '#ff5d8f', '#fff2f6', 'bold 112px sans-serif'),
      bang: glyph('!!', '#ff2e43', '#ffffff', 'bold 100px sans-serif'),
      what: glyph('?', '#ffd54a', '#3a2710', 'bold 108px sans-serif'),
      bird: birdTexture(),
    };
    const zs = (): Particle[] => [0, 1, 2].map(() => this.particle(this.tex.z));
    this.zs = { male: zs(), female: zs() };
    for (let i = 0; i < 18; i++) this.heartPool.push(this.particle(this.tex.heart));
    for (let i = 0; i < 3; i++) this.birds.push(this.particle(this.tex.bird, true));
    const mark = (tex: THREE.CanvasTexture, dx: number): Mark => {
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false });
      const sprite = new THREE.Sprite(mat);
      sprite.visible = false;
      sprite.renderOrder = 30;
      this.group.add(sprite);
      return { sprite, mat, t: 0, dur: 1, dx };
    };
    this.marks = {
      male: { bang: mark(this.tex.bang, -0.07), what: mark(this.tex.what, 0.1) },
      female: { bang: mark(this.tex.bang, 0.07), what: mark(this.tex.what, -0.1) },
    };
    this.markList = ROLES.flatMap((role) => [
      { role, m: this.marks[role].bang },
      { role, m: this.marks[role].what },
    ]);
    for (let i = 0; i < 12; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xcfe6ff,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      });
      const mesh = new THREE.Mesh(this.ringGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      mesh.renderOrder = 15;
      this.group.add(mesh);
      this.rings.push({ mesh, mat, active: false, age: 0, delay: 0, maxR: 0.5 });
    }
  }

  private particle(tex: THREE.Texture, depthTest = false): Particle {
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest, depthWrite: false, fog: false });
    const sprite = new THREE.Sprite(mat);
    sprite.visible = false;
    sprite.renderOrder = 20;
    this.group.add(sprite);
    return { sprite, mat, active: false, age: 0, life: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, s0: 0.1, s1: 0.2, wob: 0, alpha: 1 };
  }

  private spawn(p: Particle, x: number, y: number, z: number, vx: number, vy: number, life: number, s0: number, s1: number): void {
    p.active = true;
    p.age = 0;
    p.life = life;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.s0 = s0;
    p.s1 = s1;
    p.wob = Math.random() * Math.PI * 2;
    p.sprite.visible = true;
    p.sprite.position.set(x, y, z);
    p.sprite.scale.set(s0, s0, 1);
    p.mat.opacity = 0;
  }

  /** 取池裡閒置的,沒有就回收最老的 */
  private take(pool: Particle[]): Particle {
    let best = pool[0];
    for (const p of pool) {
      if (!p.active) return p;
      if (p.age / p.life > best.age / best.life) best = p;
    }
    return best;
  }

  // ───────────── 觸發 ─────────────

  /** 一個 Z(打呼事件時的大一點的 Z) */
  puffZ(role: Role, boost = 1): void {
    const h = this.headPos(role, this.v);
    const L = this.zLevel[role];
    const size = 0.2 * (1 + 0.5 * L) * this.zMult[role] * boost;
    const o = OUT[role];
    this.spawn(this.take(this.zs[role]), h.x + o * 0.1, h.y + 0.2, h.z + 0.02, o * 0.08, 0.19, Z_LIFE, size * 0.45, size);
  }

  hearts(n: number, at?: THREE.Vector3): void {
    const c = at ?? this.between(this.w);
    for (let i = 0; i < n; i++) {
      const p = this.take(this.heartPool);
      this.spawn(p, c.x + (Math.random() - 0.5) * 0.35, c.y + Math.random() * 0.1, c.z + (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.12, 0.32 + Math.random() * 0.15, HEART_LIFE, 0.1, 0.17 + Math.random() * 0.06);
      p.age = -i * 0.12; // 錯開
    }
  }

  /** intimacyWin:持續冒愛心 */
  heartRain(on: boolean): void {
    this.heartRainT = on ? 0 : -1;
  }

  mark(role: Role, kind: 'bang' | 'what', dur: number): void {
    const m = this.marks[role][kind];
    m.t = dur;
    m.dur = dur;
    m.sprite.visible = true;
  }

  /** 聲波環:從 at 平放擴散到 maxR,0.6s 淡出 */
  ring(at: THREE.Vector3, maxR: number, delay: number, red: boolean): void {
    let r = this.rings.find((x) => !x.active);
    if (!r) r = this.rings.reduce((a, b) => (a.age > b.age ? a : b));
    r.active = true;
    r.age = 0;
    r.delay = delay;
    r.maxR = maxR;
    r.mat.color.setHex(red ? 0xff3348 : 0xcfe6ff);
    r.mesh.position.copy(at);
    r.mesh.scale.setScalar(0.08);
    r.mesh.visible = false;
  }

  /** sleepWin:三隻小鳥從窗前飛過 */
  flyBirds(): void {
    this.birds.forEach((b, i) => {
      this.spawn(b, 2.56, 1.72 + (i === 1 ? 0.12 : 0) - i * 0.04, -0.98 - i * 0.12, 0, 0, 3.2, 0.13, 0.13);
      b.vx = 0.45; // 沿 +z 的速度(存在 vx)
      b.age = -0.4 * i;
    });
  }

  clear(): void {
    for (const r of ROLES) {
      for (const p of this.zs[r]) this.kill(p);
      this.zOn[r] = false;
      this.zLevel[r] = 0;
      this.zMult[r] = 1;
    }
    for (const { m } of this.markList) {
      m.t = 0;
      m.sprite.visible = false;
    }
    for (const p of this.heartPool) this.kill(p);
    for (const p of this.birds) this.kill(p);
    for (const r of this.rings) {
      r.active = false;
      r.mesh.visible = false;
    }
    this.heartRainT = -1;
  }

  private kill(p: Particle): void {
    p.active = false;
    p.sprite.visible = false;
  }

  private between(out: THREE.Vector3): THREE.Vector3 {
    this.headPos('male', out);
    this.headPos('female', this.v);
    return out.add(this.v).multiplyScalar(0.5).setY(Math.max(out.y, 0.74) + 0.3);
  }

  // ───────────── 每幀 ─────────────

  update(dt: number, t: number): void {
    // Zzz:睡著時定期冒;打呼等級越高越大、越密
    for (const r of ROLES) {
      if (this.zOn[r]) {
        this.zTimer[r] -= dt;
        if (this.zTimer[r] <= 0) {
          this.zTimer[r] = 1.6 / (1 + 0.5 * this.zLevel[r]);
          this.puffZ(r);
        }
      }
      for (const p of this.zs[r]) this.stepFloat(p, dt, 0.35, 0.9);
    }

    if (this.heartRainT >= 0) {
      this.heartRainT -= dt;
      if (this.heartRainT <= 0) {
        this.heartRainT = 0.28;
        const p = this.take(this.heartPool);
        this.spawn(p, (Math.random() - 0.5) * 1.6, 0.9 + Math.random() * 0.3, -0.7 + Math.random() * 1.2, (Math.random() - 0.5) * 0.1, 0.3 + Math.random() * 0.2, 2.4, 0.1, 0.22);
      }
    }
    for (const p of this.heartPool) this.stepFloat(p, dt, 0.25, 0.7);

    for (const b of this.birds) {
      if (!b.active) continue;
      b.age += dt;
      if (b.age < 0) continue;
      if (b.age >= b.life) {
        this.kill(b);
        continue;
      }
      const k = b.age / b.life;
      b.sprite.position.set(b.x, b.y + 0.05 * Math.sin(b.age * 3 + b.wob), b.z + b.vx * b.age);
      const flap = 0.55 + 0.45 * Math.abs(Math.sin(b.age * 13 + b.wob));
      b.sprite.scale.set(b.s0, b.s0 * flap, 1);
      b.mat.opacity = Math.min(1, k * 6, (1 - k) * 6);
    }

    for (const { role, m } of this.markList) {
      if (m.t <= 0) continue;
      m.t -= dt;
      if (m.t <= 0) {
        m.sprite.visible = false;
        continue;
      }
      const head = this.headPos(role, this.v);
      const age = m.dur - m.t;
      const pop = Math.min(1, age / 0.15);
      const s = 0.26 * (pop < 1 ? pop * (1 + 0.6 * (1 - pop)) : 1);
      m.sprite.position.set(head.x + m.dx, head.y + 0.36 + 0.025 * Math.sin(t * 9), head.z);
      m.sprite.scale.set(s, s, 1);
      m.mat.opacity = Math.min(1, m.t / 0.2);
    }

    for (const r of this.rings) {
      if (!r.active) continue;
      r.age += dt;
      const a = r.age - r.delay;
      if (a < 0) continue;
      if (a >= RING_LIFE) {
        r.active = false;
        r.mesh.visible = false;
        continue;
      }
      const k = a / RING_LIFE;
      const e = 1 - (1 - k) * (1 - k);
      r.mesh.visible = true;
      r.mesh.scale.setScalar(0.08 + (r.maxR - 0.08) * e);
      r.mat.opacity = 0.85 * (1 - k);
    }
  }

  /** 往上飄、左右輕晃、變大、淡入淡出 */
  private stepFloat(p: Particle, dt: number, fadeIn: number, fadeOut: number): void {
    if (!p.active) return;
    p.age += dt;
    if (p.age < 0) {
      p.sprite.visible = false;
      return;
    }
    if (p.age >= p.life) {
      this.kill(p);
      return;
    }
    p.sprite.visible = true;
    const k = p.age / p.life;
    p.sprite.position.set(p.x + p.vx * p.age + 0.035 * Math.sin(p.age * 3.2 + p.wob), p.y + p.vy * p.age, p.z);
    const s = p.s0 + (p.s1 - p.s0) * Math.min(1, k * 1.6);
    p.sprite.scale.set(s, s, 1);
    p.mat.opacity = Math.min(1, p.age / fadeIn, (p.life - p.age) / fadeOut);
  }

  dispose(): void {
    const mats = new Set<THREE.Material>();
    this.group.traverse((o) => {
      const mat = (o as THREE.Mesh | THREE.Sprite).material;
      if (mat) mats.add(mat as THREE.Material);
    });
    for (const m of mats) m.dispose();
    for (const tex of Object.values(this.tex)) tex.dispose();
    this.ringGeo.dispose();
  }
}

function glyph(text: string, fill: string, stroke: string, font: string): THREE.CanvasTexture {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.font = font;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 12;
  g.strokeStyle = stroke;
  g.strokeText(text, S / 2, S / 2 + 4);
  g.fillStyle = fill;
  g.fillText(text, S / 2, S / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 「v」字形小鳥剪影 */
function birdTexture(): THREE.CanvasTexture {
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.strokeStyle = '#2b2440';
  g.lineWidth = 11;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(14, 46);
  g.quadraticCurveTo(40, 40, 64, 76);
  g.quadraticCurveTo(88, 40, 114, 46);
  g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
