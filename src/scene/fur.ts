// 毛絨玩具的毛(殼層毛 shell fur,DESIGN §14.9):把剛體零件的幾何複製成好幾層、沿法線往外推,
// 每層用雜訊決定哪裡有毛(越外層越稀疏,尖端變亮、根部變暗),全部層合成一個幾何、一次畫完。
// 臉的範圍可以挖掉(臉是光滑的搪膠臉)。材質共用同一個 shader(customProgramCacheKey)。
// 每幀變形的幾何(橡皮管手臂)不複製:用 InstancedMesh,每個實例是一層,在 vertex shader 裡沿法線推出去。
import * as THREE from 'three';

/** 每個像素一根毛的「長度」(0..1);不做 mipmap,遠看時邊緣仍是毛茸茸的顆粒而不是一圈實心殼 */
export function furNoiseTexture(): THREE.DataTexture {
  const S = 64;
  const data = new Uint8Array(S * S * 4);
  let seed = 918273;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < S * S; i++) {
    const v = Math.floor(Math.pow(rnd(), 0.7) * 255);
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export interface ShellOptions {
  /** 層數(不含本體那層) */
  layers: number;
  /** 毛長(幾何的局部單位) */
  length: number;
  /** 雜訊貼圖在這個零件上重複幾次(越大毛越細) */
  uvScale: readonly [number, number];
  /** 不長毛的方向(臉):法線和 dir 夾角 < angle 沒有毛,再往外 soft 弧度內漸漸長出來 */
  bare?: { dir: THREE.Vector3; angle: number; soft: number };
}

/**
 * 把 base 做成 layers 層殼:第 k 層推到毛長的 (k+1)/K;attribute shellK = 這層的門檻 (k+1)/(K+1)
 * (雜訊最大 254/255,門檻若是 1 最外層會整層被丟掉)、furMask = 這裡能不能長毛。
 */
export function shellGeometry(base: THREE.BufferGeometry, o: ShellOptions): THREE.BufferGeometry {
  const pos = base.getAttribute('position');
  const nor = base.getAttribute('normal');
  const uv = base.getAttribute('uv');
  const n = pos.count;
  const K = o.layers;
  const P = new Float32Array(n * 3 * K);
  const N = new Float32Array(n * 3 * K);
  const U = new Float32Array(n * 2 * K);
  const S = new Float32Array(n * K);
  const M = new Float32Array(n * K);
  const v = new THREE.Vector3();
  for (let k = 0; k < K; k++) {
    const off = (o.length * (k + 1)) / K;
    const h = (k + 1) / (K + 1);
    for (let i = 0; i < n; i++) {
      const j = k * n + i;
      v.fromBufferAttribute(nor, i).normalize();
      P[j * 3] = pos.getX(i) + v.x * off;
      P[j * 3 + 1] = pos.getY(i) + v.y * off;
      P[j * 3 + 2] = pos.getZ(i) + v.z * off;
      N[j * 3] = v.x;
      N[j * 3 + 1] = v.y;
      N[j * 3 + 2] = v.z;
      U[j * 2] = uv.getX(i) * o.uvScale[0];
      U[j * 2 + 1] = uv.getY(i) * o.uvScale[1];
      S[j] = h;
      M[j] = o.bare ? THREE.MathUtils.smoothstep(v.angleTo(o.bare.dir), o.bare.angle, o.bare.angle + o.bare.soft) : 1;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  g.setAttribute('shellK', new THREE.BufferAttribute(S, 1));
  g.setAttribute('furMask', new THREE.BufferAttribute(M, 1));
  if (base.index) {
    const idx = base.index.array;
    const I = n * K > 65535 ? new Uint32Array(idx.length * K) : new Uint16Array(idx.length * K);
    for (let k = 0; k < K; k++) for (let i = 0; i < idx.length; i++) I[k * idx.length + i] = idx[i] + k * n;
    g.setIndex(new THREE.BufferAttribute(I, 1));
  }
  g.computeBoundingSphere();
  return g;
}

/** 動態幾何的毛(InstancedMesh 的實例數 = layers) */
export interface InstancedFur {
  layers: number;
  length: number;
  uvScale: readonly [number, number];
}

const glslFloat = (x: number) => (Number.isInteger(x) ? x.toFixed(1) : String(x));

/**
 * 毛的材質:雜訊(alphaMap)低於該層高度的像素丟掉 → 越外層毛越稀;根部暗、尖端亮(自遮蔽)。
 * 不透明(不排序、會寫深度)。一般的殼層幾何共用一個 shader,只差顏色;
 * 給了 instanced 就改成「實例 = 層」的版本(配 InstancedMesh,幾何照常每幀改寫)。
 */
export function furShellMaterial(color: THREE.ColorRepresentation, noise: THREE.Texture, instanced?: InstancedFur): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0, alphaMap: noise });
  const varyings = 'varying float vShellK;\nvarying float vFurMask;';
  m.onBeforeCompile = (shader) => {
    if (instanced) {
      const [u, v] = instanced.uvScale;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\n${varyings}`)
        .replace('#include <uv_vertex>', `#include <uv_vertex>\nvAlphaMapUv *= vec2(${glslFloat(u)}, ${glslFloat(v)});`)
        .replace(
          '#include <begin_vertex>',
          // 同 shellGeometry:第 k 層推到 (k+1)/K 的毛長,門檻 (k+1)/(K+1)
          `#include <begin_vertex>\nfloat furLayer = float(gl_InstanceID + 1);\nvShellK = furLayer / ${glslFloat(instanced.layers + 1)};\nvFurMask = 1.0;\ntransformed += normalize(objectNormal) * (furLayer * ${glslFloat(instanced.length)} / ${glslFloat(instanced.layers)});`,
        );
    } else {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>\nattribute float shellK;\nattribute float furMask;\n${varyings}`)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvShellK = shellK;\nvFurMask = furMask;');
    }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${varyings}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= 0.62 + 0.45 * vShellK;')
      .replace('#include <alphatest_fragment>', 'if (diffuseColor.a * vFurMask < vShellK) discard;\ndiffuseColor.a = 1.0;');
  };
  const key = instanced ? `fur-shell-i:${instanced.layers}:${instanced.length}:${instanced.uvScale.join(',')}` : 'fur-shell';
  m.customProgramCacheKey = () => key;
  return m;
}
