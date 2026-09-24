// @vitest-environment happy-dom
// GameUI 整合測試(DOM):換局後一定能操作、失敗的語系切換會退回。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listAvailableActions } from '../src/game/actions';
import { makeEnding } from '../src/game/endings';
import { createGame } from '../src/game/turn';
import { newTally } from '../src/game/titles';
import { loadCollection, recordCombo } from '../src/ui/collection';
import { renderShareCard } from '../src/ui/shareCard';

// 圖卡畫在 canvas 上:happy-dom 沒有 2D canvas,換成假的 PNG(畫圖本身在瀏覽器 E2E 驗證)
vi.mock('../src/ui/shareCard', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/ui/shareCard')>()),
  renderShareCard: vi.fn(async () => new Blob(['png'], { type: 'image/png' })),
}));
import type { GameState } from '../src/game/types';
import { GameUI, type UIHandlers } from '../src/ui/UI';

function mount() {
  const root = document.createElement('div');
  document.body.append(root);
  const handlers: UIHandlers = {
    onStart: vi.fn(),
    onAction: vi.fn(),
    onToggleEyes: vi.fn(),
    onRestart: vi.fn(),
    onReplay: vi.fn(),
    onSettings: vi.fn(),
    onLayout: vi.fn(),
  };
  const ui = new GameUI(root, handlers);
  return { root, ui, handlers };
}

/** 目標卡 → 按「開始」→ 第一次 render(和 main.ts 的 startGame 一樣) */
async function begin(ui: GameUI, root: HTMLElement, s: GameState) {
  const shown = ui.showGoal(s);
  root.querySelector<HTMLButtonElement>('.goal-card .primary')!.click();
  await shown;
  ui.render(s, listAvailableActions(s, s.playerRole), []);
}

const tray = (root: HTMLElement) => root.querySelector('.tray')!;
const eyesBtn = (root: HTMLElement) => root.querySelector<HTMLButtonElement>('.eyes-btn')!;

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
  localStorage.clear();
});

describe('GameUI: a new game is always playable', () => {
  it('after an ending, "Play again" gets a usable tray (busy is reset by the UI)', async () => {
    const { root, ui, handlers } = mount();
    const s = createGame('male', 1);
    await begin(ui, root, s);
    // main.ts:回合開始 setBusy(true);回合以結局收尾時只呼叫 showEnding,不會 setBusy(false)
    ui.setBusy(true);
    ui.showEnding({ ...s, ending: makeEnding('kickedOff') });

    await begin(ui, root, createGame('male', 2));
    expect(tray(root).classList.contains('busy')).toBe(false);
    expect(eyesBtn(root).disabled).toBe(false);
    root.querySelector<HTMLButtonElement>('.act.ok[data-id="lieSideFacing"]')!.click();
    expect(handlers.onAction).toHaveBeenCalledWith('lieSideFacing', 0);
    eyesBtn(root).click();
    expect(handlers.onToggleEyes).toHaveBeenCalledWith('closed');
  });

  it('restarting mid-turn (settings → restart) leaves the next game usable', async () => {
    const { root, ui, handlers } = mount();
    await begin(ui, root, createGame('female', 3));
    ui.setBusy(true); // 回合動畫播到一半
    ui.showStart(); // main.ts onRestart
    await begin(ui, root, createGame('female', 4));
    expect(tray(root).classList.contains('busy')).toBe(false);
    root.querySelector<HTMLButtonElement>('.act.ok[data-id="whisper"]')!.click();
    expect(handlers.onAction).toHaveBeenCalledWith('whisper', 0);
  });

  /** 在動作按鈕上按住 ms 毫秒再放開(假時鐘) */
  async function holdAction(root: HTMLElement, id: string, ms: number) {
    const btn = root.querySelector<HTMLButtonElement>(`.act.ok[data-id="${id}"]`)!;
    btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }));
    vi.advanceTimersByTime(ms);
    window.dispatchEvent(new PointerEvent('pointerup'));
  }
  const fakeClock = () =>
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'requestAnimationFrame', 'cancelAnimationFrame', 'Date'] });

  it('holding a force action sends it after the result is shown (control)', async () => {
    const { root, ui, handlers } = mount();
    await begin(ui, root, createGame('male', 5));
    fakeClock();
    await holdAction(root, 'pullBlanket', 900);
    expect(handlers.onAction).not.toHaveBeenCalled(); // 先顯示「溫柔!」0.65 秒
    vi.advanceTimersByTime(700);
    expect(handlers.onAction).toHaveBeenCalledTimes(1);
    expect(vi.mocked(handlers.onAction).mock.calls[0][0]).toBe('pullBlanket');
  });

  it('a force result still pending when the game is left is never sent into the next game', async () => {
    const { root, ui, handlers } = mount();
    await begin(ui, root, createGame('male', 5));
    fakeClock();
    await holdAction(root, 'pullBlanket', 900);
    ui.showStart(); // 結果顯示的 0.65 秒內就回到開始畫面
    vi.advanceTimersByTime(2000);
    expect(handlers.onAction).not.toHaveBeenCalled();
  });
});

