// 遊戲中 HUD:上方列、建議列、我/對方狀態卡、儀表(親密度/噪音/床位)、閉眼鈕、動作選單、事件記錄。
// 骨架只建一次,之後原地更新數值(讓 CSS 過場動畫生效)。
import { ACTIONS, CATEGORY_ORDER } from '../game/actions';
import { BAL, COMFORT, EDGE_WARN, HARD, MAX_TURNS, SLEEP_ASLEEP, SLEEP_AWAKE, clockLabel } from '../game/constants';
import { HARD_TEXT_VARS, clueLean, goalProgress, hintVars, suggestAction, type Suggestion } from '../game/hints';
import { breathRate, isFakingSleep, noiseRisk, projectedNoise, snoreLevel, wakeThreshold } from '../game/rules';
import type { ActionCategory, ActionId, AvailableAction, CharacterState, GameState, Role } from '../game/types';
import { partnerOf } from '../game/types';
import { currentLocaleInfo, fmt, m } from '../i18n';
import { h } from './dom';
import { describe, type LogItem } from './log';
import { goalEmoji, goalName } from './screens';

const pct = (v: number) => `${Math.max(0, Math.min(100, v))}%`;

class StatRow {
  readonly el: HTMLElement;
  private labelEl = h('span', { class: 'st-label' });
  private fill = h('i', { class: 'st-fill' });
  private valEl = h('span', { class: 'st-val' });
  private tagEl = h('span', { class: 'st-tag' });
  private bar: HTMLElement;
  private markKey = '';

  constructor(icon: string, marks: number[] = [], kind = '') {
    this.bar = h('span', { class: 'st-bar' }, this.fill);
    this.setMarks(marks);
    this.el = h('div', { class: `st ${kind}` }, h('span', { class: 'st-icon', 'aria-hidden': 'true', text: icon }), this.labelEl, this.bar, this.valEl, this.tagEl);
  }

  /** 刻度(困難模式的體溫刻度依體質而不同) */
  setMarks(marks: number[]): void {
    const key = marks.join(',');
    if (key === this.markKey) return;
    this.markKey = key;
    this.bar.replaceChildren(this.fill, ...marks.map((v) => h('b', { class: 'st-mark', style: { left: `${v}%` } })));
  }

  set(label: string, v: number | null, tone = '', tag = ''): this {
    this.labelEl.textContent = label;
    this.el.title = `${label}: ${v == null ? '?' : Math.round(v)}${tag ? ` (${tag})` : ''}`;
    this.el.classList.toggle('unknown', v == null);
    this.fill.style.width = v == null ? '0%' : pct(v);
    this.valEl.textContent = v == null ? '?' : String(Math.round(v));
    this.el.dataset.tone = tone;
    this.tagEl.textContent = tag;
    return this;
  }

  show(on: boolean): void {
    this.el.hidden = !on;
  }
}

class TextRow {
  readonly el: HTMLElement;
  private labelEl = h('span', { class: 'tr-label' });
  private valEl = h('span', { class: 'tr-val' });
  constructor(icon: string) {
    this.el = h('div', { class: 'tr' }, h('span', { class: 'st-icon', 'aria-hidden': 'true', text: icon }), this.labelEl, this.valEl);
  }
  set(label: string, value: string, tone = ''): this {
    this.labelEl.textContent = label;
    this.el.title = `${label}: ${value}`;
    this.valEl.textContent = value;
    this.el.dataset.tone = tone;
    return this;
  }
  show(on: boolean): void {
    this.el.hidden = !on;
  }
}

export interface HudHandlers {
  action(id: ActionId, chargeNow: boolean): void;
  unavailable(reason: string): void;
  toggleEyes(): void;
  help(): void;
  settings(): void;
  language(): void;
  sound(): void;
  hideHints(): void;
}

export interface HudView {
  busy: boolean;
  hints: boolean;
  sound: boolean;
  /** 玩家上一個動作的實際噪音 */
  lastNoise: number | null;
  log: LogItem[];
}


