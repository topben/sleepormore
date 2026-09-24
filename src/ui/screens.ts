// 全螢幕畫面:開始、目標卡、說明、設定、結局(banner + 卡片)、toast。
import { BAL, MAX_TURNS, SLEEP_WIN_SCORE } from '../game/constants';
import { morningLine } from '../game/endings';
import type { GameState, Role } from '../game/types';
import { partnerOf } from '../game/types';
import { LOCALES, fmt, getLocale, m, speechLine, type Locale } from '../i18n';
import { h } from './dom';
import type { Settings } from './settings';

export function languageSelect(onChange: (l: Locale) => void, cls = ''): HTMLElement {
  const sel = h(
    'select',
    { class: 'lang-select', 'aria-label': m().ui.start.language },
    ...LOCALES.map((l) => h('option', { value: l.id, selected: l.id === getLocale() }, l.name)),
  );
  sel.addEventListener('change', () => onChange(sel.value as Locale));
  return h('label', { class: `lang ${cls}` }, h('span', { 'aria-hidden': 'true', text: '🌐' }), sel);
}

export function startScreen(opts: { onRole(r: Role): void; onHelp(): void; onLocale(l: Locale): void }): HTMLElement {
  const t = m().ui.start;
  const roleBtn = (r: Role) =>
    h(
      'button',
      { class: `role-btn ${r}`, type: 'button', onClick: () => opts.onRole(r) },
      h('span', { class: 'role-emoji', 'aria-hidden': 'true', text: r === 'male' ? '👨' : '👩' }),
      h('span', { class: 'role-main', text: r === 'male' ? t.playMale : t.playFemale }),
      h('span', { class: 'role-sub', text: r === 'male' ? t.sideLeft : t.sideRight }),
    );
  return h(
    'div',
    { class: 'screen start' },
    languageSelect(opts.onLocale, 'corner'),
    h(
      'div',
      { class: 'start-card' },
      h('h1', { class: 'title', text: t.title }),
      h('div', { class: 'subtitle', text: t.subtitle }),
      h('p', { class: 'tagline', text: t.tagline }),
      h('div', { class: 'choose', text: t.chooseRole }),
      h('div', { class: 'roles' }, roleBtn('male'), roleBtn('female')),
      h('button', { class: 'link-btn', type: 'button', onClick: opts.onHelp }, `❓ ${t.howToPlay}`),
      h('p', { class: 'footnote', text: t.footnote }),
    ),
  );
}

export function goalScreen(s: GameState, settings: Settings, opts: { onStart(): void; onHints(on: boolean): void }): HTMLElement {
  const t = m().ui.goal;
  const g = m().game;
  const P = s.playerRole;
  const goal = s.chars[P].goal;
  const info = t[goal];
  const hints = h('input', { type: 'checkbox', checked: settings.hints });
  hints.addEventListener('change', () => opts.onHints(hints.checked));
  const startBtn = h('button', { class: 'primary big', type: 'button', onClick: opts.onStart }, t.start);
  queueMicrotask(() => startBtn.focus());
  return h(
    'div',
    { class: 'screen goal' },
    h(
      'div',
      { class: `goal-card ${goal}` },
      h('div', { class: 'goal-heading', text: t.heading }),
      h('div', { class: 'goal-big' }, h('span', { class: 'goal-big-emoji', 'aria-hidden': 'true', text: goal === 'sleep' ? '😴' : '💞' }), h('span', { text: g.goal[goal] })),
      h('p', { class: 'goal-role', text: fmt(t.youAre, { role: P === 'male' ? m().ui.common.male : m().ui.common.female, side: P === 'male' ? t.left : t.right }) }),
      h('h4', { text: t.winLabel }),
      h('p', { class: 'goal-win', text: fmt(info.win, { n: SLEEP_WIN_SCORE }) }),
      h('h4', { text: t.tipsLabel }),
      h('ul', { class: 'goal-tips' }, ...info.tips.map((tip) => h('li', { text: fmt(tip, { n: BAL.sleepyMood }) }))),
      h('p', { class: 'goal-secret', text: `🤫 ${t.secret}` }),
      h('label', { class: 'check' }, hints, h('span', { text: t.hintsToggle })),
      startBtn,
    ),
  );
}

