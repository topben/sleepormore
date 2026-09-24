// BedroomScene:three.js 臥室場景(SCENE-RIG.md)。main.ts 只透過這個類別的公開方法操作場景。
import * as THREE from 'three';
import { breathRate, snoreLevel, wakeThreshold } from '../game/rules';
import type { Ending, ForceBand, GameEvent, GameState, Role } from '../game/types';
import { partnerOf } from '../game/types';
import { SceneAudio } from './audio';
import { buildBed, type Bed } from './bed';
import { Blanket } from './blanket';
import { Character, CharacterKit, SEGMENT_STRIDE, SEGMENTS_PER_CHAR } from './character';
import { Effects } from './effects';
import { basePose, resolvePose, RIG, type Euler3, type Limbs } from './postures';
import { BG_COLOR, buildRoom, LAMP_COLOR, LIGHT, MOON_COLOR, type Room } from './room';
import { type Channel, type TweenOpts, Tweens } from './tween';

const ROLES: readonly Role[] = ['male', 'female'];
/** 往自己那側(床沿)的方向 */
const SIDE: Record<Role, number> = { male: -1, female: 1 };
const TAU = Math.PI * 2;
const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** 肢體動作強度 → 補間質感(SCENE-RIG §4 表) */
const BAND: Record<ForceBand, { dur: number; opts: TweenOpts }> = {
  timid: { dur: 1.1, opts: { hesitate: 0.15 } },
  gentle: { dur: 0.8, opts: {} },
  firm: { dur: 0.5, opts: { ease: 'outBack', overshoot: 1.2 } },
  rough: { dur: 0.3, opts: { ease: 'outBack', overshoot: 2.0 } },
};

// 相機:看 (0, 0.7, −0.25)。規格位置 (0, 2.5, 3.1) 仰角只有 28°,臉會被棉被鼓包擋住 → 仰角調高;距離依可視區自動算
const CAM_TARGET = new THREE.Vector3(0, 0.7, -0.25);
const CAM_ELEVATION = (40 * Math.PI) / 180;
const CAM_DIST = new THREE.Vector3(0, 2.5, 3.1).distanceTo(CAM_TARGET);
const CAM_DIR = new THREE.Vector3(0, Math.sin(CAM_ELEVATION), Math.cos(CAM_ELEVATION));
/** 取景時必須完整落在「沒被 UI 擋住的帶狀區」內的點:整張床(含床尾床架)與床頭板頂 */
const FRAME_POINTS: THREE.Vector3[] = [];
for (const x of [-1.15, 1.15]) {
  FRAME_POINTS.push(
    new THREE.Vector3(x, 0, 1.25),
    new THREE.Vector3(x, 0.55, 1.25),
    new THREE.Vector3(x, 0.55, -1.25),
    new THREE.Vector3(x, 1.25, -1.29),
  );
}

const srgb = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
const SUNRISE = srgb(1.0, 0.6, 0.35);
const PINK = srgb(1.0, 0.55, 0.7);
const GOLD = srgb(1.0, 0.8, 0.5);
const DAWN_SKY = new THREE.Color(0x8a6f8f);

// 特殊肢體姿勢
const FLAIL: Limbs = { armL: [0, 0, 2.1], armR: [0, 0, -2.1], legL: [-0.4, 0, 0.45], legR: [-0.2, 0, -0.45], head: [0.2, 0, 0] };
const SPRAWL: Limbs = { armL: [0, 0, 1.15], armR: [0, 0, -1.25], legL: [0, 0, 0.28], legR: [0, 0, -0.22], head: [0, 0.35, 0] };
const SIT: Limbs = { armL: [-0.45, 0, 0.3], armR: [-0.45, 0, -0.3], legL: [-Math.PI / 3, 0, 0.08], legR: [-Math.PI / 3, 0, -0.08], head: [-0.1, 0, 0] };

interface Timer {
  t: number;
  fn: () => void;
}

type ActionEvent = Extract<GameEvent, { type: 'action' }>;

export class BedroomScene {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
  private readonly fog = new THREE.Fog(BG_COLOR, 4, 10);
  /** 世界時間(× time.scale):角色、棉被、特效 */
  private readonly tw = new Tweens();
  /** 真實時間:慢動作倍率、相機、燈光 */
  private readonly rt = new Tweens();
  private readonly kit = new CharacterKit();
  private readonly chars: Record<Role, Character>;
  private readonly room: Room;
  private readonly bed: Bed;
  private readonly blanket = new Blanket();
  private readonly effects: Effects;
  private readonly audio = new SceneAudio();
  private readonly segs = new Float32Array(SEGMENT_STRIDE * SEGMENTS_PER_CHAR * 2);
  private readonly ro: ResizeObserver;
  private readonly mq: MediaQueryList | null;

