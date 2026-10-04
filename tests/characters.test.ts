import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Posture, Role } from '../src/game/types';
import { Character, CharacterKit, SEGMENTS_PER_CHAR, SEGMENT_STRIDE, type Wobble } from '../src/scene/character';
import { Blanket } from '../src/scene/blanket';
import { basePose } from '../src/scene/postures';
import { Tweens } from '../src/scene/tween';

// These tests exercise real geometry and animation without requiring a browser canvas.
// Quilt geometry / height generation remains real; only pixel drawing is substituted.
vi.mock('../src/scene/textures', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/scene/textures')>();
  const { DataTexture, RGBAFormat } = await import('three');
  const texture = () => new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat);
  return { ...actual, blushHatchTexture: texture, blanketTexture: texture, blanketNormalTexture: texture };
});

const ROLES: readonly Role[] = ['male', 'female'];
const POSTURES: readonly Posture[] = ['supine', 'sideFacing', 'sideAway', 'prone'];
const cleanup: (() => void)[] = [];

afterEach(() => {
  while (cleanup.length) cleanup.pop()!();
  vi.restoreAllMocks();
});

function models() {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  const tweens = new Tweens();
  const kit = new CharacterKit();
  const chars = { male: new Character('male', tweens, kit), female: new Character('female', tweens, kit) };
  cleanup.push(() => { chars.male.dispose(); chars.female.dispose(); kit.dispose(); });
  return { tweens, kit, chars };
}

function finiteModel(character: Character) {
  character.root.traverse((object) => {
    expect(object.matrixWorld.elements.every(Number.isFinite)).toBe(true);
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const name of ['position', 'normal']) {
      const attribute = mesh.geometry.getAttribute(name);
      if (attribute) expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
    }
  });
  const point = new THREE.Vector3();
  for (const sample of [
    () => character.headWorld(point),
    () => character.chestWorld(point),
    () => character.handWorld('armL', point),
    () => character.handWorld('armR', point),
    () => character.nearShoulderWorld(new THREE.Vector3(), point),
  ]) expect(sample().toArray().every(Number.isFinite)).toBe(true);
}

