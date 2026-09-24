# 同床異夢 (Sleep or More) — 設計規格 v2

> 3D 情侶同床模擬小遊戲 MVP。平台:Vercel(靜態 Vite build)。技術:Vite + TypeScript + three.js,無 UI 框架;邏輯層純 TS(vitest)。
> 本文件是實作的唯一規格;`src/game/types.ts` 是三個模組(game / scene / ui)的型別契約,只能新增、不可改既有欄位語意。3D 細節見 `docs/SCENE-RIG.md`。
> v2 = v1 經四個 critic(數值模擬 200 局/策略、three.js rig、規格歧義、玩法)審查後的整合版。所有數字都有理由;調整請跑 §12 的勝率測試。

## 0. 一句話

你和另一半躺在同一張床上。開局隨機抽到今晚的目標:**好好睡覺** 或 **親熱**。對方(AI)也有自己的隱藏目標。
12 個回合(22:00 → 06:00)內達成目標。太粗魯會吵醒對方、惹火對方,最後被踢下床(GTA「WASTED」式);棉被會被搶到冷醒;手臂被枕著會麻;翻身太多會被發現你根本沒睡;仰躺打呼會吵到對方。
睡覺玩家的核心決策:睡著後任何非 sleep 動作都會把自己弄醒(§2.1)—— 被搶棉被時你要選「起來拉回(醒)」還是「硬撐(冷)」。親熱玩家的核心決策:對方想睡時,先把心情養到 70 讓他「好吧…就一下下」,還要趕在他睡著前。

## 1. 名詞、數值、初始值

| 名詞 | 型別/範圍 | 說明 | 初始 |
|---|---|---|---|
| Role | `'male' \| 'female'` | 男方在床**左側**(x<0),女方**右側**。玩家可選任一方。 | — |
| Goal | `'sleep' \| 'intimacy'` | 兩人各自獨立隨機抽。玩家目標公開;對方目標**隱藏**,只能從對話/夢話推測,結局揭曉。 | `mulberry32(seed)` 依序抽 male.goal、female.goal、male.mood、female.mood |
| Posture | `supine` 仰躺 / `sideFacing` 側躺面向對方 / `sideAway` 側躺背對 / `prone` 趴睡 | 決定能做什麼、打呼多大聲 | `supine`(兩人) |
| lateral | −1..1 | 橫向位置。**玩家** `\|lateral\| >= 1` → 掉下床;AI 永遠 clamp 在 ±0.9。移動不可跨中心:male ≤ −0.1、female ≥ +0.1。 | 男 −0.35、女 +0.35 |
| distance | 衍生 | `female.lateral − male.lateral`。affection 動作要 ≤ 0.75 才搆得到。 | 0.7 |
| sleep | 0..100 | 睡意/睡眠深度。**<30 醒著、30–69 昏沉、>=70 睡著、100 熟睡**。 | 0(兩人) |
| mood | 0..100 | 心情 | `50 + floor(r×21)`(50–70) |
| annoyance | 0..100 | 火氣。對方 70–99 推人、>=100 踢下床。 | 0 |
| warmth | 0..100 | 溫暖度,由棉被覆蓋率決定。**<30 = 冷** | 60 |
| restless | 0..100 | 翻身指數。>=50 且對方沒睡著 → 被察覺「你根本沒睡」(§6.5) | 0 |
| blanketOffset | −1..1 | 棉被位置。負 = 偏男方(左)、正 = 偏女方(右) | 0 |
| intimacy | 0..100 | 親密度,共享 | 10 |
| embrace | boolean | 擁抱中 | false |
| armPillow | `{offered, inUse, numbness}` | 男方伸手當枕頭 / 女方枕上 / 手麻 0..100 | `{false,false,0}` |
| turn | 0..12 | 時鐘 = 22:00 + turn×40 分;turn 12 = 06:00;`MAX_TURNS = 12`;HUD 顯示 `${turn+1}/12` | 0 |
| sleepScore | number | 玩家每回合末:sleep>=70 → +1;30–69 → +0.5 | 0 |
| lastAction | ActionId \| null | 該角色上一個嘗試的動作(不看 success) | null |

| eyes | `'open' \| 'closed'` | 閉眼/張眼模式(§1.1)。玩家隨時免費切換;AI 的 eyes = `sleep >= 70 || lastAction === 'sleep'` ? closed : open(resolveAction 改變時發 `eyes` 事件) | `open`(兩人) |

**覆蓋率**:`coverMale = clamp(0.75 − 0.6×offset, 0, 1)`、`coverFemale = clamp(0.75 + 0.6×offset, 0, 1)`。

### 1.1 閉眼模式 vs 張眼模式(各有好處與風險)

| | 閉眼 `closed` | 張眼 `open` |
|---|---|---|
| 睡意 | `sleep` 動作可用(+18);§6 時間流逝 +6 | `sleep` **不可用**(reason「先閉上眼睛」);時間流逝 +0(turn>=6 才 +2 的疲勞) |
| 對方怎麼看你 | 可能被當成睡著(`apparentlyAsleep` 需要 closed) | 一律視為醒著:想親熱的對方會主動;想睡的對方若醒著(sleep<30)且你 sideFacing 面對他 → 每回合 annoyance +2、對話 `stare`「你幹嘛一直看我」(每 3 回合最多一次) |
| 資訊 | **看不到對方**:HUD 對方欄的心情/火氣/睡意/門檻/眼睛全部「?」,只剩「聽到的」:呼吸聲(慢/平穩/急促,由對方 `breathRate` 推得)、打呼、對話;棉被位置也看不到,只有自己的溫暖度 | 全部可見,包括對方眼睛開/閉、呼吸是否等幅(裝睡)、棉被位置、吵醒門檻 T |
| 動作 | kiss/hug **不可用**(reason「閉著眼親不到 / 抱不準」);其他蓄力動作噪音 +5(笨手笨腳);pullBlanket 綠區縮成 [40,60] | 全部可用、綠區正常 |
| 翻身指數 | 衰減 −20 | 衰減 −15 |
| 切換代價 | closed→open 時若 sleep >= 70 → sleep −20、note「你把自己弄醒了」(事件 `eyes` + action note) | open→closed 免費 |

3D:閉眼時畫面變暗(brightness 0.45)+ 上下眼皮遮罩 + 輕微模糊;對方角色的眼睛開/閉在 3D 上永遠照實畫(張眼玩家看得到,閉眼玩家畫面太暗看不清)。

**用語**:規則文字中的「清醒 / 未睡著」= `sleep < 70`;「醒著」= `sleep < 30`。只有 §4 噪音門檻與 §8 AI 的 `< 30` 用嚴格語意。