describe('GameUI: language switching', () => {
  const langChoices = (root: HTMLElement) => Array.from(root.querySelectorAll<HTMLButtonElement>('.lang-choice'));

  it('the start screen and the in-game top bar both have a visible language button that opens the picker', async () => {
    const { root, ui } = mount();
    ui.showStart();
    root.querySelector<HTMLButtonElement>('.start-card .lang-btn')!.click();
    expect(langChoices(root).map((b) => b.dataset.locale)).toEqual(['zh-TW', 'zh-CN', 'ja', 'ko', 'vi', 'en', 'es']);
    expect(root.querySelector('.lang-choice.current')!.getAttribute('data-locale')).toBe('zh-TW');
    root.querySelector<HTMLButtonElement>('.lang-panel .close')!.click();
    expect(langChoices(root)).toHaveLength(0);

    await begin(ui, root, createGame('male', 7));
    const tool = root.querySelector<HTMLButtonElement>('.tools .lang-tool')!;
    expect(tool.textContent).toContain('繁中');
    tool.click();
    expect(langChoices(root)).toHaveLength(7);
  });

  it('a locale that fails to load keeps the current language and says so', async () => {
    const { root, ui } = mount();
    ui.showStart();
    const i18n = await import('../src/i18n');
    const spy = vi.spyOn(i18n, 'setLocale').mockRejectedValueOnce(new Error('chunk failed'));
    root.querySelector<HTMLButtonElement>('.start-card .lang-btn')!.click();
    root.querySelector<HTMLButtonElement>('.lang-choice[data-locale="ja"]')!.click();
    await vi.waitFor(() => expect(root.querySelector('.toast')).not.toBeNull());
    expect(root.querySelector('.start-card .lang-btn .lang-name')!.textContent).toBe('繁體中文');
    spy.mockRestore();
  });

  it('picking a language from the in-game button switches the whole UI', async () => {
    const { root, ui } = mount();
    await begin(ui, root, createGame('female', 8));
    root.querySelector<HTMLButtonElement>('.tools .lang-tool')!.click();
    root.querySelector<HTMLButtonElement>('.lang-choice[data-locale="en"]')!.click();
    await vi.waitFor(() => expect(document.documentElement.lang).toBe('en'));
    expect(langChoices(root)).toHaveLength(0); // 選完就關
    expect(root.querySelector('.tools .lang-tool')!.textContent).toContain('EN');
    expect(root.querySelector('.act[data-id="whisper"] .act-label')!.textContent).toBe('Whisper');
    const { setLocale } = await import('../src/i18n');
    await setLocale('zh-TW'); // 還原,避免影響其他測試
  });
});