function sleepTag(v: number): string {
  const s = m().ui.hud.sleepState;
  return v >= 100 ? s.deep : v >= SLEEP_ASLEEP ? s.asleep : v >= SLEEP_AWAKE ? s.drowsy : s.awake;
}

function breathText(c: CharacterState, canSeeRegularity: boolean): string {
  const b = m().ui.hud.breath;
  const { rate, regular } = breathRate(c);
  if (canSeeRegularity) {
    if (regular) return b.suspicious;
    return rate >= 16 ? b.fast : rate >= 12 ? b.steady : rate >= 8 ? b.slow : b.deep;
  }
  return rate >= 14 ? b.fast : rate >= 10 ? b.steady : b.slow;
}

export class Hud {
  readonly el: HTMLElement;
  readonly top: HTMLElement;
  readonly dock: HTMLElement;

  // top bar
  private timeEl = h('span', { class: 'clock-time' });
  private turnEl = h('span', { class: 'clock-turn' });
  private dotsEl = h('span', { class: 'turn-dots', 'aria-hidden': 'true' });
  private goalEl = h('div', { class: 'goal-badge' });
  private goalEmoji = h('span', { class: 'goal-emoji' });
  private goalName = h('span', { class: 'goal-name' });
  private goalFill = h('i');
  private goalText = h('span', { class: 'goal-text' });
  private goalShort = h('span', { class: 'goal-text short' });
  private langBtn: HTMLButtonElement;
  private helpBtn: HTMLButtonElement;
  private soundBtn: HTMLButtonElement;
  private gearBtn: HTMLButtonElement;
  // hint
  private hintEl = h('div', { class: 'hintbar', role: 'status', 'aria-live': 'polite' });
  private hintText = h('span', { class: 'hint-text' });
  private hintHide: HTMLButtonElement;
  // cards
  private meCard = h('section', { class: 'card me' });
  private meTitle = h('h3');
  private meSleep = new StatRow('😴', [30, 70], 'sleep');
  private meWarm = new StatRow('🌡️', [30], 'warm');
  private meMood = new StatRow('🙂', [40], 'mood');
  private meRest = new StatRow('🔄', [35, 50], 'restless');
  private meNumb = new StatRow('💪', [75], 'numb');
  private meBreath = new TextRow('🫁');
  private meSnore = new TextRow('💤');
  private qCard = h('section', { class: 'card partner' });
  private qTitle = h('h3');
  private qNote = h('div', { class: 'card-note' });
  private qMood = new StatRow('🙂', [40], 'mood');
  private qAnnoy = new StatRow('💢', [50, 70], 'annoy');
  private qSleep = new StatRow('😴', [30, 70], 'sleep');
  private qEyes = new TextRow('👁️');
  private qBreath = new TextRow('🫁');
  private qSnore = new TextRow('💤');
  private qClue = new TextRow('💭');
  private qGoal = new TextRow('🎯');
  // dock
  private intimFill = h('i');
  private intimVal = h('span', { class: 'm-val' });
  private intimLabel = h('span', { class: 'm-label' });
  private intimNudge = h('span', { class: 'm-nudge' });
  /** 困難模式:你睡得安穩要的親密度 */
  private intimNeed = h('b', { class: 'm-mark need' });
  private intimMeter: HTMLElement;
  private noiseFill = h('i');
  private noiseMark = h('b', { class: 'noise-mark' });
  private noiseLabel = h('span', { class: 'm-label' });
  private noiseText = h('span', { class: 'm-val long' });
  private noiseShort = h('span', { class: 'm-val short' });
  private noiseMeter: HTMLElement;
  private bedLine = h('div', { class: 'bed-line' });
  private bedLabel = h('span', { class: 'm-label' });
  private bedBlanket = h('div', { class: 'bed-blanket' });
  private bedDots: Record<Role, HTMLElement> = {
    male: h('span', { class: 'bed-dot male' }),
    female: h('span', { class: 'bed-dot female' }),
  };
  private eyesBtn: HTMLButtonElement;
  private eyesIcon = h('span', { class: 'eyes-icon', 'aria-hidden': 'true' });
  private eyesMain = h('span', { class: 'eyes-main' });
  private eyesSub = h('span', { class: 'eyes-sub' });
  private tray = h('div', { class: 'tray', role: 'toolbar' });
  // log
  private logEl = h('div', { class: 'log collapsed' });
  private logTitle = h('button', { class: 'log-title', type: 'button' });
  private logList = h('ol', { class: 'log-list', 'aria-live': 'polite' });