**衍生純函式**(`rules.ts` 匯出,scene/UI 也用):
- `breathRate(c)`(次/分):sleep<30 → 16;30–69 → 12;70–99 → 8;100 → 6。**裝睡**(`lastAction==='sleep' && sleep<30`)→ 14 且 `regular=true`(完全等幅);其餘 `regular=false`。回傳 `{ rate, regular }`。
- `snoreLevel(c)`:sleep<70 → 0;prone → 0;supine → sleep>=90 ? 3 : 2;side* → 1。
- `apparentlyAsleep(c)`:`c.eyes === 'closed' && (c.sleep >= 70 || c.lastAction === 'sleep') && c.restless < 50`。AI 只看表象,不看數值。
- `wakeThreshold(c)`:`c.sleep >= 45 ? 15 + 0.45 × c.sleep : Infinity`(§4 的 T;HUD 噪音計用)。
- `projectedNoise(state, actor, actionId)`:該動作以 gentle 執行時的 N(含狀態加成與閉眼 +5),UI 用來標示按鈕綠/黃/紅。
- `receptive(c)`:`c.sleep < 70 && c.annoyance < 50 && c.mood >= 40`。
- `sleepyDecline(c)`:`c.goal === 'sleep' && c.mood < 70`(想睡的對方對 affection:annoyance +6、收益 ×0.5、對話 sleepyDecline;mood >= 70 則正常接受)。

## 2. 回合流程 `playTurn(state, actionId, force): TurnResult`

`state.ending` 非 null → 直接回傳 `{ state, intermediate: state, events: [] }`。

**閉眼/張眼切換** `toggleEyes(state, eyes): { state, events }`(不是回合動作,不推進 turn;UI 的切換鈕呼叫):設定玩家 eyes、發 `eyes` 事件;closed→open 且玩家 sleep >= 70 → sleep −20、事件 note「你把自己弄醒了」。同一回合可切換多次,以選動作當下的模式為準。

1. `events.push({type:'phase', phase:'player'})`。**自己弄醒**(只套用玩家):玩家 sleep>=70 且 actionId≠sleep → 先扣 sleep(posture/affection/move/arm 類 −20;blanket 類 −10),note 依類別:affection/arm/blanket「你揉揉眼睛撐著」、其他「你把自己弄醒了」。然後 `resolveAction(state, playerRole, actionId, force, rng)`。玩家 eyes 保持玩家設定;AI 的 eyes 在其 resolveAction 後依 §1 規則重算。
2. **即時結局檢查**:`checkEnding` 只看 #1 kickedOff、#2 fellOff。命中 → 推 `kick`/`fell` 事件 + `ending` 事件,寫入 `state.ending`,`intermediate = state`,turn 不加,回傳。
3. `events.push({type:'phase', phase:'partner'})`。`choosePartnerAction(state, rng)` → `resolveAction(...)`(AI 走同一套規則;AI 睡著時的翻身/搶棉被不觸發自己弄醒)。
4. `events.push({type:'phase', phase:'endOfTurn'})`,`endOfTurn(state, rng)`(§6)。
5. `turn += 1`;`events.push({type:'turnEnd', turn})`;`checkEnding` 全表(§7);命中 → kick/fell(若適用)+ ending 事件。
6. 回傳 `{ state, intermediate, events }`。`intermediate` = 步驟 1 之後的狀態。

**RNG**:每回合 `mulberry32((seed ^ Math.imul(turn, 0x9E3779B1)) >>> 0)`;呼叫順序固定:玩家 resolve(含挑對話)→ choosePartnerAction → AI resolve(含挑對話)→ endOfTurn。`createGame(role, seed)` 用 `mulberry32(seed)` 抽 goal/mood。

**Clamp**:resolveAction 每次改動 sleep/mood/annoyance/warmth/intimacy/restless 後立即 clamp 0..100;lateral、blanketOffset clamp [−1, 1](AI lateral ±0.9)。§6 末再 clamp 一次保險。

## 3. 力道(Force)

只有「eff 或噪音會改變結果」的動作才蓄力:**hug / kiss / caress / pat / pullBlanket / tuckBlanket / scootIn / scootOut / withdrawArm**(9 個)。其餘 `usesForce=false`,一律視為 gentle、`force=0`。

| 區間(綠區 [lo,hi]) | band | eff | 噪音倍率 | 額外 |
|---|---|---|---|---|
| f < lo | timid | 0.5 | 0.6 | — |
| lo ≤ f ≤ hi | gentle | 1.0 | 1.0 | — |
| hi < f ≤ hi+25 | firm | 1.25 | 1.7 | B.sleep<70 時 B.annoyance +4 |
| f > hi+25 | rough | 1.5 | 2.6 | B.annoyance +15(一律);**該動作所有正面效果取消**(intimacy、mood+、embrace 成立、restOnArm…),只留負面;note「太粗魯了」 |

eff 只套用在 §5 表中明寫 `×eff` 的數值。band 的 annoyance 與 §4 吵醒的 annoyance 疊加。

## 4. 噪音與吵醒

`N = effectiveNoise(state, action) × 噪音倍率`;`effectiveNoise = ActionDef.baseNoise + 狀態加成`(§5 註明;UI 只顯示靜態 baseNoise)。

對目標 B:
- **B.sleep >= 45**:門檻 `T = 15 + 0.45 × B.sleep`。`N > T` → **吵醒**:`B.sleep = max(0, B.sleep − (N−T)×1.5 − 10)`;`B.annoyance += 8 + (N−T)/2`;`B.mood −= 5`;事件 `wake {who:B, by:A}` + 對話(醒後 annoyance<50 → `wake`,>=50 → `wakeAngry`;由 pullBlanket 造成 → `coldAwake`)。否則 `B.sleep −= N×0.15`(無事件)。
- **30 ≤ B.sleep < 45**:只有輕微干擾 `B.sleep −= N×0.15`(剛開始昏沉的人,溫柔的親吻不算吵醒)。
- **B.sleep < 30**:不吵醒,只有 band 的 annoyance。

設計意圖(測試依據):gentle 永遠吵不醒 >=70;firm 只在 70–80 有機會;熟睡(100,T=60)只有 rough 吵得醒。

**噪音是看得見的參數**:每個 `action` 事件帶實際 `noise: N`;HUD「噪音計」顯示上一動作的 N 與對方目前 `wakeThreshold`(張眼時才看得到 T;閉眼時只顯示 N 與「?」);動作按鈕依 `projectedNoise` 對 T 上色:綠 = N < T×0.8、黃 = 0.8T ≤ N ≤ T、紅 = N > T(對方未達 45 睡意 → 一律綠)。閉眼模式下蓄力動作的狀態加成 +5(§1.1)。

**結算順序**(B 昏沉時兩個分支都可能適用):(1) 依**噪音前**的 B.sleep 決定走「睡著分支」(>=70)還是「未睡著分支」(receptive/sleepyDecline 用噪音前的值判);(2) 套 band annoyance;(3) 套噪音/吵醒;(4) 套分支效果。睡著分支中的「醒了」= 步驟 3 發了 wake。

