# 同床異夢 (Sleep or More) — 設計規格 v1

> 3D 情侶同床模擬小遊戲 MVP。目標平台:Vercel(靜態 Vite build)。
> 技術:Vite + TypeScript + three.js,無 UI 框架;邏輯層純 TS(可測),用 vitest。
> 本文件是實作的唯一規格來源;`src/game/types.ts` 是各模組間的型別契約(已定案,不可改動介面,只能新增)。

## 0. 一句話

你和另一半躺在同一張床上。開局隨機抽到今晚的目標:**好好睡覺** 或 **親熱**。
對方(AI)也有自己的隱藏目標。12 個回合(22:00 → 06:00)內達成目標;
動作太粗魯會吵醒對方、惹火對方,最後被踢下床。棉被會被搶,手臂會麻,姿勢有限制。

## 1. 名詞與數值

| 名詞 | 型別/範圍 | 說明 |
|---|---|---|
| Role | `'male' \| 'female'` | 男方在床的**左側**(x<0),女方在**右側**(x>0)。玩家可選任一方。 |
| Goal | `'sleep' \| 'intimacy'` | 玩家與對方各自獨立隨機抽。玩家目標公開;對方目標**隱藏**,只能從對話推測,結局揭曉。 |
| Posture | `supine` 仰躺 / `sideFacing` 側躺面向對方 / `sideAway` 側躺背對 / `prone` 趴睡 | |
| lateral | -1..1 | 床上橫向位置。男方預設 -0.35、女方 +0.35。`|lateral| >= 1` → 掉下床。 |
| sleep | 0..100 | 睡意/睡眠深度。**<30 清醒、30–69 昏沉、>=70 睡著、100 熟睡**。 |
| mood | 0..100 | 心情。初始 50–70(隨機)。 |
| annoyance | 0..100 | 火氣。對方火氣 >=70 推人、>=100 踢下床。 |
| warmth | 0..100 | 溫暖度,由棉被覆蓋率決定。**<30 = 冷**。初始 60。 |
| blanketOffset | -1..1 | 棉被位置。負 = 偏向男方(左)、正 = 偏向女方(右)。初始 0。 |
| intimacy | 0..100 | 親密度,兩人共享。初始 10。 |
| embrace | boolean | 是否正在擁抱。 |
| armPillow | `{offered, inUse, numbness}` | 男方伸手當枕頭:offered=已伸出、inUse=女方枕上、numbness 0..100 手麻。 |
| turn | 0..12 | 回合。時鐘 = 22:00 + turn×40 分鐘;turn 12 = 06:00。`MAX_TURNS = 12`。 |
| sleepScore | number | 玩家每回合結算:sleep>=70 → +1;30–69 → +0.5。 |

**覆蓋率**:`coverMale = clamp(0.75 - 0.6*offset, 0, 1)`、`coverFemale = clamp(0.75 + 0.6*offset, 0, 1)`。

## 2. 回合流程(`playTurn(state, actionId, force)`)

1. **玩家行動**:`resolveAction(state, playerRole, actionId, force)`。
   - 若玩家 sleep >= 70 且行動不是 `sleep` → 玩家自己醒來:sleep −20(事件 note「你把自己弄醒了」)。
2. **對方行動**:`choosePartnerAction(state)` → `resolveAction(...)`(AI 也走同一套規則,所以 AI 也可能太粗魯把玩家吵醒)。
3. **回合末結算** `endOfTurn(state)`(見 §6)。
4. `turn += 1`,`checkEnding(state)`(見 §7)。
5. 回傳 `{ state, intermediate, events }`;`intermediate` = 步驟 1 後的狀態(給 3D 場景分兩段 tween)。

RNG:每回合用 `mulberry32(seed ^ (turn * 0x9E3779B1))` 建新的亂數器,純函式、可重播、可測。

## 3. 力道(Force)

需要蓄力的動作,玩家按住 → 0..100 蓄力條,放開執行。每個動作有綠區 `forceWindow: [lo, hi]`。

