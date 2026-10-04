// 全螢幕畫面:開始、目標卡、說明、設定、結局(banner + 卡片)、toast。
import { BAL, MAX_TURNS } from '../game/constants';
import { ENDING_VARS, morningLine, sleepTarget } from '../game/endings';
import { HARD_TEXT_VARS, hintVars } from '../game/hints';
import { COMBO_IDS, comboRarity, PERSONA_EMOJI, PERSONAS, type Combo, type ComboId, type Persona, type Rarity } from '../game/titles';
import type { CharacterState, GameState, Mode, Role } from '../game/types';
import { partnerOf } from '../game/types';
import { LOCALES, currentLocaleInfo, fmt, getLocale, m, speechLine, type Locale } from '../i18n';
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

/** 明顯的語言按鈕:🌐 + 目前語言(用該語言自己的寫法)*/
export function languageButton(onOpen: () => void, cls = ''): HTMLButtonElement {
  const cur = currentLocaleInfo();
  const label = `${m().ui.settings.language} · Language: ${cur.name}`;
  return h(
    'button',
    { class: `lang-btn ${cls}`, type: 'button', 'aria-haspopup': 'dialog', 'aria-label': label, title: label, onClick: onOpen },
    h('span', { class: 'lang-globe', 'aria-hidden': 'true', text: '🌐' }),
    h('span', { class: 'lang-name', lang: cur.id, text: cur.name }),
    h('span', { class: 'lang-caret', 'aria-hidden': 'true', text: '▾' }),
  );
}

/** 語言選擇:7 個大按鈕,各自用自己的語言寫(看不懂目前語言也找得到自己的) */
export function languagePicker(opts: { onPick(l: Locale): void; onClose(): void }): HTMLElement {
  const t = m().ui;
  const cur = getLocale();
  const closeBtn = h('button', { class: 'icon-btn close', type: 'button', 'aria-label': t.common.close, onClick: opts.onClose }, '✕');
  const choices = LOCALES.map((l) =>
    h(
      'button',
      {
        class: `lang-choice${l.id === cur ? ' current' : ''}`,
        type: 'button',
        lang: l.id,
        'aria-pressed': String(l.id === cur),
        'data-locale': l.id,
        onClick: () => opts.onPick(l.id),
      },
      h('span', { text: l.name }),
      l.id === cur ? h('span', { class: 'lang-check', 'aria-hidden': 'true', text: '✓' }) : null,
    ),
  );
  queueMicrotask(() => choices.find((b) => b.classList.contains('current'))?.focus());
  return h(
    'div',
    {
      class: 'screen modal',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': `${t.settings.language} · Language`,
      onClick: (e: Event) => e.target === e.currentTarget && opts.onClose(),
    },
    h(
      'div',
      { class: 'panel lang-panel' },
      h(
        'div',
        { class: 'panel-head' },
        h('h2', {}, `🌐 ${t.settings.language}`, cur === 'en' ? null : h('span', { class: 'lang-en', text: ' · Language' })),
        closeBtn,
      ),
      h('div', { class: 'panel-body lang-grid' }, ...choices),
    ),
  );
}

/** 作者的另一個產品(開始畫面最下方的業配連結) */
const PLUG_URL = 'https://bridgetime.org';
const PLUG_HOST = 'bridgetime.org';

/** 目標的圖示:困難模式的親熱分 ⏱️ 立即 / 🌅 早上 */
export function goalEmoji(c: CharacterState, mode: Mode | undefined): string {
  if (mode === 'hard' && c.goal === 'intimacy' && c.timing) return c.timing === 'now' ? '⏱️' : '🌅';
  return c.goal === 'sleep' ? '😴' : '💞';
}

/** 目標名稱(困難模式的親熱顯示「立即親熱 / 早上親熱」) */
export function goalName(c: CharacterState, mode: Mode | undefined): string {
  const g = m().game;
  if (mode === 'hard' && c.goal === 'intimacy' && c.timing) return g.timing[c.timing];
  return g.goal[c.goal];
}