## 5. 動作表

category:`posture` = lie×4;`affection` = hug/kiss/caress/whisper;`arm` = offerArm/restOnArm/leaveArm/withdrawArm;`blanket` = pullBlanket/tuckBlanket;`move` = scootIn/scootOut;`rest` = sleep/pat(**pat 不是 affection**);`partner` = push。
`roles`:`[]` = 只有 AI 用(玩家選單不列出)。`listAvailableActions(state, actor)` 只回傳 roles 含 actor 的動作,並逐一呼叫 `available` 填 ok/reason。

**失敗動作**(需求不符或 available=false 被 AI 誤選):`success=false`、note 說明、`N = baseNoise × 0.5 × 噪音倍率` 照走 §4、band annoyance 照加(粗魯地撲空一樣惹人)、`lastAction` 照設、算作「本回合嘗試過該類動作」。

| id | 標籤 | emoji | cat | roles | force | window | noise | 需求(available) | 效果(A=行動者、B=對方) |
|---|---|---|---|---|---|---|---|---|---|
| lieSupine | 仰躺 | 🛏️ | posture | 男女 | ✗ | — | 20 | 目前姿勢≠supine | 換姿勢(§5.1)。 |
| lieSideFacing | 側躺面向 | 🙂 | posture | 男女 | ✗ | — | 20 | ≠sideFacing | 同上。 |
| lieSideAway | 側躺背對 | 🙃 | posture | 男女 | ✗ | — | 20 | ≠sideAway | 同上;B 想親熱且 sleep<70 → B.mood −3。 |
| lieProne | 趴睡 | 😴 | posture | **[] AI** | ✗ | — | 25 | ≠prone | 同上。 |
| hug | 擁抱 | 🤗 | affection | 男女 | ✓ | [25,55] | 35 | A.eyes=open(reason「閉著眼抱不準」);A=sideFacing;B∈{sideFacing,sideAway};!embrace(reason「已經抱著了」);distance ≤ 0.75 | 未睡著分支:receptive → embrace=true、intimacy +8×eff、B.mood +5、B.sleep −5、`male.lateral=max(male.lateral,−0.15)`、`female.lateral=min(female.lateral,+0.15)`、對話 receptiveHug;sleepyDecline 套 §1;不 receptive → annoyance +8、對話 refuseMood/refuseAnnoyed。睡著分支:沒醒 → embrace=true、intimacy +3、B.sleep −5、note「偷偷抱住了」;醒了且 B.goal=intimacy → embrace=true、intimacy +6、mood +8、lateral 收攏;醒了且 B.goal=sleep → annoyance +12、embrace 不成立。 |
| kiss | 親吻 | 💋 | affection | 男女 | ✓ | [20,50] | 30 | A.eyes=open(reason「閉著眼親不到」);A=sideFacing;B∈{sideFacing,supine};distance ≤ 0.75 | 未睡著:receptive → intimacy +12×eff、B.mood +6、B.sleep −5、對話 receptiveKiss(timid 時 note「癢」);sleepyDecline;不 receptive → annoyance +10、mood −3、對話 refuse*。睡著:沒醒 → intimacy +2、B.sleep −5、note「偷偷親了一下」;醒了且 goal=intimacy → mood +8、intimacy +6;醒了且 goal=sleep → annoyance +12。 |
| caress | 愛撫 | 🫳 | affection | 男女 | ✓ | [20,50] | 28 | A=sideFacing;distance ≤ 0.75(B 任何姿勢,摸背也算) | 未睡著:receptive → intimacy +10×eff、B.mood +4、B.sleep −5、對話 receptiveCaress;sleepyDecline;不 receptive → annoyance +8、mood −2、對話 refuse*。睡著:沒醒 → intimacy +2、B.sleep −5、note「輕輕摸了摸」;醒了 → 同 kiss。 |
| whisper | 說悄悄話 | 💬 | affection | 男女 | ✗ | — | 15 | — | 未睡著:receptive → mood +6、intimacy +4、對話 whisperReply;不 receptive → annoyance +3、對話 refuse*。睡著:只走吵醒判定。 |
| pat | 拍拍安撫 | 🤲 | rest | 男女 | ✓ | [15,45] | 12 | — | B.annoyance −12×eff、B.sleep +6×eff、B.mood +2;B 想親熱且 sleep<70 → intimacy +2、對話 patReply。**B 睡著且 snoreLevel(B) >= 2 → B.posture 改為 sideFacing/sideAway(r<0.5 擇一),不吵醒,note「拍一下就翻身不打呼了」**。rough → 走 §4 吵醒判定(噪音 31)、annoyance +15、對話「你是在打我嗎」。 |
| offerArm | 伸手當枕頭 | 💪 | arm | 男 | ✗ | — | 15 | !offered;A∈{supine,sideFacing};B∈{sideFacing,supine} | offered=true、對話 armOffered。 |
| restOnArm | 枕上手臂 | 😌 | arm | 女 | ✗ | — | 15 | offered && !inUse;A∈{sideFacing,supine} | inUse=true、intimacy +5、male.mood +4、`female.lateral=min(female.lateral,+0.15)`、女姿勢設 sideFacing(只在實際改變時發 posture 事件)、restless +15、對話 armAccepted。 |
| leaveArm | 離開手臂 | 🙂‍↔️ | arm | 女 | ✗ | — | 12 | inUse | inUse=false、restless +15;numbness >= 50 → male.mood +3、male.annoyance −5、對話 armRelieved。 |
| withdrawArm | 收回手臂 | 🤚 | arm | 男 | ✓ | [15,45] | 25(inUse +10) | offered | timid → success=false、note「手被壓著抽不出來」(噪音 ×0.6、numbness 繼續累積);gentle/firm/rough → offered=inUse=false、numbness=0;inUse 時:B 睡著 → 吵醒判定;B 未睡著 → mood −3。 |
| pullBlanket | 拉棉被 | 🧣 | blanket | 男女 | ✓ | [35,65] | 30 | 男:offset > −1;女:offset < 1(否則 reason「棉被已經都在你這邊了」) | offset 往 A 移 0.3×eff(男:負向)。移動後 coverB < 0.5 時:B 未睡著 → mood −4、對話 blanketPulled;B 被吵醒 → annoyance 再 +10(冷醒)。restless +10。 |
| tuckBlanket | 幫對方蓋好 | 🫶 | blanket | 男女 | ✓ | [15,50] | 10 | offset 未到 B 側極限 | offset 往 B 移 0.25×eff;實際改變 >= 0.05 且 B 未睡著 → B.mood +5、intimacy +3、對話 blanketTucked。 |
| scootIn | 挪近 | ➡️ | move | 男女 | ✓ | [15,50] | 15 | distance > 0.3 | A.lateral 往中心移 0.2×eff(不跨中心)。移動後 distance < 0.3:receptive → B.mood +2;否則 annoyance +4。restless +20。 |
| scootOut | 挪開 | ⬅️ | move | 男女 | ✓ | [15,50] | 15 | — | A.lateral 往自己那側移 0.2×eff;embrace=false;A 女方 inUse → inUse=false。移動後 `\|lateral\| >= 0.65` → note「你已經在床沿了」。restless +20。**玩家可能因此掉下床(fellOff)**。 |
| sleep | 閉眼睡 | 💤 | rest | 男女 | ✗ | — | 0 | A.eyes=closed(reason「先閉上眼睛」) | A.sleep += 18(A 已 >=70 → +12)。修正:warmth<30 → ×0.5、note「好冷」;A.mood<40 → ×0.75、note「心情不好睡不著」;A 男方 inUse → ×0.75、note「手臂壓著,睡不好」;embrace → +4;numbness>=75 且 A 男方 → 上限 +8。 |
| push | 推開 | 💢 | partner | [] AI | — | — | 20 | AI 70 ≤ annoyance < 100 | Y.lateral 往 Y 那側移 0.35;AI posture=sideAway;embrace=false、inUse=false(Y 男方 → offered=false);AI.annoyance −20;對話 push;事件 push。推完 `\|Y.lateral\| >= 1` → 由 playTurn 判 **kickedOff**(kick 事件,不是 fell)。 |