describe('adult character rig', () => {
  it('keeps every sleep posture and animated reach finite', () => {
    const { tweens, chars } = models();
    const target = new THREE.Vector3();
    let time = 0;
    const gestures: readonly Wobble[] = ['pat', 'stroke', 'yank', 'shove', 'hold'];
    for (const posture of POSTURES) {
      for (const role of ROLES) {
        const character = chars[role];
        character.resetTransient();
        character.snapPose(basePose(role, posture), role === 'male' ? -0.32 : 0.32);
        character.setBreath(16, true, true);
        character.setEyes(true, true);
        character.setNumb(role === 'male' ? 100 : 0);
        character.update(0, time);
        character.root.updateMatrixWorld(true);
      }
      for (const wobble of gestures) {
        for (const role of ROLES) {
          const character = chars[role];
          chars[role === 'male' ? 'female' : 'male'].headWorld(target);
          character.gesture('armL', target, { dur: 1.1, wobble, maxStretch: 1.6 });
          character.squeeze('armR', 0.6);
          character.flop('armR', 1.6);
        }
        for (let frame = 0; frame < 90; frame++) {
          time += 1 / 60;
          tweens.update(1 / 60);
          for (const role of ROLES) {
            chars[role].update(1 / 60, time);
            chars[role].root.updateMatrixWorld(true);
            if (frame % 30 === 0 || frame === 89) finiteModel(chars[role]);
          }
        }
      }
    }
  });

  it('writes five complete blanket segments per role without touching neighboring storage', () => {
    const { chars } = models();
    expect(SEGMENTS_PER_CHAR).toBe(5);
    expect(SEGMENT_STRIDE).toBe(9);
    const length = SEGMENTS_PER_CHAR * SEGMENT_STRIDE;
    for (const posture of POSTURES) {
      for (const role of ROLES) {
        const character = chars[role];
        character.snapPose(basePose(role, posture), 0);
        character.update(0, 0);
        character.root.updateMatrixWorld(true);
        const output = new Float32Array(length + 2).fill(NaN);
        output[0] = 123;
        output[output.length - 1] = 456;
        const end = character.writeSegments(output, 1, 1);
        expect(end).toBe(length + 1);
        expect(output[0]).toBe(123);
        expect(output[end]).toBe(456);
        expect(Array.from(output.subarray(1, end)).every(Number.isFinite)).toBe(true);
      }
    }
  });

  it('keeps the visible nightdress below the centered blanket in every sleep posture', () => {
    const { tweens, chars } = models();
    const blanket = new Blanket();
    cleanup.push(() => blanket.dispose());
    const cloth = chars.female.root.getObjectByName('female.nightdress') as THREE.Mesh | undefined;
    expect(cloth?.isMesh).toBe(true);
    expect(cloth?.visible).toBe(true);
    const positions = cloth!.geometry.getAttribute('position');
    const segments = new Float32Array(SEGMENT_STRIDE * SEGMENTS_PER_CHAR * ROLES.length);
    const point = new THREE.Vector3();
    const origin = new THREE.Vector3();
    const down = new THREE.Vector3(0, -1, 0);
    const ray = new THREE.Raycaster();
    let time = 0;
    for (const posture of POSTURES) {
      for (const role of ROLES) {
        chars[role].resetTransient();
        chars[role].snapPose(basePose(role, posture), role === 'male' ? -0.32 : 0.32);
        chars[role].setBreath(16, true, true);
      }
      let sampled = 0;
      for (let frame = 0; frame <= 120; frame++) {
        time += 1 / 60;
        tweens.update(1 / 60);
        let end = 0;
        for (const role of ROLES) {
          chars[role].update(1 / 60, time);
          chars[role].root.updateMatrixWorld(true);
          end = chars[role].writeSegments(segments, end);
        }
        if (frame % 30 !== 0) continue;
        blanket.rebuild(segments, end / SEGMENT_STRIDE);
        blanket.mesh.updateMatrixWorld(true);
        for (let vertex = 0; vertex < positions.count; vertex++) {
          point.fromBufferAttribute(positions, vertex).applyMatrix4(cloth!.matrixWorld);
          origin.set(point.x, 1.5, point.z);
          ray.set(origin, down);
          const hit = ray.intersectObject(blanket.mesh, false)[0];
          // Neckline / straps beyond the blanket's head edge intentionally stay exposed.
          if (!hit) continue;
          sampled++;
          expect(point.y - hit.point.y, `${posture}: cloth above blanket at ${point.toArray().join(', ')}`).toBeLessThanOrEqual(0.005);
        }
      }
      expect(sampled).toBeGreaterThan(0);
    }
  });

  it('disposes model resources while keeping the shared kit alive for the other character', () => {
    const { kit, chars } = models();
    const kitResources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
    for (const value of Object.values(kit)) {
      if (value instanceof THREE.BufferGeometry || value instanceof THREE.Material || value instanceof THREE.Texture) kitResources.add(value);
      else if (value && typeof value === 'object') for (const resource of Object.values(value)) {
        if (resource instanceof THREE.BufferGeometry || resource instanceof THREE.Material || resource instanceof THREE.Texture) kitResources.add(resource);
      }
    }
    const resources = (character: Character) => {
      const found = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
      character.root.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        found.add(mesh.geometry);
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          found.add(material);
          for (const value of Object.values(material)) if (value instanceof THREE.Texture) found.add(value);
        }
      });
      return found;
    };
    const maleResources = resources(chars.male);
    const femaleResources = resources(chars.female);
    const disposed = new Set<object>();
    for (const resource of new Set([...kitResources, ...maleResources, ...femaleResources])) resource.addEventListener('dispose', () => disposed.add(resource));
    const maleOwned = [...maleResources].filter((resource) => !kitResources.has(resource));
    const femaleOwned = [...femaleResources].filter((resource) => !kitResources.has(resource));
    expect(maleOwned.length).toBeGreaterThan(0);
    expect(femaleOwned.length).toBeGreaterThan(0);
    chars.male.dispose();
    for (const resource of maleOwned) expect(disposed.has(resource)).toBe(true);
    for (const resource of new Set([...kitResources, ...femaleOwned])) expect(disposed.has(resource)).toBe(false);
    chars.female.snapPose(basePose('female', 'sideFacing'), 0.32);
    chars.female.update(1 / 60, 1);
    chars.female.root.updateMatrixWorld(true);
    finiteModel(chars.female);
    chars.female.dispose();
    for (const resource of femaleOwned) expect(disposed.has(resource)).toBe(true);
    kit.dispose();
    for (const resource of kitResources) expect(disposed.has(resource)).toBe(true);
    // This test performed disposal explicitly, so the generic fixture must not repeat it.
    cleanup.pop();
  });
});
