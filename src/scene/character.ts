// 豆豆人 rig(SCENE-RIG §2):root 原點 = 髖中心,+y = 頭,+z = 臉,+x = 角色左側。
// 所有會動的量都是 Tweens 頻道;update() 每幀把 cur 寫回 Object3D,並算呼吸、眨眼、顫抖。
// 精緻化(DESIGN §14.6):細節只加在材質、動作、漫畫符號,比例維持豆豆人 ——
// 絨布睡衣(sheen + 花紋、滾邊、鈕扣)、橡皮管手臂 + 連指手套、伸手動作、臉紅分級、熟睡的鼻涕泡泡。
import * as THREE from 'three';
import type { Posture, Role } from '../game/types';
import { HoseGeometry, bezier, bezierTangent } from './hose';
import { ARM_LEN, LIMB_NAMES, RIG, reachArm, SHOULDER, type LimbName, type Pose } from './postures';
import { PAJAMA_STYLE, blushHatchTexture, pajamaTexture, repeated } from './textures';
import type { Channel, TweenOpts, Tweens } from './tween';

const TAU = Math.PI * 2;

export const SKIN = 0xf1c9a5;
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

// ── 橡皮管手臂 ──
export const ARMS = ['armL', 'armR'] as const;
export type ArmName = (typeof ARMS)[number];
/** 袖口在手臂曲線上的位置(0 = 肩、1 = 手) */
const SLEEVE_END = 0.34;
const ARM_R: readonly [number, number] = [0.054, 0.046];
const SLEEVE_R: readonly [number, number] = [0.08, 0.072];
/** 靜止時的弧度:手肘往外凸、稍微往後(曲線中點位移 = 控制點位移的一半) */
const BEND_OUT = 0.075;
const BEND_BACK = 0.035;
/** 臉紅等級 → 腮紅不透明度 */
const BLUSH_ALPHA = [0, 0.42, 0.72, 0.92];

/** 兩個角色共用的幾何與臉部材質 */
export class CharacterKit {
  readonly geo = {
    torso: new THREE.CapsuleGeometry(0.17, 0.4, 8, 24),
    chest: new THREE.SphereGeometry(0.12, 24, 14),
    collar: new THREE.TorusGeometry(0.1, 0.022, 8, 24),
    head: new THREE.SphereGeometry(0.15, 32, 22),
    hair: new THREE.SphereGeometry(0.158, 32, 14, 0, TAU, 0, 1.3),
    backHair: new THREE.SphereGeometry(0.162, 32, 16, Math.PI, Math.PI, 0, 2.15),
    bun: new THREE.SphereGeometry(0.058, 16, 12),
    tuft: new THREE.ConeGeometry(0.025, 0.07, 8),
    palm: new THREE.SphereGeometry(0.058, 16, 12),
    thumb: new THREE.SphereGeometry(0.025, 10, 8),
    cuff: new THREE.TorusGeometry(0.075, 0.0105, 8, 22),
    legCuff: new THREE.TorusGeometry(0.084, 0.014, 8, 22),
    button: new THREE.SphereGeometry(0.019, 12, 8),
    leg: new THREE.CapsuleGeometry(0.08, 0.5, 6, 18),
    foot: new THREE.SphereGeometry(0.078, 16, 10),
    eye: new THREE.SphereGeometry(0.022, 14, 10),
    blush: new THREE.CircleGeometry(0.03, 18),
    hatch: new THREE.PlaneGeometry(0.066, 0.066),
    dark: new THREE.CircleGeometry(0.036, 18),
    mouth: new THREE.TorusGeometry(0.024, 0.0065, 6, 14, Math.PI),
    bubble: new THREE.SphereGeometry(1, 16, 12),
  };
  readonly eyeMat = new THREE.MeshBasicMaterial({ color: 0x1c1422 });
  readonly darkMat = new THREE.MeshBasicMaterial({ color: 0x3a2850, transparent: true, opacity: 0.8, depthWrite: false });
  readonly mouthMat = new THREE.MeshBasicMaterial({ color: 0x7a3440 });
  readonly hatchTex = blushHatchTexture();
  readonly hatchMat = new THREE.MeshBasicMaterial({ map: this.hatchTex, transparent: true, depthWrite: false });
  /** 鼻涕泡泡:半透明、帶一點自發光(夜裡也看得到) */
  readonly bubbleMat = new THREE.MeshStandardMaterial({
    color: 0xd6f1ff,
    emissive: 0x2a4c66,
    roughness: 0.08,
    metalness: 0,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });

