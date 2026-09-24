// 豆豆人 rig(SCENE-RIG §2):root 原點 = 髖中心,+y = 頭,+z = 臉,+x = 角色左側。
// 所有會動的量都是 Tweens 頻道;update() 每幀把 cur 寫回 Object3D,並算呼吸、眨眼、顫抖。
import * as THREE from 'three';
import type { Role } from '../game/types';
import { LIMB_NAMES, RIG, type LimbName, type Pose } from './postures';
import type { Channel, TweenOpts, Tweens } from './tween';

const TAU = Math.PI * 2;

export const SKIN = 0xf1c9a5;
export const PAJAMA: Record<Role, number> = { male: 0x4a6fa5, female: 0xc98bb9 };
const PANTS: Record<Role, number> = { male: 0x3e5d8f, female: 0xb477a6 };
const HAIR: Record<Role, number> = { male: 0x2b2b2b, female: 0x5a3825 };
const NUMB_COLOR = new THREE.Color(0x8a6aa0);

const LEG_LEN = 0.66;
const CHEST_POS = new THREE.Vector3(0, 0.45, 0.13);
const CHEST_SCALE = new THREE.Vector3(1.05, 0.62, 0.5);
const EYE_SCALE = new THREE.Vector3(1, 1.25, 0.6);
/** 頭微微收下巴(臉朝腳 = 朝相機),讓床尾視角看得到五官 */
export const HEAD_TILT = 0.22;
/** 側躺時臉微微轉向天花板(−0.45·sin(roll)),不然從床尾只看得到後腦勺 */
const FACE_UP = 0.45;
/** 豆豆人的大頭(規格 Sphere(0.15);放大讓臉在手機上也看得清楚) */
const HEAD_SCALE = 1.2;

/** 兩個角色共用的幾何與臉部材質 */
export class CharacterKit {
  readonly geo = {
    torso: new THREE.CapsuleGeometry(0.17, 0.4, 8, 20),
    chest: new THREE.SphereGeometry(0.12, 20, 14),
    collar: new THREE.TorusGeometry(0.1, 0.022, 8, 20),
    head: new THREE.SphereGeometry(0.15, 28, 20),
    hair: new THREE.SphereGeometry(0.158, 28, 14, 0, TAU, 0, 1.3),
    backHair: new THREE.SphereGeometry(0.162, 28, 16, Math.PI, Math.PI, 0, 2.15),
    bun: new THREE.SphereGeometry(0.058, 16, 12),
    tuft: new THREE.ConeGeometry(0.025, 0.07, 8),
    arm: new THREE.CapsuleGeometry(0.06, 0.4, 6, 14),
    sleeve: new THREE.CapsuleGeometry(0.07, 0.12, 6, 14),
    hand: new THREE.SphereGeometry(0.064, 14, 10),
    leg: new THREE.CapsuleGeometry(0.08, 0.5, 6, 14),
    foot: new THREE.SphereGeometry(0.078, 14, 10),
    eye: new THREE.SphereGeometry(0.022, 14, 10),
    blush: new THREE.CircleGeometry(0.03, 18),
    dark: new THREE.CircleGeometry(0.036, 18),
    mouth: new THREE.TorusGeometry(0.024, 0.0065, 6, 14, Math.PI),
  };
  readonly eyeMat = new THREE.MeshBasicMaterial({ color: 0x1c1422 });
  readonly blushMat = new THREE.MeshBasicMaterial({ color: 0xff7f9e, transparent: true, opacity: 0.75, depthWrite: false });
  readonly darkMat = new THREE.MeshBasicMaterial({ color: 0x3a2850, transparent: true, opacity: 0.8, depthWrite: false });
  readonly mouthMat = new THREE.MeshBasicMaterial({ color: 0x7a3440 });

  dispose(): void {
    for (const g of Object.values(this.geo)) g.dispose();
    this.eyeMat.dispose();
    this.blushMat.dispose();
    this.darkMat.dispose();
    this.mouthMat.dispose();
  }
}

type Ch3 = [Channel, Channel, Channel];
export type Expression = 'smile' | 'neutral' | 'frown';