### 5.1 姿勢變更(所有 lie*)
- restless +35;A.sleep >= 30 → A.sleep −8(翻來翻去)。
- embrace 且新姿勢≠sideFacing → embrace=false(B 想親熱且 sleep<70 → B.mood −5)。embrace 只要求**主動方** sideFacing:被抱的人 sideAway(湯匙式)也算擁抱中;被抱者轉成 sideFacing 保持擁抱(刻意的不對稱)。
- 女方 inUse 且新姿勢∉{sideFacing,supine} → inUse=false(噪音 +5)。
- 男方 offered 且新姿勢∈{sideAway,prone} → offered=inUse=false、numbness=0(噪音 +10)。

### 5.2 手臂被枕著(男方 `inUse`)—— 身體上的限制
| 男方動作 | inUse 時 |
|---|---|
| lieSideAway / scootOut | **不可用**,reason「手臂被她枕著,得先收回手臂」 |
| lieSupine ↔ lieSideFacing | 可用(小幅調整),噪音 +5 |
| pullBlanket | 可用,eff ×0.6、note「只剩一隻手,拉不太動」 |
| hug / caress / kiss / whisper / pat / tuckBlanket | 可用(另一隻手) |
| withdrawArm | 唯一的脫身法 |

女方 inUse:lieSideAway/scootOut 自動離開手臂(§5.1)。

## 6. 回合末結算 `endOfTurn(state, rng)`

依序:
1. **溫暖**:每人 `warmth += (cover − 0.55) × 80`(offset 0 → +16;0.6 → −12.8;0.9 → −27)。warmth<30 → 事件 `cold`(每回合);對話 coldAwake 只在本回合從 >=30 跨到 <30 且未睡著時發一次;睡著者 sleep −8(翻來覆去)。
2. **時間流逝**:每人 eyes=closed → sleep +6;eyes=open → +0;turn >= 6 再 +2(不分模式)。embrace 且兩人 sleep >= 30 → 各 +2。
2b. **盯著看**:玩家 eyes=open 且 posture=sideFacing,對方 goal=sleep 且 sleep<30 → 對方 annoyance +2、對話 stare(每 3 回合最多一次)。
3. **打呼**(身體朝向的後果):每人 `L = snoreLevel(X)`;L >= 1 → 事件 `snore {who:X, level:L}`;噪音 `L=1:6、2:16、3:30` 對另一人 Y 走 §4(可把 45–69 的昏沉者吵回去);Y 醒著(sleep<30)且 L >= 2 → Y.annoyance += L×2,對話 snore(每 3 回合最多一次)。
4. **手麻**:inUse → numbness +25;每回合 inUse 時 intimacy +2、female.sleep +3、female.mood +2。numbness >= 75 → male.mood −8、事件 `numb`、對話 numbArm(首次);numbness >= 100 → 另加 male.annoyance +10、male.sleep −6(每回合重複)。不 inUse → numbness = max(0, numbness − 50)。
5. **察覺**:對 A ∈ [玩家, 對方],B = 另一人,B.sleep < 70 時:
   - `A.restless >= 50` → 事件 `noticed {who:A, by:B}`、A.restless = 20;B.goal=intimacy → B.mood +5、對話 noticedIntimacy「你也還沒睡?」;B.goal=sleep → B.annoyance +6、對話 noticedSleep「不要一直翻來翻去啦」。
   - 否則 **呼吸線索**:A 裝睡(`lastAction==='sleep' && sleep<30`)且 `r < 0.25` → 同樣發 noticed,對話 breathTell「你呼吸太規律了,你沒睡吧」。
6. **衰減**:annoyance −5;mood 向 60 靠攏 2;本回合兩人都沒**嘗試** affection → intimacy −3(intimacy<100 時);restless −15(eyes=closed 者 −20)。
7. `sleepScore`(玩家)。
8. clamp。事件策略:動作造成的非零 annoyed/mood/intimacy delta 才發事件(每動作、每角色合併一筆);endOfTurn 只發 cold/snore/numb/noticed/speech。

## 7. 結局 `checkEnding(state, phase: 'mid' | 'end')`(優先序)

| # | 條件 | id | outcome | style | title / caption / description |
|---|---|---|---|---|---|
| 1 | 對方 annoyance >= 100 | kickedOff | lose | wasted | 被踢下床 / KICKED OUT / 你被一腳踹到地板上。晚安。 |
| 2 | 玩家 `\|lateral\| >= 1` 且非 push 造成 | fellOff | lose | wasted | 掉下床 / FELL OFF / 沒人碰你,你自己滾下去了。 |
| 3 | intimacy >= 100 且**對方** sleep < 70,玩家 goal=intimacy | intimacyWin | win | passed | 燈熄了 / LIGHTS OUT / 兩人相視一笑。今晚不用多說了。(燈光轉粉 → 淡黑 + 愛心,**不露骨**) |
| 3b | 同上,玩家 goal=sleep | accidentalIntimacy | draw | neutral | 意外的夜晚 / PLOT TWIST / 你本來只想睡覺的……算了,也不錯。 |
| 4 | turn >= 12,goal=sleep,sleepScore >= 7 | sleepWin | win | passed | 一夜好眠 / SWEET DREAMS / 06:00,你神清氣爽地醒來。 |
| 4b | turn >= 12,goal=sleep,sleepScore < 7 | sleepLoseTired | lose | wasted | 黑眼圈 / SLEEPLESS / 天亮了,你根本沒睡到。 |
| 5 | turn >= 12,goal=intimacy,玩家 sleep >= 70 | intimacyLoseFellAsleep | lose | wasted | 你睡著了 / OUT COLD / 說好的今晚呢?你先睡著了。 |
| 5b | turn >= 12,goal=intimacy | intimacyLoseMorning | lose | wasted | 天亮了 / TOO LATE / 什麼都沒發生。鬧鐘響了。 |

