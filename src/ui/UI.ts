// GameUI:純 DOM + CSS 的介面層(DESIGN §10 + 易玩性改善)。所有文字依目前語系即時翻譯。
import { ACTIONS } from '../game/actions';
import { greenCenter, suggestAction } from '../game/hints';
import { forceWindow, projectedNoise, wakeThreshold } from '../game/rules';
import type { ActionId, AvailableAction, Eyes, GameEvent, GameState, Role } from '../game/types';
import { partnerOf } from '../game/types';
import { fmt, m, onLocaleChange, setLocale, speechLine, type Locale } from '../i18n';
import { Bubbles, type BubbleTone } from './bubbles';
import { h } from './dom';
import { ForceMeter } from './forceMeter';
import { Hud } from './hud';
import type { LogItem } from './log';
import { endingBanner, endingCard, goalScreen, helpScreen, settingsScreen, startScreen, toast } from './screens';
import { loadSettings, saveSettings, type Settings } from './settings';
import './style.css';

export interface UIHandlers {
  onStart(role: Role): void;
  onAction(actionId: ActionId, force: number): void;
  onToggleEyes(eyes: Eyes): void;
  /** 回到開始畫面(換角色) */
  onRestart(): void;
  /** 同角色再玩一次 */
  onReplay(): void;
  onSettings(s: Settings): void;
  /** HUD 遮住畫面的上下範圍(CSS px),給 3D 相機避開 */
  onLayout(insets: { top: number; bottom: number }): void;
}

type Screen = 'start' | 'goal' | 'game' | 'ending';

const TONE: Record<string, BubbleTone> = {
  wakeAngry: 'angry',
  refuseAnnoyed: 'angry',
  roughComplaint: 'angry',
  push: 'angry',
  kick: 'angry',
  noticedSleep: 'angry',
  stare: 'angry',
  snore: 'angry',
  coldAwake: 'angry',
  blanketPulled: 'angry',
  receptiveKiss: 'warm',
  receptiveHug: 'warm',
  receptiveCaress: 'warm',
  okFine: 'warm',
  whisperReply: 'warm',
  patReply: 'warm',
  armAccepted: 'warm',
  armOffered: 'warm',
  blanketTucked: 'warm',
  intimacyHigh: 'warm',
  noticedIntimacy: 'warm',
  sleepTalk_sleep: 'sleepy',
  sleepTalk_intimacy: 'sleepy',
  tooLate: 'thought',
};

export class GameUI {
  settings: Settings = loadSettings();
  private screen: Screen = 'start';
  private state: GameState | null = null;
  private actions: AvailableAction[] = [];
  private log: LogItem[] = [];
  private lastNoise: number | null = null;
  private busy = false;
  private goalResolve: (() => void) | null = null;
  private modal: 'help' | 'settings' | null = null;
  private endingTimer = 0;
  private lastInsets = '';

  private readonly hud: Hud;
  private readonly screenLayer = h('div', { class: 'screen-layer' });
  private readonly modalLayer = h('div', { class: 'modal-layer' });
  private readonly bubbleLayer = h('div', { class: 'bubble-layer', 'aria-live': 'polite' });
  private readonly toastLayer = h('div', { class: 'toast-layer' });
  private readonly bannerLayer = h('div', { class: 'banner-layer' });
  private readonly bubbles: Bubbles;
  private readonly meter: ForceMeter;
  private readonly youTag = h('div', { class: 'you-tag', 'aria-hidden': 'true' });
  private anchor: (role: Role) => { x: number; y: number } | null = () => null;
  private youRaf = 0;

