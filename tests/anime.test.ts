import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { almondGeometry, crescentGeometry, hairCapGeometry, hairLock, humanHeadGeometry, profileGeometry } from '../src/scene/anime';

describe('anime character geometry', () => {
  it.each([false, true])('tailored clothing faces outward with reversed rings = %s', (reversed) => {
    const rings: [number, number, number][] = [[-0.2, 0.2, 0.12], [0.2, 0.14, 0.1]];
    const geometry = profileGeometry(reversed ? rings.reverse() : rings);
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    for (let i = 0; i < positions.count; i++) {
      const radial = new THREE.Vector3(positions.getX(i), 0, positions.getZ(i) - 0.008);
      const normal = new THREE.Vector3(normals.getX(i), 0, normals.getZ(i));
      expect(radial.dot(normal)).toBeGreaterThan(0);
    }
    geometry.dispose();
  });

  it('sculpted features have finite positions and normals, including a vertical hair lock', () => {
    const geometries = [
      humanHeadGeometry(), hairCapGeometry(), almondGeometry(), crescentGeometry(),
      hairLock([[0, 0.15, 0], [0, 0, 0], [0, -0.4, 0]], 0.03),
      profileGeometry([[-0.2, 0.2, 0.12], [0.2, 0.14, 0.1]], true),
    ];
    for (const geometry of geometries) {
      for (const name of ['position', 'normal']) {
        const attribute = geometry.getAttribute(name);
        expect(attribute.count).toBeGreaterThan(0);
        expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
      }
      geometry.dispose();
    }
  });
});
