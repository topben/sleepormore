import * as THREE from 'three';

/** Four discrete light bands keep faces and hair legible in the moonlit room. */
export function toonRamp(): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array([88, 88, 88, 255, 156, 156, 156, 255, 218, 218, 218, 255, 255, 255, 255, 255]), 4, 1, THREE.RGBAFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/** Shallow, oblique silk ripples; a shared small normal texture adds detail without vertices. */
export function satinNormalTexture(): THREE.DataTexture {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  const height = (u: number, v: number) => Math.sin((u * 7 + v * 3) * Math.PI * 2) * 0.3 + Math.sin((u * 15 - v * 5) * Math.PI * 2) * 0.08;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size;
    const v = y / size;
    const normal = new THREE.Vector3(-(height(u + 1 / size, v) - height(u - 1 / size, v)) * 2, -(height(u, v + 1 / size) - height(u, v - 1 / size)) * 2, 1).normalize();
    const i = (y * size + x) * 4;
    data[i] = Math.round((normal.x * 0.5 + 0.5) * 255);
    data[i + 1] = Math.round((normal.y * 0.5 + 0.5) * 255);
    data[i + 2] = Math.round((normal.z * 0.5 + 0.5) * 255);
    data[i + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** A tapered jaw, softly flattened cheeks and a small chin instead of a toy sphere. */
export function humanHeadGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.15, 40, 28);
  const pos = geo.getAttribute('position');
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const lower = THREE.MathUtils.smoothstep(-y, 0.025, 0.15);
    const x = pos.getX(i) * (1 - 0.31 * lower);
    let z = pos.getZ(i);
    if (z > 0) z *= 0.94 + 0.025 * lower;
    pos.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** The hairline is high at the front and continues around the back of the head. */
export function hairCapGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.156, 40, 28);
  const pos = geo.getAttribute('position');
  const index = geo.getIndex()!;
  const keep: number[] = [];
  for (let i = 0; i < index.count; i += 3) {
    const ids = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    const y = ids.reduce((n, id) => n + pos.getY(id), 0) / 3;
    const z = ids.reduce((n, id) => n + pos.getZ(id), 0) / 3;
    const x = ids.reduce((n, id) => n + pos.getX(id), 0) / 3;
    if (z < 0.012 || y > 0.068 || Math.abs(x) > 0.13 && y > -0.063) keep.push(...ids);
  }
  geo.setIndex(keep);
  geo.computeVertexNormals();
  return geo;
}

/** Sculpted, pointed hair locks: a curved elliptical section, not round noodles. */
export function hairLock(points: readonly (readonly [number, number, number])[], width: number, depth = 0.012): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const positions: number[] = [];
  const uv: number[] = [];
  const indices: number[] = [];
  const rows = 16;
  const sides = 8;
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    const p = curve.getPoint(t);
    const tangent = curve.getTangent(t);
    const across = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
    if (across.lengthSq() < 0.1) across.set(1, 0, 0);
    const taper = Math.pow(1 - t, 0.62) * (0.72 + Math.sin(t * Math.PI) * 0.65) + 0.005;
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * Math.PI * 2;
      positions.push(p.x + across.x * Math.cos(a) * width * taper, p.y + across.y * Math.cos(a) * width * taper, p.z + Math.sin(a) * depth * taper);
      uv.push(j / sides, t);
      if (i < rows && j < sides) {
        const k = i * (sides + 1) + j;
        indices.push(k, k + 1, k + sides + 1, k + 1, k + sides + 2, k + sides + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export type ProfileRing = readonly [y: number, xRadius: number, zRadius: number];

/** A tailored torso / skirt with a narrow waist and flared hem. */
export function profileGeometry(rings: readonly ProfileRing[], scallopedTop = false): THREE.BufferGeometry {
  const positions: number[] = [];
  const uv: number[] = [];
  const indices: number[] = [];
  const sides = 40;
  const ascending = rings[rings.length - 1][0] > rings[0][0];
  for (let i = 0; i < rings.length; i++) {
    const [y, rx, rz] = rings[i];
    for (let j = 0; j <= sides; j++) {
      const a = j / sides * Math.PI * 2;
      const top = scallopedTop && i === rings.length - 1 ? -0.048 * Math.pow(Math.max(0, Math.cos(a)), 5) : 0;
      const fold = i < 4 ? Math.cos(a * 10) * 0.004 * (1 - i / 4) : 0;
      positions.push(Math.sin(a) * (rx + fold), y + top, Math.cos(a) * (rz + fold) + 0.008);
      uv.push(j / sides, i / (rings.length - 1));
      if (i < rings.length - 1 && j < sides) {
        const k = i * (sides + 1) + j;
        if (ascending) indices.push(k, k + 1, k + sides + 1, k + 1, k + sides + 2, k + sides + 1);
        else indices.push(k, k + sides + 1, k + 1, k + 1, k + sides + 1, k + sides + 2);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** Flat features sit above the head surface; their outline remains clear in profile. */
export function almondGeometry(): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  shape.moveTo(-0.029, 0.002);
  shape.bezierCurveTo(-0.014, 0.024, 0.016, 0.023, 0.032, 0.005);
  shape.bezierCurveTo(0.017, -0.016, -0.016, -0.016, -0.029, 0.002);
  return new THREE.ShapeGeometry(shape, 18);
}

export function crescentGeometry(radius = 0.023): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, Math.PI * 0.2, Math.PI * 1.8, false);
  shape.quadraticCurveTo(-radius * 0.52, 0, Math.cos(Math.PI * 0.2) * radius, Math.sin(Math.PI * 0.2) * radius);
  return new THREE.ExtrudeGeometry(shape, { depth: 0.003, bevelEnabled: true, bevelSize: 0.001, bevelThickness: 0.001, bevelSegments: 1, steps: 1, curveSegments: 18 });
}

export function patchGeometry(points: readonly (readonly [number, number])[]): THREE.ShapeGeometry {
  const shape = new THREE.Shape();
  points.forEach(([x, y], i) => i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y));
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}