- `phase='mid'`(§2 步驟 2)只檢查 #1、#2。**沒有**「sleep 到 100 就提前結束」:夜晚一定跑到 06:00,睡著的玩家還是要面對搶棉被/打呼/被撩。
- intimacy 達 100 但對方 sleep >= 70:intimacy clamp 100、note「對方已經睡著了……」、對話 tooLate;之後任何把對方弄到 sleep<70 的回合都會在下次檢查時判 #3。
- `Ending` 由 `endings.ts` 完整產生;結局畫面再揭露對方目標 + 依 (playerGoal, partnerGoal) 分池的 `morning` 台詞。

## 8. 對方 AI `choosePartnerAction(state, rng) → { actionId, force }`

P=對方、Y=玩家、r=rng。**必須回傳 available()==ok 的動作**;保底 `sleep`。AI 只用 `apparentlyAsleep(Y)` 判斷玩家睡了沒。

```
if turn == 0:                                     # 開場:不暴露目標
    → (r < 0.5 ? lieSideFacing : lieSupine,若已是則另一個) + 對話 goodnight_{P.goal}
if P.sleep >= 70:                                 # 睡著(無意識,不自醒)
    if P.warmth < 30 → pullBlanket 70
    elif r < 0.25   → pullBlanket 55(note「對方在睡夢中把棉被捲走了」;連續第二次 → note「對方把自己捲成春捲了」)
    elif r < 0.35   → lie{從 ≠目前姿勢的三個中隨機} (force 0)
    elif r < 0.45   → sleep + 對話 sleepTalk_{P.goal}(噪音 8,對 Y 走 §4)
    else            → sleep
elif 70 <= P.annoyance < 100 → push
elif P 男方 && armPillow.offered && numbness >= 75 → withdrawArm 40        # 兩種 goal 共用
elif P.goal == 'sleep':
    if P.warmth < 55 → pullBlanket 50
    elif P 女方 && offered && !inUse && P.mood >= 40 && P.posture ∈ {sideFacing,supine} && r < 0.5 → restOnArm
    elif Y.lastAction ∈ affection && P.annoyance >= 30 && P.posture != sideAway → lieSideAway(對話 sleepyDecline)
    elif P.mood >= 70 && intimacy >= 55 && P.annoyance < 40 && !apparentlyAsleep(Y)      # 「好吧…就一下下」
         → P.posture != sideFacing ? lieSideFacing : (r < 0.5 ? kiss : caress) 40(對話 okFine)
    elif Y.lastAction ∈ {whisper, tuckBlanket, offerArm, pat} && P.mood >= 60 && P.annoyance < 30 && r < 0.6 → whisper(回話)
    elif !apparentlyAsleep(Y) && snoreLevel(Y) >= 2 && r < 0.6 → pat 30     # 拍他翻身別打呼
    elif !apparentlyAsleep(Y) && r < 0.3 → pat 30                            # 哄玩家睡
    else → sleep(首次 → 對話 goodnight)
elif P.goal == 'intimacy':
    if P 女方 && offered && !inUse && P.mood >= 40 && P.annoyance < 50 && P.posture ∈ {sideFacing,supine} → restOnArm
    elif P.mood >= 50 && P.annoyance < 40 && !apparentlyAsleep(Y):
        if P.posture != sideFacing → lieSideFacing
        elif distance > 0.75 → scootIn 40(對話 partnerInitiate「不要躲啦」)
        elif P 男方 && !offered && Y.posture ∈ {sideFacing,supine} && r < 0.3 → offerArm
        elif Y.posture == sideAway && !embrace → hug 40
        elif Y.posture ∈ {sideFacing, supine}:
            pick: kiss 35% / caress 35% / hug 20%(embrace 或 Y=supine 時改 caress)/ whisper 10%
            force: 85% → 40;15% → 80(rough,對方也會粗魯)
        else → whisper                                                       # Y prone
    elif apparentlyAsleep(Y) && P.mood >= 50:                                # 試探/叫醒
        r < 0.2 → whisper
        elif P.posture != sideFacing → lieSideFacing
        else → caress 80(rough:噪音 72.8 > T 上限 60,一定吵醒;對話「起來啦~」)
    elif P.mood < 50 → r < 0.5 ? whisper : tuckBlanket 30
    else → sleep
```

**對話池** `speech.ts`:每個 key >= 3 句、zh-TW、口語、短;池不分角色,UI 依 who 定位泡泡。key → 觸發:

| key | 觸發 |
|---|---|
| goodnight_sleep / goodnight_intimacy | turn 0 開場;各池 1/3 是共用的曖昧句(「嗯……晚安」「燈要關嗎?」)。sleep:「今天好累……」「明天要早起」;intimacy:「今天……不太累欸」 |
| sleepTalk_sleep / sleepTalk_intimacy | §8 睡著分支。sleep:「嗯……那個報表……」「不要……再五分鐘……」;intimacy:「嗯……再靠近一點……」「(咕噥)……抱我……」 |
| wake / wakeAngry / coldAwake | §4 |
| refuseMood / refuseAnnoyed / sleepyDecline / okFine | mood<40 / annoyance>=50 / §1 / §8 |
| receptiveKiss / receptiveHug / receptiveCaress / whisperReply / patReply | 成功 affection |
| armOffered / armAccepted / numbArm / armRelieved | §5 / §6 |
| blanketPulled / blanketTucked / snore | §5 / §6 |
| roughComplaint | rough band(「太粗魯了!」「你是在打我嗎」) |
| noticedIntimacy / noticedSleep / breathTell | §6.5 |
| stare | §6.2b「你幹嘛一直看我」「閉上眼睛睡覺啦」 |
| push / kick / fellOff / tooLate / intimacyHigh(首次 >=60)/ partnerInitiate | 對應處 |
| morning_{sleep,sleep} / morning_{intimacy,sleep} / morning_{sleep,intimacy} / morning_{intimacy,intimacy} | 結局畫面(playerGoal, partnerGoal)。例:sleep/sleep「早安。你昨晚有想什麼嗎?」「沒有啊?」;intimacy/sleep「你昨晚一直動來動去是怎樣?」「……沒事。」;sleep/intimacy「……我昨晚有暗示你欸。」「有嗎??」;intimacy/intimacy 沒成「其實我昨晚也……算了,早安。」 |

## 9. 3D 場景

見 `docs/SCENE-RIG.md`(rig 數字、棉被、tween、特效、結局演出、projectHead)。API:

