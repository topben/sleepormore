// 角色 rig(SCENE-RIG §2):root 原點 = 髖中心,+y = 頭,+z = 臉,+x = 角色左側。
// 所有會動的量都是 Tweens 頻道;update() 每幀把 cur 寫回 Object3D,並算呼吸、眨眼、顫抖。
// 精緻化(DESIGN §14.6):細節只加在材質、動作、漫畫符號 ——
// 絨布睡衣(sheen + 花紋、滾邊、鈕扣)、橡皮管手臂 + 連指手套、伸手動作、臉紅分級、熟睡的鼻涕泡泡。
// 毛絨玩具化(DESIGN §14.9):原創的設計師玩具風 —— 男方小熊(圓耳)、女方垂耳兔(+ 蝴蝶結),
// 殼層毛、光滑的搪膠臉、亮晶晶的大眼睛、小鼻子、肉球腳掌、毛球尾巴;睡衣照穿。
import * as THREE from 'three';
import type { Posture, Role } from '../game/types';
import { furNoiseTexture, furShellMaterial, shellGeometry, type InstancedFur } from './fur';
import { HoseGeometry, bezier, bezierTangent } from './hose';
import { ARM_LEN, LIMB_NAMES, RIG, reachArm, SHOULDER, type LimbName, type Pose } from './postures';
import { PAJAMA_STYLE, blushHatchTexture, pajamaTexture, repeated } from './textures';
import type { Channel, TweenOpts, Tweens } from './tween';

const TAU = Math.PI * 2;

/** 毛絨玩具的配色:毛、毛的光澤、臉、內耳、鼻子、肉球 */
const PLUSH: Record<Role, { fur: number; sheen: number; face: number; inner: number; nose: number; pad: number }> = {
  male: { fur: 0xc58a55, sheen: 0xffd9a8, face: 0xf6dfc4, inner: 0xf0c49a, nose: 0x4a2c20, pad: 0x9a6444 },
  female: { fur: 0xf1e4d4, sheen: 0xffffff, face: 0xfff6ee, inner: 0xf7b3c6, nose: 0xf07fa0, pad: 0xf5a3bb },
};
const BOW = 0xff6f9c;
const NUMB_COLOR = new THREE.Color(0x8a6aa0);
/** 臉的中心方向(頭的局部座標,稍微朝下);臉在這個方向 42° 內不長毛 */
const FACE_DIR = new THREE.Vector3(0, -0.07, 1).normalize();
const Z_AXIS = new THREE.Vector3(0, 0, 1);

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
/** 手臂的毛(手臂每幀變形 → 用實例當層) */
const ARM_FUR: InstancedFur = { layers: 5, length: 0.011, uvScale: [3, 3] };
/** 臉紅等級 → 腮紅不透明度 */
const BLUSH_ALPHA = [0, 0.42, 0.72, 0.92];