| 區間 | 名稱 | 效果倍率 eff | 噪音倍率 | 額外 |
|---|---|---|---|---|
| force < lo | timid 太輕 | 0.5 | 0.6 | 部分動作等於沒做(例如棉被幾乎沒動) |
| lo..hi | gentle 溫柔 | 1.0 | 1.0 | — |
| hi..hi+25 | firm 用力 | 1.25 | 1.7 | 對方清醒時 annoyance +4 |
| > hi+25 | rough 粗魯 | 1.5 | 2.6 | annoyance +15、親密收益歸零、事件 note「太粗魯了」 |

不需蓄力的動作(`usesForce=false`)一律視為 gentle。

## 4. 噪音與吵醒(對目標 B 檢查)

`N = baseNoise × 噪音倍率`。若 B.sleep >= 30:
- 門檻 `T = 15 + 0.45 × B.sleep`(30→28.5、70→46.5、100→60)
- `N > T` → **吵醒**:`B.sleep = max(0, B.sleep − (N−T)×1.5 − 10)`;`B.annoyance += 8 + (N−T)/2`;`B.mood −= 5`;事件 `wake` + 對話。
- 否則:`B.sleep −= N × 0.15`(輕微干擾,不出事件)。
若 B.sleep < 30(清醒):不吵醒,只有 firm/rough 的 annoyance。

**接受度(receptive)**:B 清醒或昏沉(sleep<70)且 `annoyance < 50` 且 `mood >= 40`。
**想睡的對方**(B.goal='sleep' 且 B.mood < 70):對 affection 類動作額外 annoyance +6、親密收益 ×0.5,對話「我真的要睡了」。mood >= 70 時視為「好吧…」正常接受。

## 5. 動作表

分類:`posture` 姿勢 / `affection` 互動 / `arm` 手臂 / `blanket` 棉被 / `move` 挪動 / `rest` 休息 / `partner` 對方專用。
`roles` 為可用角色;`[]` = 只有 AI 用。噪音 = baseNoise。