  dispose(): void {
    for (const g of Object.values(this.geo)) g.dispose();
    for (const m of [this.eyeMat, this.darkMat, this.mouthMat, this.hatchMat, this.bubbleMat]) m.dispose();
    this.hatchTex.dispose();
  }
}

type Ch3 = [Channel, Channel, Channel];
export type Expression = 'smile' | 'neutral' | 'frown';
/** pat = 拍拍(上下)、stroke = 摸摸(來回)、yank = 抓住往回拉、shove = 推出去、hold = 伸過去停著 */
export type Wobble = 'pat' | 'stroke' | 'yank' | 'shove' | 'hold';

export interface GestureOpts {
  /** 總長(秒,含伸出與收回) */
  dur: number;
  wobble?: Wobble;
  /** 伸到目標的幾成(timid 伸不到) */
  reach?: number;
  maxStretch?: number;
  /** 伸出 / 收回各幾秒 */
  inT?: number;
  outT?: number;
}

interface Gesture extends Required<GestureOpts> {
  arm: ArmName;
  target: THREE.Vector3;
  /** yank:往回拉的終點(世界座標) */
  back: THREE.Vector3;
  t: number;
}

interface ArmRig {
  sleeve: HoseGeometry;
  arm: HoseGeometry;
  cuff: THREE.Mesh;
  hand: THREE.Group;
  side: number;
  /** 上次重建時的 (stretch, bend) → 沒變就不重算頂點 */
  lastS: number;
  lastB: number;
}

const Z_AXIS = new THREE.Vector3(0, 0, 1);
const NEG_Y = new THREE.Vector3(0, -1, 0);

