// 床(SCENE-RIG §1):床架、床墊、床頭板、單一長枕。整組放在一個 Group,rough 時整組上下抖。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export interface Bed {
  group: THREE.Group;
  dispose(): void;
}

export function buildBed(): Bed {
  const group = new THREE.Group();
  group.name = 'bed';
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];

  const box = (w: number, h: number, d: number, r: number, color: number, rough: number, x: number, y: number, z: number) => {
    const geo = new RoundedBoxGeometry(w, h, d, 3, r);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0 });
    geos.push(geo);
    mats.push(mat);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };

  box(2.3, 0.35, 2.5, 0.05, 0x5b3f37, 0.75, 0, 0.175, 0); // 床架
  box(2.2, 0.2, 2.4, 0.07, 0xe6e0ef, 0.95, 0, 0.45, 0); // 床墊(床單)
  box(2.3, 0.9, 0.08, 0.035, 0x5b3f37, 0.7, 0, 0.8, -1.25); // 床頭板
  box(2.02, 0.5, 0.05, 0.025, 0x7d6598, 0.95, 0, 0.93, -1.2); // 床頭軟墊
  box(2.0, 0.1, 0.45, 0.045, 0xf6f1fb, 0.95, 0, 0.6, -0.75); // 長枕

  return {
    group,
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