/** 兩個角色共用的幾何與臉部材質 */
export class CharacterKit {
  readonly geo = {
    torso: new THREE.CapsuleGeometry(0.17, 0.4, 8, 24),
    chest: new THREE.SphereGeometry(0.12, 24, 14),
    collar: new THREE.TorusGeometry(0.1, 0.022, 8, 24),
    head: new THREE.SphereGeometry(0.15, 32, 22),
    /** 搪膠臉:頭球正面的一片球冠,邊緣藏在毛下面 */
    face: new THREE.SphereGeometry(0.1515, 28, 18, Math.PI / 2 - 0.87, 1.74, Math.PI / 2 - 0.8, 1.75),
    nose: new THREE.SphereGeometry(0.013, 12, 8),
    earBear: new THREE.SphereGeometry(0.062, 18, 12),
    earLop: new THREE.SphereGeometry(0.06, 18, 14),
    innerEar: new THREE.SphereGeometry(0.04, 14, 10),
    bowLoop: new THREE.SphereGeometry(0.03, 12, 8),
    bowKnot: new THREE.SphereGeometry(0.014, 10, 8),
    tail: new THREE.SphereGeometry(0.05, 16, 12),
    pad: new THREE.SphereGeometry(0.028, 12, 8),
    toe: new THREE.SphereGeometry(0.012, 10, 6),
    eyeHi: new THREE.SphereGeometry(0.0072, 8, 6),
    palm: new THREE.SphereGeometry(0.058, 16, 12),
    thumb: new THREE.SphereGeometry(0.025, 10, 8),
    cuff: new THREE.TorusGeometry(0.075, 0.0105, 8, 22),
    legCuff: new THREE.TorusGeometry(0.084, 0.014, 8, 22),
    button: new THREE.SphereGeometry(0.019, 12, 8),
    leg: new THREE.CapsuleGeometry(0.08, 0.5, 6, 18),
    foot: new THREE.SphereGeometry(0.078, 16, 10),
    eye: new THREE.SphereGeometry(0.026, 16, 12),
    blush: new THREE.CircleGeometry(0.03, 18),
    hatch: new THREE.PlaneGeometry(0.066, 0.066),
    dark: new THREE.CircleGeometry(0.036, 18),
    mouth: new THREE.TorusGeometry(0.024, 0.0065, 6, 14, Math.PI),
    /** ω 嘴:兩個小弧 */
    mouthSmall: new THREE.TorusGeometry(0.012, 0.0055, 6, 12, Math.PI),
    bubble: new THREE.SphereGeometry(1, 16, 12),
  };
  readonly furNoise = furNoiseTexture();
  /** 毛(殼層):頭(臉挖掉)、耳朵(內耳挖掉)、手、腳(腳底挖掉露出肉球)、尾巴 */
  readonly shells = {
    head: shellGeometry(this.geo.head, { layers: 9, length: 0.022, uvScale: [7, 4], bare: { dir: FACE_DIR, angle: 0.73, soft: 0.2 } }),
    // 耳朵正面挖掉一塊露出內耳(淺色絨布片)
    earBear: shellGeometry(this.geo.earBear, { layers: 6, length: 0.016, uvScale: [3, 2], bare: { dir: Z_AXIS, angle: 0.5, soft: 0.22 } }),
    earLop: shellGeometry(this.geo.earLop, { layers: 6, length: 0.014, uvScale: [3, 3], bare: { dir: Z_AXIS, angle: 0.5, soft: 0.2 } }),
    palm: shellGeometry(this.geo.palm, { layers: 6, length: 0.013, uvScale: [3, 2] }),
    thumb: shellGeometry(this.geo.thumb, { layers: 5, length: 0.01, uvScale: [2, 1] }),
    foot: shellGeometry(this.geo.foot, { layers: 6, length: 0.015, uvScale: [3, 2], bare: { dir: new THREE.Vector3(0, -1, 0.35).normalize(), angle: 0.62, soft: 0.25 } }),
    tail: shellGeometry(this.geo.tail, { layers: 7, length: 0.022, uvScale: [3, 2] }),
  };
  readonly eyeMat = new THREE.MeshBasicMaterial({ color: 0x1c1422 });
  /** 眼睛裡的亮點(搪膠玩具的大眼睛) */
  readonly eyeHiMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
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
    for (const g of Object.values(this.shells)) g.dispose();
    for (const m of [this.eyeMat, this.eyeHiMat, this.darkMat, this.mouthMat, this.hatchMat, this.bubbleMat]) m.dispose();
    this.hatchTex.dispose();
    this.furNoise.dispose();
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

const NEG_Y = new THREE.Vector3(0, -1, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** 把臉部貼片放在頭球表面(沿法線朝外) */
function onHead(obj: THREE.Object3D, x: number, y: number, z: number, r: number): void {
  const n = new THREE.Vector3(x, y, z).normalize();
  obj.position.copy(n).multiplyScalar(r);
  obj.quaternion.setFromUnitVectors(Z_AXIS, n);
}

const smooth = (x: number) => THREE.MathUtils.smoothstep(x, 0, 1);

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
  /** 眼睛的亮點(閉眼時藏起來,不然閉著的眼睛會像瞇眼偷看) */
  private readonly eyeHi: THREE.Mesh[] = [];
  private readonly blush: THREE.Mesh[] = [];
  private readonly hatch: THREE.Mesh[] = [];
  private readonly blushMat: THREE.MeshBasicMaterial;
  private readonly dark: THREE.Mesh[] = [];
  private readonly mouth: THREE.Mesh;
  /** ω 嘴(笑的時候) */
  private readonly mouthW: THREE.Mesh[] = [];
  private readonly bubble: THREE.Mesh;
  private readonly armMat: Record<ArmName, THREE.MeshStandardMaterial>;
  /** 手臂、手上的毛(手麻時跟手臂一起變紫) */
  private readonly armFur: Record<ArmName, THREE.MeshStandardMaterial>;
  private readonly handFur: Record<ArmName, THREE.MeshStandardMaterial>;
  private readonly arms: Record<ArmName, ArmRig>;
  private readonly ownMats: THREE.Material[] = [];
  private readonly ownTex: THREE.Texture[] = [];
  private readonly ownGeo: THREE.BufferGeometry[] = [];
  private readonly ownInst: THREE.InstancedMesh[] = [];
  private readonly furColor: THREE.Color;

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
  /** 進入熟睡後的呼吸次數(每 4 次破一次泡泡) */
  private breaths = 0;
  /** 每幀的手臂伸長 / 彎曲(重複使用,不配置) */
  private readonly armStretch: Record<ArmName, number> = { armL: 1, armR: 1 };
  private readonly armBend: Record<ArmName, number> = { armL: 1, armR: 1 };

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
    const trim = std(style.trim, 0.72);
    const buttonMat = std(style.button, 0.35);
    // 毛絨:本體用 sheen(絨毛的柔光),外面再長一層殼層毛
    const plush = PLUSH[role];
    this.furColor = new THREE.Color(plush.fur);
    const furBody = () =>
      own(new THREE.MeshPhysicalMaterial({ color: plush.fur, roughness: 0.88, metalness: 0, sheen: 1, sheenRoughness: 0.45, sheenColor: new THREE.Color(plush.sheen) }));
    const fur = furBody();
    const furShell = own(furShellMaterial(plush.fur, kit.furNoise));
    const faceMat = std(plush.face, 0.42);
    const innerMat = std(plush.inner, 0.7);
    const noseMat = std(plush.nose, 0.3);
    const padMat = std(plush.pad, 0.55);
    this.armMat = { armL: furBody(), armR: furBody() };
    this.armFur = { armL: own(furShellMaterial(plush.fur, kit.furNoise, ARM_FUR)), armR: own(furShellMaterial(plush.fur, kit.furNoise, ARM_FUR)) };
    this.handFur = { armL: own(furShellMaterial(plush.fur, kit.furNoise)), armR: own(furShellMaterial(plush.fur, kit.furNoise)) };
    /** 在 parent 上長一層毛(殼層幾何共用;parent 的縮放照樣套用) */
    const furOn = (parent: THREE.Object3D, shell: THREE.BufferGeometry, mat: THREE.Material = furShell) => {
      const m = new THREE.Mesh(shell, mat);
      parent.add(m);
      return m;
    };
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

    // 頭:毛絨的頭 + 搪膠臉(臉的範圍不長毛)
    this.head.position.set(0, 0.9, 0);
    this.head.scale.setScalar(HEAD_SCALE);
    this.root.add(this.head);
    const headMesh = mesh(g.head, fur, this.head);
    furOn(headMesh, kit.shells.head);
    mesh(g.face, faceMat, this.head);
    if (role === 'male') {
      // 小熊:頭頂兩側的圓耳朵(正面朝前)
      for (const s of [-1, 1]) {
        const ear = mesh(g.earBear, fur, this.head, s * 0.11, 0.1, 0.03);
        ear.rotation.set(-0.2, 0, -s * 0.4);
        ear.scale.set(1, 0.92, 0.5);
        furOn(ear, kit.shells.earBear);
        const inner = mesh(g.innerEar, innerMat, ear, 0, -0.004, 0.05);
        inner.scale.set(0.95, 0.88, 0.35);
      }
    } else {
      // 垂耳兔:從頭頂往兩側攤開、垂下來的長耳朵(粉紅內耳朝前)+ 蝴蝶結
      for (const s of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(s * 0.09, 0.115, 0.005);
        pivot.rotation.set(-0.3, 0, s * 0.72);
        this.head.add(pivot);
        const ear = mesh(g.earLop, fur, pivot, 0, -0.11, 0);
        ear.scale.set(0.64, 2, 0.32);
        furOn(ear, kit.shells.earLop);
        const inner = mesh(g.innerEar, innerMat, ear, 0, -0.004, 0.05);
        inner.scale.set(0.8, 1.05, 0.3);
      }
      const bow = new THREE.Group();
      onHead(bow, 0.07, 0.125, 0.05, 0.158);
      bow.rotateZ(-0.3);
      this.head.add(bow);
      const bowMat = std(BOW, 0.5);
      for (const s of [-1, 1]) {
        const loop = mesh(g.bowLoop, bowMat, bow, s * 0.032, 0, 0);
        loop.scale.set(1.25, 0.8, 0.45);
        loop.rotation.z = s * 0.35;
      }
      mesh(g.bowKnot, bowMat, bow);
    }
    for (const s of [-1, 1]) {
      const eye = mesh(g.eye, kit.eyeMat, this.head);
      onHead(eye, s * 0.056, 0.03, 0.14, 0.147);
      eye.quaternion.identity();
      eye.scale.copy(EYE_SCALE);
      this.eyeHi.push(mesh(g.eyeHi, kit.eyeHiMat, eye, 0.009, 0.011, 0.021));
      this.eyes.push(eye);
      const b = mesh(g.blush, this.blushMat, this.head);
      onHead(b, s * 0.092, -0.03, 0.125, 0.1525);
      b.visible = false;
      this.blush.push(b);
      const hx = mesh(g.hatch, kit.hatchMat, this.head);
      onHead(hx, s * 0.092, -0.03, 0.125, 0.1532);
      hx.visible = false;
      this.hatch.push(hx);
      const d = mesh(g.dark, kit.darkMat, this.head);
      onHead(d, s * 0.056, -0.01, 0.14, 0.1522);
      d.scale.set(1.1, 0.75, 1);
      d.visible = false;
      this.dark.push(d);
    }
    const nose = mesh(g.nose, noseMat, this.head);
    onHead(nose, 0, -0.026, 0.15, 0.152);
    nose.scale.set(1.3, 0.85, 0.7);
    const mouthPivot = new THREE.Group();
    onHead(mouthPivot, 0, -0.064, 0.137, 0.1525);
    this.head.add(mouthPivot);
    this.mouth = mesh(g.mouth, kit.mouthMat, mouthPivot);
    for (const s of [-1, 1]) {
      const w = mesh(g.mouthSmall, kit.mouthMat, mouthPivot, s * 0.0118, 0.004, 0);
      w.rotation.z = Math.PI; // ∪ ∪ = ω
      this.mouthW.push(w);
    }
    this.setExpression('smile');
    // 鼻涕泡泡(熟睡時隨呼吸脹縮,偶爾破掉)
    this.bubble = mesh(g.bubble, kit.bubbleMat, this.head);
    onHead(this.bubble, 0.024, -0.034, 0.15, 0.172);
    this.bubble.visible = false;
    this.bubble.renderOrder = 5;
    // 毛球尾巴:後腰(仰躺時壓在身體下看不到,趴著、背對時露出來)
    const tail = mesh(g.tail, fur, this.root, 0, 0.2, -0.17);
    furOn(tail, kit.shells.tail);

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
      const af = new THREE.InstancedMesh(arm, this.armFur[name], ARM_FUR.layers);
      grp.add(af);
      this.ownInst.push(af);
      sm.frustumCulled = am.frustumCulled = af.frustumCulled = false;
      const cuff = mesh(g.cuff, trim, grp);
      const hand = new THREE.Group();
      grp.add(hand);
      const palm = mesh(g.palm, this.armMat[name], hand, 0, -0.022, 0);
      palm.scale.set(0.95, 1.18, 0.72);
      furOn(palm, kit.shells.palm, this.handFur[name]);
      const thumb = mesh(g.thumb, this.armMat[name], hand, -side * 0.043, -0.004, 0.022);
      furOn(thumb, kit.shells.thumb, this.handFur[name]);
      return { sleeve, arm, cuff, hand, side, lastS: NaN, lastB: NaN };
    };
    this.arms = { armL: buildArm(armL, 'armL'), armR: buildArm(armR, 'armR') };
    for (const grp of [legL, legR]) {
      mesh(g.leg, pantsMat, grp, 0, -0.33, 0);
      const c = mesh(g.legCuff, trim, grp, 0, -0.535, 0);
      c.rotation.x = Math.PI / 2;
      const foot = mesh(g.foot, fur, grp, 0, -0.6, 0.02); // 圓腳丫(拉長會戳出被子)
      furOn(foot, kit.shells.foot);
      // 腳底的肉球(仰躺時腳底朝床尾 = 朝相機;被子被搶走或掉下床時看得到)
      const pads: [THREE.BufferGeometry, number, number, number][] = [
        [g.pad, 0, -1, 0.15],
        [g.toe, -0.36, -0.86, 0.58],
        [g.toe, 0, -0.8, 0.68],
        [g.toe, 0.36, -0.86, 0.58],
      ];
      for (const [geo, x, y, z] of pads) {
        const d = new THREE.Vector3(x, y, z).normalize();
        const pad = mesh(geo, padMat, foot, d.x * 0.077, d.y * 0.077, d.z * 0.077);
        pad.quaternion.setFromUnitVectors(Y_AXIS, d);
        pad.scale.set(1, 0.4, geo === g.pad ? 0.85 : 1);
      }
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
    } else {
      // 內側 = 朝對方:仰躺時男方左手、女方右手;趴著(roll = π)左右對調
      const inner: ArmName = this.role === 'male' ? 'armL' : 'armR';
      arm = posture === 'prone' ? (inner === 'armL' ? 'armR' : 'armL') : inner;
    }
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

