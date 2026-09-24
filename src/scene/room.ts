// 房間與燈光(SCENE-RIG §1):地板、地毯、三面牆、+x 牆上的窗(月光)、床頭櫃 + 檯燈 + 鬧鐘。
// 夜晚配色:深靛藍牆、暖橘檯燈、冷藍月光。所有貼圖都是 CanvasTexture 畫的。
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const LAMP_COLOR = new THREE.Color(0xffb070);
export const MOON_COLOR = new THREE.Color(0x8fb4ff);
export const BG_COLOR = 0x0b0a14;

/** 物理光照單位(three r155+);規格值是舊版強度,這裡依畫面調過 */
export const LIGHT = {
  hemi: 2.4,
  lamp: 5.5,
  moon: 1.25,
  /** 床尾方向的柔和補光(檯燈與月光都在床頭那側,朝相機的斜面會太黑) */
  fill: 0.55,
} as const;

export interface Room {
  group: THREE.Group;
  hemi: THREE.HemisphereLight;
  lamp: THREE.PointLight;
  moon: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
  lampShade: THREE.MeshStandardMaterial;
  glow: THREE.Sprite;
  /** 日出窗景(opacity 0..1 疊在夜景上) */
  dawn: THREE.MeshBasicMaterial;
  beam: THREE.MeshBasicMaterial;
  clock: THREE.Group;
  clockBaseX: number;
  setClock(turn: number): void;
  dispose(): void;
}