| id | 標籤 | emoji | roles | usesForce | window | noise | 需求 | 效果(A=行動者、B=對方) |
|---|---|---|---|---|---|---|---|---|
| lieSupine | 仰躺 | 🛏️ | 男女 | ✓ | [20,60] | 20 | 目前姿勢不同 | 換姿勢。若 embrace 且新姿勢≠sideFacing → embrace=false(B 想親熱且清醒 → B.mood −5)。女方離開 sideFacing/supine → 離開手臂(inUse=false)。男方轉 sideAway/prone → 手臂收回(offered=inUse=false,噪音 +10)。 |
| lieSideFacing | 側躺面向 | 🙂 | 男女 | ✓ | [20,60] | 20 | 同上 | 同上 |
| lieSideAway | 側躺背對 | 🙃 | 男女 | ✓ | [20,60] | 20 | 同上 | 同上;若 B 想親熱且清醒 → B.mood −3 |
| lieProne | 趴睡 | 😴 | 男女 | ✓ | [20,60] | 25 | 同上 | 同上 |
| hug | 擁抱 | 🤗 | 男女 | ✓ | [25,55] | 35 | A=sideFacing;B∈{sideFacing, sideAway};!embrace | B receptive:embrace=true、intimacy +8×eff、B.mood +5、兩人 lateral 拉向中心(男 −0.15、女 +0.15)。B 不 receptive:annoyance +8、對話拒絕。B 睡著:先吵醒判定;沒醒 → embrace=true、intimacy +3、B.sleep −5。 |
| kiss | 親吻 | 💋 | 男女 | ✓ | [20,50] | 30 | A=sideFacing;B∈{sideFacing, supine} | receptive:intimacy +12×eff、B.mood +6。不 receptive:annoyance +10、mood −3。B 睡著:吵醒判定;醒了且 B.goal=intimacy → mood +8、intimacy +6(被親醒很開心);醒了且 B.goal=sleep → annoyance +12。 |
| caress | 愛撫 | 🫳 | 男女 | ✓ | [20,50] | 28 | A=sideFacing;B≠prone | receptive:intimacy +10×eff、B.mood +4。想睡的對方:見 §4。B 睡著:吵醒判定同 kiss。 |
| whisper | 說悄悄話 | 💬 | 男女 | ✗ | — | 15 | B 在 1.0 距離內(永遠成立) | B 清醒/昏沉:mood +6、intimacy +4。B 睡著:吵醒判定。 |
| pat | 拍拍安撫 | 🤲 | 男女 | ✓ | [15,45] | 12 | — | B.annoyance −12、B.sleep +10、B.mood +2;B 想親熱且清醒 → intimacy +2。 |
| offerArm | 伸手當枕頭 | 💪 | 男 | ✓ | [15,50] | 15 | !offered;A∈{supine,sideFacing};B∈{sideFacing,supine} | offered=true。若 B 是 AI 女方:下回合依 AI 規則決定是否枕上。 |
| restOnArm | 枕上手臂 | 😌 | 女 | ✗ | — | 15 | offered && !inUse;A∈{sideFacing,supine} | inUse=true、intimacy +5、男.mood +4、女.lateral 拉向中心到 +0.15、女姿勢強制 sideFacing。 |
| leaveArm | 離開手臂 | 🙂‍↔️ | 女 | ✗ | — | 12 | inUse | inUse=false。 |
| withdrawArm | 收回手臂 | 🤚 | 男 | ✓ | [15,45] | 25(inUse 時 35) | offered | offered=inUse=false。B 正枕著且睡著 → 吵醒判定;B 清醒 → mood −3。numbness 歸 0。 |
| pullBlanket | 拉棉被 | 🧣 | 男女 | ✓ | [35,65] | 30 | — | offset 往 A 方向移 0.3×eff(男:負向)。B 清醒且覆蓋率降到 <0.5 → mood −4、對話;B 睡著 → 吵醒判定,醒了 annoyance 再 +10(冷醒)。 |
| tuckBlanket | 幫對方蓋好 | 🫶 | 男女 | ✓ | [15,50] | 10 | — | offset 往 B 方向移 0.25×eff。B 清醒:mood +5、intimacy +3、對話感謝。 |
| scootIn | 挪近 | ➡️ | 男女 | ✓ | [15,50] | 15 | 兩人距離 > 0.3 | A.lateral 往中心移 0.2×eff。距離 <0.3 時 B receptive → mood +2,否則 annoyance +4。 |
| scootOut | 挪開 | ⬅️ | 男女 | ✓ | [15,50] | 15 | — | A.lateral 往自己那側邊緣移 0.2×eff;embrace=false;若 A 女方 inUse → inUse=false。**可能自己掉下床**。 |
| sleep | 閉眼睡 | 💤 | 男女 | ✗ | — | 0 | — | A.sleep += 18(warmth<30 → ×0.5,對話「好冷」;embrace → +4;A 女方 inUse → +3)。A 已睡著(>=70)→ 改 +12。 |
| push | 推開 | 💢 | [] AI | — | — | 20 | AI 火氣 >=70 | 玩家 lateral 往玩家那側邊緣移 0.35;AI 姿勢 sideAway;AI.annoyance −20(發洩過)。對話警告。 |

姿勢需求不符時:動作失敗,`success=false`,note 說明(例:「對方背對你,親不到」),仍產生 baseNoise×0.5 的噪音。

## 6. 回合末結算 `endOfTurn`