export function startScreen(opts: {
  onRole(r: Role): void;
  onHelp(): void;
  onLanguage(): void;
  onGallery(): void;
  onMode(mode: Mode): void;
  mode: Mode;
  collected: number;
}): HTMLElement {
  const t = m().ui.start;
  // 選難度時原地切換(不重畫整個畫面,開場動畫不會重播)
  const modeBtns: HTMLElement[] = [];
  const pickMode = (md: Mode) => {
    for (const b of modeBtns) {
      const on = b.dataset.mode === md;
      b.classList.toggle('selected', on);
      b.setAttribute('aria-pressed', String(on));
    }
    opts.onMode(md);
  };
  const modeBtn = (md: Mode) => {
    const b = h(
      'button',
      { class: `mode-btn ${md}${opts.mode === md ? ' selected' : ''}`, type: 'button', 'data-mode': md, 'aria-pressed': String(opts.mode === md), onClick: () => pickMode(md) },
      h('span', { class: 'mode-name', text: `${md === 'hard' ? '🔥' : '🌙'} ${t.mode[md]}` }),
      h('span', { class: 'mode-hint', text: t.modeHint[md] }),
      h('span', { class: 'mode-check', 'aria-hidden': 'true', text: '✓' }),
    );
    modeBtns.push(b);
    return b;
  };
  const roleBtn = (r: Role) =>
    h(
      'button',
      { class: `role-btn ${r}`, type: 'button', onClick: () => opts.onRole(r) },
      h(
        'span',
        { class: 'role-portrait', 'aria-hidden': 'true' },
        h('img', { class: 'role-art', src: `/characters/anime-${r}.png`, alt: '', 'aria-hidden': 'true', width: 1254, height: 1254, draggable: 'false' }),
      ),
      h(
        'span',
        { class: 'role-caption' },
        h('span', { class: 'role-main', text: r === 'male' ? t.playMale : t.playFemale }),
        h('span', { class: 'role-sub', text: r === 'male' ? t.sideLeft : t.sideRight }),
      ),
      h('span', { class: 'role-arrow', 'aria-hidden': 'true', text: '→' }),
    );
  return h(
    'div',
    { class: 'screen start' },
    h(
      'div',
      { class: 'start-card' },
      h(
        'header',
        { class: 'start-heading' },
        h('div', { class: 'subtitle', text: t.subtitle }),
        h('h1', { class: [...t.title].length > 8 ? 'title long' : 'title', text: t.title }),
        h('p', { class: 'tagline', text: t.tagline }),
      ),
      h(
        'section',
        { class: 'start-difficulty', 'aria-labelledby': 'start-mode-label' },
        h('h2', { class: 'start-label', id: 'start-mode-label', text: t.modeLabel }),
        h('div', { class: 'mode-pick', role: 'group', 'aria-label': t.modeLabel }, modeBtn('easy'), modeBtn('hard')),
      ),
      h(
        'section',
        { class: 'start-characters', 'aria-labelledby': 'start-role-label' },
        h('h2', { class: 'start-label choose', id: 'start-role-label', text: t.chooseRole }),
        h('div', { class: 'roles' }, roleBtn('male'), roleBtn('female')),
      ),
      h(
        'div',
        { class: 'start-links' },
        h('button', { class: 'link-btn', type: 'button', onClick: opts.onHelp }, `❓ ${t.howToPlay}`),
        h('button', { class: 'link-btn gallery-link', type: 'button', onClick: opts.onGallery }, `🏆 ${t.gallery} ${opts.collected}/${COMBO_IDS.length}`),
        languageButton(opts.onLanguage),
      ),
      h('p', { class: 'footnote', text: t.footnote }),
      h(
        'a',
        { class: 'plug', href: PLUG_URL, target: '_blank', rel: 'noopener' },
        h('span', { class: 'plug-tag', text: t.plugTag }),
        h('span', { class: 'plug-text', text: t.plug }),
        h('span', { class: 'plug-url' }, PLUG_HOST, h('span', { 'aria-hidden': 'true', text: ' ↗' })),
      ),
    ),
  );
}

/** 「🏆 ……」這種一行:開頭的圖示自成一欄,折行時文字對齊(文字本身已說明贏 / 輸,圖示不唸) */
function iconLine(text: string): HTMLElement {
  const m = /^(\p{Extended_Pictographic}\uFE0F?)\s+(.*)$/su.exec(text);
  if (!m) return h('li', { text });
  return h('li', {}, h('span', { class: 'line-icon', 'aria-hidden': 'true', text: m[1] }), h('span', { text: m[2] }));
}