describe('GameUI: start screen plug', () => {
  it('links to bridgetime.org in a new tab and follows the language', async () => {
    const { root, ui } = mount();
    ui.showStart();
    const plug = () => root.querySelector<HTMLAnchorElement>('.start-card a.plug')!;
    expect(plug().getAttribute('href')).toBe('https://bridgetime.org');
    expect(plug().getAttribute('target')).toBe('_blank');
    expect(plug().getAttribute('rel')).toContain('noopener');
    expect(plug().textContent).toBe('[無情業配]喬個時間睡覺吧bridgetime.org ↗');
    root.querySelector<HTMLButtonElement>('.start-card .lang-btn')!.click();
    root.querySelector<HTMLButtonElement>('.lang-choice[data-locale="en"]')!.click();
    await vi.waitFor(() => expect(plug().textContent).toBe('[Shameless plug]Let’s find a time to sleepbridgetime.org ↗'));
    const { setLocale } = await import('../src/i18n');
    await setLocale('zh-TW'); // 還原,避免影響其他測試
  });
});

describe('GameUI: combo endings (you × partner), collection and sharing', () => {
  /** 玩家(男)一直講悄悄話、對方翻來翻去 → 悄悄話高手 × 翻身陀螺 = 邊聊邊翻身 */
  function endedNight(): GameState {
    const s = createGame('male', 9);
    s.memo.tally = newTally();
    s.memo.tally.male.acts.whisper = 6;
    s.memo.tally.female.turned = 5;
    return { ...s, turn: 12, ending: makeEnding('sleepWin') };
  }
  function finish(ui: GameUI, s: GameState) {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    ui.showEnding(s);
    vi.advanceTimersByTime(2600); // banner → 結局卡
    vi.useRealTimers();
  }

  it('the ending card names tonight’s combo with its rarity, NEW only the first time', () => {
    const { root, ui } = mount();
    const s = endedNight();
    finish(ui, s);
    expect(root.querySelector('.combo-name')!.textContent).toBe('邊聊邊翻身');
    expect(root.querySelector('.combo-pair')!.textContent).toContain('悄悄話高手');
    expect(root.querySelector('.combo-pair')!.textContent).toContain('翻身陀螺');
    expect(root.querySelector('.ending-combo .rarity')).not.toBeNull();
    expect(root.querySelector('.combo-new')).not.toBeNull();

    ui.showStart();
    expect(root.querySelector('.gallery-link')!.textContent).toContain('1/64');
    finish(ui, s);
    expect(root.querySelector('.combo-new')).toBeNull(); // 第二次就不是新的了
  });

  it('the gallery shows the 8 × 8 grid with tonight’s combo unlocked', () => {
    const { root, ui } = mount();
    finish(ui, endedNight());
    root.querySelector<HTMLButtonElement>('.combo-gallery')!.click();
    const cells = root.querySelectorAll('.gallery-cell');
    expect(cells).toHaveLength(64);
    const open = root.querySelectorAll('.gallery-cell.open');
    expect(open).toHaveLength(1);
    expect((open[0] as HTMLElement).dataset.combo).toBe('talker_spinner');
    expect(root.querySelector('.gallery-detail-name')!.textContent).toBe('邊聊邊翻身');
    // 點沒解鎖的格子:只看得到「還沒解鎖」
    root.querySelector<HTMLButtonElement>('.gallery-cell[data-combo="faker_faker"]')!.click();
    expect(root.querySelector('.gallery-detail-name')!.textContent).toContain('還沒解鎖');
  });

  const stubNavigator = (props: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(props)) Object.defineProperty(navigator, k, { configurable: true, value: v });
  };
  afterEach(() => stubNavigator({ share: undefined, canShare: undefined }));

  it('share opens a card preview; phones send the image to the share sheet, and the text can be copied', async () => {
    const { root, ui } = mount();
    finish(ui, endedNight());
    const share = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share, canShare: vi.fn().mockReturnValue(true) });
    root.querySelector<HTMLButtonElement>('.combo-share')!.click();
    expect(root.querySelector('.share-card')).not.toBeNull();
    expect(root.querySelector('.share-card-wait.making')).not.toBeNull(); // 先顯示「製作中」
    await vi.waitFor(() => expect(root.querySelector('.share-card-img')).not.toBeNull());
    expect(vi.mocked(renderShareCard).mock.calls.at(-1)![0].combo.id).toBe('talker_spinner');

    root.querySelector<HTMLButtonElement>('.share-image')!.click();
    expect(share).toHaveBeenCalledTimes(1); // 在點擊當下呼叫(檔案事先準備好)
    const data = share.mock.calls[0][0] as ShareData;
    expect(data.files![0].name).toBe('sleepormore-talker_spinner.png');
    expect(data.text).toContain('邊聊邊翻身');

    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ clipboard: { writeText } });
    root.querySelector<HTMLButtonElement>('.share-copy')!.click();
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText.mock.calls[0][0]).toContain('邊聊邊翻身');
    await vi.waitFor(() => expect(root.querySelector('.toast')).not.toBeNull());
  });

  it('without file sharing (desktop), the card offers a download instead', async () => {
    const { root, ui } = mount();
    finish(ui, endedNight());
    root.querySelector<HTMLButtonElement>('.combo-share')!.click();
    await vi.waitFor(() => expect(root.querySelector('.share-card-img')).not.toBeNull());
    expect(root.querySelector('.share-image')).toBeNull();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    root.querySelector<HTMLButtonElement>('.share-download')!.click();
    expect(click).toHaveBeenCalledTimes(1);
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('sleepormore-talker_spinner.png');
    click.mockRestore();
    root.querySelector<HTMLButtonElement>('.share-card .close')!.click();
    expect(root.querySelector('.share-card')).toBeNull();
  });

  it('if the card cannot be drawn, the text can still be copied', async () => {
    vi.mocked(renderShareCard).mockRejectedValueOnce(new Error('no canvas'));
    const { root, ui } = mount();
    finish(ui, endedNight());
    root.querySelector<HTMLButtonElement>('.combo-share')!.click();
    await vi.waitFor(() => expect(root.querySelector('.share-card-wait.failed')).not.toBeNull());
    expect(root.querySelector('.share-copy')).not.toBeNull();
  });
});