const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** 把臉部貼片放在頭球表面(沿法線朝外) */
function onHead(obj: THREE.Object3D, x: number, y: number, z: number, r: number): void {
  const n = new THREE.Vector3(x, y, z).normalize();
  obj.position.copy(n).multiplyScalar(r);
  obj.quaternion.setFromUnitVectors(Z_AXIS, n);
}

export class Character {
  readonly role: Role;
  readonly root = new THREE.Group();
  readonly head = new THREE.Group();
  readonly limbs: Record<LimbName, THREE.Group>;

  readonly cx: Channel;
  readonly cy: Channel;
  readonly cz: Channel;
  readonly croll: Channel;
  readonly cpitch: Channel;
  readonly ceye: Channel;
  readonly clook: Channel;
  readonly cbreath: Channel;
  readonly cnudge: Channel;
  private readonly climbs: Record<LimbName, Ch3>;

  /** 床晃的 y 位移(場景每幀寫入) */
  bedShake = 0;
  /** 呼吸相位值 −1..1(×隨機幅度),棉被鼓包也用 */
  breath = 0;

  private readonly chest: THREE.Mesh;
  private readonly eyes: THREE.Mesh[] = [];
  private readonly blush: THREE.Mesh[] = [];
  private readonly dark: THREE.Mesh[] = [];
  private readonly mouth: THREE.Mesh;
  private readonly armMat: Record<'armL' | 'armR', THREE.MeshStandardMaterial>;
  private readonly ownMats: THREE.Material[] = [];
  private readonly skin = new THREE.Color(SKIN);

  private phase = Math.random() * TAU;
  private ampK = 1;
  private rateK = 1;
  private regular = false;
  private eyeWant = 1;
  private eyeForce = 0;
  private blinkIn = 1.5 + Math.random() * 3;
  private blinkT = 0;
  private shiverT = 0;
  private trembleT = 0;
  private lookT = 0;
  private numb = 0;
  private snore = 0;
  private headLift = 0;

  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();

  constructor(role: Role, tweens: Tweens, kit: CharacterKit) {
    this.role = role;
    const g = kit.geo;
    const std = (color: number, roughness: number) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
      this.ownMats.push(m);
      return m;
    };
    const pj = std(PAJAMA[role], 0.82);
    const pants = std(PANTS[role], 0.85);
    const skin = std(SKIN, 0.6);
    const hair = std(HAIR[role], 0.7);
    const collarMat = std(role === 'male' ? 0xdfe8f5 : 0xfbe6f3, 0.8);
    this.armMat = { armL: std(SKIN, 0.6), armR: std(SKIN, 0.6) };

