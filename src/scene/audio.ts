// WebAudio 合成音效(不載任何音檔)。AudioContext 必須由使用者手勢 unlock() 建立/恢復;之前一律靜默略過。
const VOLUME = 0.55;

type AudioCtor = typeof AudioContext;

export class SceneAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;

  unlock(): void {
    try {
      if (!this.ctx) {
        const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
        const AC = w.AudioContext ?? w.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : VOLUME;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    } catch {
      this.ctx = null;
      this.master = null;
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ctx && this.master) this.master.gain.setTargetAtTime(muted ? 0 : VOLUME, this.ctx.currentTime, 0.03);
  }

  /** 已解鎖、正在跑、沒靜音才回傳 context */
  private live(): { c: AudioContext; out: GainNode } | null {
    const c = this.ctx;
    if (!c || !this.master || this.muted || c.state !== 'running') return null;
    return { c, out: this.master };
  }

  private noiseBuffer(c: AudioContext): AudioBuffer {
    if (!this.noise) {
      const len = Math.floor(c.sampleRate * 1.2);
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noise;
  }

  private tone(c: AudioContext, out: AudioNode, type: OscillatorType, f0: number, f1: number, t0: number, dur: number, peak: number, attack = 0.01): void {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  /** 鼾聲:低頻鋸齒(~90Hz,28Hz 抖動)+ band-pass 噪音,0.6s,音量隨 level */
  snore(level: number): void {
    const a = this.live();
    if (!a || level <= 0) return;
    const { c, out } = a;
    const t0 = c.currentTime + 0.02;
    const dur = 0.55 + 0.08 * level;
    const vol = [0, 0.1, 0.17, 0.26][Math.min(3, level)];

    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(vol, t0 + dur * 0.35);
    env.gain.linearRampToValueAtTime(vol * 0.7, t0 + dur * 0.75);
    env.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    env.connect(out);

    // 軟顎抖動:用 LFO 調變振幅
    const flutter = c.createGain();
    flutter.gain.value = 0.55;
    const lfo = c.createOscillator();
    lfo.frequency.value = 24 + level * 3;
    const lfoAmt = c.createGain();
    lfoAmt.gain.value = 0.45;
    lfo.connect(lfoAmt).connect(flutter.gain);
    flutter.connect(env);

    const saw = c.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.setValueAtTime(80 + level * 6, t0);
    saw.frequency.linearRampToValueAtTime(68, t0 + dur);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 340 + level * 60;
    lp.Q.value = 1.5;
    saw.connect(lp).connect(flutter);

    const src = c.createBufferSource();
    src.buffer = this.noiseBuffer(c);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 520;
    bp.Q.value = 0.9;
    const ng = c.createGain();
    ng.gain.value = 0.35 + level * 0.1;
    src.connect(bp).connect(ng).connect(flutter);

    for (const n of [lfo, saw]) {
      n.start(t0);
      n.stop(t0 + dur + 0.05);
    }
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  /** wasted:悶聲 thud(60Hz sine,0.8 → 0 in 0.4s)+ 下行兩音(220 → 165Hz,各 0.25s) */
  wasted(): void {
    const a = this.live();
    if (!a) return;
    const { c, out } = a;
    const t0 = c.currentTime + 0.02;
    this.tone(c, out, 'sine', 90, 45, t0, 0.4, 0.8, 0.005);
    const src = c.createBufferSource();
    src.buffer = this.noiseBuffer(c);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    const g = c.createGain();
    g.gain.setValueAtTime(0.5, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
    src.connect(lp).connect(g).connect(out);
    src.start(t0);
    src.stop(t0 + 0.3);
    const tri = c.createBiquadFilter();
    tri.type = 'lowpass';
    tri.frequency.value = 900;
    tri.connect(out);
    this.tone(c, tri, 'triangle', 220, 220, t0 + 0.45, 0.25, 0.3, 0.02);
    this.tone(c, tri, 'triangle', 165, 165, t0 + 0.72, 0.25, 0.3, 0.02);
  }

  /** passed:柔和上行的鈴聲 */
  chime(): void {
    const a = this.live();
    if (!a) return;
    const { c, out } = a;
    const t0 = c.currentTime + 0.02;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.tone(c, out, 'sine', f, f, t0 + i * 0.13, 1.3, 0.14, 0.01);
      this.tone(c, out, 'sine', f * 2, f * 2, t0 + i * 0.13, 0.6, 0.03, 0.01);
    });
  }

  /** neutral:溫和的兩音 */
  gentle(): void {
    const a = this.live();
    if (!a) return;
    const { c, out } = a;
    const t0 = c.currentTime + 0.02;
    this.tone(c, out, 'sine', 440, 440, t0, 1.0, 0.12, 0.05);
    this.tone(c, out, 'sine', 554.37, 554.37, t0 + 0.28, 1.2, 0.1, 0.05);
  }

  /** 早晨結局的鬧鐘嗶嗶 */
  alarm(): void {
    const a = this.live();
    if (!a) return;
    const { c, out } = a;
    const t0 = c.currentTime + 0.05;
    for (let k = 0; k < 2; k++) for (let i = 0; i < 4; i++) this.tone(c, out, 'square', 1760, 1760, t0 + k * 0.7 + i * 0.12, 0.07, 0.035, 0.005);
  }

  dispose(): void {
    const c = this.ctx;
    this.ctx = null;
    this.master = null;
    this.noise = null;
    if (c) void c.close().catch(() => undefined);
  }
}
