// 原創成年日系幻想角色。保留同一套肩 / 髖 rig、姿勢與 Tweens；造型使用輪廓明確的 toon 臉、分層髮束與緞面睡衣。
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Posture, Role } from '../game/types';
import { almondGeometry, crescentGeometry, hairCapGeometry, hairLock, humanHeadGeometry, patchGeometry, profileGeometry, satinNormalTexture, toonRamp } from './anime';
import { HoseGeometry, bezier, bezierTangent } from './hose';
import { batchStaticMeshes, retireUnusedGeometries } from './modelBatch';
import { ARM_LEN, LIMB_NAMES, RIG, reachArm, SHOULDER, type LimbName, type Pose } from './postures';
import { blushHatchTexture } from './textures';
import type { Channel, TweenOpts, Tweens } from './tween';

const TAU = Math.PI * 2;
const NUMB_COLOR = new THREE.Color(0x8a6aa0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const LEG_LEN = 0.66;
const LEG_COVER = 0.12;
const CHEST_POS = new THREE.Vector3(0, 0.45, 0.13);
const CHEST_SCALE = new THREE.Vector3(1.25, 0.72, 0.4);
const EYE_SCALE = new THREE.Vector3(1, 1, 1);
/** 頭微微收下巴，讓床尾视角仍看得到五官。 */
export const HEAD_TILT = 0.22;
const FACE_UP = 0.45;
const HEAD_SCALE = 0.82;
const SKIN: Record<Role, number> = { male: 0xf2cdbb, female: 0xffe1d5 };

export const ARMS = ['armL', 'armR'] as const;
export type ArmName = (typeof ARMS)[number];
const ARM_R: readonly [number, number] = [0.043, 0.027];
const SLEEVE_R: readonly [number, number] = [0.065, 0.051];
const BEND_OUT = 0.06;
const BEND_BACK = 0.035;
const BLUSH_ALPHA = [0, 0.28, 0.5, 0.74];

/** 兩人共用平滑的身體、成年臉部比例與表情幾何。 */
export class CharacterKit {
  readonly geo = {
    torso: new THREE.CapsuleGeometry(0.17, 0.4, 10, 32),
    chest: new THREE.SphereGeometry(0.12, 24, 16),
    neck: new THREE.CylinderGeometry(0.046, 0.055, 0.145, 20),
    head: humanHeadGeometry(),
    hairCap: hairCapGeometry(),
    nose: new THREE.SphereGeometry(0.012, 14, 10),
    ear: new THREE.SphereGeometry(0.021, 14, 10),
    lid: new THREE.TorusGeometry(0.027, 0.0026, 6, 22, Math.PI),
    brow: new THREE.TorusGeometry(0.027, 0.0023, 6, 20, Math.PI),
    eyeHi: new THREE.SphereGeometry(0.0055, 8, 6),
    palm: new THREE.SphereGeometry(0.058, 16, 12),
    thumb: new THREE.CapsuleGeometry(0.009, 0.026, 4, 10),
    shoulder: new THREE.SphereGeometry(0.053, 16, 12),
    cuff: new THREE.TorusGeometry(0.051, 0.0035, 6, 22),
    legCuff: new THREE.TorusGeometry(0.058, 0.0035, 6, 22),
    button: new THREE.SphereGeometry(0.01, 10, 8),
    leg: profileGeometry([[0.01, 0.063, 0.069], [-0.15, 0.07, 0.072], [-0.29, 0.05, 0.057], [-0.37, 0.054, 0.058], [-0.5, 0.041, 0.046], [-0.6, 0.028, 0.03]]),
    foot: new THREE.SphereGeometry(0.055, 18, 12),
    eye: almondGeometry(),
    iris: new THREE.SphereGeometry(0.015, 20, 14),
    blush: new THREE.CircleGeometry(0.022, 18),
    hatch: new THREE.PlaneGeometry(0.05, 0.046),
    dark: new THREE.CircleGeometry(0.029, 18),
    mouth: new THREE.TorusGeometry(0.017, 0.0018, 6, 20, Math.PI),
    mouthSmall: new THREE.TorusGeometry(0.008, 0.0018, 6, 16, Math.PI),
    bubble: new THREE.SphereGeometry(1, 16, 12),
    moon: crescentGeometry(),
  };
  readonly ramp = toonRamp();
  readonly satinNormal = satinNormalTexture();
  readonly eyeMat = new THREE.MeshBasicMaterial({ color: 0x201a35 });
  readonly eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xfff7ff, side: THREE.DoubleSide });
  readonly eyeHiMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  readonly darkMat = new THREE.MeshBasicMaterial({ color: 0x3a2850, transparent: true, opacity: 0.5, depthWrite: false });
  readonly hatchTex = blushHatchTexture();
  readonly hatchMat = new THREE.MeshBasicMaterial({ map: this.hatchTex, transparent: true, depthWrite: false });
  readonly bubbleMat = new THREE.MeshStandardMaterial({ color: 0xd6f1ff, emissive: 0x2a4c66, roughness: 0.08, transparent: true, opacity: 0.55, depthWrite: false });

  dispose(): void {
    for (const g of Object.values(this.geo)) g.dispose();
    for (const m of [this.eyeMat, this.eyeWhiteMat, this.eyeHiMat, this.darkMat, this.hatchMat, this.bubbleMat]) m.dispose();
    this.hatchTex.dispose();
    this.ramp.dispose();
    this.satinNormal.dispose();
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
  sleeveEnd: number;
  armStart: number;
  arm: HoseGeometry;
  cuff: THREE.Mesh;
  hand: THREE.Group;
  side: number;
  /** 上次重建時的 (stretch, bend) → 沒變就不重算頂點 */
  lastS: number;
  lastB: number;
}

