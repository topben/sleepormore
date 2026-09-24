// 毛絨玩具的殼層毛:幾何(層數、沿法線推出去、臉挖掉)與 shader 注入
// (注入靠 three 的 chunk 名稱;three 改名時 replace 會默默失效 → 毛不見,這裡先抓)
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { furShellMaterial, shellGeometry } from '../src/scene/fur';

const base = new THREE.SphereGeometry(1, 8, 6);
const n = base.getAttribute('position').count;

describe('shellGeometry', () => {
  it('stacks one copy per layer, pushed out along the normals (outermost = full length)', () => {
    const g = shellGeometry(base, { layers: 4, length: 0.2, uvScale: [2, 3] });
    const pos = g.getAttribute('position');
    const k = g.getAttribute('shellK');
    expect(pos.count).toBe(n * 4);
    expect(g.index!.count).toBe(base.index!.count * 4);
    const p = new THREE.Vector3();
    for (let layer = 0; layer < 4; layer++) {
      const i = layer * n + 5;
      expect(k.getX(i)).toBeCloseTo((layer + 1) / 4);
      // 單位球:沿法線推 = 半徑變大
      expect(p.fromBufferAttribute(pos, i).length()).toBeCloseTo(1 + (0.2 * (layer + 1)) / 4);
    }
  });

  it('each layer indexes its own vertices, with the uv scaled', () => {
    const g = shellGeometry(base, { layers: 3, length: 0.1, uvScale: [2, 3] });
    const m = base.index!.count;
    for (let layer = 0; layer < 3; layer++) expect(g.index!.getX(layer * m + 7)).toBe(base.index!.getX(7) + layer * n);
    const uv = g.getAttribute('uv');
    const bu = base.getAttribute('uv');
    expect(uv.getX(n + 7)).toBeCloseTo(bu.getX(7) * 2);
    expect(uv.getY(n + 7)).toBeCloseTo(bu.getY(7) * 3);
  });

  it('bare: no fur within the angle, full fur beyond angle + soft', () => {
    const dir = new THREE.Vector3(0, 0, 1);
    const g = shellGeometry(base, { layers: 2, length: 0.1, uvScale: [1, 1], bare: { dir, angle: 0.5, soft: 0.3 } });
    const nor = g.getAttribute('normal');
    const mask = g.getAttribute('furMask');
    const v = new THREE.Vector3();
    let bare = 0;
    let full = 0;
    for (let i = 0; i < nor.count; i++) {
      const a = v.fromBufferAttribute(nor, i).angleTo(dir);
      if (a < 0.5) {
        expect(mask.getX(i)).toBe(0);
        bare++;
      } else if (a > 0.8) {
        expect(mask.getX(i)).toBe(1);
        full++;
      }
    }
    expect(bare).toBeGreaterThan(0);
    expect(full).toBeGreaterThan(0);
  });

  it('without bare, fur grows everywhere', () => {
    const mask = shellGeometry(base, { layers: 2, length: 0.1, uvScale: [1, 1] }).getAttribute('furMask');
    for (let i = 0; i < mask.count; i++) expect(mask.getX(i)).toBe(1);
  });
});

describe('furShellMaterial', () => {
  /** 跑 onBeforeCompile,拿注入後的 shader 原始碼 */
  const compiled = (m: THREE.Material) => {
    const shader = { vertexShader: THREE.ShaderLib.standard.vertexShader, fragmentShader: THREE.ShaderLib.standard.fragmentShader, uniforms: {} };
    m.onBeforeCompile(shader as never, undefined as never);
    return shader;
  };
  const noise = new THREE.Texture();

  it('shell geometry version: reads the per-vertex layer / mask and discards thin fur', () => {
    const { vertexShader: vs, fragmentShader: fs } = compiled(furShellMaterial(0xffffff, noise));
    expect(vs).toContain('attribute float shellK;');
    expect(vs).toContain('vShellK = shellK;');
    expect(vs).toContain('vFurMask = furMask;');
    expect(fs).toContain('varying float vShellK;');
    expect(fs).toContain('diffuseColor.rgb *= 0.62 + 0.45 * vShellK;');
    expect(fs).toContain('if (diffuseColor.a * vFurMask < vShellK) discard;');
    expect(fs).not.toContain('#include <alphatest_fragment>');
  });

  it('instanced version: the instance is the layer, pushed out in the vertex shader', () => {
    const { vertexShader: vs, fragmentShader: fs } = compiled(furShellMaterial(0xffffff, noise, { layers: 5, length: 0.011, uvScale: [3, 4] }));
    expect(vs).not.toContain('attribute float shellK;');
    expect(vs).toContain('vShellK = float(gl_InstanceID + 1) / 5.0;');
    expect(vs).toContain('transformed += normalize(objectNormal) * (vShellK * 0.011);');
    expect(vs).toContain('vAlphaMapUv *= vec2(3.0, 4.0);');
    expect(fs).toContain('if (diffuseColor.a * vFurMask < vShellK) discard;');
  });

  it('plain shells share one program; instanced ones get their own', () => {
    const key = (m: THREE.Material) => m.customProgramCacheKey();
    const inst = { layers: 5, length: 0.011, uvScale: [3, 3] } as const;
    expect(key(furShellMaterial(0xff0000, noise))).toBe(key(furShellMaterial(0x00ff00, noise)));
    expect(key(furShellMaterial(0xff0000, noise, inst))).not.toBe(key(furShellMaterial(0xff0000, noise)));
    expect(key(furShellMaterial(0xff0000, noise, inst))).toBe(key(furShellMaterial(0x0000ff, noise, inst)));
  });
});
