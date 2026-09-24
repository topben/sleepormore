// @vitest-environment happy-dom
// GameUI 整合測試(DOM):換局後一定能操作、失敗的語系切換會退回。
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listAvailableActions } from '../src/game/actions';
import { makeEnding } from '../src/game/endings';
import { createGame } from '../src/game/turn';
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
  it('a locale that fails to load keeps the current language and resets the selector', async () => {
    const { root, ui } = mount();
    ui.showStart();
    const i18n = await import('../src/i18n');
    const spy = vi.spyOn(i18n, 'setLocale').mockRejectedValueOnce(new Error('chunk failed'));
    const sel = root.querySelector<HTMLSelectElement>('.lang-select')!;
    const before = sel.value;
    sel.value = 'ja';
    sel.dispatchEvent(new Event('change'));
    await vi.waitFor(() => expect(root.querySelector('.toast')).not.toBeNull());
    expect(root.querySelector<HTMLSelectElement>('.lang-select')!.value).toBe(before);
    spy.mockRestore();
  });
});