    const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };

    this.root.name = role;
    this.root.rotation.order = 'XYZ';
    mesh(g.torso, pj, this.root, 0, 0.38, 0);
    this.chest = mesh(g.chest, pj, this.root, CHEST_POS.x, CHEST_POS.y, CHEST_POS.z);
    this.chest.scale.copy(CHEST_SCALE);
    const collar = mesh(g.collar, collarMat, this.root, 0, 0.7, 0.01);
    collar.rotation.x = Math.PI / 2;
    collar.scale.set(1.15, 1.15, 1.6);

    // 頭
    this.head.position.set(0, 0.9, 0);
    this.head.scale.setScalar(HEAD_SCALE);
    this.root.add(this.head);
    mesh(g.head, skin, this.head);
    const cap = mesh(g.hair, hair, this.head);
    cap.rotation.x = 0.12; // 規格 −0.4;往前蓋出瀏海,床尾視角才看得到頭髮
    if (role === 'female') {
      mesh(g.backHair, hair, this.head); // 後腦到耳下的鮑伯頭,從正面看框住臉
      for (const s of [-1, 1]) {
        const bun = mesh(g.bun, hair, this.head);
        onHead(bun, s * 0.13, 0.07, -0.04, 0.15);
      }
    } else {
      const tuft = mesh(g.tuft, hair, this.head, 0.02, 0.16, 0.03);
      tuft.rotation.set(0.5, 0, -0.5);
    }
    for (const s of [-1, 1]) {
      const eye = mesh(g.eye, kit.eyeMat, this.head);
      onHead(eye, s * 0.052, 0.03, 0.14, 0.143);
      eye.quaternion.identity();
      eye.scale.copy(EYE_SCALE);
      this.eyes.push(eye);
      const b = mesh(g.blush, kit.blushMat, this.head);
      onHead(b, s * 0.092, -0.025, 0.125, 0.1525);
      b.visible = false;
      this.blush.push(b);
      const d = mesh(g.dark, kit.darkMat, this.head);
      onHead(d, s * 0.052, -0.012, 0.14, 0.1515);
      d.scale.set(1.1, 0.75, 1);
      d.visible = false;
      this.dark.push(d);
    }
    const mouthPivot = new THREE.Group();
    onHead(mouthPivot, 0, -0.062, 0.137, 0.149);
    this.head.add(mouthPivot);
    this.mouth = mesh(g.mouth, kit.mouthMat, mouthPivot);
    this.setExpression('smile');

    // 四肢(Group pivot = 肩 / 髖)
    const limb = (name: LimbName, x: number, y: number, z: number) => {
      const grp = new THREE.Group();
      grp.name = `${role}.${name}`;
      grp.position.set(x, y, z);
      grp.rotation.order = 'XYZ';
      this.root.add(grp);
      return grp;
    };
    const armL = limb('armL', 0.2, 0.65, 0.06);
    const armR = limb('armR', -0.2, 0.65, 0.06);
    const legL = limb('legL', 0.1, 0.02, 0);
    const legR = limb('legR', -0.1, 0.02, 0);
    for (const [grp, name] of [
      [armL, 'armL'],
      [armR, 'armR'],
    ] as const) {
      mesh(g.arm, this.armMat[name], grp, 0, -0.26, 0);
      mesh(g.sleeve, pj, grp, 0, -0.09, 0);
      mesh(g.hand, this.armMat[name], grp, 0, -0.47, 0);
    }
    for (const grp of [legL, legR]) {
      mesh(g.leg, pants, grp, 0, -0.33, 0);
      mesh(g.foot, skin, grp, 0, -0.6, 0.02);
    }
    this.limbs = { armL, armR, legL, legR, head: this.head };

    const k = (s: string, v = 0) => tweens.chan(`${role}.${s}`, v);
    this.cx = k('x');
    this.cy = k('y', RIG.rootY);
    this.cz = k('z', RIG.rootZ);
    this.croll = k('roll');
    this.cpitch = k('pitch', RIG.lyingPitch);
    this.ceye = k('eye', 1);
    this.clook = k('look');
    this.cbreath = k('breath', 16);
    this.cnudge = k('nudge');
    const c3 = (n: LimbName): Ch3 => [k(`${n}.x`), k(`${n}.y`), k(`${n}.z`)];
    this.climbs = { armL: c3('armL'), armR: c3('armR'), legL: c3('legL'), legR: c3('legR'), head: c3('head') };
  }

  // ───────────── 姿勢 ─────────────

  snapPose(pose: Pose, x: number): void {
    this.cx.snap(x);
    this.cy.snap(RIG.rootY + pose.rootYOffset);
    this.cz.snap(RIG.rootZ);
    this.croll.snap(pose.roll);
    this.cpitch.snap(RIG.lyingPitch);
    this.cnudge.snap(0);
    this.clook.snap(0);
    for (const n of LIMB_NAMES) {
      const e = pose.limbs[n];
      const c = this.climbs[n];
      c[0].snap(e[0]);
      c[1].snap(e[1]);
      c[2].snap(e[2]);
    }
  }

  /** 姿勢 → 0.8s(依 band 調整);roll 走最短路徑 */
  tweenPose(pose: Pose, dur: number, opts: TweenOpts = {}): void {
    this.croll.set(pose.roll, dur, { ...opts, angular: true });
    this.cy.set(RIG.rootY + pose.rootYOffset, dur, opts);
    this.cpitch.set(RIG.lyingPitch, dur, opts);
    this.cz.set(RIG.rootZ, dur, opts);
    this.tweenLimbs(pose.limbs, dur, opts);
  }

  tweenLimbs(limbs: Partial<Pose['limbs']>, dur: number, opts: TweenOpts = {}): void {
    for (const n of LIMB_NAMES) {
      const e = limbs[n];
      if (!e) continue;
      const c = this.climbs[n];
      c[0].set(e[0], dur, opts);
      c[1].set(e[1], dur, opts);
      c[2].set(e[2], dur, opts);
    }
  }

  // ───────────── 可見參數 ─────────────

  setBreath(rate: number, regular: boolean, snap = false): void {
    if (snap) this.cbreath.snap(rate);
    else this.cbreath.set(rate, 1.0);
    this.regular = regular;
    if (regular) {
      this.ampK = 1;
      this.rateK = 1;
    }
  }

  setEyes(open: boolean, snap = false): void {
    this.eyeWant = open ? 1 : 0.15;
    if (snap) {
      this.eyeForce = 0;
      this.ceye.snap(this.eyeWant);
    }
  }

  /** wake / noticed:暫時睜眼 */
  forceEyesOpen(sec: number): void {
    this.eyeForce = Math.max(this.eyeForce, sec);
  }

  setBlush(on: boolean): void {
    for (const b of this.blush) b.visible = on;
  }

  setDarkCircles(on: boolean): void {
    for (const d of this.dark) d.visible = on;
  }

  setExpression(e: Expression): void {
    this.mouth.rotation.z = e === 'frown' ? 0 : Math.PI;
    this.mouth.scale.set(1, e === 'neutral' ? 0.25 : 1, 1);
    this.mouth.position.y = e === 'frown' ? -0.012 : e === 'neutral' ? 0 : 0.008;
  }

  setNumb(n: number): void {
    this.numb = n;
    const t = Math.min(1, Math.max(0, (n - 75) / 25));
    this.armMat.armL.color.copy(this.skin).lerp(NUMB_COLOR, n >= 75 ? 0.35 + 0.65 * t : 0);
  }

  setSnore(level: number): void {
    this.snore = level;
  }

  shiver(sec: number): void {
    this.shiverT = Math.max(this.shiverT, sec);
  }

  tremble(sec: number): void {
    this.trembleT = Math.max(this.trembleT, sec);
  }

  /** noticed:頭朝對方轉 0.3 rad(依目前 roll 決定方向),dur 秒後轉回 */
  lookAtPartner(dur: number): void {
    const sx = this.role === 'male' ? 1 : -1;
    const r = this.croll.cur;
    const s = Math.sign(sx * Math.cos(r) - Math.sin(r)) || 1;
    this.clook.set(0.3 * s, 0.3, { force: true });
    this.lookT = dur;
  }

  resetTransient(): void {
    this.eyeForce = 0;
    this.shiverT = 0;
    this.trembleT = 0;
    this.lookT = 0;
    this.blinkT = 0;
    this.headLift = 0;
    this.setDarkCircles(false);
  }

  // ───────────── 每幀 ─────────────

  update(dt: number, t: number): void {
    // 呼吸:真睡每次呼吸幅度 ±15%、週期 ±8% 隨機;裝睡完全等幅規律
    this.phase += ((TAU * this.cbreath.cur * this.rateK) / 60) * dt;
    if (this.phase >= TAU) {
      this.phase -= TAU;
      if (!this.regular) {
        this.ampK = 1 + (Math.random() * 2 - 1) * 0.15;
        this.rateK = 1 + (Math.random() * 2 - 1) * 0.08;
      }
    }
    const b = Math.sin(this.phase) * this.ampK;
    this.breath = b;
    this.chest.scale.set(CHEST_SCALE.x * (1 + 0.05 * b), CHEST_SCALE.y * (1 + 0.18 * b), CHEST_SCALE.z * (1 + 0.5 * b));

    if (this.shiverT > 0) this.shiverT -= dt;
    if (this.trembleT > 0) this.trembleT -= dt;
    if (this.lookT > 0) {
      this.lookT -= dt;
      if (this.lookT <= 0) this.clook.set(0, 0.4);
    }
    const shiver = this.shiverT > 0 ? 0.01 * Math.sin(t * 95) : 0;

    this.root.position.set(this.cx.cur + this.cnudge.cur + shiver, this.cy.cur + this.bedShake, this.cz.cur + 0.004 * b);
    this.root.rotation.set(this.cpitch.cur, this.croll.cur, 0);
    for (const n of LIMB_NAMES) {
      const c = this.climbs[n];
      this.limbs[n].rotation.set(c[0].cur, c[1].cur, c[2].cur);
    }
    this.head.rotation.x += HEAD_TILT;
    this.head.rotation.y += this.clook.cur - FACE_UP * Math.sin(this.croll.cur);
    // 打呼 level 3:每次呼氣頭微微抬起 0.01
    const lift = this.snore >= 3 ? 0.01 * Math.max(0, -b) : 0;
    this.headLift += (lift - this.headLift) * Math.min(1, dt * 8);
    this.head.position.z = this.headLift;

    // 手麻:>= 75 顫抖(每幀 rotation.z ± 0.02·sin(30t));numb 事件再加一段明顯顫抖
    if (this.numb >= 75 || this.trembleT > 0) {
      const amp = this.trembleT > 0 ? 0.05 : 0.02;
      this.limbs.armL.rotation.z += amp * Math.sin(30 * t);
    }

    // 眼睛:開/閉 tween 0.2s,睜眼時偶爾眨眼
    if (this.eyeForce > 0) this.eyeForce -= dt;
    const want = this.eyeForce > 0 ? 1 : this.eyeWant;
    if (Math.abs(this.ceye.to - want) > 1e-3) this.ceye.set(want, 0.2);
    let blink = 1;
    if (want > 0.9 && this.ceye.cur > 0.9) {
      this.blinkIn -= dt;
      if (this.blinkIn <= 0) {
        this.blinkT = 0.16;
        this.blinkIn = 2.5 + Math.random() * 3.5;
      }
    }
    if (this.blinkT > 0) {
      this.blinkT -= dt;
      blink = 0.12 + 0.88 * Math.abs(this.blinkT / 0.08 - 1);
    }
    const open = Math.max(0.12, this.ceye.cur * blink);
    for (const e of this.eyes) e.scale.y = EYE_SCALE.y * open;
  }

  /** 頭心世界座標 */
  headWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.head.getWorldPosition(out);
  }

  /**
   * 棉被高度場用的身體線段(世界座標),每段 9 個數:ax ay az bx by bz r σ w。
   * r = 身體半徑(決定隆起高度)、σ = 隆起寬度、w = 權重。手臂不算:貼身側的被軀幹的寬隆起蓋住,抬高的就擱在被子上。
   * 呼叫前 root.matrixWorld 必須是新的。
   */
  writeSegments(out: Float32Array, i: number): number {
    const a = this.tmpA;
    const b = this.tmpB;
    // 軀幹:髖 → 脖子;寬而平頂,連身側的手臂一起蓋住
    a.set(0, 0.06, 0).applyMatrix4(this.root.matrixWorld);
    b.set(0, 0.7, 0).applyMatrix4(this.root.matrixWorld);
    i = putSegment(out, i, a, b, 0.17, 0.28, 1);
    // 胸口(呼吸時棉被跟著起伏)
    a.setFromMatrixPosition(this.chest.matrixWorld);
    i = putSegment(out, i, a, a, 0.07 + 0.035 * this.breath, 0.15, 1);
    // 腿
    a.setFromMatrixPosition(this.limbs.legL.matrixWorld);
    b.set(0, -(LEG_LEN - 0.04), 0).applyMatrix4(this.limbs.legL.matrixWorld);
    i = putSegment(out, i, a, b, 0.085, 0.2, 1);
    a.setFromMatrixPosition(this.limbs.legR.matrixWorld);
    b.set(0, -(LEG_LEN - 0.04), 0).applyMatrix4(this.limbs.legR.matrixWorld);
    return putSegment(out, i, a, b, 0.085, 0.2, 1);
  }

  dispose(): void {
    for (const m of this.ownMats) m.dispose();
  }
}

function putSegment(out: Float32Array, i: number, a: THREE.Vector3, b: THREE.Vector3, r: number, sigma: number, w: number): number {
  out[i] = a.x;
  out[i + 1] = a.y;
  out[i + 2] = a.z;
  out[i + 3] = b.x;
  out[i + 4] = b.y;
  out[i + 5] = b.z;
  out[i + 6] = r;
  out[i + 7] = sigma;
  out[i + 8] = w;
  return i + 9;
}

export const SEGMENTS_PER_CHAR = 4;
export const SEGMENT_STRIDE = 9;