/** 把臉部貼片放在頭球表面(沿法線朝外) */
function onHead(obj: THREE.Object3D, x: number, y: number, z: number, r: number): void {
  const n = new THREE.Vector3(x, y, z).normalize();
  obj.position.copy(n).multiplyScalar(r);
  obj.quaternion.setFromUnitVectors(Z_AXIS, n);
}

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

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
  private readonly cstretch: Record<ArmName, Channel>;

  /** 床晃的 y 位移(場景每幀寫入) */
  bedShake = 0;
  /** 呼吸相位值 −1..1(×隨機幅度),棉被鼓包也用 */
  breath = 0;

  private readonly chest: THREE.Mesh;
  private readonly eyes: THREE.Mesh[] = [];
  private readonly blush: THREE.Mesh[] = [];
  private readonly hatch: THREE.Mesh[] = [];
  private readonly blushMat: THREE.MeshBasicMaterial;
  private readonly dark: THREE.Mesh[] = [];
  private readonly mouth: THREE.Mesh;
  private readonly bubble: THREE.Mesh;
  private readonly armMat: Record<ArmName, THREE.MeshStandardMaterial>;
  private readonly arms: Record<ArmName, ArmRig>;
  private readonly ownMats: THREE.Material[] = [];
  private readonly ownTex: THREE.Texture[] = [];
  private readonly ownGeo: THREE.BufferGeometry[] = [];
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
  // 動作疊加(不改頻道,只在寫回 Object3D 時加上去)
  private gestures: Gesture[] = [];
  private leanT = 0;
  private leanDur = 1;
  private leanX = 0;
  private scootT = 0;
  private readonly squeezeT: Record<ArmName, number> = { armL: 0, armR: 0 };
  private readonly flopT: Record<ArmName, number> = { armL: 0, armR: 0 };
  // 鼻涕泡泡
  private deep = false;
  private bubbleK = 0;
  private popT = 0;
  private breaths = 0;

  private readonly tmpA = new THREE.Vector3();
  private readonly tmpB = new THREE.Vector3();
  private readonly tmpC = new THREE.Vector3();
  private readonly p0 = new THREE.Vector3();
  private readonly p1 = new THREE.Vector3();
  private readonly p2 = new THREE.Vector3();
  private readonly ref = new THREE.Vector3(0, 0, 1);
  private readonly inv = new THREE.Matrix4();

  constructor(role: Role, tweens: Tweens, kit: CharacterKit) {
    this.role = role;
    const g = kit.geo;
    const style = PAJAMA_STYLE[role];
    const own = <M extends THREE.Material>(m: M): M => {
      this.ownMats.push(m);
      return m;
    };
    const std = (color: number, roughness: number) => own(new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 }));
    // 絨布:花紋貼圖 + sheen(掠射角的柔光 = 絨毛感);不同部位周長不同 → 各自的重複次數
    const topTex = pajamaTexture(role, style.top);
    const pantsTex = pajamaTexture(role, style.pants);
    this.ownTex.push(topTex, pantsTex);
    const fabric = (tex: THREE.Texture, u: number, v: number) => {
      const t = repeated(tex, u, v);
      this.ownTex.push(t);
      return own(
        new THREE.MeshPhysicalMaterial({
          map: t,
          roughness: 0.82,
          metalness: 0,
          sheen: 1,
          sheenRoughness: 0.55,
          sheenColor: new THREE.Color(style.sheen),
        }),
      );
    };
    const dotted = role === 'female';
    const torsoMat = fabric(topTex, dotted ? 10 : 8, dotted ? 8 : 1);
    const chestMat = fabric(topTex, dotted ? 7 : 6, dotted ? 4 : 1);
    const sleeveMat = fabric(topTex, dotted ? 4 : 4, dotted ? 1.5 : 1);
    const pantsMat = fabric(pantsTex, dotted ? 5 : 4, dotted ? 7 : 1);
    const skin = std(SKIN, 0.55);
    const hair = std(HAIR[role], 0.55);
    const trim = std(style.trim, 0.72);
    const buttonMat = std(style.button, 0.35);
    this.armMat = { armL: std(SKIN, 0.55), armR: std(SKIN, 0.55) };
    this.blushMat = own(new THREE.MeshBasicMaterial({ color: 0xff7f9e, transparent: true, opacity: 0.75, depthWrite: false }));

    const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };

    this.root.name = role;
    this.root.rotation.order = 'XYZ';
    mesh(g.torso, torsoMat, this.root, 0, 0.38, 0);
    this.chest = mesh(g.chest, chestMat, this.root, CHEST_POS.x, CHEST_POS.y, CHEST_POS.z);
    this.chest.scale.copy(CHEST_SCALE);
    const collar = mesh(g.collar, trim, this.root, 0, 0.7, 0.01);
    collar.rotation.x = Math.PI / 2;
    collar.scale.set(1.15, 1.15, 1.6);
    // 鈕扣:領口下兩顆(露在被子外)+ 胸口下一顆;扁圓、略亮
    for (const [y, z] of [
      [0.64, 0.166],
      [0.565, 0.171],
      [0.3, 0.17],
    ]) {
      const b = mesh(g.button, buttonMat, this.root, 0, y, z);
      b.scale.set(1, 1, 0.45);
    }

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
      const b = mesh(g.blush, this.blushMat, this.head);
      onHead(b, s * 0.092, -0.025, 0.125, 0.1525);
      b.visible = false;
      this.blush.push(b);
      const hx = mesh(g.hatch, kit.hatchMat, this.head);
      onHead(hx, s * 0.092, -0.025, 0.125, 0.1535);
      hx.visible = false;
      this.hatch.push(hx);
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
    // 鼻涕泡泡(熟睡時隨呼吸脹縮,偶爾破掉)
    this.bubble = mesh(g.bubble, kit.bubbleMat, this.head);
    onHead(this.bubble, 0.035, -0.038, 0.14, 0.168);
    this.bubble.visible = false;
    this.bubble.renderOrder = 5;

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
    const buildArm = (grp: THREE.Group, name: ArmName): ArmRig => {
      const side = name === 'armL' ? 1 : -1;
      const sleeve = new HoseGeometry(4, 16);
      const arm = new HoseGeometry(10, 14);
      this.ownGeo.push(sleeve, arm);
      const sm = mesh(sleeve, sleeveMat, grp);
      const am = mesh(arm, this.armMat[name], grp);
      sm.frustumCulled = am.frustumCulled = false;
      const cuff = mesh(g.cuff, trim, grp);
      const hand = new THREE.Group();
      grp.add(hand);
      const palm = mesh(g.palm, this.armMat[name], hand, 0, -0.022, 0);
      palm.scale.set(0.95, 1.18, 0.72);
      mesh(g.thumb, this.armMat[name], hand, -side * 0.043, -0.004, 0.022);
      return { sleeve, arm, cuff, hand, side, lastS: NaN, lastB: NaN };
    };
    this.arms = { armL: buildArm(armL, 'armL'), armR: buildArm(armR, 'armR') };
    for (const grp of [legL, legR]) {
      mesh(g.leg, pantsMat, grp, 0, -0.33, 0);
      const c = mesh(g.legCuff, trim, grp, 0, -0.535, 0);
      c.rotation.x = Math.PI / 2;
      const foot = mesh(g.foot, skin, grp, 0, -0.6, 0.02);
      foot.scale.set(1, 0.92, 1.22);
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
    this.cstretch = { armL: k('armL.stretch', 1), armR: k('armR.stretch', 1) };
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
    for (const a of ARMS) this.cstretch[a].snap(1);
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

  /** 手臂伸長倍率(橡皮管;1 = 原長) */
  stretchArm(arm: ArmName, s: number, dur: number, opts: TweenOpts = {}): void {
    this.cstretch[arm].set(s, dur, opts);
  }

  // ───────────── 動作(疊加在姿勢上,時間到自動淡出) ─────────────

  /**
   * 能伸向對方的那隻手:仰躺/趴 = 內側那隻;側躺 = 上面那隻(在下那隻被身體壓著)。
   * 男方左手當枕頭時改用右手。
   */
  freeArm(posture: Posture, pillowBusy: boolean): ArmName {
    let arm: ArmName;
    if (posture === 'sideFacing' || posture === 'sideAway') {
      const lDown = this.croll.to > 0; // roll > 0 → 左側在下
      arm = lDown ? 'armR' : 'armL';
    } else arm = this.role === 'male' ? 'armL' : 'armR'; // 內側 = 朝對方
    if (pillowBusy && this.role === 'male' && arm === 'armL') arm = 'armR';
    return arm;
  }

  /** 把手伸到世界座標 target(拍拍 / 摸摸 / 抓棉被 / 推),dur 秒後自動收回原姿勢 */
  gesture(arm: ArmName, target: THREE.Vector3, opts: GestureOpts, back?: THREE.Vector3): void {
    this.gestures = this.gestures.filter((g) => g.arm !== arm);
    this.gestures.push({
      arm,
      target: target.clone(),
      back: (back ?? target).clone(),
      t: 0,
      dur: opts.dur,
      wobble: opts.wobble ?? 'hold',
      reach: opts.reach ?? 1,
      maxStretch: opts.maxStretch ?? 1.45,
      inT: opts.inT ?? Math.min(0.28, opts.dur * 0.3),
      outT: opts.outT ?? Math.min(0.35, opts.dur * 0.35),
    });
  }

  /** 身體朝 dirX 靠過去 amount,再回來(親、講悄悄話) */
  lean(dirX: number, amount: number, dur: number): void {
    this.leanX = dirX * amount;
    this.leanDur = dur;
    this.leanT = dur;
  }

  /** 挪位置時扭一扭 */
  scootWiggle(dur: number): void {
    this.scootT = dur;
  }

  /** 抱緊一下:手臂彎得更深再放鬆 */
  squeeze(arm: ArmName, dur: number): void {
    this.squeezeT[arm] = dur;
  }

  /** 手麻的手臂一放開就軟趴趴地晃 */
  flop(arm: ArmName, dur: number): void {
    this.flopT[arm] = dur;
  }

  /** 手(連指手套)的世界座標;呼叫前 matrixWorld 要是新的 */
  handWorld(arm: ArmName, out: THREE.Vector3): THREE.Vector3 {
    return this.arms[arm].hand.getWorldPosition(out);
  }

  /** 胸口的世界座標(拍拍 / 蓋被的目標) */
  chestWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.chest.getWorldPosition(out);
  }

  /** 兩邊肩膀中離 from 比較近的那一個(世界座標;拍拍的目標) */
  nearShoulderWorld(from: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    const [lx, ly, lz] = SHOULDER.armL;
    const [rx, ry, rz] = SHOULDER.armR;
    const l = this.tmpC.set(lx, ly, lz).applyMatrix4(this.root.matrixWorld);
    out.set(rx, ry, rz).applyMatrix4(this.root.matrixWorld);
    return l.distanceToSquared(from) < out.distanceToSquared(from) ? out.copy(l) : out;
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

  /** 臉紅 0..3:0 不紅、1 淡淡的、2 紅、3 紅到冒斜線 */
  setBlush(level: number): void {
    const L = Math.max(0, Math.min(3, Math.round(level)));
    for (const b of this.blush) {
      b.visible = L > 0;
      b.scale.setScalar(L >= 3 ? 1.18 : 1);
    }
    for (const h of this.hatch) h.visible = L >= 3;
    this.blushMat.opacity = BLUSH_ALPHA[L];
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

  /** 熟睡(鼻涕泡泡) */
  setDeepSleep(on: boolean): void {
    this.deep = on;
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
    this.gestures = [];
    this.leanT = 0;
    this.scootT = 0;
    this.squeezeT.armL = this.squeezeT.armR = 0;
    this.flopT.armL = this.flopT.armR = 0;
    this.deep = false;
    this.bubbleK = 0;
    this.setDarkCircles(false);
  }

  // ───────────── 每幀 ─────────────

  update(dt: number, t: number): void {
    // 呼吸:真睡每次呼吸幅度 ±15%、週期 ±8% 隨機;裝睡完全等幅規律
    this.phase += ((TAU * this.cbreath.cur * this.rateK) / 60) * dt;
    if (this.phase >= TAU) {
      this.phase -= TAU;
      this.breaths += 1;
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

    // 靠過去(親 / 悄悄話):sin 包絡,去回各半
    let lean = 0;
    if (this.leanT > 0) {
      this.leanT -= dt;
      lean = this.leanX * Math.sin(Math.PI * Math.max(0, Math.min(1, 1 - this.leanT / this.leanDur)));
    }
    let wiggle = 0;
    if (this.scootT > 0) {
      this.scootT -= dt;
      wiggle = 0.07 * Math.sin(t * 28) * Math.min(1, this.scootT / 0.2);
    }

    this.root.position.set(this.cx.cur + this.cnudge.cur + shiver + lean, this.cy.cur + this.bedShake, this.cz.cur + 0.004 * b);
    this.root.rotation.set(this.cpitch.cur, this.croll.cur + wiggle, 0);
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

    const stretch: Record<ArmName, number> = { armL: this.cstretch.armL.cur, armR: this.cstretch.armR.cur };
    const bend: Record<ArmName, number> = { armL: 1, armR: 1 };
    this.applyGestures(dt, stretch);

    // 手麻:>= 75 顫抖(每幀 rotation.z ± 0.02·sin(30t));numb 事件再加一段明顯顫抖
    if (this.numb >= 75 || this.trembleT > 0) {
      const amp = this.trembleT > 0 ? 0.05 : 0.02;
      this.limbs.armL.rotation.z += amp * Math.sin(30 * t);
    }
    for (const a of ARMS) {
      if (this.squeezeT[a] > 0) {
        this.squeezeT[a] -= dt;
        bend[a] += 1.3 * Math.sin(Math.PI * Math.min(1, Math.max(0, this.squeezeT[a] / 0.6)));
      }
      if (this.flopT[a] > 0) {
        this.flopT[a] -= dt;
        const age = 1.6 - this.flopT[a];
        const k = Math.exp(-2.6 * age);
        bend[a] += 2.4 * k * Math.sin(TAU * 2.3 * age);
        this.limbs[a].rotation.z += a === 'armL' ? 0.22 * k : -0.22 * k;
      }
    }
    for (const a of ARMS) this.buildArm(a, stretch[a], bend[a]);

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

    this.updateBubble(dt, b, open);
  }

  /** 伸手動作:把手臂 Euler 往「指向目標」混過去(伸出 / 停留 / 收回),並算橡皮管伸長 */
  private applyGestures(dt: number, stretch: Record<ArmName, number>): void {
    if (!this.gestures.length) return;
    this.root.updateMatrix();
    this.inv.copy(this.root.matrix).invert();
    for (let i = this.gestures.length - 1; i >= 0; i--) {
      const g = this.gestures[i];
      g.t += dt;
      if (g.t >= g.dur) {
        this.gestures.splice(i, 1);
        continue;
      }
      const w = Math.min(smooth(g.t / g.inT), smooth((g.dur - g.t) / g.outT));
      const tgt = this.tmpA.copy(g.target);
      const hold = g.t - g.inT;
      switch (g.wobble) {
        case 'pat':
          if (hold > 0) tgt.y += 0.05 * Math.abs(Math.sin(hold * Math.PI * 3.2));
          break;
        case 'stroke':
          if (hold > 0) tgt.x += 0.07 * Math.sin(hold * TAU * 1.4);
          break;
        case 'yank': {
          const k = smooth((g.t - g.inT * 1.1) / Math.max(0.05, g.dur - g.inT - g.outT));
          tgt.lerp(g.back, k);
          break;
        }
        case 'shove':
          if (hold > 0) tgt.lerp(this.tmpB.setFromMatrixPosition(this.root.matrix), -0.25 * Math.sin(Math.min(1, hold / 0.25) * Math.PI));
          break;
        default:
          break;
      }
      tgt.applyMatrix4(this.inv); // → 角色局部座標
      if (g.reach < 1) {
        const [sx, sy, sz] = SHOULDER[g.arm];
        tgt.set(sx + (tgt.x - sx) * g.reach, sy + (tgt.y - sy) * g.reach, sz + (tgt.z - sz) * g.reach);
      }
      const r = reachArm(g.arm, tgt.x, tgt.y, tgt.z, g.maxStretch);
      const rot = this.limbs[g.arm].rotation;
      rot.set(rot.x + (r.euler[0] - rot.x) * w, rot.y * (1 - w), rot.z + (r.euler[2] - rot.z) * w);
      stretch[g.arm] += (r.stretch - stretch[g.arm]) * w;
    }
  }

  /** 依伸長 / 彎曲重建袖子與手臂的軟管,手套對齊末端切線 */
  private buildArm(a: ArmName, stretch: number, bend: number): void {
    const rig = this.arms[a];
    if (Math.abs(stretch - rig.lastS) < 1e-4 && Math.abs(bend - rig.lastB) < 1e-4) return;
    rig.lastS = stretch;
    rig.lastB = bend;
    const len = ARM_LEN * stretch;
    // 拉長時變直、縮短時更彎(橡皮管)
    const k = bend * Math.max(0.25, Math.min(1.3, 1.9 - stretch));
    this.p0.set(0, 0.015, 0);
    this.p2.set(0, -len, 0);
    this.p1.set(rig.side * BEND_OUT * k, -len / 2, -BEND_BACK * k);
    rig.sleeve.update(this.p0, this.p1, this.p2, 0, SLEEVE_END, SLEEVE_R[0], SLEEVE_R[1], this.ref);
    rig.arm.update(this.p0, this.p1, this.p2, SLEEVE_END - 0.06, 0.985, ARM_R[0], ARM_R[1], this.ref);
    // 袖口滾邊
    bezier(this.p0, this.p1, this.p2, SLEEVE_END, rig.cuff.position);
    bezierTangent(this.p0, this.p1, this.p2, SLEEVE_END, this.tmpC);
    rig.cuff.quaternion.setFromUnitVectors(Z_AXIS, this.tmpC);
    // 手套:位置 = 末端,−y 對齊末端切線
    rig.hand.position.copy(this.p2);
    bezierTangent(this.p0, this.p1, this.p2, 1, this.tmpC);
    rig.hand.quaternion.setFromUnitVectors(NEG_Y, this.tmpC);
  }

  /** 鼻涕泡泡:呼氣脹、吸氣縮,大約每 4 次呼吸破一次 */
  private updateBubble(dt: number, b: number, eyeOpen: number): void {
    const show = this.deep && eyeOpen < 0.5;
    this.bubbleK += ((show ? 1 : 0) - this.bubbleK) * Math.min(1, dt * 3);
    if (this.popT > 0) this.popT -= dt;
    else if (show && this.breaths >= 4 && b > 0.95) {
      this.breaths = 0;
      this.popT = 0.45;
    }
    const inflate = this.popT > 0 ? 0 : 0.5 - 0.5 * b; // b = −1(呼完)最大
    const r = this.bubbleK * (0.008 + 0.034 * inflate);
    this.bubble.visible = r > 0.004;
    this.bubble.scale.setScalar(r);
  }

  /** 頭心世界座標 */
  headWorld(out: THREE.Vector3): THREE.Vector3 {
    return this.head.getWorldPosition(out);
  }

  /**
   * 棉被高度場用的身體線段(世界座標),每段 9 個數:ax ay az bx by bz r σ w。
   * r = 身體半徑(決定隆起高度)、σ = 隆起寬度、w = 權重。手臂不算:貼身側的被軀幹的寬隆起蓋住,抬高的就擱在被子上。
   * wrap > 0:被子捲在自己身上(春捲),隆起更厚更寬。呼叫前 root.matrixWorld 必須是新的。
   */
  writeSegments(out: Float32Array, i: number, wrap = 0): number {
    const a = this.tmpA;
    const b = this.tmpB;
    const thick = 0.045 * wrap;
    const wide = 0.07 * wrap;
    // 軀幹:髖 → 脖子;寬而平頂,連身側的手臂一起蓋住
    a.set(0, 0.06, 0).applyMatrix4(this.root.matrixWorld);
    b.set(0, 0.7, 0).applyMatrix4(this.root.matrixWorld);
    i = putSegment(out, i, a, b, 0.17 + thick, 0.28 + wide, 1);
    // 胸口(呼吸時棉被跟著起伏)
    a.setFromMatrixPosition(this.chest.matrixWorld);
    i = putSegment(out, i, a, a, 0.07 + 0.035 * this.breath + thick, 0.15 + wide, 1);
    // 腿
    a.setFromMatrixPosition(this.limbs.legL.matrixWorld);
    b.set(0, -(LEG_LEN - 0.04), 0).applyMatrix4(this.limbs.legL.matrixWorld);
    i = putSegment(out, i, a, b, 0.085 + thick, 0.2 + wide, 1);
    a.setFromMatrixPosition(this.limbs.legR.matrixWorld);
    b.set(0, -(LEG_LEN - 0.04), 0).applyMatrix4(this.limbs.legR.matrixWorld);
    return putSegment(out, i, a, b, 0.085 + thick, 0.2 + wide, 1);
  }

  dispose(): void {
    for (const m of this.ownMats) m.dispose();
    for (const t of this.ownTex) t.dispose();
    for (const g of this.ownGeo) g.dispose();
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
