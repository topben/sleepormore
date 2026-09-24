// 橡皮管手臂(rubber hose):沿二次貝茲曲線的軟管。拓撲固定,頂點每幀原地改寫(不 new 任何東西)。
import * as THREE from 'three';

const TAU = Math.PI * 2;

/** 二次貝茲 B(t) = (1−t)²·p0 + 2(1−t)t·p1 + t²·p2 */
export function bezier(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
  const u = 1 - t;
  return out.set(
    u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z,
  );
}

/** 切線 B′(t)(已正規化) */
export function bezierTangent(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
  const u = 1 - t;
  out.set(2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x), 2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y), 2 * u * (p1.z - p0.z) + 2 * t * (p2.z - p1.z));
  const len = out.length();
  return len > 1e-9 ? out.multiplyScalar(1 / len) : out.set(0, -1, 0);
}

export class HoseGeometry extends THREE.BufferGeometry {
  private readonly rings: number;
  private readonly radial: number;
  private readonly pos: Float32Array;
  private readonly nor: Float32Array;
  private readonly p = new THREE.Vector3();
  private readonly t = new THREE.Vector3();
  private readonly n = new THREE.Vector3();
  private readonly b = new THREE.Vector3();
  private readonly d = new THREE.Vector3();

  constructor(rings = 12, radial = 12) {
    super();
    this.rings = rings;
    this.radial = radial;
    const count = (rings + 1) * (radial + 1);
    this.pos = new Float32Array(count * 3);
    this.nor = new Float32Array(count * 3);
    const uv = new Float32Array(count * 2);
    for (let i = 0; i <= rings; i++) {
      for (let j = 0; j <= radial; j++) {
        const k = i * (radial + 1) + j;
        uv[k * 2] = j / radial;
        uv[k * 2 + 1] = 1 - i / rings;
      }
    }
    const idx: number[] = [];
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j;
        const b = a + radial + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1); // 外側為正面(法線朝外)
      }
    }
    const posAttr = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    const norAttr = new THREE.BufferAttribute(this.nor, 3).setUsage(THREE.DynamicDrawUsage);
    this.setAttribute('position', posAttr);
    this.setAttribute('normal', norAttr);
    this.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    this.setIndex(idx);
    this.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1);
  }

  /**
   * 取曲線 t ∈ [t0, t1] 那段做管子,半徑從 r0 線性變到 r1。
   * 截面的起始方向用 ref(投影到切線的垂直面),沿曲線做平行傳遞 → 管子不會扭轉,花紋穩定。
   */
  update(p0: THREE.Vector3, p1: THREE.Vector3, p2: THREE.Vector3, t0: number, t1: number, r0: number, r1: number, ref: THREE.Vector3): void {
    const { p, t, n, b } = this;
    const rings = this.rings;
    const radial = this.radial;
    for (let i = 0; i <= rings; i++) {
      const k = i / rings;
      const tt = t0 + (t1 - t0) * k;
      bezier(p0, p1, p2, tt, p);
      bezierTangent(p0, p1, p2, tt, t);
      if (i === 0) {
        n.copy(ref).addScaledVector(t, -ref.dot(t));
        if (n.lengthSq() < 1e-6) n.set(1, 0, 0).addScaledVector(t, -t.x);
        n.normalize();
      } else {
        // 平行傳遞:上一圈的法向投影到新切線的垂直面
        n.addScaledVector(t, -n.dot(t)).normalize();
      }
      b.crossVectors(t, n);
      const r = r0 + (r1 - r0) * k;
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * TAU;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const o = (i * (radial + 1) + j) * 3;
        const dx = c * n.x + s * b.x;
        const dy = c * n.y + s * b.y;
        const dz = c * n.z + s * b.z;
        this.pos[o] = p.x + r * dx;
        this.pos[o + 1] = p.y + r * dy;
        this.pos[o + 2] = p.z + r * dz;
        this.nor[o] = dx;
        this.nor[o + 1] = dy;
        this.nor[o + 2] = dz;
      }
    }
    this.attributes.position.needsUpdate = true;
    this.attributes.normal.needsUpdate = true;
    // 包圍球:取中點與兩端的最大距離(給 raycast/culling 用;手臂 mesh 另外關掉 frustumCulled)
    bezier(p0, p1, p2, (t0 + t1) / 2, this.d);
    this.boundingSphere!.center.copy(this.d);
    this.boundingSphere!.radius = Math.max(p0.distanceTo(this.d), p2.distanceTo(this.d)) + Math.max(r0, r1);
  }
}
