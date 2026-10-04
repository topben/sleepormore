import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface StaticMeshBatchResult {
  meshes: THREE.Mesh[];
  /** New, independently owned geometries. Add these to the model's disposal list once. */
  geometries: THREE.BufferGeometry[];
  savedDrawCalls: number;
}

/**
 * Bake explicitly selected static siblings into one mesh per material / render state.
 * The parent can still animate. Selected meshes must not animate their own transform,
 * visibility, or vertices; expression meshes and deforming cloth must stay separate.
 * Source geometries and materials are never changed or disposed (they may be shared).
 */
export function batchStaticMeshes(parent: THREE.Object3D, sources: readonly THREE.Mesh[]): StaticMeshBatchResult {
  const buckets = new Map<string, THREE.Mesh[]>();
  for (const mesh of new Set(sources)) {
    if (mesh.parent !== parent || !mesh.visible || mesh.children.length || Array.isArray(mesh.material) || mesh.material.transparent) continue;
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh || (mesh as THREE.InstancedMesh).isInstancedMesh) continue;
    const geo = mesh.geometry;
    if (!geo.getAttribute('position') || geo.drawRange.start !== 0 || geo.drawRange.count !== Infinity) continue;
    if (Object.values(geo.morphAttributes).some((attributes) => attributes.length > 0)) continue;
    const attributes = Object.entries(geo.attributes).sort(([a], [b]) => a.localeCompare(b));
    if (attributes.some(([, attribute]) => !(attribute instanceof THREE.BufferAttribute) || attribute.usage !== THREE.StaticDrawUsage)) continue;
    const layout = attributes.map(([name, attribute]) => `${name}:${attribute.itemSize}:${attribute.normalized}:${attribute.array.constructor.name}`).join(',');
    const key = [mesh.material.uuid, layout, mesh.castShadow, mesh.receiveShadow, mesh.renderOrder, mesh.layers.mask, mesh.frustumCulled].join('|');
    const bucket = buckets.get(key);
    if (bucket) bucket.push(mesh);
    else buckets.set(key, [mesh]);
  }

  const result: StaticMeshBatchResult = { meshes: [], geometries: [], savedDrawCalls: 0 };
  for (const bucket of buckets.values()) {
    if (bucket.length < 2) continue;
    const copies = bucket.map((mesh) => {
      if (mesh.matrixAutoUpdate) mesh.updateMatrix();
      const geo = mesh.geometry.clone();
      // Indexed and unindexed primitives can safely share a batch without expanding vertices.
      if (!geo.index) geo.setIndex(Array.from({ length: geo.getAttribute('position').count }, (_, i) => i));
      geo.applyMatrix4(mesh.matrix);
      // A mirrored Mesh reverses GPU winding; baking its transform must do the same.
      if (mesh.matrix.determinant() < 0) {
        const index = geo.index!;
        for (let i = 0; i < index.count; i += 3) {
          const b = index.getX(i + 1);
          index.setX(i + 1, index.getX(i + 2));
          index.setX(i + 2, b);
        }
      }
      return geo;
    });
    let merged: THREE.BufferGeometry | null;
    try {
      merged = mergeGeometries(copies, false);
    } finally {
      for (const geo of copies) geo.dispose();
    }
    // Unsupported layouts leave the original scene intact.
    if (!merged) continue;
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    const first = bucket[0];
    const batch = new THREE.Mesh(merged, first.material);
    batch.name = `${parent.name || 'model'}.static`;
    batch.castShadow = first.castShadow;
    batch.receiveShadow = first.receiveShadow;
    batch.renderOrder = first.renderOrder;
    batch.layers.mask = first.layers.mask;
    batch.frustumCulled = first.frustumCulled;
    for (const mesh of bucket) parent.remove(mesh);
    parent.add(batch);
    result.meshes.push(batch);
    result.geometries.push(merged);
    result.savedDrawCalls += bucket.length - 1;
  }
  return result;
}

/**
 * After registering batches, release unused model-owned source geometry and deduplicate
 * the disposal list. Scan the complete model root, including invisible/dynamic meshes.
 * Shared kit geometry must never be included in ownedGeometries.
 */
export function retireUnusedGeometries(root: THREE.Object3D, ownedGeometries: THREE.BufferGeometry[]): number {
  const referenced = new Set<THREE.BufferGeometry>();
  root.traverse((object) => {
    const geo = (object as THREE.Mesh).geometry;
    if (geo?.isBufferGeometry) referenced.add(geo);
  });
  const owned = new Set(ownedGeometries);
  ownedGeometries.length = 0;
  let retired = 0;
  for (const geo of owned) {
    if (referenced.has(geo)) ownedGeometries.push(geo);
    else {
      geo.dispose();
      retired++;
    }
  }
  return retired;
}
