// 對話泡泡:錨在角色頭上(scene.projectHead),每句 2.5 秒,同一角色排隊。
import type { Role } from '../game/types';
import { h } from './dom';

export type BubbleTone = 'normal' | 'angry' | 'warm' | 'sleepy' | 'thought';
type Anchor = (role: Role) => { x: number; y: number } | null;

const SHOW_MS = 2500;
const FADE_MS = 300;

interface Live {
  el: HTMLElement;
  role: Role;
  until: number;
}

export class Bubbles {
  private anchor: Anchor = () => null;
  private queues: Record<Role, { text: string; tone: BubbleTone }[]> = { male: [], female: [] };
  private live: Partial<Record<Role, Live>> = {};
  private raf = 0;
  private playerRole: Role = 'male';

  constructor(private layer: HTMLElement) {}

  setAnchor(fn: Anchor): void {
    this.anchor = fn;
  }

  setPlayer(role: Role): void {
    this.playerRole = role;
  }

  speak(role: Role, text: string, tone: BubbleTone = 'normal'): void {
    this.queues[role].push({ text, tone });
    if (!this.live[role]) this.next(role);
    this.loop();
  }

  clear(): void {
    this.queues = { male: [], female: [] };
    for (const r of ['male', 'female'] as Role[]) this.live[r]?.el.remove();
    this.live = {};
  }

  private next(role: Role) {
    const item = this.queues[role].shift();
    if (!item) {
      delete this.live[role];
      return;
    }
    const el = h(
      'div',
      { class: `bubble ${role} tone-${item.tone} ${role === this.playerRole ? 'mine' : 'theirs'}` },
      h('span', { class: 'bubble-text', text: item.text }),
    );
    this.layer.append(el);
    this.live[role] = { el, role, until: performance.now() + SHOW_MS };
    this.place(this.live[role]!);
    requestAnimationFrame(() => el.classList.add('in'));
    this.loop();
  }

  private place(b: Live) {
    const p = this.anchor(b.role);
    if (!p) {
      b.el.style.visibility = 'hidden';
      return;
    }
    b.el.style.visibility = '';
    const w = this.layer.clientWidth;
    const bw = b.el.offsetWidth;
    // 不要超出畫面左右
    const x = Math.max(bw / 2 + 8, Math.min(w - bw / 2 - 8, p.x));
    b.el.style.transform = `translate(${x - bw / 2}px, ${p.y - b.el.offsetHeight}px)`;
    b.el.style.setProperty('--tail-x', `${Math.max(12, Math.min(bw - 12, p.x - (x - bw / 2)))}px`);
  }

  private loop() {
    if (this.raf) return;
    const tick = () => {
      const now = performance.now();
      let any = false;
      for (const r of ['male', 'female'] as Role[]) {
        const b = this.live[r];
        if (!b) continue;
        any = true;
        this.place(b);
        if (now > b.until && !b.el.classList.contains('out')) {
          b.el.classList.add('out');
          setTimeout(() => {
            b.el.remove();
            if (this.live[r] === b) this.next(r);
          }, FADE_MS);
        }
      }
      this.raf = any ? requestAnimationFrame(tick) : 0;
    };
    this.raf = requestAnimationFrame(tick);
  }
}