依序對兩人:
1. **溫暖**:`warmth += (cover − 0.5) × 40`,clamp。warmth < 30 → 事件 `cold`;清醒者對話「好冷…」;睡著者 sleep −8(翻來覆去)。
2. **時間流逝**:每人 sleep +4(turn >= 6 再 +2)。embrace 且兩人 sleep >= 30 → 各 +2。
3. **手麻**:inUse → numbness +25。>=75 → 男方 mood −8、對話「手麻了…」。=100 → 男方 annoyance +10,若男方是玩家:玩家 sleep −10(不舒服)。不 inUse → numbness = max(0, numbness − 50)。
4. **衰減**:annoyance −5;mood 向 60 靠攏 2;本回合兩人都沒做 affection → intimacy −3(intimacy < 100 時)。
5. `sleepScore` 結算(玩家)。
6. 每個 clamp 0..100。

## 7. 結局 `checkEnding`(優先序)

| # | 條件 | ending.id | outcome | 標題 / 說明(zh-TW) |
|---|---|---|---|---|
| 1 | 對方 annoyance >= 100 | kickedOff | lose | 「被踢下床」/「你被一腳踹到地板上。晚安。」 |
| 2 | 玩家 `|lateral| >= 1` | fellOff | lose | 「掉下床」/「你自己滾下去了。」 |
| 3 | intimacy >= 100 且兩人 sleep < 70,玩家 goal=intimacy | intimacyWin | win | 「燈熄了」/「兩人相視一笑。今晚不用多說了。」(畫面淡出 + 愛心,**不做任何露骨表現**) |
| 3b | 同上,玩家 goal=sleep | accidentalIntimacy | draw | 「意外的夜晚」/「你本來只想睡覺的……算了,也不錯。」 |
| 4 | 玩家 sleep >= 100,goal=sleep | sleepWin | win | 「睡得像塊石頭」/「你直接昏睡到天亮。」 |
| 4b | 玩家 sleep >= 100,goal=intimacy | intimacyLoseFellAsleep | lose | 「你睡著了」/「說好的今晚呢?你先睡著了。」 |
| 5 | turn >= 12,goal=sleep,sleepScore >= 6 | sleepWin | win | 「一夜好眠」/「06:00,你神清氣爽地醒來。」 |
| 5b | turn >= 12,goal=sleep,sleepScore < 6 | sleepLoseTired | lose | 「黑眼圈」/「天亮了,你根本沒睡到。」 |
| 5c | turn >= 12,goal=intimacy | intimacyLoseMorning | lose | 「天亮了」/「什麼都沒發生。」 |

結局畫面揭露:對方今晚其實想「睡覺/親熱」、回合數、intimacy、sleepScore。

## 8. 對方 AI `choosePartnerAction(state) → {actionId, force}`

P=對方、Y=玩家、r=rng。依序:

```
if P.sleep >= 70:                         # 睡著
    if P.warmth < 30 → pullBlanket, force 70     # 睡著的人搶棉被特別用力
    elif r < 0.15   → lie{隨機姿勢}, force 30
    else            → sleep
elif P.annoyance >= 70 → push
elif P.goal == 'sleep':
    if P.warmth < 40 → pullBlanket 50
    elif P 男方 && armPillow.offered && numbness >= 75 → withdrawArm 40
    elif P 女方 && armPillow.offered && !inUse && P.mood >= 40 && r < 0.5 → restOnArm
    elif Y.lastAction ∈ affection && P.annoyance >= 30 → lieSideAway 30(對話「我真的要睡了」)
    elif Y.sleep < 30 && r < 0.3 → pat 30        # 哄玩家睡
    else → sleep
elif P.goal == 'intimacy':
    if P 女方 && armPillow.offered && !inUse && P.mood >= 40 && P.annoyance < 50 → restOnArm
    elif P.mood >= 50 && P.annoyance < 40 && Y.sleep < 70:
        if P.posture != sideFacing → lieSideFacing 30
        elif Y.posture == sideAway && !embrace → hug 40
        elif Y.posture ∈ {sideFacing, supine}:
            pick: kiss 35% / caress 35% / hug 20%(!embrace,否則改 caress) / whisper 10%
            force: 85% → 40;15% → 75(對方也會粗魯)
        elif P 男方 && !offered → offerArm 35
        else → whisper
    elif Y.sleep >= 70 && P.mood >= 50:
        r < 0.5 → whisper(試著溫柔叫醒) else caress 45
    elif P.mood < 50:
        r < 0.5 → whisper else tuckBlanket 30
    else → sleep
```