export function helpScreen(onClose: () => void): HTMLElement {
  const t = m().ui.help;
  const closeBtn = h('button', { class: 'icon-btn close', type: 'button', 'aria-label': m().ui.common.close, onClick: onClose }, '✕');
  queueMicrotask(() => closeBtn.focus());
  return h(
    'div',
    { class: 'screen modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t.title, onClick: (e: Event) => e.target === e.currentTarget && onClose() },
    h(
      'div',
      { class: 'panel help' },
      h('div', { class: 'panel-head' }, h('h2', { text: `❓ ${t.title}` }), closeBtn),
      h(
        'div',
        { class: 'panel-body' },
        ...t.sections.map((sec) => h('section', {}, h('h3', { text: sec.title }), ...sec.body.map((p) => h('p', { text: p })))),
      ),
    ),
  );
}

export function settingsScreen(
  settings: Settings,
  opts: {
    inGame: boolean;
    onClose(): void;
    onChange(s: Settings): void;
    onLocale(l: Locale): void;
    onRestart(): void;
  },
): HTMLElement {
  const t = m().ui.settings;
  const toggle = (key: keyof Settings, label: string) => {
    const input = h('input', { type: 'checkbox', checked: settings[key] });
    input.addEventListener('change', () => opts.onChange({ ...settings, [key]: input.checked }));
    return h('label', { class: 'check' }, input, h('span', { text: label }));
  };
  const closeBtn = h('button', { class: 'icon-btn close', type: 'button', 'aria-label': m().ui.common.close, onClick: opts.onClose }, '✕');
  queueMicrotask(() => closeBtn.focus());
  return h(
    'div',
    { class: 'screen modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t.title, onClick: (e: Event) => e.target === e.currentTarget && opts.onClose() },
    h(
      'div',
      { class: 'panel settings' },
      h('div', { class: 'panel-head' }, h('h2', { text: `⚙️ ${t.title}` }), closeBtn),
      h(
        'div',
        { class: 'panel-body' },
        h('div', { class: 'row' }, h('span', { text: t.language }), languageSelect(opts.onLocale)),
        toggle('sound', t.sound),
        toggle('hints', t.hints),
        toggle('autoForce', t.autoForce),
        opts.inGame
          ? h(
              'button',
              {
                class: 'secondary',
                type: 'button',
                onClick: () => {
                  if (confirm(t.restartConfirm)) opts.onRestart();
                },
              },
              `↺ ${t.restart}`,
            )
          : null,
      ),
    ),
  );
}

export function endingBanner(s: GameState): HTMLElement {
  const e = s.ending!;
  const tx = m().game.ending[e.id];
  return h(
    'div',
    { class: `ending-banner style-${e.style}` },
    h('div', { class: 'banner-band' }, h('div', { class: 'banner-title', text: tx.title }), h('div', { class: 'banner-caption', text: e.caption })),
  );
}

export function endingCard(s: GameState, opts: { onAgain(): void; onChangeRole(): void }): HTMLElement {
  const e = s.ending!;
  const t = m().ui.ending;
  const tx = m().game.ending[e.id];
  const P = s.playerRole;
  const qGoal = s.chars[partnerOf(P)].goal;
  const ml = morningLine(s);
  const again = h('button', { class: 'primary big', type: 'button', onClick: opts.onAgain }, `↺ ${t.again}`);
  queueMicrotask(() => again.focus());
  return h(
    'div',
    { class: 'screen modal ending' },
    h(
      'div',
      { class: `panel ending-card outcome-${e.outcome} style-${e.style}` },
      h('div', { class: 'ending-outcome', text: t.outcome[e.outcome] }),
      h('h2', { class: 'ending-title', text: tx.title }),
      h('div', { class: 'ending-caption', text: e.caption }),
      h('p', { class: 'ending-desc', text: tx.description }),
      h('div', { class: 'ending-reveal' }, h('span', { text: t.partnerWanted }), h('strong', { class: qGoal, text: qGoal === 'sleep' ? t.goalSleep : t.goalIntimacy })),
      h('div', { class: 'ending-morning' }, h('div', { class: 'mini-title', text: `☀️ ${t.morning}` }), h('p', { text: speechLine(ml.key, ml.index) })),
      h(
        'div',
        { class: 'ending-stats' },
        h('span', { text: fmt(t.statTurns, { n: Math.min(s.turn, MAX_TURNS), max: MAX_TURNS }) }),
        h('span', { text: fmt(t.statIntimacy, { n: Math.round(s.intimacy) }) }),
        h('span', { text: fmt(t.statSleep, { n: s.sleepScore }) }),
        h('span', { text: fmt(t.statClues, { n: s.memo.clues.sleep + s.memo.clues.intimacy }) }),
      ),
      h('div', { class: 'ending-tip' }, h('div', { class: 'mini-title', text: `💡 ${t.tip}` }), h('p', { text: fmt(tx.tip, { n: BAL.sleepyMood }) })),
      h('div', { class: 'ending-actions' }, again, h('button', { class: 'secondary', type: 'button', onClick: opts.onChangeRole }, t.changeRole)),
    ),
  );
}

export function toast(layer: HTMLElement, text: string, ms = 2200): void {
  const el = h('div', { class: 'toast', role: 'status', text });
  layer.append(el);
  requestAnimationFrame(() => el.classList.add('in'));
  setTimeout(() => {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 300);
  }, ms);
}
