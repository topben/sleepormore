// 補間頻道(SCENE-RIG §4)。純數字、無 three.js;每個頻道一條 from → to 的補間。
// applyState 只呼叫 set();每幀 update(dt) 推進,場景再把 cur 寫回 Object3D。

export type Ease = 'inOut' | 'outBack' | 'out' | 'in' | 'linear';

export interface TweenOpts {
  /** 角度頻道:走最短路徑(±π 內) */
  angular?: boolean;
  /** 搭配 angular:目標照給定值,不取最短路徑(整圈翻滾用) */
  noWrap?: boolean;
  ease?: Ease;
  /** easeOutBack 的過衝係數 s */
  overshoot?: number;
  /** 做到一半停頓幾秒再完成(timid 的猶豫) */
  hesitate?: number;
  /** 延遲幾秒才開始 */
  delay?: number;
  /** 目標相同也重新起跑(換 ease 用) */
  force?: boolean;
}

const TAU = Math.PI * 2;

/** 把角度差折回 [−π, π) */
export const wrapAngle = (d: number): number => ((((d + Math.PI) % TAU) + TAU) % TAU) - Math.PI;

export const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export const easeOutBack = (t: number, s = 1.70158): number => {
  const u = t - 1;
  return 1 + (s + 1) * u * u * u + s * u * u;
};

function ease(kind: Ease, t: number, s: number): number {
  switch (kind) {
    case 'outBack':
      return easeOutBack(t, s);
    case 'out':
      return 1 - (1 - t) * (1 - t) * (1 - t);
    case 'in':
      return t * t * t;
    case 'linear':
      return t;
    default:
      return easeInOutCubic(t);
  }
}

export class Channel {
  cur: number;
  from: number;
  to: number;
  private dur = 0;
  private el = 0;
  private wait = 0;
  private hold = 0;
  private kind: Ease = 'inOut';
  private s = 1.70158;
  private running = false;

  constructor(v = 0) {
    this.cur = this.from = this.to = v;
  }

  get active(): boolean {
    return this.running;
  }

  snap(v: number): void {
    this.cur = this.from = this.to = v;
    this.running = false;
  }

  set(to: number, dur: number, o: TweenOpts = {}): void {
    if (!(dur > 0) && !o.delay) {
      // 0 秒 = 立刻到位(reset 用),不管目前在跑什麼
      this.snap(o.angular && !o.noWrap ? this.cur + wrapAngle(to - this.cur) : to);
      return;
    }
    if (o.angular && !o.noWrap) {
      if (!o.force) {
        // 已經在往同一個角度(模 2π)前進 / 已經停在那裡 → 不重跑
        if (this.running && Math.abs(wrapAngle(to - this.to)) < 1e-6) return;
        if (!this.running && Math.abs(wrapAngle(to - this.cur)) < 1e-6) return;
      }
      to = this.cur + wrapAngle(to - this.cur);
    } else if (!o.force) {
      if (this.running && Math.abs(to - this.to) < 1e-6) return;
      if (!this.running && Math.abs(to - this.cur) < 1e-6 && !o.delay) return;
    }
    this.from = this.cur;
    this.to = to;
    this.dur = Math.max(1e-3, dur);
    this.el = 0;
    this.wait = o.delay ?? 0;
    this.hold = o.hesitate ?? 0;
    this.kind = o.ease ?? 'inOut';
    this.s = o.overshoot ?? 1.70158;
    this.running = true;
  }

  update(dt: number): void {
    if (!this.running) return;
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait > 0) return;
      dt = -this.wait;
      this.wait = 0;
      this.from = this.cur;
    }
    this.el += dt;
    if (this.el >= this.dur + this.hold) {
      this.cur = this.to;
      this.running = false;
      return;
    }
    let p: number;
    if (this.hold > 0) {
      const half = this.dur / 2;
      if (this.el < half) p = 0.5 * ease(this.kind, this.el / half, this.s);
      else if (this.el < half + this.hold) p = 0.5;
      else p = 0.5 + 0.5 * ease(this.kind, (this.el - half - this.hold) / half, this.s);
    } else {
      p = ease(this.kind, this.el / this.dur, this.s);
    }
    this.cur = this.from + (this.to - this.from) * p;
  }
}

export class Tweens {
  private readonly map = new Map<string, Channel>();
  private readonly list: Channel[] = [];

  /** 取得(必要時建立)頻道;場景物件持有頻道參考,每幀直接讀 cur,不做字串查找 */
  chan(key: string, init = 0): Channel {
    let c = this.map.get(key);
    if (!c) {
      c = new Channel(init);
      this.map.set(key, c);
      this.list.push(c);
    }
    return c;
  }

  set(key: string, to: number, dur: number, opts?: TweenOpts): void {
    this.chan(key).set(to, dur, opts);
  }

  snap(key: string, v: number): void {
    this.chan(key).snap(v);
  }

  get(key: string): number {
    return this.map.get(key)?.cur ?? 0;
  }

  update(dt: number): void {
    for (let i = 0; i < this.list.length; i++) this.list[i].update(dt);
  }
}