  private state: GameState | null = null;
  private readonly fallen: Record<Role, boolean> = { male: false, female: false };
  private readonly blushT: Record<Role, number> = { male: 0, female: 0 };
  /** 結局時已經醒來的玩家不再冒 Z */
  private readonly zOff: Record<Role, boolean> = { male: false, female: false };
  private blushBase = false;
  private insets = { top: 0, bottom: 0 };
  private fitDist = CAM_DIST;
  private readonly worldTimers: Timer[] = [];
  private readonly realTimers: Timer[] = [];
  private raf = 0;
  private lastNow = -1;
  private wt = 0;
  private rtime = 0;
  private reduced = false;
  private disposed = false;
  private inEnding = false;
  private focusRole: Role = 'male';
  private bedShakeT = 0;
  private camShakeT = 0;
  private rippleT = 0;
  private rippleDur = 1;
  private rippleBoost = 1;
  private clockShakeT = 0;
  private lastBlanket = 0;
  // 畫面濾鏡(閉眼 + 結局灰階,組成一條 filter 字串)
  private eyesClosed = false;
  private gray = false;
  private shownGray = false;
  private lastFilter = '';

  private readonly chBlanketX: Channel;
  private readonly chTime: Channel;
  private readonly chYaw: Channel;
  private readonly chRoll: Channel;
  private readonly chDolly: Channel;
  private readonly chCamY: Channel;
  private readonly chFocus: Channel;
  private readonly chLampI: Channel;
  private readonly chLamp: [Channel, Channel, Channel];
  private readonly chMoonI: Channel;
  private readonly chMoon: [Channel, Channel, Channel];
  private readonly chSky: Channel;
  private readonly chDark: Channel;

  private readonly camTarget = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly tmpP = new THREE.Vector3();
  private readonly tmpC = new THREE.Color();
  private readonly hemiSky = new THREE.Color(0x2a2f55);

  constructor(container: HTMLElement) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = false;
    this.canvas = this.renderer.domElement;
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    container.appendChild(this.canvas);

    this.scene.background = new THREE.Color(BG_COLOR);
    this.scene.fog = this.fog;
    this.room = buildRoom();
    this.bed = buildBed();
    this.scene.add(this.room.group, this.bed.group, this.blanket.mesh);
    this.chars = { male: new Character('male', this.tw, this.kit), female: new Character('female', this.tw, this.kit) };
    for (const r of ROLES) this.scene.add(this.chars[r].root);
    this.effects = new Effects((r, out) => this.chars[r].headWorld(out));
    this.scene.add(this.effects.group);

    const rt = this.rt;
    this.chBlanketX = this.tw.chan('blanket.x');
    this.chTime = rt.chan('time.scale', 1);
    this.chYaw = rt.chan('cam.yaw');
    this.chRoll = rt.chan('cam.roll');
    this.chDolly = rt.chan('cam.dolly');
    this.chCamY = rt.chan('cam.y');
    this.chFocus = rt.chan('cam.focus');
    this.chLampI = rt.chan('lamp.i', 1);
    this.chLamp = [rt.chan('lamp.r', LAMP_COLOR.r), rt.chan('lamp.g', LAMP_COLOR.g), rt.chan('lamp.b', LAMP_COLOR.b)];
    this.chMoonI = rt.chan('moon.i', 1);
    this.chMoon = [rt.chan('moon.r', MOON_COLOR.r), rt.chan('moon.g', MOON_COLOR.g), rt.chan('moon.b', MOON_COLOR.b)];
    this.chSky = rt.chan('sky');
    this.chDark = rt.chan('fx.dark');

    // 預設畫面(reset 之前):兩人仰躺
    for (const r of ROLES) this.chars[r].snapPose(basePose(r, 'supine'), SIDE[r] * 0.35 * RIG.lateralScale);