  constructor(
    private readonly root: HTMLElement,
    private readonly handlers: UIHandlers,
  ) {
    this.hud = new Hud({
      action: (id, chargeNow) => this.chooseAction(id, chargeNow),
      unavailable: (reason) => toast(this.toastLayer, fmt(m().ui.action.unavailable, { reason })),
      toggleEyes: () => this.toggleEyes(),
      help: () => this.openModal('help'),
      settings: () => this.openModal('settings'),
      sound: () => this.updateSettings({ ...this.settings, sound: !this.settings.sound }),
      hideHints: () => this.updateSettings({ ...this.settings, hints: false }),
    });
    this.hud.el.hidden = true;
    const eyelids = h('div', { class: 'eyelids', 'aria-hidden': 'true' }, h('div', { class: 'eyelid top' }), h('div', { class: 'eyelid bottom' }));
    this.bubbleLayer.append(this.youTag);
    root.append(eyelids, this.hud.el, this.bubbleLayer, this.bannerLayer, this.screenLayer, this.modalLayer, this.toastLayer);
    this.bubbles = new Bubbles(this.bubbleLayer);
    this.meter = new ForceMeter(root);

    onLocaleChange(() => this.refresh());
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    const ro = new ResizeObserver(() => this.reportLayout());
    ro.observe(this.hud.dock);
    ro.observe(this.hud.top);
    ro.observe(root);
  }

  // ───────────── 畫面 ─────────────

  showStart(): void {
    this.screen = 'start';
    this.state = null;
    this.busy = false; // UI 自己負責:不論上一局怎麼結束(結局、播到一半重來),新畫面一定可以操作
    this.meter.reset();
    this.updateYouTag();
    this.clearEnding();
    this.hud.el.hidden = true;
    this.bubbles.clear();
    document.body.classList.remove('eyes-closed', 'in-game');
    this.screenLayer.replaceChildren(
      startScreen({
        onRole: (r) => this.handlers.onStart(r),
        onHelp: () => this.openModal('help'),
        onLocale: (l) => void this.changeLocale(l),
      }),
    );
    this.reportLayout();
  }

  showGoal(state: GameState): Promise<void> {
    this.screen = 'goal';
    this.state = state;
    this.busy = false;
    this.meter.reset();
    this.log = [];
    this.lastNoise = null;
    this.clearEnding();
    this.bubbles.clear();
    this.bubbles.setPlayer(state.playerRole);
    this.hud.el.hidden = true;
    document.body.classList.remove('eyes-closed');
    return new Promise((resolve) => {
      this.goalResolve = resolve;
      this.renderGoal();
    });
  }

  private renderGoal() {
    if (!this.state) return;
    this.screenLayer.replaceChildren(
      goalScreen(this.state, this.settings, {
        onStart: () => {
          this.screenLayer.replaceChildren();
          this.screen = 'game';
          document.body.classList.add('in-game');
          this.hud.el.hidden = false;
          const r = this.goalResolve;
          this.goalResolve = null;
          r?.();
          this.reportLayout();
          this.updateYouTag();
        },
        onHints: (on) => this.updateSettings({ ...this.settings, hints: on }),
      }),
    );
  }

  /** 每次狀態改變時呼叫;events 會加進記錄 */
  render(state: GameState, actions: AvailableAction[], events: GameEvent[]): void {
    this.state = state;
    this.actions = actions;
    const closed = state.chars[state.playerRole].eyes === 'closed';
    for (const ev of events) {
      if (ev.type === 'action' && ev.who === state.playerRole) this.lastNoise = ev.noise;
      this.log.push({ ev, playerRole: state.playerRole, eyesClosed: closed });
    }
    document.body.classList.toggle('eyes-closed', closed);
    this.renderHud();
    this.updateYouTag();
  }

  private renderHud() {
    if (!this.state) return;
    this.hud.render(this.state, this.actions, {
      busy: this.busy,
      hints: this.settings.hints,
      sound: this.settings.sound,
      lastNoise: this.lastNoise,
      log: this.log,
    });
    this.reportLayout();
  }

  setBusy(busy: boolean): void {
    this.busy = busy;
    this.renderHud();
  }

  showEnding(state: GameState): void {
    this.state = state;
    this.screen = 'ending';
    this.meter.cancel();
    this.bannerLayer.replaceChildren(endingBanner(state));
    document.body.classList.add(`ending-${state.ending!.style}`);
    this.endingTimer = window.setTimeout(() => this.renderEndingCard(), 2500);
  }

