// 力道條:按住蓄力(1.8 秒 0→100,到 100 停住),在綠區放開。
// 易玩性:直接在動作按鈕上按住就開始蓄力;只是「點一下」不會送出太輕的動作,而是打開力道條等你按住。
import { FIRM_SPAN, FORCE_FILL_MS } from '../game/constants';
import { forceBand } from '../game/rules';
import type { ForceBand } from '../game/types';
import { h } from './dom';

export interface ForceRequest {
  emoji: string;
  label: string;
  window: [number, number];
  suggested?: number;
  info: string;
  bandLabels: Record<ForceBand, string>;
  texts: { instruction: string; holdButton: string; keyboard: string; tooShort: string; cancel: string; suggested: string };
}

const TAP_MS = 160; // 短於這個 = 只是點一下
const RESULT_MS = 650;

export class ForceMeter {
  readonly el: HTMLElement;
  private req: ForceRequest | null = null;
  private onDone: ((force: number) => void) | null = null;
  private onClose: (() => void) | null = null;
  private charging = false;
  private locked = false;
  private resultTimer = 0;
  /** 這次蓄力是從動作按鈕上按下的(點一下只是打開力道條,不提示) */
  private fromAction = false;
  private startAt = 0;
  private force = 0;
  private raf = 0;
  private needle!: HTMLElement;
  private fill!: HTMLElement;
  private readout!: HTMLElement;
  private msg!: HTMLElement;
  private holdBtn!: HTMLButtonElement;

  constructor(parent: HTMLElement) {
    this.el = h('div', { class: 'force hidden', role: 'dialog', 'aria-modal': 'false' });
    parent.append(this.el);
    window.addEventListener('pointerup', () => this.charging && this.release());
    window.addEventListener('pointercancel', () => this.charging && this.release());
  }

  get isOpen(): boolean {
    return this.req !== null;
  }

  open(req: ForceRequest, onDone: (force: number) => void, onClose: () => void, chargeNow = false): void {
    this.req = req;
    this.onDone = onDone;
    this.onClose = onClose;
    this.locked = false;
    this.force = 0;
    this.build(req);
    this.el.classList.remove('hidden');
    this.update();
    if (chargeNow) {
      this.press();
      this.fromAction = true;
    }
  }

  press(): void {
    if (!this.req || this.locked || this.charging) return;
    this.charging = true;
    this.startAt = performance.now();
    this.force = 0;
    this.msg.textContent = '';
    this.el.classList.add('charging');
    const tick = () => {
      if (!this.charging) return;
      this.force = Math.min(100, ((performance.now() - this.startAt) / FORCE_FILL_MS) * 100);
      this.update();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  release(): void {
    if (!this.req || !this.charging) return;
    this.charging = false;
    cancelAnimationFrame(this.raf);
    this.el.classList.remove('charging');
    const held = performance.now() - this.startAt;
    const fromAction = this.fromAction;
    this.fromAction = false;
    if (held < TAP_MS) {
      // 只是點一下:不送出。從動作按鈕點開的就安靜等待,在力道條上點的才提示要按住
      this.force = 0;
      this.update();
      if (fromAction) return;
      this.msg.textContent = this.req.texts.tooShort;
      this.holdBtn.classList.remove('nudge');
      void this.holdBtn.offsetWidth;
      this.holdBtn.classList.add('nudge');
      return;
    }
    this.force = Math.min(100, (held / FORCE_FILL_MS) * 100);
    this.update();
    const band = forceBand(this.req.window, this.force);
    this.locked = true;
    this.readout.textContent = `${this.req.bandLabels[band]}!`;
    this.readout.className = `force-readout band-${band} show`;
    const done = this.onDone;
    const force = this.force;
    this.resultTimer = window.setTimeout(() => {
      this.close();
      done?.(force);
    }, RESULT_MS);
  }

  /** 無條件關閉(換局/回開始畫面時):不送出動作,也取消還沒送出的結果 */
  reset(): void {
    cancelAnimationFrame(this.raf);
    this.close();
  }

  cancel(): void {
    if (!this.req || this.locked) return;
    this.charging = false;
    cancelAnimationFrame(this.raf);
    const cb = this.onClose;
    this.close();
    cb?.();
  }

  private close() {
    clearTimeout(this.resultTimer);
    this.resultTimer = 0;
    this.locked = false;
    this.req = null;
    this.onDone = null;
    this.onClose = null;
    this.charging = false;
    this.el.classList.add('hidden');
    this.el.classList.remove('charging');
  }

  private update() {
    if (!this.req) return;
    const pct = `${this.force}%`;
    this.needle.style.left = pct;
    this.fill.style.width = pct;
    const band = forceBand(this.req.window, this.force);
    this.fill.className = `force-fill band-${band}`;
    this.holdBtn.setAttribute('aria-valuenow', String(Math.round(this.force)));
  }

  private build(req: ForceRequest) {
    const [lo, hi] = req.window;
    const firmEnd = Math.min(100, hi + FIRM_SPAN);
    const seg = (band: ForceBand, a: number, b: number) =>
      b > a
        ? h('div', { class: `zone band-${band}`, style: { left: `${a}%`, width: `${b - a}%` } }, b - a >= 12 ? h('span', { text: req.bandLabels[band] }) : null)
        : null;
    this.needle = h('div', { class: 'force-needle' });
    this.fill = h('div', { class: 'force-fill' });
    this.readout = h('div', { class: 'force-readout' });
    this.msg = h('div', { class: 'force-msg', 'aria-live': 'polite' });
    this.holdBtn = h(
      'button',
      {
        class: 'force-hold',
        type: 'button',
        role: 'slider',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': '0',
        'aria-label': req.texts.holdButton,
        onPointerdown: (e: PointerEvent) => {
          e.preventDefault();
          this.press();
        },
        onContextmenu: (e: Event) => e.preventDefault(),
      },
      req.texts.holdButton,
    );
    const marker =
      req.suggested != null
        ? h('div', { class: 'force-suggest', style: { left: `${req.suggested}%` }, title: req.texts.suggested }, h('span', { text: '▼' }))
        : null;
    this.el.replaceChildren(
      h(
        'div',
        { class: 'force-panel' },
        h(
          'div',
          { class: 'force-head' },
          h('span', { class: 'force-emoji', text: req.emoji }),
          h('span', { class: 'force-title', text: req.label }),
          h('button', { class: 'icon-btn force-x', type: 'button', 'aria-label': req.texts.cancel, title: req.texts.cancel, onClick: () => this.cancel() }, '✕'),
        ),
        h('div', { class: 'force-instr', text: req.texts.instruction }),
        h(
          'div',
          { class: 'force-track' },
          seg('timid', 0, lo),
          seg('gentle', lo, hi),
          seg('firm', hi, firmEnd),
          seg('rough', firmEnd, 100),
          this.fill,
          marker,
          this.needle,
          this.readout,
        ),
        this.msg,
        this.holdBtn,
        h('div', { class: 'force-foot' }, h('span', { text: req.texts.keyboard }), h('span', { class: 'force-info', text: req.info })),
      ),
    );
  }
}