  constructor(private hnd: HudHandlers) {
    this.langBtn = h('button', { class: 'icon-btn lang-tool', type: 'button', 'aria-haspopup': 'dialog', onClick: () => hnd.language() });
    this.helpBtn = h('button', { class: 'icon-btn', type: 'button', onClick: () => hnd.help() }, '❓');
    this.soundBtn = h('button', { class: 'icon-btn sound-tool', type: 'button', onClick: () => hnd.sound() }, '🔊');
    this.gearBtn = h('button', { class: 'icon-btn', type: 'button', onClick: () => hnd.settings() }, '⚙️');
    this.hintHide = h('button', { class: 'hint-x', type: 'button', onClick: () => hnd.hideHints() }, '✕');
    this.hintEl.append(h('span', { class: 'hint-icon', 'aria-hidden': 'true', text: '💡' }), this.hintText, this.hintHide);

    this.goalEl.append(
      this.goalEmoji,
      h('span', { class: 'goal-body' }, this.goalName, h('span', { class: 'goal-bar' }, this.goalFill), this.goalText, this.goalShort),
    );
    this.top = h(
      'header',
      { class: 'topbar' },
      h('div', { class: 'clock' }, this.timeEl, h('span', { class: 'clock-sub' }, this.turnEl, this.dotsEl)),
      this.goalEl,
      h('div', { class: 'tools' }, this.langBtn, this.helpBtn, this.soundBtn, this.gearBtn),
    );

    this.meCard.append(this.meTitle, this.meSleep.el, this.meWarm.el, this.meMood.el, this.meRest.el, this.meNumb.el, this.meBreath.el, this.meSnore.el);
    this.qCard.append(this.qTitle, this.qNote, this.qMood.el, this.qAnnoy.el, this.qSleep.el, this.qEyes.el, this.qBreath.el, this.qSnore.el, this.qClue.el, this.qGoal.el);

    this.intimMeter = h(
      'div',
      { class: 'meter intimacy' },
      h('span', { class: 'm-icon', text: '♥' }),
      this.intimLabel,
      h('span', { class: 'm-bar' }, this.intimFill, this.intimNeed),
      this.intimVal,
      this.intimNudge,
    );
    this.noiseMeter = h(
      'div',
      { class: 'meter noise' },
      h('span', { class: 'm-icon', text: '🔊' }),
      this.noiseLabel,
      h('span', { class: 'm-bar' }, this.noiseFill, this.noiseMark),
      this.noiseText,
      this.noiseShort,
    );
    this.bedLine.append(
      h('span', { class: 'bed-edge left' }),
      h('span', { class: 'bed-edge right' }),
      this.bedBlanket,
      this.bedDots.male,
      this.bedDots.female,
    );
    const bedMeter = h('div', { class: 'meter bed' }, h('span', { class: 'm-icon', text: '🛏️' }), this.bedLabel, this.bedLine);

    this.eyesBtn = h(
      'button',
      { class: 'eyes-btn', type: 'button', onClick: () => hnd.toggleEyes() },
      this.eyesIcon,
      h('span', { class: 'eyes-text' }, this.eyesMain, this.eyesSub),
    );

    this.logTitle.addEventListener('click', () => {
      this.logEl.classList.toggle('collapsed');
      this.logList.scrollTop = this.logList.scrollHeight;
    });
    this.logEl.append(this.logTitle, this.logList);
    // 桌機預設展開記錄;手機只顯示最新一行,點標題展開
    if (typeof window !== 'undefined' && window.innerWidth >= 720) this.logEl.classList.remove('collapsed');

    this.dock = h(
      'footer',
      { class: 'dock' },
      this.logEl,
      h('div', { class: 'meters' }, this.intimMeter, this.noiseMeter, bedMeter),
      h('div', { class: 'controls' }, this.eyesBtn, this.tray),
    );

    const cards = h('div', { class: 'cards' }, this.meCard, this.qCard);
    this.el = h('div', { class: 'hud' }, h('div', { class: 'hud-top' }, this.top, this.hintEl, cards), this.dock);
  }