對方對話由 `speech.ts` 依事件 key 從 3 句以上的池中隨機挑一句(zh-TW、口語、短)。事件 key 至少涵蓋:
`wake, wakeAngry, coldAwake, refuse, sleepyDecline, receptiveKiss, receptiveHug, receptiveCaress, whisperReply, patReply, numbArm, armAccepted, armOffered, blanketPulled, blanketTucked, roughComplaint, push, kick, intimacyHigh, goodnight, morning, fellOff, partnerInitiate`。

## 9. 3D 場景(three.js)

- 世界座標:床中心在原點;`x = lateral × 1.1`;床頭在 −z,床尾在 +z;床面 y≈0.55。床寬 2.6、長 2.2。
- 房間:地板、地毯、牆、床頭板、兩個枕頭、床頭櫃 + 檯燈(暖色 PointLight)、窗戶(冷色 DirectionalLight 月光)、淡霧。深夜色調。
- 角色:低多邊形「豆豆人」用 primitives 組成(頭 sphere、身體 capsule/rounded box、四肢 capsule 從肩/髖 pivot 旋轉、眼睛小球、髮帽)。男方藍色睡衣、女方粉/薰衣草色睡衣。睡著 → 閉眼;intimacy >= 60 → 臉紅。
- **姿勢 rig**:每個 `Posture` 定義 root 旋轉 + 各肢體局部旋轉。`sideFacing` = 面向對方(男朝 +x、女朝 −x);`sideAway` 相反;`prone` 臉朝下。`embrace` = 兩人 sideFacing 靠近、上手臂搭在對方身上。`armPillow.inUse` = 男方仰躺手臂往 +x 伸、女方頭靠在他肩/臂上。
- 棉被:一片略有起伏的 mesh(PlaneGeometry 頂點加 sin 波),寬約 2.0、覆蓋兩人身體;x 中心 = `blanketOffset × 0.6`;高度略高於身體。
- **Tween**:姿勢 0.8s easeInOut;lateral/棉被 0.6s;燈光 1s。`applyState(state, events)` 只設定目標值,`update(dt)` 每幀插值。
- 特效(由 events 觸發):`Zzz` 文字 sprite 從睡著角色頭上飄起(持續)、`♥` sprite(intimacy 事件)、紅色 `💢` 標記(annoyed/wake)、冷 → 角色微抖(cold)、`push` → 目標角色橫向彈開、`kick`/`fell` → 角色翻滾掉到床下 1.2s、結局 intimacyWin → 燈光轉粉再淡黑 + 愛心上升、sleepWin/morning → 窗外轉亮(日出色)。
- 相機:床尾偏上方的 3/4 視角,看向床頭;閒置時輕微呼吸式擺動;可用滑鼠拖曳小幅環繞(±25°)。RWD:resize 監聽。
- API(`src/scene/Scene.ts`):
  ```ts
  class BedroomScene {
    constructor(container: HTMLElement)
    applyState(state: GameState, events: GameEvent[]): void
    projectHead(role: Role): { x: number; y: number } | null   // canvas 像素座標,給對話泡泡
    playEnding(ending: Ending): void
    dispose(): void
  }
  ```

## 10. UI(純 DOM + CSS,zh-TW)

