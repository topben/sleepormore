// 組裝入口:createGame / BedroomScene / GameUI;回合流程與時序(SCENE-RIG §5)。
import { inject } from '@vercel/analytics';
import { listAvailableActions } from './game/actions';
import { randomSeed } from './game/rng';
import { createGame, playTurn, splitPhases, toggleEyes } from './game/turn';
import type { ActionId, Ending, Eyes, GameEvent, GameState, Goal, Role } from './game/types';
import { detectLocale, setLocale } from './i18n';
import { GameUI } from './ui/UI';

/** 場景需要的介面(WebGL 不可用時用空實作,遊戲仍可只靠 HUD 進行) */
interface SceneLike {
  reset(state: GameState): void;
  applyState(state: GameState, events: GameEvent[]): void;
  projectHead(role: Role): { x: number; y: number } | null;
  playEnding(ending: Ending): void;
  setViewInsets(insets: { top: number; bottom: number }): void;
  setMuted(muted: boolean): void;
  unlockAudio(): void;
}

const NULL_SCENE: SceneLike = {
  reset: () => undefined,
  applyState: () => undefined,
  projectHead: () => null,
  playEnding: () => undefined,
  setViewInsets: () => undefined,
  setMuted: () => undefined,
  unlockAudio: () => undefined,
};

const PLAYER_SEGMENT_MS = 1000;
const PARTNER_SEGMENT_MS = 950;
const PREVIEW_SEED = 20260924;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** ?goal=sleep|intimacy:練習指定目標(不指定 = 隨機) */
function practiceGoal(): Goal | undefined {
  const g = new URLSearchParams(location.search).get('goal');
  return g === 'sleep' || g === 'intimacy' ? g : undefined;
}

/** 偵測到的語系載入失敗(網路、部署換版)時退回主程式內建的繁中,頁面不會空白 */
async function initLocale(): Promise<void> {
  try {
    await setLocale(detectLocale());
  } catch (err) {
    console.warn('locale load failed, falling back to zh-TW', err);
    await setLocale('zh-TW');
  }
}

async function createScene(el: HTMLElement): Promise<SceneLike> {
  try {
    const { BedroomScene } = await import('./scene/Scene');
    return new BedroomScene(el);
  } catch (err) {
    console.warn('3D scene unavailable, continuing without it', err);
    el.classList.add('no-webgl');
    return NULL_SCENE;
  }
}

async function boot() {
  const sceneEl = document.getElementById('scene')!;
  const uiEl = document.getElementById('ui')!;
  // 語系檔與 three.js 場景同時下載
  const [, scene] = await Promise.all([initLocale(), createScene(sceneEl)]);

  let state: GameState | null = null;
  let role: Role = 'male';
  let busy = false;
  /** 每開一局 +1;用來中止上一局還在播的回合動畫 */
  let generation = 0;

  const preview = () => createGame('male', PREVIEW_SEED);
  const actionsOf = (s: GameState) => listAvailableActions(s, s.playerRole);

  const ui = new GameUI(uiEl, {
    onStart: (r) => void startGame(r),
    onAction: (id, force) => void doTurn(id, force),
    onToggleEyes: (eyes) => doToggleEyes(eyes),
    onRestart: () => {
      generation++;
      state = null;
      busy = false;
      scene.reset(preview());
      ui.showStart();
    },
    onReplay: () => void startGame(role),
    onSettings: (s) => scene.setMuted(!s.sound),
    onLayout: (insets) => scene.setViewInsets(insets),
  });
  ui.setBubbleAnchor((r) => scene.projectHead(r));
  scene.setMuted(!ui.settings.sound);
  scene.reset(preview());
  ui.showStart();

  async function startGame(r: Role) {
    const gen = ++generation;
    role = r;
    busy = false;
    scene.unlockAudio();
    state = createGame(r, randomSeed(), { playerGoal: practiceGoal() });
    scene.reset(state);
    await ui.showGoal(state);
    if (gen !== generation || !state) return;
    ui.render(state, actionsOf(state), []);
  }

  function doToggleEyes(eyes: Eyes) {
    if (!state || busy || state.ending) return;
    const res = toggleEyes(state, eyes);
    state = res.state;
    scene.applyState(state, res.events);
    ui.render(state, actionsOf(state), res.events);
  }

  function speakAll(events: GameEvent[]) {
    for (const e of events) if (e.type === 'speech') ui.speakEvent(e);
  }

  async function doTurn(id: ActionId, force: number) {
    if (!state || busy || state.ending) return;
    const gen = generation;
    busy = true;
    ui.setBusy(true);
    const res = playTurn(state, id, force);
    const seg = splitPhases(res.events);

    // 1) 玩家的動作(搭 intermediate 狀態)
    scene.applyState(res.intermediate, seg.player);
    ui.render(res.intermediate, actionsOf(res.intermediate), seg.player);
    speakAll(seg.player);
    await wait(PLAYER_SEGMENT_MS);
    if (gen !== generation) return;

    // 2) 對方的動作 + 回合末(玩家行動當下就結束的話沒有這段)
    if (!res.intermediate.ending) {
      const rest = [...seg.partner, ...seg.endOfTurn];
      scene.applyState(res.state, rest);
      ui.render(res.state, actionsOf(res.state), rest);
      speakAll(rest);
      await wait(PARTNER_SEGMENT_MS);
      if (gen !== generation) return;
    }

    state = res.state;
    busy = false;
    if (state.ending) {
      scene.playEnding(state.ending);
      ui.showEnding(state);
    } else {
      ui.setBusy(false);
    }
  }
}

// Vercel Web Analytics:部署在 Vercel 時記錄瀏覽量;開發時只在 console 印出、不送出
inject({ mode: import.meta.env.DEV ? 'development' : 'production' });
void boot();