```ts
class BedroomScene {
  constructor(container: HTMLElement)
  applyState(state: GameState, events: GameEvent[]): void
  projectHead(role: Role): { x: number; y: number } | null
  playEnding(ending: Ending): void
  dispose(): void
}
```

六個「看得見的參數」:身體距離(root x)、呼吸頻率(胸口起伏;裝睡等幅)、肢體動作強度(band → tween 速度/過衝/床晃)、棉被覆蓋度(高度場網格,被搶就露出來)、打呼(Zzz 放大 + 合成鼾聲)、身體朝向(roll 翻身;手臂真的墊在頭下)。

## 10. UI(純 DOM + CSS,zh-TW)

- **開始畫面**:「同床異夢」/「Sleep or More」/「我是男方」「我是女方」。
- **目標卡**:「今晚的目標:好好睡覺 / 親熱」+ 一行提示 +「開始」。
- **HUD**:上方時鐘 + `${turn+1}/12` + 目標徽章 + **閉眼/張眼切換鈕**(大按鈕,顯示目前模式與一行好處/風險;切換即呼叫 `onToggleEyes(eyes)`)。
  - 「我」欄:睡意、溫暖、心情、翻身指數(>=35 黃「小心」、>=50 紅「快被發現了」)、呼吸(急促/平穩/深沉/「規律得可疑」)、打呼指示;男方 inUse 時顯示手麻條(>=75 橘)。
  - 「對方」欄(**張眼**):心情(40 刻度線)、火氣(50/70/100 刻度線;>=70 變紅並閃一下)、睡意、眼睛(開/閉)、呼吸(含「等幅=裝睡?」)、打呼、目標「?」。(**閉眼**):全部「?」,只剩「聽到的」:呼吸聲(慢/平穩/急促)、打呼、對話。
  - **噪音計**:一條橫向 VU 條顯示上一動作的 N;張眼時疊上對方門檻 T 的紅色刻度線,N 超過 T 時整條閃紅;閉眼時只有 N 與「門檻 ?」。
  - 中間:親密度 ♥ 條(>=90 且對方未睡著 → 提示「趁對方還醒著」)。
  - 床位列:一條線上兩個點,床沿 20% 區域塗紅;棉被小圖示偏左/偏右(閉眼時棉被圖示隱藏,只剩自己的溫暖度)。