export function buildRoom(): Room {
  const group = new THREE.Group();
  group.name = 'room';
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];
  const g = <T extends THREE.BufferGeometry>(x: T): T => (geos.push(x), x);
  const m = <T extends THREE.Material>(x: T): T => (mats.push(x), x);
  const t = <T extends THREE.Texture>(x: T): T => (texs.push(x), x);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = group) => {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  };
  const std = (color: number, roughness = 0.9, extra: THREE.MeshStandardMaterialParameters = {}) =>
    m(new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, ...extra }));

  // ── 地板、地毯 ──
  const floorTex = t(canvasTex(512, 512, drawPlanks));
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(2, 2);
  const floor = add(g(new THREE.PlaneGeometry(8, 8)), std(0xffffff, 0.85, { map: floorTex }), 0, 0, 0.5);
  floor.rotation.x = -Math.PI / 2;
  const rugTex = t(canvasTex(256, 256, drawRug));
  const rug = add(g(new THREE.CircleGeometry(1.25, 48)), std(0xffffff, 1, { map: rugTex }), 0, 0.004, 1.75);
  rug.rotation.x = -Math.PI / 2;
  rug.scale.set(1.35, 1, 1);

  // ── 牆 ──
  const wallMat = std(0x2d2b4f, 1);
  const back = add(g(new THREE.PlaneGeometry(8, 3.6)), wallMat, 0, 1.8, -1.45);
  back.name = 'wallBack';
  const sideGeo = g(new THREE.PlaneGeometry(6, 3.6));
  const left = add(sideGeo, wallMat, -2.7, 1.8, 1.55);
  left.rotation.y = Math.PI / 2;
  const right = add(sideGeo, wallMat, 2.7, 1.8, 1.55);
  right.rotation.y = -Math.PI / 2;
  const trimMat = std(0x1d1b33, 0.8);
  add(g(new THREE.BoxGeometry(8, 0.12, 0.03)), trimMat, 0, 0.06, -1.435);
  const sideTrim = g(new THREE.BoxGeometry(0.03, 0.12, 6));
  add(sideTrim, trimMat, -2.685, 0.06, 1.55);
  add(sideTrim, trimMat, 2.685, 0.06, 1.55);

  // 床頭上方的小畫框(月亮與山)
  const picTex = t(canvasTex(256, 160, drawPicture));
  add(g(new RoundedBoxGeometry(0.78, 0.52, 0.04, 2, 0.015)), std(0xcdb89a, 0.6), 0, 1.95, -1.43);
  add(g(new THREE.PlaneGeometry(0.66, 0.4)), m(new THREE.MeshStandardMaterial({ map: picTex, roughness: 0.8 })), 0, 1.95, -1.405);

  // ── 窗(+x 牆)──
  const win = new THREE.Group();
  win.position.set(2.69, 1.55, -0.35);
  win.rotation.y = -Math.PI / 2; // 局部 +z 朝 −x(朝房間)
  group.add(win);
  const nightTex = t(canvasTex(256, 224, drawNightSky));
  const dawnTex = t(canvasTex(256, 224, drawDawnSky));
  const paneGeo = g(new THREE.PlaneGeometry(1.3, 1.14));
  add(paneGeo, m(new THREE.MeshBasicMaterial({ map: nightTex, fog: false })), 0, 0, 0, win);
  const dawn = m(new THREE.MeshBasicMaterial({ map: dawnTex, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  add(paneGeo, dawn, 0, 0, 0.002, win);
  const frameMat = std(0xd8cde6, 0.6);
  const barH = g(new THREE.BoxGeometry(1.42, 0.07, 0.06));
  const barV = g(new THREE.BoxGeometry(0.07, 1.26, 0.06));
  add(barH, frameMat, 0, 0.6, 0.02, win);
  add(barH, frameMat, 0, -0.6, 0.02, win);
  add(barH, frameMat, 0, 0, 0.02, win).scale.set(1, 0.6, 0.7);
  add(barV, frameMat, 0.68, 0, 0.02, win);
  add(barV, frameMat, -0.68, 0, 0.02, win);
  add(barV, frameMat, 0, 0, 0.02, win).scale.set(0.6, 1, 0.7);
  add(g(new THREE.BoxGeometry(1.55, 0.05, 0.16)), frameMat, 0, -0.66, 0.07, win);
  // 窗簾(靜態皺褶)
  const curtainGeo = g(curtainGeometry(0.42, 1.75));
  const curtainMat = std(0x4b3f78, 0.95, { side: THREE.DoubleSide });
  add(curtainGeo, curtainMat, -0.9, -0.05, 0.1, win);
  add(curtainGeo, curtainMat, 0.9, -0.05, 0.1, win);
  // 月光光柱(加法混色的平行四邊形,從窗戶斜射到床上)
  const beamTex = t(canvasTex(64, 256, drawBeam));
  const beam = m(
    new THREE.MeshBasicMaterial({
      map: beamTex,
      color: MOON_COLOR,
      transparent: true,
      opacity: 0.16,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    }),
  );
  const beamMesh = new THREE.Mesh(g(beamGeometry()), beam);
  beamMesh.renderOrder = 5;
  group.add(beamMesh);

  // ── 床頭櫃 + 檯燈 + 鬧鐘 ──
  const wood = std(0x6b4a3d, 0.7);
  add(g(new RoundedBoxGeometry(0.5, 0.5, 0.5, 3, 0.03)), wood, -1.65, 0.25, -0.9);
  add(g(new RoundedBoxGeometry(0.42, 0.16, 0.02, 2, 0.008)), std(0x7d5a4a, 0.7), -1.65, 0.33, -0.645);
  add(g(new THREE.SphereGeometry(0.022, 10, 8)), std(0xe0c080, 0.4, { metalness: 0.4 }), -1.65, 0.33, -0.63);
  const lampX = -1.72;
  const lampZ = -1.0;
  add(g(new THREE.CylinderGeometry(0.07, 0.09, 0.03, 20)), std(0xd9c6a5, 0.5), lampX, 0.515, lampZ);
  add(g(new THREE.CylinderGeometry(0.018, 0.018, 0.28, 10)), std(0xd9c6a5, 0.5), lampX, 0.66, lampZ);
  add(g(new THREE.SphereGeometry(0.045, 14, 10)), m(new THREE.MeshBasicMaterial({ color: 0xfff1c9 })), lampX, 0.79, lampZ);
  const lampShade = std(0xffe2bd, 0.8, { emissive: LAMP_COLOR.clone(), emissiveIntensity: 0.9, side: THREE.DoubleSide });
  const shade = add(g(new THREE.CylinderGeometry(0.1, 0.17, 0.2, 24, 1, true)), lampShade, lampX, 0.84, lampZ);
  shade.name = 'lampShade';
  const glowTex = t(canvasTex(128, 128, drawGlow));
  const glowMat = m(
    new THREE.SpriteMaterial({
      map: glowTex,
      color: LAMP_COLOR.clone(),
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  const glow = new THREE.Sprite(glowMat);
  glow.position.set(lampX, 0.84, lampZ + 0.05);
  glow.scale.set(1.5, 1.5, 1);
  group.add(glow);

  const clock = new THREE.Group();
  const clockBaseX = -1.5;
  clock.position.set(clockBaseX, 0.5, -0.78);
  clock.rotation.y = 0.5;
  group.add(clock);
  add(g(new RoundedBoxGeometry(0.2, 0.13, 0.09, 2, 0.025)), std(0xc4524f, 0.5), 0, 0.065, 0, clock);
  const bellGeo = g(new THREE.SphereGeometry(0.035, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2));
  const bellMat = std(0xe8c26a, 0.35, { metalness: 0.5 });
  add(bellGeo, bellMat, -0.065, 0.125, 0, clock);
  add(bellGeo, bellMat, 0.065, 0.125, 0, clock);
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 128;
  faceCanvas.height = 64;
  const faceTex = t(new THREE.CanvasTexture(faceCanvas));
  faceTex.colorSpace = THREE.SRGBColorSpace;
  add(g(new THREE.PlaneGeometry(0.155, 0.078)), m(new THREE.MeshBasicMaterial({ map: faceTex, fog: false })), 0, 0.065, 0.047, clock);
  let shownTurn = -1;
  const setClock = (turn: number) => {
    if (turn === shownTurn) return;
    shownTurn = turn;
    const c = faceCanvas.getContext('2d')!;
    c.fillStyle = '#10141c';
    c.fillRect(0, 0, 128, 64);
    const total = (22 * 60 + turn * 40) % (24 * 60);
    const label = `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    c.fillStyle = '#7dffb4';
    c.font = 'bold 40px monospace';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.shadowColor = '#3dff8a';
    c.shadowBlur = 8;
    c.fillText(label, 64, 34);
    faceTex.needsUpdate = true;
  };
  setClock(0);

  // ── 燈光 ──
  const hemi = new THREE.HemisphereLight(0x2a2f55, 0x0e0a14, LIGHT.hemi);
  group.add(hemi);
  const lamp = new THREE.PointLight(LAMP_COLOR.clone(), LIGHT.lamp, 4, 2);
  lamp.position.set(lampX, 0.98, lampZ + 0.05);
  group.add(lamp);
  const moon = new THREE.DirectionalLight(MOON_COLOR.clone(), LIGHT.moon);
  moon.position.set(3.4, 2.7, -0.3);
  moon.target.position.set(0, 0.5, 0.2);
  group.add(moon, moon.target);
  const fill = new THREE.DirectionalLight(0x9aa2d8, LIGHT.fill);
  fill.position.set(-0.8, 3.2, 4.5);
  fill.target.position.set(0, 0.6, 0);
  group.add(fill, fill.target);

  return {
    group,
    hemi,
    lamp,
    moon,
    fill,
    lampShade,
    glow,
    dawn,
    beam,
    clock,
    clockBaseX,
    setClock,
    dispose() {
      for (const x of geos) x.dispose();
      for (const x of mats) x.dispose();
      for (const x of texs) x.dispose();
    },
  };
}

// ───────────── 幾何 ─────────────

/** 垂直掛著、有正弦皺褶的布 */
function curtainGeometry(w: number, h: number): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(w, h, 16, 1);
  const p = geo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    p.setZ(i, 0.035 * Math.sin((x / w) * Math.PI * 6));
  }
  geo.computeVertexNormals();
  return geo;
}

/** 月光光柱:窗戶的垂直截面沿光線方向延伸到床/地板 */
function beamGeometry(): THREE.BufferGeometry {
  const dir = new THREE.Vector3(-1, -0.62, 0.18).normalize();
  const len = 2.9;
  const z = -0.35;
  const top = new THREE.Vector3(2.66, 2.05, z);
  const bot = new THREE.Vector3(2.66, 1.05, z);
  const top2 = top.clone().addScaledVector(dir, len);
  const bot2 = bot.clone().addScaledVector(dir, len);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([top.x, top.y, top.z, bot.x, bot.y, bot.z, top2.x, top2.y, top2.z, bot2.x, bot2.y, bot2.z], 3),
  );
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0, 0, 1, 0], 2));
  geo.setIndex([0, 1, 2, 1, 3, 2]);
  return geo;
}

// ───────────── CanvasTexture 畫法 ─────────────

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function drawPlanks(g: CanvasRenderingContext2D, w: number, h: number): void {
  const n = 8;
  const pw = w / n;
  const tones = ['#3a2a2c', '#35262a', '#3f2e2e', '#33242a', '#3c2b2d'];
  for (let i = 0; i < n; i++) {
    g.fillStyle = tones[(i * 3) % tones.length];
    g.fillRect(i * pw, 0, pw, h);
    // 錯開的接縫
    const seam = ((i * 197) % 5) * (h / 5) + h * 0.1;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(i * pw, seam, pw, 2);
    g.fillRect(i * pw, 0, 2, h);
    // 木紋
    g.strokeStyle = 'rgba(255,220,200,0.035)';
    g.lineWidth = 1;
    for (let k = 0; k < 5; k++) {
      g.beginPath();
      const x = i * pw + 8 + k * (pw / 5);
      g.moveTo(x, 0);
      g.bezierCurveTo(x + 6, h * 0.3, x - 6, h * 0.6, x + 3, h);
      g.stroke();
    }
  }
}

function drawRug(g: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w / 2;
  const cy = h / 2;
  const rings = ['#5d4a7c', '#6e5a90', '#5d4a7c', '#7b67a0', '#5d4a7c', '#8e7bb3'];
  for (let i = 0; i < rings.length; i++) {
    g.fillStyle = rings[i];
    g.beginPath();
    g.arc(cx, cy, (w / 2) * (1 - i / rings.length), 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = 'rgba(255,240,255,0.25)';
  g.setLineDash([4, 6]);
  g.lineWidth = 2;
  g.beginPath();
  g.arc(cx, cy, w / 2 - 8, 0, Math.PI * 2);
  g.stroke();
  void h;
}

function drawPicture(g: CanvasRenderingContext2D, w: number, h: number): void {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#2b3a6b');
  sky.addColorStop(1, '#7a6aa8');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff4c4';
  g.beginPath();
  g.arc(w * 0.72, h * 0.3, 18, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3d3566';
  g.beginPath();
  g.moveTo(0, h);
  g.lineTo(w * 0.3, h * 0.45);
  g.lineTo(w * 0.55, h * 0.8);
  g.lineTo(w * 0.75, h * 0.55);
  g.lineTo(w, h);
  g.fill();
}

function drawNightSky(g: CanvasRenderingContext2D, w: number, h: number): void {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#16204a');
  sky.addColorStop(1, '#34427a');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  // 星星(固定種子)
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#ffffff';
  for (let i = 0; i < 40; i++) {
    const r = rnd() * 1.4 + 0.4;
    g.globalAlpha = 0.4 + rnd() * 0.6;
    g.beginPath();
    g.arc(rnd() * w, rnd() * h * 0.8, r, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  // 月亮 + 光暈
  const mx = w * 0.3;
  const my = h * 0.3;
  const halo = g.createRadialGradient(mx, my, 10, mx, my, 70);
  halo.addColorStop(0, 'rgba(220,235,255,0.55)');
  halo.addColorStop(1, 'rgba(220,235,255,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#f6f3dc';
  g.beginPath();
  g.arc(mx, my, 22, 0, Math.PI * 2);
  g.fill();
  // 遠方屋頂剪影
  g.fillStyle = '#0f1430';
  g.beginPath();
  g.moveTo(0, h);
  for (let x = 0; x <= w; x += 32) g.lineTo(x, h * (0.78 + 0.08 * Math.sin(x * 0.07) + (x % 64 === 0 ? -0.05 : 0)));
  g.lineTo(w, h);
  g.fill();
}

function drawDawnSky(g: CanvasRenderingContext2D, w: number, h: number): void {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#7fa6d9');
  sky.addColorStop(0.55, '#f2b48a');
  sky.addColorStop(1, '#ffd49a');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  const sx = w * 0.62;
  const sy = h * 0.72;
  const halo = g.createRadialGradient(sx, sy, 8, sx, sy, 90);
  halo.addColorStop(0, 'rgba(255,240,200,0.9)');
  halo.addColorStop(1, 'rgba(255,200,150,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, w, h);
  g.fillStyle = '#fff3d0';
  g.beginPath();
  g.arc(sx, sy, 20, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#6c5a7a';
  g.beginPath();
  g.moveTo(0, h);
  for (let x = 0; x <= w; x += 32) g.lineTo(x, h * (0.78 + 0.08 * Math.sin(x * 0.07) + (x % 64 === 0 ? -0.05 : 0)));
  g.lineTo(w, h);
  g.fill();
}

function drawBeam(g: CanvasRenderingContext2D, w: number, h: number): void {
  // v = 1(窗)→ 0(遠端):亮 → 淡出;左右邊緣柔化
  const lin = g.createLinearGradient(0, 0, 0, h);
  lin.addColorStop(0, 'rgba(255,255,255,1)');
  lin.addColorStop(0.6, 'rgba(255,255,255,0.35)');
  lin.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = lin;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-in';
  const side = g.createLinearGradient(0, 0, w, 0);
  side.addColorStop(0, 'rgba(0,0,0,0)');
  side.addColorStop(0.25, 'rgba(0,0,0,1)');
  side.addColorStop(0.75, 'rgba(0,0,0,1)');
  side.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = side;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'source-over';
}

export function drawGlow(g: CanvasRenderingContext2D, w: number, h: number): void {
  const r = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,255,0.9)');
  r.addColorStop(0.25, 'rgba(255,255,255,0.35)');
  r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, w, h);
}