    this.mq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    this.reduced = !!this.mq?.matches;
    this.mq?.addEventListener('change', this.onMotionPref);
    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(container);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.layout();
    this.start();
  }

  // ═════════════════════════ 公開 API ═════════════════════════

  /** 立即跳到這個狀態(新局 / 標題預覽):不補間;清掉結局特效、濾鏡、sprite、慢動作,相機歸位 */
  reset(state: GameState): void {
    if (this.disposed) return;
    this.state = state;
    this.worldTimers.length = 0;
    this.realTimers.length = 0;
    this.fallen.male = this.fallen.female = false;
    this.zOff.male = this.zOff.female = false;
    this.inEnding = false;
    this.effects.clear();
    for (const r of ROLES) {
      const ch = this.chars[r];
      ch.resetTransient();
      ch.snapPose(resolvePose(r, state), state.chars[r].lateral * RIG.lateralScale);
      this.blushT[r] = 0;
    }
    this.chBlanketX.snap(state.blanketOffset * 0.9);
    this.lastBlanket = state.blanketOffset;
    this.bedShakeT = this.camShakeT = this.rippleT = this.clockShakeT = 0;
    this.blanket.rippleAmp = 1;
    this.room.clock.position.x = this.room.clockBaseX;

    const rt = this.rt;
    rt.snap('time.scale', 1);
    for (const k of ['cam.yaw', 'cam.roll', 'cam.dolly', 'cam.y', 'cam.focus', 'fx.dark', 'sky']) rt.snap(k, 0);
    rt.snap('moon.i', 1);
    this.setColor(this.chMoon, MOON_COLOR, 0);
    this.lightsFor(state, true);
    this.syncVisuals(state, true);
    this.room.setClock(state.turn);

    this.gray = false;
    this.eyesClosed = state.chars[state.playerRole].eyes === 'closed';
    this.writeFilter(true);
  }

  /** 補間到 state,並依 events 觸發特效(SCENE-RIG §4–§6)。每回合最多兩次:玩家段、對方+回合末段 */
  applyState(state: GameState, events: GameEvent[]): void {
    if (this.disposed) return;
    this.state = state;

    let band: ForceBand = 'gentle';
    let actor: Role | null = null;
    const pushed: Record<Role, boolean> = { male: false, female: false };
    const tumbling: Record<Role, boolean> = { male: false, female: false };
    for (const e of events) {
      if (e.type === 'action') {
        band = e.band;
        actor = e.who;
      } else if (e.type === 'push') pushed[e.target] = true;
      else if (e.type === 'kick') tumbling[e.target] = true;
      else if (e.type === 'fell') tumbling[e.who] = true;
    }
    const { dur, opts } = BAND[band];

    for (const r of ROLES) {
      if (this.fallen[r] || tumbling[r]) continue;
      const ch = this.chars[r];
      ch.tweenPose(resolvePose(r, state), dur, opts);
      const x = state.chars[r].lateral * RIG.lateralScale;
      if (pushed[r]) ch.cx.set(x, 0.4, { ease: 'outBack', overshoot: 2.4, force: true });
      else ch.cx.set(x, dur * 0.75, opts);
    }
    this.chBlanketX.set(state.blanketOffset * 0.9, dur * 0.75, opts);

    if (band === 'firm') this.ripple(2, 0.4);
    else if (band === 'rough') {
      this.ripple(3, 0.45);
      this.bedShakeT = 0.3;
      if (!this.reduced) this.camShakeT = 0.25;
      if (actor) this.nudge(partnerOf(actor));
    }
    if (Math.abs(state.blanketOffset - this.lastBlanket) >= 0.5) this.ripple(2.5, 0.5);
    this.lastBlanket = state.blanketOffset;

    this.syncVisuals(state, false);
    if (!this.inEnding) this.lightsFor(state, false);
    for (const e of events) this.trigger(e, state, events);
    for (const r of ROLES) if (tumbling[r]) this.tumble(r);

    this.room.setClock(state.turn);
    if (!this.inEnding) {
      this.eyesClosed = state.chars[state.playerRole].eyes === 'closed';
      this.writeFilter(false);
    }
  }

  /** SCENE-RIG §7:頭頂上方的錨點(CSS px,相對容器左上角);不在畫面內 → null */
  projectHead(role: Role): { x: number; y: number } | null {
    if (this.disposed) return null;
    const v = this.chars[role].headWorld(this.tmpP);
    v.y += 0.28;
    this.camera.updateMatrixWorld();
    v.project(this.camera);
    if (!(v.z >= -1 && v.z <= 1) || Math.abs(v.x) > 1.5 || Math.abs(v.y) > 1.5) return null;
    const el = this.canvas;
    return { x: (v.x + 1) * 0.5 * el.clientWidth, y: (1 - v.y) * 0.5 * el.clientHeight };
  }

  /** SCENE-RIG §6 結局演出(燈光/濾鏡/慢動作/相機/日出/愛心;不重播角色動作) */
  playEnding(ending: Ending): void {
    if (this.disposed) return;
    this.inEnding = true;
    const player: Role = this.state?.playerRole ?? 'male';
    const partner = partnerOf(player);
    this.focusRole = player;
    // 早晨/被踢醒:玩家睜眼,畫面不再暗;只有「你睡著了」維持閉眼
    if (ending.id !== 'intimacyLoseFellAsleep') {
      this.chars[player].setEyes(true);
      this.eyesClosed = false;
      this.zOff[player] = true;
      this.effects.zOn[player] = false;
    }

    if (ending.style === 'wasted') {
      const hold = this.reduced ? 1.0 : 2.5;
      this.rt.set('time.scale', this.reduced ? 0.5 : 0.25, 0.25, { force: true });
      this.realTimer(hold, () => this.rt.set('time.scale', 1, 0.6, { force: true }));
      this.gray = true;
      if (!this.reduced) this.rt.set('cam.roll', 0.21, 1.4);
      this.rt.set('cam.dolly', -0.8, 1.6);
      this.rt.set('cam.y', -0.3, 1.6);
      this.rt.set('cam.focus', 0.55, 1.6);
      this.audio.wasted();
      switch (ending.id) {
        case 'kickedOff':
        case 'fellOff':
          if (!this.fallen[player]) this.tumble(player); // 保險:事件沒送到時也要掉下去
          break;
        case 'sleepLoseTired':
        case 'intimacyLoseMorning':
          this.sunrise();
          this.clockShakeT = 2;
          this.audio.alarm();
          this.sitUp(player);
          this.chars[player].setDarkCircles(true);
          break;
        case 'intimacyLoseFellAsleep':
          this.effects.zMult[player] = 3;
          this.effects.zOn[player] = true;
          this.effects.puffZ(player);
          if (!this.fallen[partner]) this.chars[partner].tweenPose(basePose(partner, 'sideAway'), 0.8);
          break;
        default:
          break;
      }
    } else if (ending.style === 'passed') {
      this.rt.set('lamp.i', 2.0, 1);
      this.setColor(this.chLamp, GOLD, 1);
      this.audio.chime();
      if (ending.id === 'intimacyWin') {
        this.setColor(this.chLamp, PINK, 1.5);
        this.blushT.male = this.blushT.female = 99;
        this.effects.hearts(4);
        this.realTimer(1.5, () => {
          this.rt.set('fx.dark', 1, 2.2);
          this.effects.heartRain(true);
        });
      } else {
        this.sunrise();
        this.effects.flyBirds();
      }
    } else {
      this.setColor(this.chLamp, PINK, 1);
      this.effects.hearts(3);
      this.realTimer(1.0, () => this.rt.set('fx.dark', 0.55, 1.2));
      this.audio.gentle();
    }
    this.writeFilter(false);
  }

  /** UI 蓋在畫布上下的區域(CSS px);床會置中在中間沒被擋住的帶狀區 */
  setViewInsets(insets: { top: number; bottom: number }): void {
    this.insets = { top: Math.max(0, insets.top || 0), bottom: Math.max(0, insets.bottom || 0) };
    this.layout();
  }

  setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
  }

  /** 必須在使用者手勢中呼叫:建立 / 恢復 AudioContext */
  unlockAudio(): void {
    this.audio.unlock();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stop();
    this.ro.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.mq?.removeEventListener('change', this.onMotionPref);
    this.effects.dispose();
    this.blanket.dispose();
    this.bed.dispose();
    this.room.dispose();
    for (const r of ROLES) this.chars[r].dispose();
    this.kit.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
    this.audio.dispose();
  }

  // ═════════════════════════ 狀態 → 可見參數 ═════════════════════════

  private syncVisuals(s: GameState, snap: boolean): void {
    this.blushBase = s.embrace || s.intimacy >= 60 || s.armPillow.inUse;
    for (const r of ROLES) {
      const c = s.chars[r];
      const ch = this.chars[r];
      ch.setEyes(c.eyes === 'open', snap);
      const br = breathRate(c);
      ch.setBreath(br.rate, br.regular, snap);
      const L = snoreLevel(c);
      ch.setSnore(L);
      this.effects.zOn[r] = c.sleep >= 70 && !this.fallen[r] && !this.zOff[r];
      this.effects.zLevel[r] = L;
      ch.setExpression(this.fallen[r] || c.annoyance >= 50 ? 'frown' : c.mood >= 60 && c.annoyance < 25 ? 'smile' : 'neutral');
      const ap = s.armPillow;
      ch.setNumb(r === 'male' && (ap.offered || ap.inUse) ? ap.numbness : 0);
    }
  }

  /** 夜越深檯燈越暗;親密度越高燈色越偏粉 */
  private lightsFor(s: GameState, snap: boolean): void {
    const d = snap ? 0 : 1;
    const late = Math.min(1, Math.max(0, s.turn / 12));
    this.rt.set('lamp.i', 1 - 0.3 * late, d);
    this.tmpC.copy(LAMP_COLOR).lerp(PINK, 0.45 * Math.min(1, Math.max(0, s.intimacy / 100)));
    this.setColor(this.chLamp, this.tmpC, d);
  }

  private setColor(ch: [Channel, Channel, Channel], c: THREE.Color, dur: number): void {
    ch[0].set(c.r, dur);
    ch[1].set(c.g, dur);
    ch[2].set(c.b, dur);
  }

  private trigger(e: GameEvent, s: GameState, events: GameEvent[]): void {
    switch (e.type) {
      case 'action':
        this.noiseRings(e, s, events);
        break;
      case 'wake':
        this.effects.mark(e.who, 'bang', 1);
        this.chars[e.who].forceEyesOpen(1.2);
        break;
      case 'annoyed':
        if (e.delta > 0) this.effects.mark(e.who, 'bang', 1);
        break;
      case 'intimacy':
        if (e.delta > 0) {
          this.effects.hearts(Math.max(2, Math.min(4, Math.round(e.delta / 4) + 1)));
          this.blushT.male = this.blushT.female = 3;
        }
        break;
      case 'cold':
        this.chars[e.who].shiver(0.8);
        break;
      case 'noticed': {
        const ch = this.chars[e.by];
        ch.forceEyesOpen(1.5);
        ch.lookAtPartner(1.5);
        this.effects.mark(e.by, 'what', 1.5);
        break;
      }
      case 'numb':
        this.chars[e.who].tremble(1.2);
        break;
      case 'snore':
        this.audio.snore(e.level);
        if (!this.fallen[e.who]) this.effects.puffZ(e.who, 1.3);
        break;
      case 'kick':
        this.kickLeg(e.who, e.target);
        break;
      case 'eyes':
        this.chars[e.who].setEyes(e.eyes === 'open');
        break;
      default:
        break;
    }
  }

  /** 行動者頭部發出 1–3 圈聲波環;噪音超過對方門檻 → 最後一圈變紅、對方頭上閃 !! */
  private noiseRings(e: ActionEvent, s: GameState, events: GameEvent[]): void {
    if (!(e.noise > 0) || this.fallen[e.who]) return;
    const target = partnerOf(e.who);
    const woke = events.some((x) => x.type === 'wake' && x.who === target && x.by === e.who);
    const loud = woke || e.noise > wakeThreshold(s.chars[target]);
    const n = e.noise < 15 ? 1 : e.noise < 35 ? 2 : 3;
    const maxR = 0.2 + e.noise / 60;
    const at = this.chars[e.who].headWorld(this.tmp);
    at.y += 0.1;
    for (let i = 0; i < n; i++) this.effects.ring(at, maxR, i * 0.16, loud && i === n - 1);
    if (loud && !woke) this.effects.mark(target, 'bang', 1);
  }

  private ripple(amp: number, dur: number): void {
    if (this.rippleT > 0 && this.rippleBoost > amp) return;
    this.rippleBoost = amp;
    this.rippleDur = dur;
    this.rippleT = dur;
  }

  /** rough:對方被帶動 0.03 再彈回 */
  private nudge(r: Role): void {
    if (this.fallen[r]) return;
    const ch = this.chars[r];
    ch.cnudge.set(SIDE[r] * 0.03, 0.08, { ease: 'out', force: true });
    this.worldTimer(0.08, () => ch.cnudge.set(0, 0.35, { ease: 'outBack', overshoot: 2, force: true }));
  }

  /** kick / fell:整圈翻滾掉到床邊地上,落地小彈一次 */
  private tumble(role: Role): void {
    if (this.fallen[role]) return;
    this.fallen[role] = true;
    const ch = this.chars[role];
    const s = SIDE[role];
    let end = Math.round((ch.croll.cur + s * TAU) / TAU) * TAU; // 落地時臉朝上
    if (Math.abs(end - ch.croll.cur) < TAU * 0.75) end += s * TAU;
    ch.croll.set(end, 1.2, { angular: true, noWrap: true, force: true });
    ch.cx.set(s * 1.75, 1.2, { force: true });
    ch.cz.set(0.45, 1.2, { force: true });
    ch.cpitch.set(RIG.lyingPitch, 0.3, { force: true });
    ch.cnudge.snap(0);
    ch.cy.set(RIG.rootY + 0.08, 0.45, { ease: 'out', force: true });
    this.worldTimer(0.45, () => ch.cy.set(0.22, 0.75, { ease: 'in', force: true }));
    ch.tweenLimbs(FLAIL, 0.3, { force: true });
    this.worldTimer(1.2, () => {
      ch.cy.set(0.3, 0.12, { ease: 'out', force: true });
      ch.tweenLimbs(SPRAWL, 0.45, { force: true });
    });
    this.worldTimer(1.32, () => ch.cy.set(0.22, 0.28, { ease: 'inOut', force: true }));
    this.effects.zOn[role] = false;
    this.effects.mark(role, 'bang', 1.4);
    ch.forceEyesOpen(4);
    ch.setExpression('frown');
  }

  /** 踢人的那一腳(依姿勢挑朝向對方的那條腿) */
  private kickLeg(who: Role, victim: Role): void {
    if (this.fallen[who]) return;
    const ch = this.chars[who];
    const posture = this.state?.chars[who].posture ?? 'supine';
    const dir = SIDE[victim];
    const roll = ch.croll.to;
    let leg: 'legL' | 'legR';
    let e: Euler3;
    if (posture === 'supine') {
      leg = dir > 0 ? 'legL' : 'legR';
      e = [0, 0, dir * 1.0];
    } else if (posture === 'prone') {
      leg = dir > 0 ? 'legR' : 'legL';
      e = [0, 0, -dir * 1.0];
    } else {
      leg = roll > 0 ? 'legR' : 'legL'; // 上面那條腿
      e = posture === 'sideFacing' ? [-1.5, 0, 0] : [0.9, 0, 0];
    }
    ch.tweenLimbs({ [leg]: e }, 0.12, { ease: 'out', force: true });
    this.worldTimer(0.4, () => {
      if (this.state) ch.tweenLimbs(resolvePose(who, this.state).limbs, 0.45, { force: true });
    });
  }

  /** 早晨結局:翻成仰躺後坐起來(rotation.x −π/2 → −π/6) */
  private sitUp(role: Role): void {
    if (this.fallen[role]) return;
    const ch = this.chars[role];
    ch.croll.set(0, 0.8, { angular: true, force: true });
    ch.cpitch.set(-Math.PI / 6, 0.8, { force: true });
    ch.cy.set(RIG.rootY, 0.8, { force: true });
    ch.tweenLimbs(SIT, 0.8, { force: true });
    this.effects.zOn[role] = false;
  }

  private sunrise(): void {
    this.setColor(this.chMoon, SUNRISE, 1.5);
    this.rt.set('moon.i', 2, 1.5);
    this.rt.set('sky', 1, 2);
  }

  // ═════════════════════════ 畫面濾鏡 ═════════════════════════

  /** 閉眼 brightness(0.45) blur(1.5px) 與結局 grayscale/contrast/brightness 組成一條字串;CSS transition 0.5s / 0.8s */
  private writeFilter(instant: boolean): void {
    const b = (this.eyesClosed ? 0.45 : 1) * (this.gray ? 0.75 : 1);
    const f =
      !this.eyesClosed && !this.gray
        ? 'none'
        : `brightness(${b}) blur(${this.eyesClosed ? 1.5 : 0}px) grayscale(${this.gray ? 1 : 0}) contrast(${this.gray ? 1.15 : 1})`;
    const style = this.canvas.style;
    if (instant) {
      style.transition = 'none';
      style.filter = f;
      void this.canvas.offsetWidth; // 讓「無 transition」先生效
    } else if (f !== this.lastFilter) {
      const dur = this.gray !== this.shownGray ? 0.8 : 0.5;
      style.transition = `filter ${dur}s ease`;
      style.filter = f;
    }
    this.lastFilter = f;
    this.shownGray = this.gray;
  }

  // ═════════════════════════ 取景 ═════════════════════════

  private layout(): void {
    if (this.disposed) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w < 2 || h < 2) return;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    const cam = this.camera;
    cam.aspect = w / h;
    cam.fov = w / h < 1 ? 58 : 42;
    cam.clearViewOffset();

    let top = this.insets.top;
    let bottom = this.insets.bottom;
    const minBand = h * 0.3;
    if (h - top - bottom < minBand) {
      const k = (h - minBand) / Math.max(1, top + bottom);
      top *= k;
      bottom *= k;
    }
    const band = h - top - bottom;
    const margin = Math.min(16, w * 0.03);

    // 二分搜尋相機距離:整張床剛好塞進 w × band(不比規格相機更近太多)
    let lo = CAM_DIST * 0.85;
    let hi = CAM_DIST * 5;
    const box = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      this.projectFrame(mid, w, h, box);
      if (box.maxX - box.minX <= w - 2 * margin && box.maxY - box.minY <= band - 2 * margin) hi = mid;
      else lo = mid;
    }
    this.fitDist = hi;
    this.projectFrame(hi, w, h, box);
    // 視窗平移:床的投影中心 → 帶狀區中心(projectHead 用同一個 camera,自然正確)
    cam.setViewOffset(w, h, (box.minX + box.maxX) / 2 - w / 2, (box.minY + box.maxY) / 2 - (top + band / 2), w, h);
    this.fog.near = hi * 1.05;
    this.fog.far = hi + 6.5;
    this.updateCamera(0);
    this.renderer.render(this.scene, this.camera);
  }

  private projectFrame(dist: number, w: number, h: number, out: { minX: number; maxX: number; minY: number; maxY: number }): void {
    const cam = this.camera;
    cam.position.copy(CAM_TARGET).addScaledVector(CAM_DIR, dist);
    cam.up.set(0, 1, 0);
    cam.lookAt(CAM_TARGET);
    cam.updateMatrixWorld();
    out.minX = out.minY = Infinity;
    out.maxX = out.maxY = -Infinity;
    for (const p of FRAME_POINTS) {
      const v = this.tmp.copy(p).project(cam);
      const x = (v.x + 1) * 0.5 * w;
      const y = (1 - v.y) * 0.5 * h;
      if (x < out.minX) out.minX = x;
      if (x > out.maxX) out.maxX = x;
      if (y < out.minY) out.minY = y;
      if (y > out.maxY) out.maxY = y;
    }
  }

  private updateCamera(realDt: number): void {
    const cam = this.camera;
    const target = this.camTarget.copy(CAM_TARGET);
    const f = this.chFocus.cur;
    if (f > 0) {
      // 受害者身體中段(髖與頭的中點):躺在地上、坐起來都能框進畫面
      const ch = this.chars[this.focusRole];
      const mid = ch.root.getWorldPosition(this.tmp2).add(ch.headWorld(this.tmpP)).multiplyScalar(0.5);
      target.lerp(mid, f);
    }
    const sway = this.reduced ? 0 : 0.012 * Math.sin(this.rtime * 0.23);
    const off = this.tmp.copy(CAM_DIR).multiplyScalar(Math.max(0.8, this.fitDist + this.chDolly.cur));
    off.applyAxisAngle(Y_AXIS, this.chYaw.cur + sway);
    cam.position.copy(target).add(off);
    cam.position.y += this.chCamY.cur;
    if (this.camShakeT > 0) {
      this.camShakeT -= realDt;
      const a = 0.025 * Math.max(0, this.camShakeT / 0.25);
      cam.position.x += (Math.random() * 2 - 1) * a;
      cam.position.y += (Math.random() * 2 - 1) * a;
    }
    cam.lookAt(target);
    const roll = this.reduced ? 0 : this.chRoll.cur;
    if (roll !== 0) cam.rotateZ(roll);
  }

  // ═════════════════════════ 每幀 ═════════════════════════

  private start(): void {
    if (this.raf || this.disposed || document.hidden) return;
    this.lastNow = -1;
    this.raf = requestAnimationFrame(this.frame);
  }

  private stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private readonly frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = this.lastNow < 0 ? 0 : Math.min(0.05, Math.max(0, (now - this.lastNow) / 1000));
    this.lastNow = now;
    this.step(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private readonly onVisibility = (): void => {
    if (document.hidden) this.stop();
    else this.start();
  };

  private readonly onMotionPref = (e: MediaQueryListEvent): void => {
    this.reduced = e.matches;
  };

  private worldTimer(t: number, fn: () => void): void {
    this.worldTimers.push({ t, fn });
  }

  private realTimer(t: number, fn: () => void): void {
    this.realTimers.push({ t, fn });
  }

  private runTimers(list: Timer[], dt: number): void {
    for (let i = 0; i < list.length; ) {
      const tm = list[i];
      tm.t -= dt;
      if (tm.t <= 0) {
        list.splice(i, 1);
        tm.fn();
      } else i++;
    }
  }

  /** tweens → 寫回 Object3D → 棉被 → 呼吸 → 特效 → 燈光 → 相機 */
  private step(realDt: number): void {
    this.rtime += realDt;
    this.rt.update(realDt);
    this.runTimers(this.realTimers, realDt);
    const dt = realDt * Math.max(0, this.chTime.cur);
    this.wt += dt;
    this.tw.update(dt);
    this.runTimers(this.worldTimers, dt);

    let shake = 0;
    if (this.bedShakeT > 0) {
      this.bedShakeT -= dt;
      shake = 0.015 * Math.sin(this.wt * 75) * Math.max(0, this.bedShakeT / 0.3);
    }
    this.bed.group.position.y = shake;

    let n = 0;
    for (const r of ROLES) {
      const ch = this.chars[r];
      ch.bedShake = this.fallen[r] ? 0 : shake;
      if (this.blushT[r] > 0) this.blushT[r] -= dt;
      ch.setBlush(this.blushBase || this.blushT[r] > 0);
      ch.update(dt, this.wt);
      ch.root.updateMatrixWorld(true);
      n = ch.writeSegments(this.segs, n);
    }

    const bl = this.blanket;
    bl.mesh.position.x = this.chBlanketX.cur;
    bl.mesh.position.y = shake;
    if (this.rippleT > 0) {
      this.rippleT -= dt;
      const k = Math.max(0, this.rippleT / this.rippleDur);
      bl.rippleAmp = 1 + (this.rippleBoost - 1) * k;
      bl.ripplePhase += dt * 14 * k;
    } else bl.rippleAmp = 1;
    bl.rebuild(this.segs, n / SEGMENT_STRIDE);

    this.effects.update(dt, this.wt);

    if (this.clockShakeT > 0) {
      this.clockShakeT -= realDt;
      this.room.clock.position.x = this.room.clockBaseX + (this.clockShakeT > 0 ? 0.02 * Math.sin(this.rtime * 60) : 0);
    }
    this.updateLights();
    this.updateCamera(realDt);
  }

  private updateLights(): void {
    const room = this.room;
    const dark = 1 - 0.94 * this.chDark.cur;
    const li = this.chLampI.cur;
    const sky = this.chSky.cur;
    room.lamp.color.setRGB(this.chLamp[0].cur, this.chLamp[1].cur, this.chLamp[2].cur);
    room.lamp.intensity = LIGHT.lamp * li * dark;
    room.lampShade.emissive.copy(room.lamp.color);
    room.lampShade.emissiveIntensity = 0.9 * Math.min(1.5, li) * dark;
    const glow = room.glow.material;
    glow.color.copy(room.lamp.color);
    glow.opacity = 0.5 * Math.min(1.6, li) * dark;
    room.moon.color.setRGB(this.chMoon[0].cur, this.chMoon[1].cur, this.chMoon[2].cur);
    room.moon.intensity = LIGHT.moon * this.chMoonI.cur * dark;
    room.hemi.intensity = LIGHT.hemi * (1 + 0.6 * sky) * dark;
    room.fill.intensity = LIGHT.fill * dark;
    room.hemi.color.copy(this.hemiSky).lerp(DAWN_SKY, sky);
    room.dawn.opacity = sky;
    room.night.color.setScalar(1 - 0.75 * this.chDark.cur);
    room.beam.color.copy(room.moon.color);
    room.beam.opacity = 0.16 * dark * (1 - 0.5 * sky);
  }
}