  /** 笑 = ω、平 = 一條線、皺眉 = ∩ */
  setExpression(e: Expression): void {
    this.mouth.visible = e !== 'smile';
    for (const w of this.mouthW) w.visible = e === 'smile';
    this.mouth.rotation.z = e === 'frown' ? 0 : Math.PI;
    this.mouth.scale.set(e === 'neutral' ? 0.7 : 1, e === 'neutral' ? 0.25 : 1, 1);
    this.mouth.position.y = e === 'frown' ? -0.012 : 0;
  }

  setNumb(n: number): void {
    this.numb = n;
    const t = Math.min(1, Math.max(0, (n - 75) / 25));
    const k = n >= 75 ? 0.35 + 0.65 * t : 0;
    for (const m of [this.armMat.armL, this.armFur.armL, this.handFur.armL]) m.color.copy(this.furColor).lerp(NUMB_COLOR, k);
  }

  setSnore(level: number): void {
    this.snore = level;
  }

  /** 熟睡(鼻涕泡泡);剛睡熟時從頭數呼吸,泡泡先慢慢脹大 */
  setDeepSleep(on: boolean): void {
    if (on && !this.deep) {
      this.breaths = 0;
      this.popT = 0;
    }
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
    this.popT = 0;
    this.breaths = 0;
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

    const stretch = this.armStretch;
    const bend = this.armBend;
    for (const a of ARMS) {
      stretch[a] = this.cstretch[a].cur;
      bend[a] = 1;
    }
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
    for (const h of this.eyeHi) h.visible = open > 0.5;

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
    i = putSegment(out, i, a, b, 0.095 + thick, 0.2 + wide, 1); // 腿(含腳丫)
    a.setFromMatrixPosition(this.limbs.legR.matrixWorld);
    b.set(0, -(LEG_LEN - 0.04), 0).applyMatrix4(this.limbs.legR.matrixWorld);
    return putSegment(out, i, a, b, 0.095 + thick, 0.2 + wide, 1);
  }

  dispose(): void {
    for (const m of this.ownMats) m.dispose();
    for (const t of this.ownTex) t.dispose();
    for (const g of this.ownGeo) g.dispose();
    for (const m of this.ownInst) m.dispose();
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