- **開始畫面**:標題「同床異夢」、副標「Sleep or More」、「我是男方」「我是女方」。
- **目標卡**:「今晚的目標:好好睡覺 / 親熱」+ 一行提示 +「開始」。
- **HUD**:上方時鐘(22:00…)+ 回合 n/12 + 目標徽章。左欄「我」:睡意、溫暖。右欄「對方」:心情、火氣、睡意(對方目標顯示「?」)。中間:親密度 ♥ 條。棉被指示(小圖示偏左/偏右)。
- **動作選單**(下方):依 `listAvailableActions` 顯示;不可用的變灰並顯示原因。每格:emoji + 標籤 + 噪音等級點點(●●○)。
- **力道條**:選了 `usesForce` 的動作 → 顯示「按住蓄力,放開執行」;支援 pointerdown/up 與空白鍵;綠區標示;蓄力速度約 1.2 秒填滿;放開回傳 0..100。取消:Esc 或點選單外。
- **對話泡泡**:用 `scene.projectHead(role)` 定位;超過 2.5 秒淡出。
- **事件記錄**:最近 6 筆文字。
- **結局畫面**:標題、說明、揭露對方目標、統計、「再玩一次」。
- 手機:直式排版可用;按鈕 >= 44px。
- API(`src/ui/UI.ts`):
  ```ts
  class GameUI {
    constructor(root: HTMLElement, handlers: {
      onStart(role: Role): void
      onAction(actionId: ActionId, force: number): void
      onRestart(): void
    })
    showStart(): void
    showGoal(state: GameState): Promise<void>       // 玩家按「開始」後 resolve
    render(state: GameState, actions: AvailableAction[], events: GameEvent[]): void
    speak(role: Role, text: string): void
    setBubbleAnchor(fn: (role: Role) => { x: number; y: number } | null): void
    setBusy(busy: boolean): void                     // 動畫期間鎖住選單
    showEnding(state: GameState): void
  }
  ```

## 11. 檔案配置

```
sleepormore/
  index.html  package.json  tsconfig.json  vite.config.ts  vercel.json  README.md
  docs/DESIGN.md
  src/
    main.ts                 # 組裝:createGame / BedroomScene / GameUI,回合流程與時序
    game/
      types.ts              # 型別契約(已定)
      constants.ts          # MAX_TURNS、門檻、初始值
      rng.ts                # mulberry32
      actions.ts            # ACTIONS 表 + listAvailableActions
      rules.ts              # resolveAction / applyNoise / endOfTurn
      partner.ts            # choosePartnerAction
      speech.ts             # 對話池
      endings.ts            # checkEnding
      turn.ts               # playTurn, createGame
    scene/
      Scene.ts  room.ts  bed.ts  blanket.ts  character.ts  postures.ts  effects.ts  tween.ts
    ui/
      UI.ts  forceMeter.ts  hud.ts  screens.ts  style.css
  tests/
    rules.test.ts  partner.test.ts  endings.test.ts  turn.test.ts  playthrough.test.ts
```

## 12. 測試(vitest,只測 `src/game`)

- force 分段與倍率;噪音/吵醒公式(邊界:N==T 不吵醒)。
- 每個動作的需求檢查與失敗 note;姿勢連動(轉身破壞 embrace / 離開手臂)。
- 棉被覆蓋率 → warmth 變化;冷的效果。
- 手麻累積與歸零。
- 對方 AI 每個分支至少一個測試(固定 seed)。
- 結局優先序(同時滿足多個時取序號小的)。
- **可解性(playthrough)**:
  - 玩家 goal=sleep、對方 goal=sleep:每回合 `sleep` → 12 回合內必定 win。
  - 玩家 goal=intimacy、對方 goal=intimacy:先 lieSideFacing,之後 kiss/caress 交替(force 35)→ 12 回合內 win。
  - 玩家 goal=sleep、對方 goal=intimacy:策略「pat 直到對方 sleep>=70,再 sleep」→ 12 回合內 win(這條若不成立就要調數值,測試要能指出哪個回合卡住)。
  - 每回合 rough(force 100)hug → 在 8 回合內 kickedOff 或 fellOff。

## 13. 內容尺度

成人向但**不露骨**:「親熱」結局只用燈光淡出 + 愛心表現;沒有裸露、沒有露骨動畫或文字。對話保持可愛、生活化。