  render(s: GameState, actions: AvailableAction[], view: HudView): void {
    const t = m().ui;
    const g = m().game;
    const P = s.playerRole;
    const Q = partnerOf(P);
    const me = s.chars[P];
    const q = s.chars[Q];
    const open = me.eyes === 'open';

    this.el.classList.toggle('busy', view.busy);
    this.el.classList.toggle('eyes-closed', !open);
    this.el.dataset.player = P;

    // ── 上方列 ──
    const hard = s.mode === 'hard';
    this.timeEl.textContent = clockLabel(s.turn);
    this.turnEl.textContent = fmt(t.hud.turn, { n: Math.min(s.turn + 1, MAX_TURNS), max: MAX_TURNS }) + (hard ? ` · 🔥${t.hud.hardTag}` : '');
    this.dotsEl.replaceChildren(...Array.from({ length: MAX_TURNS }, (_, i) => h('i', { class: i < s.turn ? 'done' : i === s.turn ? 'now' : '' })));
    const prog = goalProgress(s);
    this.goalEl.className = `goal-badge ${prog.goal} status-${prog.status}${hard ? ' hard' : ''}`;
    this.goalEmoji.textContent = goalEmoji(me, s.mode);
    const name = goalName(me, s.mode);
    this.goalName.textContent = name;
    this.goalFill.style.width = pct((prog.value / prog.target) * 100);
    this.goalText.textContent = `${fmt(t.hud.progress[prog.kind], { ...HARD_TEXT_VARS, v: prog.value, t: prog.target })} · ${t.hud.status[prog.status]}`;
    this.goalShort.textContent = `${prog.value}/${prog.target} · ${t.hud.status[prog.status]}`;
    this.goalEl.title = `${name} — ${this.goalText.textContent}`;
    const loc = currentLocaleInfo();
    this.langBtn.replaceChildren(h('span', { 'aria-hidden': 'true', text: '🌐' }), h('span', { class: 'lang-short', lang: loc.id, text: loc.short }));
    this.langBtn.title = `${t.settings.language} · Language: ${loc.name}`;
    this.langBtn.setAttribute('aria-label', this.langBtn.title);
    this.helpBtn.title = t.hud.help;
    this.helpBtn.setAttribute('aria-label', t.hud.help);
    this.soundBtn.textContent = view.sound ? '🔊' : '🔇';
    this.soundBtn.title = `${t.hud.sound}: ${view.sound ? t.common.on : t.common.off}`;
    this.soundBtn.setAttribute('aria-label', this.soundBtn.title);
    this.gearBtn.title = t.hud.settings;
    this.gearBtn.setAttribute('aria-label', t.hud.settings);

    // ── 建議 ──
    const sug: Suggestion | null = view.hints ? suggestAction(s) : null;
    this.hintEl.hidden = !sug;
    if (sug) {
      this.hintText.textContent = fmt(g.hint[sug.key], hintVars(s));
      this.hintEl.classList.toggle('urgent', !!sug.urgent);
      this.hintHide.title = t.hud.hideHints;
      this.hintHide.setAttribute('aria-label', t.hud.hideHints);
    }

    // ── 我 ──
    const side = (r: Role) => (r === 'male' ? 'left' : 'right');
    this.meCard.className = `card me ${side(P)} ${P}`;
    this.meTitle.textContent = `${t.hud.me} · ${P === 'male' ? t.common.male : t.common.female}`;
    const st = t.hud.stat;
    this.meSleep.set(st.sleep, me.sleep, 'sleep', sleepTag(me.sleep));
    if (hard) {
      // 困難模式:刻度 = 你的體質舒服的範圍(垂耳兔沒有上限)
      const body = COMFORT[P];
      this.meWarm.setMarks(body.warmHi < 100 ? [body.warmLo, body.warmHi] : [body.warmLo]);
      const cold = me.warmth < body.warmLo;
      const hot = me.warmth > body.warmHi;
      const edge = me.warmth < body.warmLo + 8 || me.warmth > body.warmHi - 8;
      this.meWarm.set(st.warmth, me.warmth, cold || hot ? 'danger' : edge ? 'warn' : 'ok', cold ? t.hud.cold : hot ? t.hud.hot : '');
    } else {
      this.meWarm.setMarks([30]);
      this.meWarm.set(st.warmth, me.warmth, me.warmth < 30 ? 'danger' : me.warmth < 45 ? 'warn' : 'ok', me.warmth < 30 ? t.hud.cold : '');
    }
    this.meMood.set(st.mood, me.mood, me.mood < 40 ? 'warn' : 'ok');
    this.meRest.set(
      st.restless,
      me.restless,
      me.restless >= 50 ? 'danger' : me.restless >= 35 ? 'warn' : '',
      me.restless >= 50 ? t.hud.restlessDanger : me.restless >= 35 ? t.hud.restlessWarn : '',
    );
    const showNumb = P === 'male' && (s.armPillow.offered || s.armPillow.numbness > 0);
    this.meNumb.show(showNumb);
    if (showNumb) this.meNumb.set(st.numb, s.armPillow.numbness, s.armPillow.numbness >= 75 ? 'danger' : 'warn');
    this.meBreath.set(st.breath, breathText(me, true), isFakingSleep(me) ? 'warn' : '');
    const mySnore = snoreLevel(me);
    this.meSnore.show(mySnore > 0);
    if (mySnore > 0) this.meSnore.set(st.snore, t.hud.snoreLevel[mySnore], 'warn');

    // ── 對方 ──
    this.qCard.className = `card partner ${side(Q)} ${Q} ${open ? '' : 'blind'}`;
    this.qTitle.textContent = `${t.hud.partner} · ${Q === 'male' ? t.common.male : t.common.female}`;
    this.qNote.hidden = open;
    this.qNote.textContent = t.hud.closedNote;
    for (const row of [this.qMood, this.qAnnoy, this.qSleep]) row.show(open);
    this.qEyes.show(open);
    if (open) {
      this.qMood.set(st.mood, q.mood, q.mood < 40 ? 'warn' : q.mood >= BAL.sleepyMood ? 'love' : 'ok');
      this.qAnnoy.set(
        st.annoyance,
        q.annoyance,
        q.annoyance >= 70 ? 'danger' : q.annoyance >= 50 ? 'warn' : '',
        q.annoyance >= 70 ? t.hud.annoyPush : q.annoyance >= 50 ? t.hud.annoyHigh : '',
      );
      this.qSleep.set(st.sleep, q.sleep, 'sleep', sleepTag(q.sleep));
      this.qEyes.set(st.eyes, t.hud.eyesState[q.eyes]);
    }
    this.qBreath.set(st.breath, breathText(q, open), open && breathRate(q).regular ? 'warn' : '');
    const qSnore = snoreLevel(q);
    this.qSnore.show(qSnore > 0);
    if (qSnore > 0) this.qSnore.set(st.snore, t.hud.snoreLevel[qSnore], qSnore >= 2 ? 'warn' : '');
    const lean = clueLean(s);
    const clues = s.memo.clues;
    const clueCount = fmt(t.hud.clue.count, { s: clues.sleep, i: clues.intimacy });
    this.qClue.set(
      t.hud.clue.label,
      lean ? `${lean === 'sleep' ? t.hud.clue.sleep : t.hud.clue.intimacy} (${clueCount})` : t.hud.clue.none,
      lean === 'sleep' ? 'sleep' : lean === 'intimacy' ? 'love' : '',
    );
    this.qGoal.set(st.goal, `? (${t.hud.hidden})`);

    // ── 儀表 ──
    this.intimLabel.textContent = t.hud.intimacy;
    this.intimFill.style.width = pct(s.intimacy);
    this.intimVal.textContent = String(Math.round(s.intimacy));
    // 困難模式:刻度 = 你睡得安穩要的親密度;低於它時條子變色
    const need = COMFORT[P].intimacy;
    this.intimNeed.hidden = !hard;
    if (hard) {
      this.intimNeed.style.left = pct(need);
      this.intimNeed.title = fmt(t.hud.need, { n: need });
    }
    this.intimMeter.classList.toggle('lonely', hard && s.intimacy < need);
    // 早上親熱的夜裡親密度滿了反而是「太早」,不要催
    const tooEarly = hard && me.timing === 'morning' && s.turn < HARD.morningTurn - 1;
    const nudge = open && s.intimacy >= 90 && q.sleep < SLEEP_ASLEEP && me.goal === 'intimacy' && !tooEarly;
    this.intimNudge.textContent = nudge ? t.hud.intimacyNudge : '';
    this.intimMeter.classList.toggle('nudge', nudge);

    this.noiseLabel.textContent = t.hud.noise.label;
    const T = wakeThreshold(q);
    const N = view.lastNoise;
    this.noiseFill.style.width = N == null ? '0%' : pct(N);
    const showT = open && Number.isFinite(T);
    this.noiseMark.hidden = !showT;
    if (showT) this.noiseMark.style.left = pct(T);
    const lastTxt = N == null ? '—' : fmt(t.hud.noise.last, { n: Math.round(N) });
    const thrTxt = !open ? t.hud.noise.thresholdUnknown : Number.isFinite(T) ? fmt(t.hud.noise.threshold, { t: Math.round(T) }) : t.hud.noise.none;
    this.noiseText.textContent = `${lastTxt} · ${thrTxt}`;
    this.noiseShort.textContent = `${N == null ? '—' : Math.round(N)} / ${showT ? Math.round(T) : open ? '∞' : '?'}`;
    this.noiseMeter.title = this.noiseText.textContent;
    this.noiseMeter.classList.toggle('over', showT && N != null && N > T);

    this.bedLabel.textContent = t.hud.bed.label;
    const toPct = (lat: number) => `${((lat + 1) / 2) * 100}%`;
    for (const r of ['male', 'female'] as Role[]) {
      const d = this.bedDots[r];
      d.style.left = toPct(s.chars[r].lateral);
      d.classList.toggle('me', r === P);
      d.dataset.label = r === P ? t.common.you : '';
    }
    const edge = `${((1 - EDGE_WARN) / 2) * 100}%`;
    this.bedLine.style.setProperty('--edge', edge);
    const bx = s.blanketOffset * 0.9;
    this.bedBlanket.hidden = !open;
    this.bedBlanket.style.left = toPct(Math.max(-1, (bx - 0.9) / 1.1));
    this.bedBlanket.style.right = `${100 - parseFloat(toPct(Math.min(1, (bx + 0.9) / 1.1)))}%`;
    this.bedBlanket.title = t.hud.bed.blanket;
    this.bedLine.title = open ? t.hud.bed.blanket : t.hud.bed.blanketHidden;

    // ── 閉眼鈕 ──
    const e = t.hud.eyes;
    this.eyesBtn.className = `eyes-btn ${me.eyes}${sug?.eyes ? ' suggested' : ''}`;
    this.eyesIcon.textContent = open ? '👀' : '😌';
    this.eyesMain.textContent = `${open ? e.open : e.closed} · ${open ? e.toClose : e.toOpen}`;
    this.eyesSub.textContent = open ? e.openInfo : e.closedInfo;
    this.eyesBtn.disabled = view.busy;
    this.eyesBtn.setAttribute('aria-pressed', String(!open));

    // ── 動作選單 ──
    this.renderTray(s, actions, sug, view.busy);

    // ── 記錄 ──
    this.renderLog(view.log);
  }

