import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { batchStaticMeshes, retireUnusedGeometries } from '../src/scene/modelBatch';

const triangle = () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  geometry.computeVertexNormals();
  return geometry;
};

describe('static model batching', () => {
  it('preserves positions and inverse-transpose normals under moving parents and nonuniform mesh scales', () => {
    const root = new THREE.Group();
    root.position.set(1, 3, -2);
    root.rotation.set(0.3, 0.1, -0.2);
    const head = new THREE.Group();
    head.position.set(0, 0.8, 0);
    head.scale.set(0.8, 1.1, 0.7);
    root.add(head);
    const material = new THREE.MeshToonMaterial();
    const a = new THREE.Mesh(triangle(), material);
    const b = new THREE.Mesh(triangle(), material);
    a.position.set(0.1, -0.2, 0.05);
    a.rotation.set(0.6, 0.2, 0.4);
    a.scale.set(0.6, 1.3, 0.9);
    b.position.set(-0.2, 0.1, 0.4);
    b.rotation.set(-0.4, 0.5, 0.3);
    head.add(a, b);
    root.updateMatrixWorld(true);
    const positions: THREE.Vector3[] = [];
    const normals: THREE.Vector3[] = [];
    for (const mesh of [a, b]) {
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
      for (let i = 0; i < mesh.geometry.getAttribute('position').count; i++) {
        positions.push(new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'), i).applyMatrix4(mesh.matrixWorld));
        normals.push(new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('normal'), i).applyNormalMatrix(normalMatrix));
      }
    }
    const result = batchStaticMeshes(head, [a, b, a]);
    expect(result.savedDrawCalls).toBe(1);
    expect(result.meshes).toHaveLength(1);
    expect(result.meshes[0].material).toBe(material);
    root.updateMatrixWorld(true);
    const batch = result.meshes[0];
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(batch.matrixWorld);
    positions.forEach((expected, i) => {
      const actual = new THREE.Vector3().fromBufferAttribute(batch.geometry.getAttribute('position'), i).applyMatrix4(batch.matrixWorld);
      expect(actual.distanceTo(expected)).toBeLessThan(1e-6);
      const normal = new THREE.Vector3().fromBufferAttribute(batch.geometry.getAttribute('normal'), i).applyNormalMatrix(normalMatrix);
      expect(normal.distanceTo(normals[i])).toBeLessThan(1e-6);
    });
    expect(batch.geometry.boundingSphere!.radius).toBeGreaterThan(0);
    expect(batch.geometry.getAttribute('uv').count).toBe(6);
    for (const geometry of [a.geometry, b.geometry, ...result.geometries]) geometry.dispose();
    material.dispose();
  });

  it('groups by material identity and render state, while retaining triangle counts for mixed indexing', () => {
    const parent = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({ color: 0xffddaa });
    const differentGold = gold.clone();
    const meshes = Array.from({ length: 5 }, (_, i) => new THREE.Mesh(triangle(), i === 4 ? differentGold : gold));
    meshes[1].geometry.setIndex([0, 1, 2]);
    meshes[2].castShadow = meshes[3].castShadow = true;
    meshes[2].renderOrder = meshes[3].renderOrder = 2;
    meshes[2].layers.set(3);
    meshes[3].layers.set(3);
    parent.add(...meshes);
    const result = batchStaticMeshes(parent, meshes);
    expect(result.savedDrawCalls).toBe(2);
    expect(result.meshes).toHaveLength(2);
    expect(result.geometries.map((geometry) => geometry.index!.count)).toEqual([6, 6]);
    expect(result.meshes[1].castShadow).toBe(true);
    expect(result.meshes[1].renderOrder).toBe(2);
    expect(result.meshes[1].layers.mask).toBe(meshes[2].layers.mask);
    expect(meshes[4].parent).toBe(parent);
    for (const mesh of meshes) mesh.geometry.dispose();
    for (const geometry of result.geometries) geometry.dispose();
    gold.dispose();
    differentGold.dispose();
  });

  it('keeps dynamic vertices, transparent surfaces, expression parents and unselected geometry separate', () => {
    const parent = new THREE.Group();
    const material = new THREE.MeshBasicMaterial();
    const meshes = Array.from({ length: 7 }, () => new THREE.Mesh(triangle(), material));
    (meshes[2].geometry.getAttribute('position') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
    meshes[3].material = new THREE.MeshBasicMaterial({ transparent: true });
    meshes[4].visible = false;
    meshes[5].add(new THREE.Group());
    parent.add(...meshes);
    const result = batchStaticMeshes(parent, meshes.slice(0, 6));
    expect(result.savedDrawCalls).toBe(1);
    for (const mesh of meshes.slice(2)) expect(mesh.parent).toBe(parent);
    for (const mesh of meshes) mesh.geometry.dispose();
    for (const geometry of result.geometries) geometry.dispose();
    meshes[3].material.dispose();
    material.dispose();
  });

  it('preserves outward triangle winding when baking a mirrored hand', () => {
    const parent = new THREE.Group();
    const material = new THREE.MeshBasicMaterial();
    const a = new THREE.Mesh(triangle(), material);
    const b = new THREE.Mesh(triangle(), material);
    b.scale.set(-1, 1, 1);
    parent.add(a, b);
    const result = batchStaticMeshes(parent, [a, b]);
    const geo = result.geometries[0];
    const position = geo.getAttribute('position');
    const index = geo.index!;
    const p = new THREE.Vector3();
    const u = new THREE.Vector3();
    const v = new THREE.Vector3();
    for (let i = 0; i < index.count; i += 3) {
      p.fromBufferAttribute(position, index.getX(i));
      u.fromBufferAttribute(position, index.getX(i + 1)).sub(p);
      v.fromBufferAttribute(position, index.getX(i + 2)).sub(p);
      const normal = new THREE.Vector3().fromBufferAttribute(geo.getAttribute('normal'), index.getX(i));
      expect(u.cross(v).dot(normal)).toBeGreaterThan(0);
    }
    a.geometry.dispose();
    b.geometry.dispose();
    geo.dispose();
    material.dispose();
  });

  it('never disposes shared kit geometry and retires only unused owned sources exactly once', () => {
    const root = new THREE.Group();
    const hand = new THREE.Group();
    root.add(hand);
    const material = new THREE.MeshBasicMaterial();
    const shared = triangle();
    const owned = triangle();
    const stillUsed = triangle();
    const ownedGeometries = [owned, owned, stillUsed];
    const disposeShared = vi.spyOn(shared, 'dispose');
    const disposeOwned = vi.spyOn(owned, 'dispose');
    const disposeStillUsed = vi.spyOn(stillUsed, 'dispose');
    const meshes = [shared, owned, stillUsed].map((geo) => new THREE.Mesh(geo, material));
    hand.add(...meshes);
    const hiddenDynamic = new THREE.Mesh(stillUsed, material);
    hiddenDynamic.visible = false;
    root.add(hiddenDynamic);
    const result = batchStaticMeshes(hand, meshes);
    expect(disposeShared).not.toHaveBeenCalled();
    expect(disposeOwned).not.toHaveBeenCalled();
    const disposeBatch = vi.spyOn(result.geometries[0], 'dispose');
    ownedGeometries.push(...result.geometries);
    expect(retireUnusedGeometries(root, ownedGeometries)).toBe(1);
    expect(ownedGeometries).toEqual([stillUsed, ...result.geometries]);
    expect(disposeOwned).toHaveBeenCalledTimes(1);
    expect(disposeShared).not.toHaveBeenCalled();
    expect(disposeStillUsed).not.toHaveBeenCalled();
    for (const geo of ownedGeometries) geo.dispose();
    expect(disposeOwned).toHaveBeenCalledTimes(1);
    expect(disposeStillUsed).toHaveBeenCalledTimes(1);
    expect(disposeBatch).toHaveBeenCalledTimes(1);
    shared.dispose();
    material.dispose();
  });
});