  private renderEndingCard() {
    if (!this.state?.ending) return;
    this.hud.el.hidden = true;
    this.screenLayer.replaceChildren(
      endingCard(this.state, {
        onAgain: () => this.handlers.onReplay(),
        onChangeRole: () => this.handlers.onRestart(),
      }),
    );
  }

  private clearEnding() {
    clearTimeout(this.endingTimer);
    this.bannerLayer.replaceChildren();
    document.body.classList.remove('ending-wasted', 'ending-passed', 'ending-neutral');
  }

  // ───────────── 對話泡泡 ─────────────

  setBubbleAnchor(fn: (role: Role) => { x: number; y: number } | null): void {
    this.anchor = fn;
    this.bubbles.setAnchor(fn);
  }

  /** 開局前兩回合在玩家角色頭上標「你」,一眼認出自己是哪一個 */
  private updateYouTag() {
    const s = this.state;
    const show = !!s && this.screen === 'game' && s.turn < 2 && !s.ending;
    this.youTag.classList.toggle('show', show);
    if (!show || !s) {
      cancelAnimationFrame(this.youRaf);
      this.youRaf = 0;
      return;
    }
    this.youTag.textContent = `▼ ${m().ui.common.you}`;
    this.youTag.className = `you-tag show ${s.playerRole}`;
    if (this.youRaf) return;
    const tick = () => {
      const st = this.state;
      const p = st ? this.anchor(st.playerRole) : null;
      if (p) this.youTag.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y + 30)}px) translate(-50%, -100%)`;
      this.youTag.style.visibility = p ? '' : 'hidden';
      this.youRaf = requestAnimationFrame(tick);
    };
    this.youRaf = requestAnimationFrame(tick);
  }

  speak(role: Role, text: string, tone: BubbleTone = 'normal'): void {
    this.bubbles.speak(role, text, tone);
  }

  /** speech 事件 → 目前語系的句子 */
  speakEvent(ev: Extract<GameEvent, { type: 'speech' }>): void {
    const text = ev.key ? speechLine(ev.key as keyof ReturnType<typeof m>['game']['speech'], ev.index ?? 0) : ev.text;
    this.speak(ev.who, text, (ev.key && TONE[ev.key]) || 'normal');
  }

  // ───────────── 操作 ─────────────

  private chooseAction(id: ActionId, chargeNow: boolean) {
    const s = this.state;
    if (!s || this.busy || this.screen !== 'game' || this.meter.isOpen) {
      if (this.busy && !this.meter.isOpen) toast(this.toastLayer, m().ui.action.busy, 1200);
      return;
    }
    const def = ACTIONS[id];
    if (!def.usesForce) return this.handlers.onAction(id, 0);
    if (this.settings.autoForce) return this.handlers.onAction(id, greenCenter(s, id));

    const t = m().ui;
    const g = m().game;
    const P = s.playerRole;
    const open = s.chars[P].eyes === 'open';
    const sug = this.settings.hints ? suggestAction(s) : null;
    const T = wakeThreshold(s.chars[partnerOf(P)]);
    const noise = Math.round(projectedNoise(s, P, id));
    const thr = !open ? t.hud.noise.thresholdUnknown : Number.isFinite(T) ? fmt(t.hud.noise.threshold, { t: Math.round(T) }) : t.hud.noise.none;
    this.meter.open(
      {
        emoji: def.emoji,
        label: g.action[id].label,
        window: forceWindow(s, P, id),
        suggested: sug?.actionId === id && sug.force != null ? sug.force : this.settings.hints ? greenCenter(s, id) : undefined,
        info: `${fmt(t.action.noise, { n: noise })} · ${thr}`,
        bandLabels: g.band,
        texts: {
          instruction: t.force.instruction,
          holdButton: t.force.holdButton,
          keyboard: t.force.keyboard,
          tooShort: t.force.tooShort,
          cancel: t.force.cancel,
          suggested: t.force.suggested,
        },
      },
      (force) => this.handlers.onAction(id, force),
      () => undefined,
      chargeNow,
    );
  }

  private toggleEyes() {
    const s = this.state;
    if (!s || this.busy || this.screen !== 'game') return;
    this.handlers.onToggleEyes(s.chars[s.playerRole].eyes === 'open' ? 'closed' : 'open');
  }

  private onKey(e: KeyboardEvent, down: boolean) {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === ' ' || e.code === 'Space') {
      if (this.meter.isOpen) {
        e.preventDefault();
        if (down && !e.repeat) this.meter.press();
        if (!down) this.meter.release();
      }
      return;
    }
    if (!down) return;
    if (e.key === 'Escape') {
      if (this.meter.isOpen) this.meter.cancel();
      else if (this.modal) this.closeModal();
      return;
    }
    if (this.modal || this.meter.isOpen) return;
    const k = e.key.toLowerCase();
    if (k === 'e' && this.screen === 'game') this.toggleEyes();
    else if (k === 'h' || e.key === '?') this.openModal('help');
  }

  // ───────────── 設定 / 說明 / 語言 ─────────────

  private openModal(which: 'help' | 'settings') {
    this.modal = which;
    this.renderModal();
  }

  private closeModal() {
    this.modal = null;
    this.modalLayer.replaceChildren();
  }

  private renderModal() {
    if (!this.modal) return;
    const el =
      this.modal === 'help'
        ? helpScreen(() => this.closeModal())
        : settingsScreen(this.settings, {
            inGame: this.screen === 'game',
            onClose: () => this.closeModal(),
            onChange: (s) => this.updateSettings(s),
            onLocale: (l) => void this.changeLocale(l),
            onRestart: () => {
              this.closeModal();
              this.handlers.onRestart();
            },
          });
    this.modalLayer.replaceChildren(el);
  }

  private updateSettings(s: Settings) {
    this.settings = s;
    saveSettings(s);
    this.handlers.onSettings(s);
    if (this.modal === 'settings') this.renderModal();
    this.renderHud();
  }

  private async changeLocale(l: Locale) {
    try {
      await setLocale(l);
    } catch (err) {
      // 語系檔載入失敗(網路、部署換版):留在目前語系,選單也改回來
      console.warn('locale load failed', err);
      toast(this.toastLayer, m().ui.common.loadError);
      this.refresh();
    }
  }

  /** 語系改變 → 重畫目前畫面 */
  private refresh() {
    if (this.screen === 'start') this.showStart();
    else if (this.screen === 'goal') this.renderGoal();
    else if (this.screen === 'ending') {
      if (this.bannerLayer.firstChild && this.state) this.bannerLayer.replaceChildren(endingBanner(this.state));
      if (this.screenLayer.firstChild) this.renderEndingCard();
    }
    this.renderHud();
    if (this.modal) this.renderModal();
  }

  // ───────────── 版面 ─────────────

  private reportLayout() {
    const rootRect = this.root.getBoundingClientRect();
    if (!rootRect.height) return;
    if (this.hud.el.hidden) return this.emitInsets(0, 0);
    const narrow = rootRect.width < 720;
    // 窄螢幕的狀態卡橫跨上方,也要算進上方遮擋
    const topEls = [this.hud.top, ...Array.from(this.hud.el.querySelectorAll<HTMLElement>(narrow ? '.hintbar, .card' : '.hintbar'))];
    let top = 0;
    for (const el of topEls) if (!el.hidden && el.offsetParent) top = Math.max(top, el.getBoundingClientRect().bottom - rootRect.top);
    const bottom = Math.max(0, rootRect.bottom - this.hud.dock.getBoundingClientRect().top);
    this.emitInsets(Math.round(top), Math.round(bottom));
  }

  /** insets 真的變了才通知場景(HUD 每回合會重畫好幾次) */
  private emitInsets(top: number, bottom: number) {
    const key = `${top}|${bottom}`;
    if (key === this.lastInsets) return;
    this.lastInsets = key;
    this.root.style.setProperty('--inset-top', `${top}px`);
    this.root.style.setProperty('--inset-bottom', `${bottom}px`);
    this.handlers.onLayout({ top, bottom });
  }
}