  private renderTray(s: GameState, actions: AvailableAction[], sug: Suggestion | null, busy: boolean) {
    const t = m().ui;
    const g = m().game;
    const P = s.playerRole;
    const open = s.chars[P].eyes === 'open';
    const byCat = new Map<ActionCategory, AvailableAction[]>();
    for (const a of actions) byCat.set(a.def.category, [...(byCat.get(a.def.category) ?? []), a]);
    // 按鈕很少,每次重建(噪音顏色取決於對方當下的睡意);保留鍵盤焦點
    const focusedId = (document.activeElement as HTMLElement | null)?.closest?.('.act')?.getAttribute('data-id');
    const groups: HTMLElement[] = [];
    for (const cat of CATEGORY_ORDER) {
      const list = byCat.get(cat);
      if (!list?.length) continue;
      groups.push(
        h(
          'div',
          { class: `group cat-${cat}` },
          h('div', { class: 'group-title', text: t.action.category[cat] }),
          h('div', { class: 'group-btns' }, ...list.map((a) => this.actionButton(s, a, sug, open))),
        ),
      );
    }
    this.tray.replaceChildren(...groups);
    this.tray.classList.toggle('busy', busy);
    this.tray.setAttribute('aria-label', g.goal[s.chars[P].goal]);
    if (focusedId) this.tray.querySelector<HTMLElement>(`.act[data-id="${focusedId}"]`)?.focus();
  }