describe('GameUI: hard mode', () => {
  const hardGame = (goal: 'sleep' | 'intimacy', timing?: 'now' | 'morning') =>
    createGame('male', 3, { mode: 'hard', playerGoal: goal, playerTiming: timing, partnerGoal: 'sleep' });

  it('the goal card shows the body-type note with its own class (not the top bar’s .goal-body) and focuses Start without scrolling', async () => {
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    const { root, ui } = mount();
    void ui.showGoal(hardGame('sleep'));
    await Promise.resolve();
    expect(root.querySelector('.goal-card .goal-physique')?.textContent).toContain('🐻');
    expect(root.querySelector('.goal-card .goal-body')).toBeNull();
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    focus.mockRestore();
  });

  it('the top bar rounds intimacy and keeps the 🔥 label word in its own span (phones show only 🔥)', async () => {
    const { root, ui } = mount();
    const s = hardGame('intimacy', 'now');
    s.intimacy = 25.68330670380965;
    await begin(ui, root, s);
    const text = root.querySelector('.goal-text')!.textContent!;
    expect(text).toContain('26/100');
    expect(text).not.toContain('25.68');
    expect(root.querySelector('.goal-text.short')!.textContent).toMatch(/^26\/100 · /);
    expect(root.querySelector('.clock-turn .hard-word')!.textContent).toBe('困難');
  });

  it('the “sleepless” ending tip names the hard-mode sleep target', () => {
    const { root, ui } = mount();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    ui.showEnding({ ...hardGame('sleep'), turn: 12, sleepScore: 4, ending: makeEnding('sleepLoseTired') });
    vi.advanceTimersByTime(2600);
    vi.useRealTimers();
    const tip = root.querySelector('.ending-tip p')!.textContent!;
    expect(tip).toContain('睡眠分數要 5 分');
    expect(tip).not.toContain('{target}');
  });
});

describe('collection storage', () => {
  it('when storage is blocked (private mode), a combo is NEW once per session and the count stays consistent', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(recordCombo('faker_faker')).toBe(true);
    expect(recordCombo('faker_faker')).toBe(false);
    expect(loadCollection().has('faker_faker')).toBe(true);
    spy.mockRestore();
  });
});