- `GameUI` handlers 增加 `onToggleEyes(eyes: Eyes): void`;`render` 依玩家 eyes 決定對方欄顯示模式與畫面暗化 class(`body.eyes-closed`)。
- **動作選單**:`listAvailableActions`;不可用 → 灰階 + reason;每格 emoji + 標籤 + 噪音點點(●●○ 依 baseNoise:<15 一點、<28 兩點、其餘三點)。
- **力道條**:蓄力動作 → 「按住蓄力,放開執行」;pointerdown/up 與空白鍵;1.8 秒填滿、到 100 停住;綠區永遠可見;放開後停留 0.6 秒顯示落點與段名(太輕/溫柔/用力/粗魯)再收起;Esc 取消。
- **對話泡泡**:`scene.projectHead(role)` 定位,rAF 跟隨;2.5 秒淡出;同角色同段多句排隊。`render` 忽略 speech 事件,由 main.ts 依 phase 切段逐筆呼叫 `speak()`。
- **事件記錄**:最近 6 筆。
- **結局 banner**(`showEnding` 先播 banner,2.5s 後淡入結局卡):
  - `wasted`:超粗緊縮無襯線大字(`title`,深紅 #b3001b、黑描邊 + 陰影、字距 0.05em)從左滑入 0.4s,下方 `caption` 大寫小字字距 0.4em 灰白;橫向暗紅漸層帶;HUD 淡出;暗角 overlay。系統粗體(`font-weight: 900`),不載外部字型。
  - `passed`:金色 #e6b422 大字由小放大 0.5s;`neutral`:銀白淡入。
- **結局卡**:標題、說明、「其實今晚對方想:睡覺/親熱」+ 一句 morning 台詞、統計(回合、親密度、睡眠分數)、「再玩一次」。
- 手機:直式可用;按鈕 >= 44px。

```ts
class GameUI {
  constructor(root: HTMLElement, handlers: { onStart(role: Role): void; onAction(actionId: ActionId, force: number): void; onRestart(): void })
  showStart(): void
  showGoal(state: GameState): Promise<void>
  render(state: GameState, actions: AvailableAction[], events: GameEvent[]): void
  speak(role: Role, text: string): void
  setBubbleAnchor(fn: (role: Role) => { x: number; y: number } | null): void
  setBusy(busy: boolean): void
  showEnding(state: GameState): void
}
```

## 11. 檔案配置

```
src/
  main.ts                 # 組裝:createGame / BedroomScene / GameUI;回合流程與時序(SCENE-RIG §5)
  game/
    types.ts constants.ts rng.ts actions.ts rules.ts partner.ts speech.ts endings.ts turn.ts
  scene/
    Scene.ts room.ts bed.ts blanket.ts character.ts postures.ts effects.ts tween.ts audio.ts
  ui/
    UI.ts forceMeter.ts hud.ts screens.ts bubbles.ts style.css
tests/
  rules.test.ts partner.test.ts endings.test.ts turn.test.ts playthrough.test.ts postures.test.ts
```

## 12. 測試(vitest)

單元:閉眼/張眼(`sleep` 需 closed、kiss/hug 需 open、閉眼蓄力噪音 +5、張眼時間流逝 +0、closed→open 且 sleep>=70 自醒 −20、`apparentlyAsleep` 對 open 恆 false、stare 每 3 回合一次);`action` 事件的 noise 等於 §4 的 N;`projectedNoise` 與 `wakeThreshold`;force 分段邊界(f==lo gentle、f==hi gentle、hi+25 firm);§4 公式(N==T 不吵醒;30–44 不吵醒;熟睡只有 rough 吵得醒);每個動作的 available 與失敗 note;§5.1/§5.2 連動;pull/tuck 極限不可用;warmth 公式與 cold;手麻累積/歸零/每回合重複;restless/noticed/breathTell(固定 seed);打呼等級與 pat 翻身;AI 每個分支至少一測且回傳的動作 available;結局優先序;phase 事件順序;Ending 欄位完整;`resolvePose` 純函式(scene)。

**可解性(playthrough.test.ts)**:用 100 個 seed(0..99)× 兩個角色跑固定策略,斷言勝率區間(數值調整時這裡會告訴你哪條壞了):

| # | 玩家 / 對方 | 策略 | 斷言 |
|---|---|---|---|
| 1 | sleep / sleep | 每回合 sleep | win >= 0.9 |
| 2 | intimacy / intimacy | lieSideFacing → kiss/caress 交替 force 35 | win >= 0.7 |
| 3 | sleep / intimacy | pat 30 直到對方 sleep>=70,之後 sleep | 0.35 ≤ win ≤ 0.8 |
| 4 | intimacy / sleep | tuckBlanket/whisper 養 mood>=70,再 kiss/caress 35 | 0.25 ≤ win ≤ 0.7 |
| 5 | 任意 | lieSideFacing → 每回合 hug force 100 | win == 0;>= 0.9 在 8 回合內 kickedOff/fellOff;kickedOff 佔比 >= 0.2 |
| 6 | sleep / intimacy | 每回合 sleep(裝睡到底) | win <= 0.35 |
| 7 | sleep / intimacy | lieSideAway → sleep | win <= 0.6(有盾但不是最佳解) |

無 NaN;所有數值全程在 0..100。

## 13. 內容尺度

成人向但**不露骨**:「親熱」結局只用燈光淡出 + 愛心;沒有裸露、沒有露骨動畫或文字。對話可愛、生活化。

## 14. 實作補充與調整(v2 實作後)

> 實作 v2 時發現的規格歧義、我們的解讀,以及跑 §12 勝率模擬後新增的平衡規則。數值集中在 `src/game/constants.ts` 的 `BAL`。

### 14.1 多語系
- 支援 7 種語言:繁體中文(參考語系)、简体中文、日本語、한국어、Tiếng Việt、English、Español。文字全部在 `src/i18n/<語系>/{game,ui}.ts`。
- 規則層只產生 **key**:`AvailableAction.reasonKey`、`action` 事件的 `noteKeys`、`speech` 事件的 `key + index`(各語系對話池句數與順序相同)、`note` 事件的 `key`、`Ending.id`。契約中原有的字串欄位(`label`/`hint`/`reason`/`note`/`text`/`title`…)仍以繁中填入,語意不變。
- 語系選擇:`?lang=` → 上次選擇(localStorage)→ 瀏覽器語言 → English。

### 14.2 規格解讀
- **閉眼的限制只套用玩家**(`sleep` 要閉眼、kiss/hug 要張眼、閉眼蓄力噪音 +5、pullBlanket 綠區 [40,60])。AI 的眼睛完全由 §1 規則推得,否則 AI「保底 sleep」會不可用。
- `withdrawArm` 太輕抽不出來只在 `inUse`(手真的被壓著)時發生。
- `push` 一律清掉 `offered/inUse/embrace`(推人的一方轉成背對,手臂枕不可能維持)。
- **察覺**(§6.5)要求被察覺者真的沒睡著(`A.sleep < 70`):真的睡著的人不會被說「你根本沒睡」。
- 睡著的 AI 的無意識動作(翻身、捲棉被)不扣自己睡意、不加翻身指數。
- 被拍拍而翻身的打呼者:若正在擁抱或手臂枕,一律翻成面向對方,避免拆散。
- `whisper` 不套 sleepyDecline(規格只在 hug/kiss/caress 註明)。sleepyDecline 的擁抱仍然成立,只是收益減半。
- `scootIn` 已在床中線(|lateral| ≤ 0.1)時不可用;玩家 lateral clamp ±1、AI ±0.9。
- 台詞:每個動作每個角色最多一句(優先序 roughComplaint > 吵醒 > 分支台詞 > tooLate > intimacyHigh)。intimacyHigh 由醒著的對方說,對方睡著則是玩家的內心話。
- 結局早晨對話新增兩個池:`together`(親熱成功)、`floor`(被踢/掉床)。
- **亂數流加鹽**:§2 原式 `mulberry32(seed ^ imul(turn, k))` 在 turn 0 等於 `mulberry32(seed)`,和 `createGame` 抽目標/心情的是同一條流,女方 AI 的開場台詞序號就等於決定她目標的那個亂數(想親熱的她永遠不說曖昧句)。改為 `imul(turn + 1, k)`。
- `offerArm` / `restOnArm` 也要求距離 ≤ 0.75(原規格沒有,會讓她從床的另一頭瞬移過來枕手臂)。
- 想睡的對方「好吧…就一下下」的心情門檻與 sleepyDecline 一致(`BAL.sleepyMood`);昏沉時翻身背對只在心情未達該門檻時發生。
- 數值變化事件(annoyed/mood/intimacy)的 delta 四捨五入到 0.1,四捨五入後為 0 的不發;回合末也會發 AI 的 `eyes` 與 `clue` 事件。
- 規格內的幾句「設計意圖」和數字不完全一致(測試 `rules.test.ts` 的 "spec self-consistency" 記錄):firm 的擁抱(59.5)可吵醒睡意 < 99 的人,不只 70–80;閉眼男方在她枕著時用力收手(68)能吵醒熟睡(T=60);最大鼾聲 30 < T(45)=35.25,所以打呼吵不醒昏沉者;AI 的「15% 力道 80」對 hug 只是 firm。數字以實作為準。

### 14.3 平衡調整(§12 模擬後新增)
v2 規格直接實作時,「想睡 vs 想親熱」幾乎無解(#3 = 0%),「想親熱 vs 想睡」太簡單(#4 = 94%),粗魯擁抱太慢才被踢(#5 八回合內 53%),背對睡又變成完美盾牌。新增/調整:

| 規則 | 內容 | `BAL` |
|---|---|---|
| 粗魯 = 被拒絕 | rough 的 hug/kiss/caress 對醒著的對方一律走「不 receptive」分支(火氣、心情扣分),再加 band 的 +15 | — |
| 哄睡 | 想親熱的對方被玩家拍拍後,有機率直接選擇睡覺 | `lullChance 0.6` |
| 睡意慣性 | 想親熱的對方已經閉眼在睡(睡意 ≥ 30)且這回合沒被親熱/挪近/搶被打擾 → 繼續睡 | `momentumMinSleep 30` |
| 背對 = 部分盾牌 | 玩家看似睡著且背對時,想親熱的對方:偷偷從背後抱 15%、小聲試探 10%、放棄去睡 5%,其餘照常叫醒 | `shieldHug/Whisper/GiveUp` |
| 賭氣睡覺 | 想親熱的對方心情 < 50:悄悄話 35%、蓋被 20%,其餘賭氣去睡 | `sulkWhisper/sulkTuck` |
| 想睡的人比較難撩 | sleepyDecline 門檻 70 → 75;想睡且已昏沉(≥ 30)的對方被示好時 50% 翻身背對;只有還醒著(< 30)才會回悄悄話 | `sleepyMood 75`、`drowsyTurnAway 0.5`、`replyChance` |

調整後(seed 0..99 × 兩個角色):#1 1.00、#2 1.00、#3 0.61、#4 0.61、#5 0 勝且 91.5% 在 8 回合內被踢、#6 0.00、#7 0.25(有盾但不如哄睡)。

### 14.4 易玩性
- **建議提示**(`src/game/hints.ts`):每回合依玩家「看得到」的資訊給一句建議並高亮建議的按鈕(可關閉)。
- **目標進度**:睡眠分數 x/7 或親密度 x/100,並顯示「來得及 / 有點趕 / 來不及了」。
- **線索**(`memo.clues`):對方說出透露目標的話(晚安池非共用句、夢話、「好吧…就一下下」、「不要躲啦」…)或做出透露目標的行為時記一筆,UI 顯示「直覺:對方好像想…」。
- 結局卡附「下次可以試試」的提示;`createGame` 可指定目標(練習用)。

### 14.5 3D 場景(相對 `docs/SCENE-RIG.md` 的調整)
都是看截圖後為了「讀得清楚」而改;API 與 §9 相同,另加 `reset(state)`、`setViewInsets({top,bottom})`(相機避開 HUD,`projectHead` 仍準)、`setMuted`、`unlockAudio`。
- **相機**:俯角提高到約 40°(原 28° 棉被會擋住臉),距離依可見區域自動貼合整張床;fov 42 / 直式 58 不變。
- **棉被**:鼓包改為跟隨身體各段(軀幹、胸口、雙腿)的世界座標,胸口隨呼吸起伏;上緣在 z −0.2 露出肩膀;床沿外的垂墜捲過床墊邊緣落到地上。
- **角色**:頭放大 1.2 倍(手機上看得清表情),瀏海、女生髮型、嘴型(笑/平/皺眉);臉部貼花貼在頭的表面;側躺時臉稍微朝上。
- **姿勢數值**:擁抱的手搭在對方背上、湯匙抱環到腰;手臂枕的手臂平放在她頭下的枕頭上(原數值會穿過她的頭)。`tests/postures.test.ts` 依此更新。
- **燈光**:依 three.js 新版物理光單位重調,加一盞相機方向的冷色補光;檯燈隨夜深變暗、親密度高時偏粉。
- **結局**:`intimacyWin` 燈光降到 6%(不是全黑)讓愛心看得到;濾鏡用 CSS transition 組合;被踢/掉床翻滾落在床尾方向避開床頭櫃。
- 已知限制:側躺手臂枕時她的肩膀會擋住部分手麻的紫色;肢體沒有碰撞偵測(兩人側躺很近時手會在中間碰在一起)。

### 14.6 角色與棉被精緻化(精緻的是「玩具感」,不是「人感」)
原則:比例維持豆豆人(大頭、無手指、無鼻子、無身體曲線),細節只加在**材質、動作、漫畫符號**;親、摸、抱的截圖看起來要「可愛 / 好笑」而不是尷尬。實驗截圖流程見開發筆記(scene lab,不進 repo)。
- **睡衣**:`MeshPhysicalMaterial` + `sheen`(絨布光澤);canvas 花紋(男方寬直條紋、女方奶油色圓點),依部位周長設重複次數;領口、袖口、褲管滾邊,領口下兩顆鈕扣。
- **手臂(`hose.ts`)**:二次貝茲曲線的軟管(平行傳遞截面、頂點原地改寫),肘部外凸的弧度;連指手套的手。`postures.ts` 的姿勢表不變(手臂 pivot 的 Euler 決定方向),另加伸長倍率。
- **伸手動作**:`Character.gesture()` 疊加在姿勢上(伸出 → 停留 → 收回,時間到自動淡出):拍拍 = 拍對方靠近自己的肩膀、摸摸 = 臉頰來回、搶棉被 = 抓被子上緣往回扯、推 = 雙手推出去;親 / 悄悄話 = 身體靠過去、頭轉向對方;擁抱時手臂再收緊一下;挪位置扭一扭。力道:timid 伸不到(八成)、rough 更快更長。`aimEuler` / `reachArm` 是純函式(有測試)。
- **手麻**:>= 75 手邊定期閃電流;抽手 / 她起身時整隻手臂軟趴趴地晃。
- **棉被**:整張不重複的貼圖(6 × 5 格鋪棉、星星月亮、奶油色滾邊帶)+ 法線貼圖(每格鼓起)+ 幾何微鼓;沿外圍一圈捲起的邊條;凹處變暗(頂點色 AO);拉扯時順著拉的方向起皺(依棉被位移速度)、搶贏的那側堆出摺子、被子偏向某人時那人的鼓包變厚(春捲)。
- **接觸陰影(`shadows.ts`)**:不開 shadowMap,用貼片:頭在枕頭上、身體在床單 / 地板上、棉被側緣落在床單上。
- **漫畫符號**:💢 青筋(火氣上升,取代原本的 !!;!! 保留給嚇醒)、汗滴(裝睡被抓包、被推)、額頭三條線(被拒絕、心情大跌)、閃亮(心情變好)、發抖線(冷)、掉床後頭上繞圈的暈眩星星;臉紅分 3 級(親密度 >= 80 冒斜線);熟睡(sleep >= 90、閉眼)時鼻涕泡泡隨呼吸脹縮、偶爾破掉。

### 14.7 組合結局(雙方配合,64 種)
目的:讓玩家多玩幾次、出現稀有結局可以分享。
- **行為統計**:`memo.tally`(`src/game/titles.ts` 的 `tallyTurn`,每回合結束時累計,不耗 RNG):雙方各自的動作次數、翻身、冷、打呼、吵醒對方、裝睡被抓包、貼床緣、閉眼醒著、睡著的回合;共用的擁抱 / 手臂枕回合、最高手麻。
- **睡姿人格(8 種)**:拉棉被大師、悄悄話高手、無尾熊、哄睡保母、秒睡機器、裝睡演員、翻身陀螺、冰山邊緣人。每種人格一個原始指標,除以「一般人」的平均與標準差(玩家、對方各一張表,來自 2 萬局平衡模擬)→ 取最突出的一項。對方是 AI、習慣和玩家不同,用各自的基準才讓對方也拿得到每一種人格。
- **組合**:你 × 對方 = 64 種(`game.combo[你_對方]`,7 語系都有,名稱在各語系內不重複)。稀有度依同一個模擬的出現頻率排名:普通 24(1.6–9.8%)、稀有 20(0.6–1.6%)、超稀有 12(0.24–0.6%)、傳說 8(< 0.25%)。
- **UI**:結局卡的「今晚的組合」(稀有度、NEW、你 × 對方、分享、圖鑑);圖鑑 8 × 8(列 = 你、行 = 對方;沒解鎖的格子用邊框顏色暗示稀有度);開始畫面「🏆 圖鑑 n/64」。收集紀錄存在 `localStorage`(`som.combos`)。分享:手機用系統分享選單(Web Share API),其他情況複製文字 + 網址。
- 測試:`tests/titles.test.ts`(統計、人格判定、64 組合、稀有度分布、600 局模擬裡兩邊都拿得到 8 種人格)、`tests/ui.test.ts`(結局卡、圖鑑、分享)、`tests/i18n.test.ts`(各語系 64 個名稱不重複)。