export function goalScreen(s: GameState, settings: Settings, opts: { onStart(): void; onHints(on: boolean): void }): HTMLElement {
  const t = m().ui.goal;
  const P = s.playerRole;
  const me = s.chars[P];
  const goal = me.goal;
  const hard = s.mode === 'hard';
  const timing = hard && goal === 'intimacy' ? me.timing : undefined;
  const info = timing ? t[timing] : hard && goal === 'sleep' ? t.sleepHard : t[goal];
  const vars = hintVars(s);
  // win 的 {n} = 睡覺要的睡眠分數;tips 的 {n} = 想睡的對方要的心情
  const winVars = { ...vars, n: sleepTarget(s) };
  // 困難模式:要睡覺的目標(睡覺、早上親熱的夜裡)會用到自己的體質
  const showBody = hard && (goal === 'sleep' || timing === 'morning');
  const hints = h('input', { type: 'checkbox', checked: settings.hints });
  hints.addEventListener('change', () => opts.onHints(hints.checked));
  const startBtn = h('button', { class: 'primary big', type: 'button', onClick: opts.onStart }, t.start);
  // 焦點給「開始」但不捲動:手機上卡片比畫面高,捲到底會看不到自己的目標
  queueMicrotask(() => startBtn.focus({ preventScroll: true }));
  return h(
    'div',
    { class: 'screen goal' },
    h(
      'div',
      { class: `goal-card ${goal}${hard ? ' hard' : ''}` },
      h('div', { class: 'goal-heading' }, h('span', { text: t.heading }), hard ? h('span', { class: 'goal-mode', text: t.hardBadge }) : null),
      h('div', { class: 'goal-big' }, h('span', { class: 'goal-big-emoji', 'aria-hidden': 'true', text: goalEmoji(me, s.mode) }), h('span', { text: goalName(me, s.mode) })),
      h('p', { class: 'goal-role', text: fmt(t.youAre, { role: P === 'male' ? m().ui.common.male : m().ui.common.female, side: P === 'male' ? t.left : t.right }) }),
      h('h4', { text: t.winLabel }),
      // 勝利條件逐條寫清楚:🏆 贏 / 🤝 平手 / 💀 輸 / 💤 怎麼計分
      h('ul', { class: 'goal-win' }, ...info.win.map((line) => iconLine(fmt(line, winVars)))),
      showBody ? h('p', { class: 'goal-physique', text: fmt(t.body[P], vars) }) : null,
      h('h4', { text: t.tipsLabel }),
      h('ul', { class: 'goal-tips' }, ...info.tips.map((tip) => h('li', { text: fmt(tip, vars) }))),
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
        ...t.sections.map((sec) => h('section', {}, h('h3', { text: sec.title }), ...sec.body.map((p) => h('p', { text: fmt(p, HARD_TEXT_VARS) })))),
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

/** 結局卡上的組合資訊(showEnding 時算一次,換語言重畫時沿用) */
export interface ComboView extends Combo {
  rarity: Rarity;
  isNew: boolean;
  /** 圖鑑已收集幾種(含這次) */
  collected: number;
}

const RARITY_STARS: Record<Rarity, string> = { N: '★', R: '★★', SR: '★★★', SSR: '★★★★' };

export function rarityBadge(r: Rarity): HTMLElement {
  return h('span', { class: `rarity rarity-${r}` }, h('span', { class: 'rarity-stars', 'aria-hidden': 'true', text: RARITY_STARS[r] }), ` ${m().ui.ending.rarity[r]}`);
}

export const personaLabel = (p: Persona): string => `${PERSONA_EMOJI[p]} ${m().game.persona[p].name}`;

/** 今晚的組合:你的人格 × 對方的人格 → 組合名稱、稀有度、分享、圖鑑 */
function comboSection(c: ComboView, opts: { onShare(): void; onGallery(): void }): HTMLElement {
  const t = m().ui.ending;
  const tx = m().game.combo[c.id];
  return h(
    'section',
    { class: `ending-combo rarity-box-${c.rarity}` },
    h('div', { class: 'combo-head' }, h('span', { class: 'mini-title', text: `🎲 ${t.comboLabel}` }), rarityBadge(c.rarity), c.isNew ? h('span', { class: 'combo-new', text: t.newCombo }) : null),
    h('div', { class: 'combo-name', text: tx.name }),
    h(
      'div',
      { class: 'combo-pair' },
      h('span', { class: 'combo-chip' }, h('small', { text: m().ui.common.you }), personaLabel(c.me)),
      h('span', { class: 'combo-x', 'aria-hidden': 'true', text: '×' }),
      h('span', { class: 'combo-chip' }, h('small', { text: m().ui.common.partner }), personaLabel(c.partner)),
    ),
    h('p', { class: 'combo-desc', text: tx.desc }),
    h(
      'div',
      { class: 'combo-actions' },
      h('button', { class: 'secondary combo-share', type: 'button', onClick: opts.onShare }, `📤 ${t.share}`),
      h('button', { class: 'secondary combo-gallery', type: 'button', onClick: opts.onGallery }, `🏆 ${fmt(t.collection, { n: c.collected, max: COMBO_IDS.length })}`),
    ),
  );
}

export function endingCard(
  s: GameState,
  opts: { onAgain(): void; onChangeRole(): void; combo: ComboView | null; onShare(): void; onGallery(): void },
): HTMLElement {
  const e = s.ending!;
  const t = m().ui.ending;
  const tx = m().game.ending[e.id];
  const P = s.playerRole;
  const q = s.chars[partnerOf(P)];
  const qGoal = q.goal;
  const hard = s.mode === 'hard';
  const qWanted = hard && q.goal === 'intimacy' && q.timing ? `${goalEmoji(q, s.mode)} ${goalName(q, s.mode)}` : qGoal === 'sleep' ? t.goalSleep : t.goalIntimacy;
  const ml = morningLine(s);
  const again = h('button', { class: 'primary big', type: 'button', onClick: opts.onAgain }, `↺ ${t.again}`);
  // 同上:卡片從結局標題開始看
  queueMicrotask(() => again.focus({ preventScroll: true }));
  return h(
    'div',
    { class: 'screen modal ending' },
    h(
      'div',
      { class: `panel ending-card outcome-${e.outcome} style-${e.style}` },
      h('div', { class: 'ending-outcome' }, h('span', { text: t.outcome[e.outcome] }), hard ? h('span', { class: 'ending-mode', text: t.hardTag }) : null),
      h('h2', { class: 'ending-title', text: tx.title }),
      h('div', { class: 'ending-caption', text: e.caption }),
      h('p', { class: 'ending-desc', text: fmt(tx.description, ENDING_VARS) }),
      opts.combo ? comboSection(opts.combo, opts) : null,
      h('div', { class: 'ending-reveal' }, h('span', { text: t.partnerWanted }), h('strong', { class: qGoal, text: qWanted })),
      h('div', { class: 'ending-morning' }, h('div', { class: 'mini-title', text: `☀️ ${t.morning}` }), h('p', { text: speechLine(ml.key, ml.index) })),
      h(
        'div',
        { class: 'ending-stats' },
        h('span', { text: fmt(t.statTurns, { n: Math.min(s.turn, MAX_TURNS), max: MAX_TURNS }) }),
        h('span', { text: fmt(t.statIntimacy, { n: Math.round(s.intimacy) }) }),
        h('span', { text: fmt(t.statSleep, { n: s.sleepScore }) }),
        h('span', { text: fmt(t.statClues, { n: s.memo.clues.sleep + s.memo.clues.intimacy }) }),
      ),
      h('div', { class: 'ending-tip' }, h('div', { class: 'mini-title', text: `💡 ${t.tip}` }), h('p', { text: fmt(tx.tip, { ...ENDING_VARS, n: BAL.sleepyMood, target: sleepTarget(s) }) })),
      h('div', { class: 'ending-actions' }, again, h('button', { class: 'secondary', type: 'button', onClick: opts.onChangeRole }, t.changeRole)),
    ),
  );
}

/** 組合圖鑑:8 × 8(列 = 你、行 = 對方);點格子看名稱與說明,沒解鎖的只看得到稀有度 */
export function galleryScreen(opts: { unlocked: Set<ComboId>; highlight?: ComboId; onClose(): void }): HTMLElement {
  const t = m().ui.gallery;
  const g = m().game;
  const closeBtn = h('button', { class: 'icon-btn close', type: 'button', 'aria-label': m().ui.common.close, onClick: opts.onClose }, '✕');
  queueMicrotask(() => closeBtn.focus());
  const detail = h('div', { class: 'gallery-detail', 'aria-live': 'polite' });
  const show = (id: ComboId) => {
    const [a, b] = id.split('_') as [Persona, Persona];
    const open = opts.unlocked.has(id);
    detail.replaceChildren(
      h('div', { class: 'gallery-detail-head' }, rarityBadge(comboRarity(id)), h('span', { class: 'gallery-detail-pair', text: `${personaLabel(a)} × ${personaLabel(b)}` })),
      h('div', { class: 'gallery-detail-name', text: open ? g.combo[id].name : `🔒 ${t.locked}` }),
      h('p', { class: 'gallery-detail-desc', text: open ? g.combo[id].desc : t.lockedHint }),
    );
    for (const el of cells) el.classList.toggle('selected', el.dataset.combo === id);
  };
  const cells: HTMLButtonElement[] = [];
  const grid = h('div', { class: 'gallery-grid', role: 'group', 'aria-label': t.axes });
  grid.append(h('span', { class: 'gallery-corner', 'aria-hidden': 'true' }));
  for (const b of PERSONAS) grid.append(h('span', { class: 'gallery-axis col', title: g.persona[b].name, text: PERSONA_EMOJI[b] }));
  for (const a of PERSONAS) {
    grid.append(h('span', { class: 'gallery-axis row', title: g.persona[a].name, text: PERSONA_EMOJI[a] }));
    for (const b of PERSONAS) {
      const id = `${a}_${b}` as ComboId;
      const open = opts.unlocked.has(id);
      const r = comboRarity(id);
      const cell = h(
        'button',
        {
          class: `gallery-cell rarity-cell-${r}${open ? ' open' : ''}${id === opts.highlight ? ' latest' : ''}`,
          type: 'button',
          'data-combo': id,
          'aria-label': open ? `${g.persona[a].name} × ${g.persona[b].name}: ${g.combo[id].name}` : `${g.persona[a].name} × ${g.persona[b].name}: ${t.locked}`,
          onClick: () => show(id),
        },
        open ? '★' : '?',
      );
      cells.push(cell);
      grid.append(cell);
    }
  }
  const legend = h(
    'ul',
    { class: 'gallery-legend' },
    ...PERSONAS.map((p) => h('li', {}, h('span', { 'aria-hidden': 'true', text: PERSONA_EMOJI[p] }), h('strong', { text: g.persona[p].name }), h('small', { text: g.persona[p].desc }))),
  );
  const first = opts.highlight ?? COMBO_IDS.find((id) => opts.unlocked.has(id));
  if (first) show(first);
  else detail.replaceChildren(h('p', { class: 'gallery-detail-desc', text: t.lockedHint }));
  return h(
    'div',
    { class: 'screen modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t.title, onClick: (e: Event) => e.target === e.currentTarget && opts.onClose() },
    h(
      'div',
      { class: 'panel gallery' },
      h('div', { class: 'panel-head' }, h('h2', { text: `🏆 ${t.title}` }), closeBtn),
      h(
        'div',
        { class: 'panel-body' },
        h('div', { class: 'gallery-progress' }, h('strong', { text: fmt(t.progress, { n: opts.unlocked.size, max: COMBO_IDS.length }) }), h('span', { text: t.axes })),
        grid,
        detail,
        legend,
      ),
    ),
  );
}

/** 結局圖卡:預覽 + 分享圖片(手機)/ 下載圖片 / 複製文字 */
export function shareCardScreen(opts: {
  status: 'making' | 'ready' | 'failed';
  imgUrl?: string;
  /** 瀏覽器能直接分享圖片檔(Web Share API Level 2) */
  canShareFile: boolean;
  onShare(): void;
  onDownload(): void;
  onCopy(): void;
  onClose(): void;
}): HTMLElement {
  const t = m().ui.shareCard;
  const closeBtn = h('button', { class: 'icon-btn close', type: 'button', 'aria-label': m().ui.common.close, onClick: opts.onClose }, '✕');
  const ready = opts.status === 'ready' && !!opts.imgUrl;
  const preview = ready
    ? h('img', { class: 'share-card-img', src: opts.imgUrl, alt: t.title, width: 1080, height: 1350 })
    : h('div', { class: `share-card-wait ${opts.status}`, role: 'status', text: opts.status === 'failed' ? t.failed : t.making });
  const shareBtn = ready && opts.canShareFile ? h('button', { class: 'primary share-image', type: 'button', onClick: opts.onShare }, `📤 ${t.share}`) : null;
  const downloadBtn = ready ? h('button', { class: shareBtn ? 'secondary share-download' : 'primary share-download', type: 'button', onClick: opts.onDownload }, `⬇️ ${t.download}`) : null;
  const copyBtn = h('button', { class: 'secondary share-copy', type: 'button', onClick: opts.onCopy }, `🔗 ${t.copy}`);
  queueMicrotask(() => (shareBtn ?? downloadBtn ?? closeBtn).focus());
  return h(
    'div',
    { class: 'screen modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': t.title, onClick: (e: Event) => e.target === e.currentTarget && opts.onClose() },
    h(
      'div',
      { class: 'panel share-card' },
      h('div', { class: 'panel-head' }, h('h2', { text: `📤 ${t.title}` }), closeBtn),
      h(
        'div',
        { class: 'panel-body' },
        h('div', { class: 'share-card-preview' }, preview),
        ready ? h('p', { class: 'share-card-hint', text: t.saveHint }) : null,
        h('div', { class: 'share-card-actions' }, shareBtn, downloadBtn, copyBtn),
      ),
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