const NEG_Y = new THREE.Vector3(0, -1, 0);

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
  private readonly cloth: THREE.Mesh;
  private readonly clothBase: Float32Array;
  private readonly hem: THREE.Mesh | null;
  private readonly hemBase: Float32Array | null;
  private lastClothPitchL = NaN;
  private lastClothPitchR = NaN;
  private lastClothBreath = NaN;
  private readonly eyes: THREE.Mesh[] = [];
  private readonly lids: THREE.Mesh[] = [];
  private readonly brows: THREE.Mesh[] = [];
  /** 眼睛的亮點(閉眼時藏起來,不然閉著的眼睛會像瞇眼偷看) */
  private readonly eyeHi: THREE.Mesh[] = [];
  private readonly blush: THREE.Mesh[] = [];
  private readonly hatch: THREE.Mesh[] = [];
  private readonly blushMat: THREE.MeshBasicMaterial;
  private readonly dark: THREE.Mesh[] = [];
  private readonly mouth: THREE.Mesh;
  /** 睡前微笑弧線 */
  private readonly mouthW: THREE.Mesh[] = [];
  private readonly bubble: THREE.Mesh;
  private readonly armMat: Record<ArmName, THREE.MeshToonMaterial>;
  private readonly handMat: Record<ArmName, THREE.MeshToonMaterial>;
  private readonly arms: Record<ArmName, ArmRig>;
  private readonly ownMats: THREE.Material[] = [];
  private readonly ownTex: THREE.Texture[] = [];
  private readonly ownGeo: THREE.BufferGeometry[] = [];
  private readonly skinColor: THREE.Color;

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
    const female = role === 'female';
    const g = kit.geo;
    const own = <M extends THREE.Material>(m: M): M => {
      this.ownMats.push(m);
      return m;
    };
    const geometry = <G extends THREE.BufferGeometry>(geo: G): G => {
      this.ownGeo.push(geo);
      return geo;
    };
    const toon = (color: number, glow = 0.035) => own(new THREE.MeshToonMaterial({ color, gradientMap: kit.ramp, emissive: color, emissiveIntensity: glow }));
    const satin = (color: number) => own(new THREE.MeshPhysicalMaterial({ color, normalMap: kit.satinNormal, normalScale: new THREE.Vector2(0.24, 0.24), roughness: 0.36, metalness: 0.08, sheen: 0.85, sheenColor: new THREE.Color(female ? 0xf3eaff : 0x9eb7ec), sheenRoughness: 0.33, clearcoat: 0.12, clearcoatRoughness: 0.36, side: THREE.DoubleSide }));
    const fabric = satin(female ? 0xcbb8e9 : 0x243d6d);
    const lapelMat = satin(female ? 0xe4d3f9 : 0x426092);
    const trim = own(new THREE.MeshStandardMaterial({ color: 0xe8c88c, roughness: 0.35, metalness: 0.55 }));
    const lace = own(new THREE.MeshStandardMaterial({ color: 0xf3e9ff, roughness: 0.6, side: THREE.DoubleSide }));
    const skin = toon(SKIN[role], 0.1);
    this.skinColor = new THREE.Color(SKIN[role]);
    this.armMat = { armL: toon(SKIN[role], 0.1), armR: toon(SKIN[role], 0.1) };
    this.handMat = { armL: toon(SKIN[role], 0.1), armR: toon(SKIN[role], 0.1) };
    const hairColor = female ? 0xb7a5db : 0x142a48;
    const hairMat = toon(hairColor, 0.06);
    const hairLight = toon(female ? 0xd7cbed : 0x3d587e, 0.08);
    const hairShadow = toon(female ? 0x8676b2 : 0x0c1d35);
    const ink = own(new THREE.MeshBasicMaterial({ color: female ? 0x473d62 : 0x253145, side: THREE.DoubleSide }));
    const irisMat = toon(female ? 0x9466d3 : 0x598ab2, 0.22);
    const irisLight = own(new THREE.MeshBasicMaterial({ color: female ? 0xd7baff : 0xa0deed }));
    this.blushMat = own(new THREE.MeshBasicMaterial({ color: 0xf688a1, transparent: true, opacity: 0.5, depthWrite: false }));
    const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      parent.add(m);
      return m;
    };
    const line = (parent: THREE.Object3D, mat: THREE.Material, points: readonly (readonly [number, number, number])[], radius = 0.003) =>
      mesh(geometry(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), 22, radius, 5, false)), mat, parent);
    const strand = (parent: THREE.Object3D, points: readonly (readonly [number, number, number])[], width: number, mat = hairMat, depth = 0.012) =>
      mesh(geometry(hairLock(points, width, depth)), mat, parent);

    this.root.name = role;
    this.root.rotation.order = 'XYZ';
    const maleRings = [[0, 0.155, 0.105], [0.16, 0.145, 0.111], [0.3, 0.14, 0.115], [0.44, 0.17, 0.125], [0.56, 0.188, 0.128], [0.64, 0.19, 0.105], [0.71, 0.15, 0.076]] as const;
    const skinRings = [[0.525, 0.144, 0.105], [0.56, 0.152, 0.107], [0.59, 0.158, 0.11], [0.65, 0.184, 0.092], [0.675, 0.184, 0.086], [0.71, 0.1, 0.066], [0.745, 0.048, 0.044]] as const;
    const torso = mesh(geometry(profileGeometry(female ? skinRings : maleRings)), female ? skin : fabric, this.root);
    const surfaceAt = (x: number, y: number) => {
      let rx: number = maleRings[0][1];
      let rz: number = maleRings[0][2];
      for (let i = 1; i < maleRings.length; i++) {
        if (y > maleRings[i][0] && i < maleRings.length - 1) continue;
        const a = maleRings[i - 1];
        const b = maleRings[i];
        const t = THREE.MathUtils.clamp((y - a[0]) / (b[0] - a[0]), 0, 1);
        rx = THREE.MathUtils.lerp(a[1], b[1], t);
        rz = THREE.MathUtils.lerp(a[2], b[2], t);
        break;
      }
      return Math.sqrt(Math.max(0, 1 - x * x / (rx * rx))) * rz + 0.008;
    };
    const lapelGeo = (points: readonly (readonly [number, number])[]) => {
      const geo = geometry(patchGeometry(points));
      const pos = geo.getAttribute('position');
      for (let i = 0; i < pos.count; i++) pos.setZ(i, surfaceAt(pos.getX(i), pos.getY(i)) + 0.012);
      geo.computeVertexNormals();
      return geo;
    };
    const neck = mesh(g.neck, skin, this.root, 0, 0.735, 0);
    neck.scale.set(female ? 0.84 : 1, 1, female ? 0.9 : 1);
    this.chest = mesh(g.chest, fabric, this.root, CHEST_POS.x, CHEST_POS.y, CHEST_POS.z);
    this.chest.scale.copy(CHEST_SCALE);
    // A hidden breath/gesture target, while the continuous cloth surface supplies the visible body.
    this.chest.visible = false;

    if (female) {
      // Opaque satin follows the waist and hips; the scalloped neckline stays above the bust.
      this.cloth = mesh(geometry(profileGeometry([[-0.26, 0.23, 0.195], [-0.16, 0.215, 0.18], [-0.02, 0.18, 0.138], [0.15, 0.146, 0.114], [0.3, 0.124, 0.104], [0.42, 0.156, 0.128], [0.51, 0.176, 0.152], [0.59, 0.166, 0.14]], true)), fabric, this.root);
      // Thin satin shoulder straps and a fitted neckline make the silhouette read as a slip dress.
      for (const side of [-1, 1]) {
        line(this.root, lapelMat, [[side * 0.136, 0.582, 0.094], [side * 0.144, 0.684, 0.015], [side * 0.138, 0.587, -0.086]], 0.007);

      }
      const necklineLoop = geometry(new THREE.TorusGeometry(0.009, 0.0015, 4, 12));
      const neckline: [number, number, number][] = [];
      for (let i = -11; i <= 11; i++) {
        const x = i * 0.014;
        const c = Math.sqrt(1 - x * x / (0.166 * 0.166));
        const y = 0.59 - 0.048 * Math.pow(c, 5);
        const z = 0.14 * c + 0.008;
        const loop = mesh(necklineLoop, lace, this.root, x, y - 0.003, z + 0.003);
        const n = new THREE.Vector3(x / (0.166 * 0.166), 0, c / 0.14).normalize();
        loop.quaternion.setFromUnitVectors(Z_AXIS, n);
        loop.scale.y = 0.75;
        neckline.push([x, y, z + 0.004]);
      }
      line(this.root, lace, neckline, 0.0016);
      // Small loops are actual open lace along the hem, with no transparent clothing.
      const laceLoop = new THREE.TorusGeometry(0.0115, 0.0017, 5, 12);
      const hemParts: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 32; i++) {
        const a = i / 32 * TAU;
        const part = laceLoop.clone();
        part.scale(1, 0.7, 1);
        part.rotateY(a);
        part.translate(Math.sin(a) * 0.228, -0.252, Math.cos(a) * 0.194 + 0.008);
        hemParts.push(part);
      }
      const hemGeo = mergeGeometries(hemParts)!;
      laceLoop.dispose();
      for (const part of hemParts) part.dispose();
      this.hem = mesh(geometry(hemGeo), lace, this.root);
      this.hemBase = new Float32Array(hemGeo.getAttribute('position').array);
      const pendant = mesh(g.moon, trim, this.root, 0, 0.518, 0.185);
      pendant.scale.setScalar(0.42);
      for (const side of [-1, 1]) line(this.root, trim, [[side * 0.07, 0.566, 0.149], [side * 0.035, 0.534, 0.169], [0, 0.52, 0.181]], 0.0014);
    } else {
      // A V-shaped opening, turned lapels, fine gold piping and a crescent pocket emblem.
      this.cloth = torso;
      this.hem = null;
      this.hemBase = null;
      const openPositions: number[] = [];
      const openIndices: number[] = [];
      for (let i = 0; i <= 8; i++) {
        const y = 0.473 + i / 8 * 0.231;
        const w = 0.003 + i / 8 * 0.061;
        for (const side of [-1, 1]) openPositions.push(side * w, y, surfaceAt(side * w, y) + 0.004);
        if (i < 8) { const k = i * 2; openIndices.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const opening = geometry(new THREE.BufferGeometry());
      opening.setAttribute('position', new THREE.Float32BufferAttribute(openPositions, 3));
      opening.setIndex(openIndices);
      opening.computeVertexNormals();
      mesh(opening, skin, this.root);
      for (const side of [-1, 1]) {
        mesh(lapelGeo([[side * 0.035, 0.708], [side * 0.137, 0.631], [side * 0.073, 0.565], [0, 0.47]]), lapelMat, this.root);
        line(this.root, trim, [[side * 0.035, 0.708], [side * 0.137, 0.631], [side * 0.073, 0.565], [0, 0.47]].map(([x, y]) => [x, y, surfaceAt(x, y) + 0.018] as const), 0.0023);
      }
      line(this.root, trim, [[0, 0.466], [0, 0.35], [0, 0.17]].map(([x, y]) => [x, y, surfaceAt(x, y) + 0.008] as const), 0.002);
      for (const y of [0.424, 0.335, 0.244]) {
        const b = mesh(g.button, trim, this.root, 0, y, surfaceAt(0, y) + 0.014);
        b.scale.set(0.65, 0.65, 0.35);
      }
      line(this.root, trim, [[0.064, 0.442], [0.096, 0.426], [0.135, 0.445]].map(([x, y]) => [x, y, surfaceAt(x, y) + 0.008] as const), 0.002);
      const moon = mesh(g.moon, trim, this.root, 0.095, 0.481, surfaceAt(0.095, 0.481) + 0.015);
      moon.scale.setScalar(0.35);
    }
    this.cloth.name = `${role}.${female ? 'nightdress' : 'pajamas'}`;
    (this.cloth.geometry.getAttribute('position') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
    (this.cloth.geometry.getAttribute('normal') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
    if (this.hem) {
      this.hem.name = `${role}.laceHem`;
      (this.hem.geometry.getAttribute('position') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
      (this.hem.geometry.getAttribute('normal') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
    }
    this.clothBase = new Float32Array(this.cloth.geometry.getAttribute('position').array);

    this.head.position.set(0, 0.9, 0);
    this.head.scale.set(HEAD_SCALE * (female ? 0.92 : 0.97), HEAD_SCALE * 1.04, HEAD_SCALE * 0.87);
    this.root.add(this.head);
    mesh(g.head, skin, this.head);
    mesh(g.hairCap, hairMat, this.head);
    for (const side of [-1, 1]) {
      const ear = mesh(g.ear, skin, this.head, side * 0.139, -0.024, 0);
      ear.scale.set(0.5, 1.3, 0.7);
      if (female) {
        const stud = mesh(g.button, trim, this.head, side * 0.147, -0.041, 0.009);
        stud.scale.setScalar(0.34);
      }
    }
    if (female) {
      // Overlapping S-curves and tapered ends give the silver-lilac lengths a flowing silhouette.
      for (let i = -3; i <= 3; i++) {
        const x = i * 0.04;
        const side = Math.sign(i) || 1;
        const wave = i % 2 === 0 ? 1 : -1;
        strand(this.head, [[x * 0.82, 0.113, -0.088], [x * 1.1, -0.045, -0.139], [x * 1.32 + side * 0.014, -0.2, -0.12], [x * 1.46 + wave * 0.017, -0.43, -0.08], [x * 1.12 - side * 0.012, -0.65 - Math.abs(i) * 0.018, -0.026]], 0.038, i % 2 ? hairShadow : hairMat, 0.021);
        strand(this.head, [[x * 0.83, 0.112, -0.072], [x * 1.1, -0.042, -0.115], [x * 1.32 + side * 0.014, -0.2, -0.096], [x * 1.46 + wave * 0.017, -0.43, -0.056], [x * 1.12 - side * 0.012, -0.63 - Math.abs(i) * 0.018, -0.003]], 0.004, hairLight, 0.002);
      }
      for (const side of [-1, 1]) {
        strand(this.head, [[side * 0.092, 0.113, 0.072], [side * 0.141, 0.027, 0.082], [side * 0.159, -0.13, 0.04], [side * 0.18, -0.248, 0.047], [side * 0.153, -0.396, 0.086], [side * 0.192, -0.505, 0.027]], 0.029);
        strand(this.head, [[side * 0.089, 0.116, 0.086], [side * 0.132, 0.018, 0.101], [side * 0.154, -0.13, 0.06], [side * 0.173, -0.241, 0.067], [side * 0.15, -0.393, 0.104], [side * 0.19, -0.489, 0.044]], 0.004, hairLight, 0.002);
        strand(this.head, [[side * 0.12, 0.071, -0.03], [side * 0.166, -0.082, -0.005], [side * 0.211, -0.263, -0.038], [side * 0.201, -0.434, -0.026], [side * 0.153, -0.614, 0.029]], 0.026, hairMat, 0.017);
        strand(this.head, [[side * 0.126, 0.07, -0.009], [side * 0.171, -0.082, 0.015], [side * 0.216, -0.262, -0.018], [side * 0.203, -0.432, -0.006], [side * 0.159, -0.594, 0.048]], 0.003, hairLight, 0.0015);
      }
      // A swept fringe: pointed tips stop above the eyes.
      strand(this.head, [[-0.049, 0.133, 0.072], [-0.071, 0.108, 0.127], [-0.095, 0.057, 0.144], [-0.105, 0.026, 0.117]], 0.03);
      strand(this.head, [[-0.014, 0.139, 0.071], [0.034, 0.112, 0.129], [0.069, 0.075, 0.145], [0.097, 0.032, 0.12]], 0.045);
      strand(this.head, [[-0.019, 0.136, 0.089], [0.025, 0.119, 0.141], [0.061, 0.085, 0.153], [0.08, 0.056, 0.142]], 0.008, hairLight, 0.003);
      const pin = mesh(g.moon, trim, this.head, 0.115, 0.076, 0.105);
      pin.rotation.z = -0.26;
      pin.scale.setScalar(1.1);
    } else {
      // Layered short navy hair, asymmetrical side part and a few distinct pointed tips.
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) strand(this.head, [[side * (0.078 + i * 0.012), 0.102 - i * 0.015, 0.07 - i * 0.022], [side * 0.142, 0.03 - i * 0.026, 0.045 - i * 0.024], [side * (0.135 + i * 0.006), -0.045 - i * 0.016, 0.027 - i * 0.024]], 0.025, i === 1 ? hairShadow : hairMat);
      }
      for (let i = 0; i < 5; i++) {
        const x = -0.085 + i * 0.043;
        strand(this.head, [[x * 0.48, 0.14, 0.052], [x - 0.023, 0.099, 0.133], [x - 0.015, 0.035 + Math.abs(x) * 0.18, 0.143]], 0.029);
        if (i % 2 === 0) strand(this.head, [[x * 0.5, 0.14, 0.068], [x - 0.023, 0.103, 0.145], [x - 0.015, 0.052 + Math.abs(x) * 0.18, 0.154]], 0.005, hairLight, 0.002);
      }
      strand(this.head, [[0.026, 0.131, -0.025], [0.067, 0.165, 0.007], [0.096, 0.139, 0.042]], 0.03);
    }

    for (const side of [-1, 1]) {
      const eye = mesh(g.eye, kit.eyeWhiteMat, this.head, side * 0.058, 0.014, 0.139);
      eye.rotation.y = side * 0.18;
      eye.scale.copy(EYE_SCALE);
      const iris = mesh(g.iris, irisMat, eye, side * 0.002, 0.003, 0.003);
      iris.scale.set(0.83, 1.08, 0.22);
      const rim = mesh(g.iris, ink, eye, side * 0.002, 0.003, 0.002);
      rim.scale.set(0.91, 1.14, 0.12);
      const pupil = mesh(g.iris, kit.eyeMat, eye, side * 0.002, 0.005, 0.007);
      pupil.scale.set(0.35, 0.65, 0.12);
      const irisGlow = mesh(g.iris, irisLight, eye, side * 0.002, -0.006, 0.008);
      irisGlow.scale.set(0.61, 0.24, 0.08);
      const shine = mesh(g.eyeHi, kit.eyeHiMat, eye, -0.005, 0.012, 0.01);
      shine.scale.set(0.7, 1, 0.28);
      this.eyeHi.push(shine);
      const glint = mesh(g.eyeHi, kit.eyeHiMat, eye, 0.007, -0.004, 0.01);
      glint.scale.setScalar(0.35);
      this.eyeHi.push(glint);
      this.eyes.push(eye);
      // Dark upper eyeliner and eyelashes are parented to the open eye and disappear on closure.
      line(eye, ink, [[-0.029, 0.003, 0.01], [-0.015, 0.016, 0.011], [0.011, 0.018, 0.011], [0.032, 0.007, 0.01]], female ? 0.0028 : 0.002);
      if (female) {
        for (let i = 0; i < 3; i++) line(eye, ink, [[side * (0.022 + i * 0.004), 0.013 - i * 0.002, 0.011], [side * (0.027 + i * 0.005), 0.02 - i * 0.001, 0.012]], 0.0018);
      }
      line(eye, ink, [[-0.024, -0.003, 0.009], [-0.004, -0.011, 0.009], [0.024, -0.003, 0.009]], 0.0008);
      const lid = mesh(g.lid, ink, this.head, side * 0.058, 0.015, 0.143);
      lid.rotation.z = Math.PI;
      lid.rotation.y = side * 0.18;
      lid.scale.y = 0.35;
      lid.visible = false;
      this.lids.push(lid);
      const brow = mesh(g.brow, hairShadow, this.head, side * 0.058, 0.055, 0.135);
      brow.scale.set(0.88, 0.2, 1);
      brow.rotation.y = side * 0.18;
      this.brows.push(brow);
      const blush = mesh(g.blush, this.blushMat, this.head);
      onHead(blush, side * 0.088, -0.035, 0.12, 0.144);
      blush.scale.y = 0.58;
      blush.visible = false;
      this.blush.push(blush);
      const hatch = mesh(g.hatch, kit.hatchMat, this.head);
      onHead(hatch, side * 0.088, -0.035, 0.12, 0.145);
      hatch.visible = false;
      this.hatch.push(hatch);
      const dark = mesh(g.dark, kit.darkMat, this.head);
      onHead(dark, side * 0.058, -0.02, 0.136, 0.143);
      dark.scale.set(1, 0.42, 1);
      dark.visible = false;
      this.dark.push(dark);
    }
    const nose = mesh(g.nose, skin, this.head, 0, -0.031, 0.143);
    nose.scale.set(0.45, 0.75, 0.9);
    const warmDetail = own(new THREE.MeshBasicMaterial({ color: female ? 0xd298a4 : 0xb78383 }));
    line(this.head, warmDetail, [[-0.0035, -0.038, 0.148], [0, -0.04, 0.152], [0.004, -0.037, 0.148]], 0.00085);
    const mouthPivot = new THREE.Group();
    mouthPivot.position.set(0, -0.075, 0.128);
    this.head.add(mouthPivot);
    const lip = mesh(g.nose, warmDetail, mouthPivot, 0, -0.006, 0.0007);
    lip.scale.set(0.77, 0.15, 0.1);
    this.mouth = mesh(g.mouth, ink, mouthPivot);
    // A single delicate anime smile, using the same expression API as all other expressions.
    const smile = mesh(g.mouth, ink, mouthPivot);
    smile.rotation.z = Math.PI;
    smile.scale.set(0.82, 0.35, 1);
    this.mouthW.push(smile);
    this.setExpression('smile');
    this.bubble = mesh(g.bubble, kit.bubbleMat, this.head);
    onHead(this.bubble, 0.022, -0.034, 0.15, 0.155);
    this.bubble.visible = false;
    this.bubble.renderOrder = 5;

    const limb = (name: LimbName, x: number, y: number, z: number) => {
      const grp = new THREE.Group();
      grp.name = `${role}.${name}`;
      grp.position.set(x, y, z);
      grp.rotation.order = 'XYZ';
      this.root.add(grp);
      return grp;
    };
    const armL = limb('armL', ...SHOULDER.armL);
    const armR = limb('armR', ...SHOULDER.armR);
    const legL = limb('legL', 0.1, 0.02, 0);
    const legR = limb('legR', -0.1, 0.02, 0);
    const buildArm = (grp: THREE.Group, name: ArmName): ArmRig => {
      const side = name === 'armL' ? 1 : -1;
      const sleeve = geometry(new HoseGeometry(6, 16));
      const arm = geometry(new HoseGeometry(12, 14));
      const sm = mesh(sleeve, fabric, grp);
      sm.visible = !female;
      const shoulder = mesh(g.shoulder, female ? this.armMat[name] : fabric, grp, 0, 0.006, 0);
      shoulder.position.y = 0.015;
      shoulder.scale.set(female ? 0.85 : 1.16, female ? 0.26 : 0.35, female ? 0.81 : 1);
      const am = mesh(arm, this.armMat[name], grp);
      sm.frustumCulled = am.frustumCulled = false;
      const cuff = mesh(g.cuff, trim, grp);
      cuff.visible = !female;
      const hand = new THREE.Group();
      grp.add(hand);
      const palm = mesh(g.palm, this.handMat[name], hand, 0, -0.015, 0);
      palm.scale.set(0.53, 0.67, 0.3);
      // Four separated fingers and an angled thumb retain the original hand world target.
      for (let i = 0; i < 4; i++) {
        const length = [0.04, 0.05, 0.054, 0.043][i];
        const finger = mesh(geometry(new THREE.CapsuleGeometry(0.007, length - 0.014, 4, 10)), this.handMat[name], hand, (i - 1.5) * 0.014, -0.049 - length / 2, 0);
        finger.rotation.z = (1.5 - i) * 0.075;
      }
      const thumb = mesh(g.thumb, this.handMat[name], hand, -side * 0.033, -0.025, 0.005);
      thumb.rotation.z = -side * 0.65;
      return { sleeve, arm, cuff, hand, side, sleeveEnd: female ? 0 : 0.6, armStart: female ? 0 : 0.56, lastS: NaN, lastB: NaN };
    };
    this.arms = { armL: buildArm(armL, 'armL'), armR: buildArm(armR, 'armR') };
    for (const grp of [legL, legR]) {
      const leg = mesh(g.leg, female ? skin : fabric, grp);
      if (!female) leg.scale.set(1.13, 1, 1.09);
      if (!female) {
        const cuff = mesh(g.legCuff, trim, grp, 0, -0.566, 0.005);
        cuff.rotation.x = Math.PI / 2;
        cuff.scale.set(0.67, 0.7, 1);
      }
      const foot = mesh(g.foot, skin, grp, 0, -0.615, 0.037);
      foot.scale.set(0.7, 0.58, 1.48);
    }
    this.limbs = { armL, armR, legL, legR, head: this.head };

    // Keep all gesture/expression/deforming meshes live; only static siblings share draw calls.
    const dynamic = new Set<THREE.Object3D>([this.chest, this.cloth, ...this.eyes, ...this.eyeHi, ...this.lids, ...this.brows, ...this.blush, ...this.hatch, ...this.dark, this.mouth, ...this.mouthW, this.bubble, this.arms.armL.cuff, this.arms.armR.cuff]);
    if (this.hem) dynamic.add(this.hem);
    const batch = (parent: THREE.Object3D) => {
      const sources = parent.children.filter((obj): obj is THREE.Mesh => obj instanceof THREE.Mesh && !dynamic.has(obj) && !(obj.geometry instanceof HoseGeometry));
      this.ownGeo.push(...batchStaticMeshes(parent, sources).geometries);
    };
    for (const hand of [this.arms.armL.hand, this.arms.armR.hand]) batch(hand);
    for (const eye of this.eyes) batch(eye);
    batch(this.head);
    batch(this.root);
    batch(legL);
    batch(legR);
    retireUnusedGeometries(this.root, this.ownGeo);

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

  /** 手掌的世界座標;呼叫前 matrixWorld 要是新的 */
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
      const k = L >= 3 ? 1.18 : 1;
      b.scale.set(k, k * 0.58, 1);
    }
    for (const h of this.hatch) h.visible = L >= 3;
    this.blushMat.opacity = BLUSH_ALPHA[L];
  }

  setDarkCircles(on: boolean): void {
    for (const d of this.dark) d.visible = on;
  }

  /** 笑 = 小弧線、平 = 一條線、皺眉 = ∩ */
  setExpression(e: Expression): void {
    this.mouth.visible = e !== 'smile';
    for (const w of this.mouthW) w.visible = e === 'smile';
    this.mouth.rotation.z = e === 'frown' ? 0 : Math.PI;
    this.mouth.scale.set(e === 'neutral' ? 0.7 : 1, e === 'neutral' ? 0.25 : 1, 1);
    this.mouth.position.y = e === 'frown' ? -0.012 : 0;
    for (let i = 0; i < this.brows.length; i++) {
      const side = i === 0 ? -1 : 1;
      this.brows[i].rotation.z = side * (e === 'frown' ? 0.38 : e === 'neutral' ? 0 : -0.08);
    }
  }

  setNumb(n: number): void {
    this.numb = n;
    const t = Math.min(1, Math.max(0, (n - 75) / 25));
    const k = n >= 75 ? 0.35 + 0.65 * t : 0;
    for (const m of [this.armMat.armL, this.handMat.armL]) m.color.copy(this.skinColor).lerp(NUMB_COLOR, k);
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
    this.chest.scale.set(CHEST_SCALE.x * (1 + 0.05 * b), CHEST_SCALE.y * (1 + 0.06 * b), CHEST_SCALE.z * (1 + 0.18 * b));

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
    this.updateCloth(b);
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
    for (const e of this.eyes) {
      e.scale.y = EYE_SCALE.y * open;
      e.visible = open > 0.22;
    }
    for (const lid of this.lids) lid.visible = open <= 0.22;
    for (const h of this.eyeHi) h.visible = open > 0.5;

    this.updateBubble(dt, b, open);
  }

  /** The lower slip follows bent thighs while the waist and neckline stay fitted. */
  private updateCloth(breath: number): void {
    const pitchL = this.limbs.legL.rotation.x;
    const pitchR = this.limbs.legR.rotation.x;
    const poseChanged = !Number.isFinite(this.lastClothPitchL) || Math.abs(pitchL - this.lastClothPitchL) > 0.0001 || Math.abs(pitchR - this.lastClothPitchR) > 0.0001;
    if (!poseChanged && Math.abs(breath - this.lastClothBreath) < 0.0001) return;
    this.lastClothPitchL = pitchL;
    this.lastClothPitchR = pitchR;
    this.lastClothBreath = breath;
    const pos = this.cloth.geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const x = this.clothBase[i * 3];
      const y = this.clothBase[i * 3 + 1];
      const z = this.clothBase[i * 3 + 2];
      let yy = y;
      let zz = z;
      if (this.role === 'female' && y < 0.15) {
        const weight = THREE.MathUtils.smoothstep(0.15 - y, 0, 0.38);
        const localPitch = THREE.MathUtils.lerp(this.limbs.legR.rotation.x, this.limbs.legL.rotation.x, THREE.MathUtils.smoothstep(x, -0.14, 0.14));
        const a = localPitch * weight;
        yy = 0.02 + Math.cos(a) * (y - 0.02) - Math.sin(a) * z;
        zz = Math.sin(a) * (y - 0.02) + Math.cos(a) * z;
      }
      if (z > 0 && y > 0.31 && y < 0.61) zz += Math.sin((y - 0.31) / 0.3 * Math.PI) * 0.004 * breath;
      pos.setXYZ(i, x, yy, zz);
    }
    pos.needsUpdate = true;
    this.cloth.geometry.computeVertexNormals();
    if (this.hem && this.hemBase && poseChanged) {
      const hemPos = this.hem.geometry.getAttribute('position');
      for (let i = 0; i < hemPos.count; i++) {
        const x = this.hemBase[i * 3];
        const y = this.hemBase[i * 3 + 1];
        const z = this.hemBase[i * 3 + 2];
        const localPitch = THREE.MathUtils.lerp(this.limbs.legR.rotation.x, this.limbs.legL.rotation.x, THREE.MathUtils.smoothstep(x, -0.14, 0.14));
        const a = localPitch * THREE.MathUtils.smoothstep(0.15 - y, 0, 0.38);
        hemPos.setXYZ(i, x, 0.02 + Math.cos(a) * (y - 0.02) - Math.sin(a) * z, Math.sin(a) * (y - 0.02) + Math.cos(a) * z);
      }
      hemPos.needsUpdate = true;
      this.hem.geometry.computeVertexNormals();
    }
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

  /** 依伸長 / 彎曲重建袖子與手臂的軟管,手掌對齊末端切線 */
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
    rig.sleeve.update(this.p0, this.p1, this.p2, 0, Math.max(0.01, rig.sleeveEnd), SLEEVE_R[0], SLEEVE_R[1], this.ref);
    rig.arm.update(this.p0, this.p1, this.p2, rig.armStart, 0.985, ARM_R[0], ARM_R[1], this.ref);
    // 袖口滾邊
    bezier(this.p0, this.p1, this.p2, rig.sleeveEnd, rig.cuff.position);
    bezierTangent(this.p0, this.p1, this.p2, rig.sleeveEnd, this.tmpC);
    rig.cuff.quaternion.setFromUnitVectors(Z_AXIS, this.tmpC);
    // 手掌:位置 = 末端,−y 對齊末端切線
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
    // 腿(含腳丫):半徑要留得比腳丫 + 毛高(LEG_COVER),不然毛會從被子的縫戳出來
    i = putSegment(out, i, a, b, LEG_COVER + thick, 0.2 + wide, 1);
    a.setFromMatrixPosition(this.limbs.legR.matrixWorld);
    b.set(0, -(LEG_LEN - 0.04), 0).applyMatrix4(this.limbs.legR.matrixWorld);
    i = putSegment(out, i, a, b, LEG_COVER + thick, 0.2 + wide, 1);
    // The fifth segment covers the slip hem as it follows the thighs, also when side sleeping.
    if (this.role === 'female') {
      const pitch = (this.limbs.legL.rotation.x + this.limbs.legR.rotation.x) / 2;
      a.set(0, 0.15, 0.008).applyMatrix4(this.root.matrixWorld);
      b.set(0, 0.02 - Math.cos(pitch) * 0.28 - Math.sin(pitch) * 0.008, -Math.sin(pitch) * 0.28 + Math.cos(pitch) * 0.008).applyMatrix4(this.root.matrixWorld);
      const sin = Math.sin(this.croll.cur);
      const cos = Math.cos(this.croll.cur);
      const radius = Math.hypot(0.23 * sin, 0.195 * cos * Math.cos(pitch)) + 0.012;
      return putSegment(out, i, a, b, radius + thick, 0.26 + wide, 1);
    }
    a.set(0, 0.06, 0).applyMatrix4(this.root.matrixWorld);
    return putSegment(out, i, a, a, 0.14 + thick, 0.2 + wide, 1);
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

export const SEGMENTS_PER_CHAR = 5;
export const SEGMENT_STRIDE = 9;