  private actionButton(s: GameState, a: AvailableAction, sug: Suggestion | null, open: boolean): HTMLElement {
    const t = m().ui;
    const g = m().game;
    const P = s.playerRole;
    const id = a.def.id;
    const label = g.action[id].label;
    const base = ACTIONS[id].baseNoise;
    const dots = base < 15 ? '●○○' : base < 28 ? '●●○' : '●●●';
    const risk = a.ok && open ? noiseRisk(s, P, id) : 'none';
    const suggested = sug?.actionId === id && a.ok;
    const reason = a.reasonKey ? (g.msg as Record<string, string>)[a.reasonKey] ?? a.reason ?? '' : a.reason ?? '';
    const noiseN = Math.round(projectedNoise(s, P, id));
    const tip = a.ok
      ? `${g.action[id].hint}\n${fmt(t.action.noise, { n: noiseN })}${risk !== 'none' ? ` · ${t.action.risk[risk]}` : ''}`
      : fmt(t.action.unavailable, { reason });
    const cls = ['act', a.ok ? 'ok' : 'no', `risk-${risk}`, a.def.usesForce ? 'holdable' : '', suggested ? 'suggested' : ''].join(' ');
    const btn = h(
      'button',
      {
        class: cls,
        type: 'button',
        title: tip,
        'aria-label': `${label}. ${tip}`,
        'aria-disabled': a.ok ? null : 'true',
        'data-id': id,
        onContextmenu: (e: Event) => e.preventDefault(),
      },
      h('span', { class: 'act-emoji', 'aria-hidden': 'true', text: a.def.emoji }),
      h('span', { class: 'act-label', text: label }),
      h(
        'span',
        { class: 'act-meta', 'aria-hidden': 'true' },
        h('span', { class: 'act-dots', text: dots }),
        a.def.usesForce ? h('span', { class: 'act-hold', text: t.action.hold }) : null,
      ),
      suggested ? h('span', { class: 'act-badge', text: t.action.suggested }) : null,
    );
    if (!a.ok) {
      btn.addEventListener('click', () => this.hnd.unavailable(reason));
    } else if (a.def.usesForce) {
      btn.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        this.hnd.action(id, true);
      });
      btn.addEventListener('click', () => this.hnd.action(id, false)); // 鍵盤 Enter/空白鍵
    } else {
      btn.addEventListener('click', () => this.hnd.action(id, false));
    }
    return btn;
  }

  private renderLog(items: LogItem[]) {
    const t = m().ui.hud;
    // 先截尾再翻譯:只描述最近的事件(有些事件不顯示,所以多取一些)
    const lines = items
      .slice(-150)
      .map((it) => describe(it))
      .filter((x): x is NonNullable<typeof x> => !!x)
      .slice(-60);
    this.logTitle.textContent = `📜 ${t.log}`;
    this.logList.replaceChildren(
      ...(lines.length ? lines.map((l) => h('li', { class: `tone-${l.tone}`, text: l.text })) : [h('li', { class: 'empty', text: t.logEmpty })]),
    );
    this.logList.scrollTop = this.logList.scrollHeight;
  }
}
