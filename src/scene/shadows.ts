// 接觸陰影(不開 shadowMap 的便宜做法,§14.6):頭在枕頭上、身體在床單/地板上、棉被側緣落在床單上的柔和暗影。
// 都是貼在表面上的透明貼片,每幀跟著角色與棉被移動。
import * as THREE from 'three';
import type { Role } from '../game/types';
import { BLANKET_HALF_W, BLANKET_Z } from './blanket';
import { edgeShadowTexture, softShadowTexture } from './textures';

const PILLOW_TOP = 0.652; // 長枕頂面(y 0.6 + 0.05)
const PILLOW = { x: 1.0, z0: -0.975, z1: -0.525 };
const MATTRESS_TOP = 0.556;
const MATTRESS_HALF = 1.1;
const FLOOR_Y = 0.004;
/** 棉被在床單上的範圍(床頭端 → 床尾端) */
const COVER_Z0 = BLANKET_Z - 0.81;
const COVER_Z1 = 1.13;

interface Decal {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
}

export interface ShadowSource {
  role: Role;
  head: THREE.Vector3;
  /** 髖(root)的世界座標:軀幹往床頭延伸、腿往床尾延伸 */
  hip: THREE.Vector3;
  fallen: boolean;
}

export class ContactShadows {
  readonly group = new THREE.Group();
  private readonly soft = softShadowTexture();
  private readonly edge = edgeShadowTexture();
  private readonly plane = new THREE.PlaneGeometry(1, 1);
  private readonly heads: Record<Role, Decal>;
  private readonly bodies: Record<Role, Decal>;
  private readonly edges: [Decal, Decal];

  constructor() {
    this.group.name = 'contactShadows';
    const decal = (tex: THREE.Texture, order: number): Decal => {
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        opacity: 0,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
        fog: false,
      });
      const mesh = new THREE.Mesh(this.plane, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = order;
      mesh.visible = false;
      this.group.add(mesh);
      return { mesh, mat };
    };
    this.heads = { male: decal(this.soft, 2), female: decal(this.soft, 2) };
    this.bodies = { male: decal(this.soft, 1), female: decal(this.soft, 1) };
    this.edges = [decal(this.edge, 1), decal(this.edge, 1)];
  }

  /** 每幀:兩個角色 + 棉被目前的 x(mesh.position.x) */
  update(chars: ShadowSource[], blanketX: number): void {
    for (const c of chars) {
      // 頭:在枕頭範圍內、貼近枕面才有
      const hd = this.heads[c.role];
      const onPillow = !c.fallen && Math.abs(c.head.x) < PILLOW.x && c.head.z > PILLOW.z0 - 0.05 && c.head.z < PILLOW.z1 + 0.1;
      const lift = c.head.y - PILLOW_TOP - 0.17;
      const ha = onPillow ? 0.6 * clamp01(1 - lift / 0.14) : 0;
      hd.mesh.visible = ha > 0.01;
      hd.mat.opacity = ha;
      hd.mesh.position.set(c.head.x, PILLOW_TOP + 0.002, Math.min(c.head.z + 0.03, PILLOW.z1 + 0.02));
      hd.mesh.scale.set(0.42, 0.34, 1);

      // 身體:床上 = 床單上方一點;掉下床 = 地板
      const bd = this.bodies[c.role];
      const onBed = !c.fallen && Math.abs(c.hip.x) < MATTRESS_HALF;
      const surf = onBed ? MATTRESS_TOP : FLOOR_Y;
      const height = c.hip.y - surf - 0.17;
      const ba = 0.5 * clamp01(1 - height / 0.35);
      bd.mesh.visible = ba > 0.01;
      bd.mat.opacity = ba;
      bd.mesh.position.set(c.hip.x, surf + 0.002, onBed ? c.hip.z - 0.02 : c.hip.z);
      bd.mesh.scale.set(0.56, onBed ? 1.45 : 1.1, 1);
    }

    // 棉被左右側緣:落在床單上時,往外投一條柔和的影子
    for (const [k, s] of [
      [0, -1],
      [1, 1],
    ] as const) {
      const d = this.edges[k];
      const x = blanketX + s * BLANKET_HALF_W;
      const a = 0.55 * clamp01((1.02 - Math.abs(x)) / 0.12);
      d.mesh.visible = a > 0.01;
      d.mat.opacity = a;
      const w = 0.13;
      d.mesh.position.set(x + (s * w) / 2, MATTRESS_TOP + 0.002, (COVER_Z0 + COVER_Z1) / 2);
      // u = 0 在被緣(深)→ 往外淡出;左緣把 x 翻過來
      d.mesh.scale.set(s * w, COVER_Z1 - COVER_Z0, 1);
    }
  }

  dispose(): void {
    this.plane.dispose();
    this.soft.dispose();
    this.edge.dispose();
    this.group.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      m?.dispose();
    });
  }
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
