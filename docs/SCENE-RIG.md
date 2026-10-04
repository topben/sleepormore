# 3D 場景實作規格(three.js primitives,無外部模型)

> 給 `src/scene/` 實作者。數值可直接照抄;與 `docs/DESIGN.md` §9 衝突時以本文件為準。
> 不開 shadowMap;three >= r139(CapsuleGeometry)。目標 ~800 行。

## 1. 世界座標

- 床:寬 2.2(x ∈ [−1.1, 1.1])× 長 2.4(z ∈ [−1.2, 1.2]),床面 y = 0.55。
  - 床架 `Box(2.3, 0.35, 2.5)` @ y=0.175;床墊 `Box(2.2, 0.20, 2.4)` @ y=0.45;床頭板 `Box(2.3, 0.9, 0.08)` @ (0, 0.8, −1.25)。
  - 單一長枕 `Box(2.0, 0.10, 0.45)` @ (0, 0.60, −0.75)(長枕讓 lateral 變化時頭不會滑出枕頭)。
  - 床頭櫃 `Box(0.5, 0.5, 0.5)` @ (−1.65, 0.25, −0.9),上面檯燈(小圓柱 + 半球罩)與鬧鐘(小方塊,結局用來抖)。
- 角色 root 位置:`x = lateral × 1.1`、`y = 0.74`、`z = +0.20`。`|lateral| = 1` → 身體中心剛好在床沿(半身懸空)。
- 房間:地板 `Plane(8, 8)` 深色、地毯圓形、三面牆、窗戶(牆上亮色矩形 + 窗框)在 +x 側牆。
- 相機:`position (0, 2.5, 3.1)`、`lookAt (0, 0.7, −0.25)`、`fov 42`;直式(aspect < 1)fov 改 58。相機在 +z 看 −z,螢幕右 = +x = 女方,符合「男左女右」。
- 燈光:`HemisphereLight(0x2a2f55, 0x0e0a14, 0.6)`;檯燈 `PointLight(0xffb070, 1.2, 4, 2)` @ 床頭櫃上方;月光 `DirectionalLight(0x8fb4ff, 0.35)` 從窗方向斜射;`scene.fog = new Fog(bg, 4, 10)`,背景色 = 霧色 = `0x0b0a14`。

## 2. 角色 rig(成年日系幻想角色)

現行人物外觀見 §2.1 與 DESIGN §14.10。下表保留姿勢與動畫的基礎座標;角色的頭髮、服裝與臉部細節依現行外觀覆寫。

角色局部座標:原點 = 髖中心,+y = 頭,+z = 臉,+x = 角色左側。所有零件掛在 root Group 下:

| 零件 | 幾何 | 位置(局部) | 備註 |
|---|---|---|---|
| torso | `Capsule(0.17, 0.40)` | (0, 0.38, 0) | 圓截面 → 翻身時高度不變 |
| head(Group) | 內含 `Sphere(0.15)` | (0, 0.90, 0) | 眼睛 2× `Sphere(0.02)` @ (±0.05, 0.03, 0.14);睡著 → `eye.scale.y = 0.15`;腮紅 2× `Circle(0.03)` @ (±0.09, −0.02, 0.13) 以 visible 切換;髮帽 `Sphere(0.155, 16, 8, 0, 2π, 0, 1.3)` rotation.x = −0.4;**黑眼圈**:2× 深色 `Circle(0.035)` @ (±0.05, −0.01, 0.135),預設隱藏 |
| armL / armR(Group,pivot = 肩) | 內含 `Capsule(0.06, 0.40)` @ (0, −0.26, 0) | (±0.20, 0.65, +0.06) | 靜止朝 −y,總長 0.52 |
| legL / legR(Group,pivot = 髖) | 內含 `Capsule(0.08, 0.50)` @ (0, −0.33, 0) | (±0.10, 0.02, 0) | 總長 0.66 |
| chest(呼吸用) | torso 前方一片 `Sphere(0.12)` 壓扁 scale (1, 0.6, 0.35) @ (0, 0.45, 0.12) | | 呼吸動畫只縮放這片,不動 torso |

全長 −0.66..1.05 = 1.71。材質配色依 §2.1 的成年日系幻想角色設定;此處尺寸是原骨架的基礎尺度。

### 2.1 現行角色外觀

兩位角色皆為原創成年人類,採日系幻想動畫風格。此節取代舊豆豆人與毛絨玩具的外觀規格,維持角色局部座標與姿勢 / 動作介面。

| 角色 | 外觀 | 睡衣 |
|---|---|---|
| 男方 | 深藍色短髮、藍色眼睛、人類膚色 | 藍色開襟緞面睡衣、金色滾邊與鈕扣 |
| 女方 | 銀紫色長髮、紫色眼睛、人類膚色、金色月亮髮飾 | 淡紫色細肩帶緞面睡裙、蕾絲領口與裙襬 |

- 成年比例、五指手掌、分明髮束、人類耳朵與鼻子、大眼睛及細緻衣料呈現成年人物;動物耳朵、毛、尾巴與肉球退出角色造型。
- 衣料保持完整覆蓋;女方睡裙以細肩帶、緞面光澤與蕾絲細節呈現性感睡衣的造型。
- 保留 `Character` 對外介面:頭部錨點、眼睛開閉、腮紅、黑眼圈、呼吸、漫畫符號與肢體動作仍由遊戲狀態控制;手麻時人類手臂膚色往紫偏。
- 長髮、肩帶、裙襬與飾物需在仰躺 / 側躺 / 趴睡時可辨識,並避免遮住眼睛與臉部表情。遊戲相機的角色讀感優先於選角肖像細節。

`root.rotation.order = 'XYZ'`;`root.rotation.set(−π/2, roll, 0)`:Ry(roll) 先繞身體長軸自轉,Rx(−π/2) 把局部 +y(頭)倒向世界 −z、臉朝 +y。頭心落在世界 z = 0.20 − 0.90 = −0.70(枕頭上)。

### roll 表(posture 只差這一個純量;tween 它 = 翻身)

| posture | male | female |
|---|---|---|
| supine | 0 | 0 |
| sideFacing | +π/2(臉朝 +x) | −π/2(臉朝 −x) |
| sideAway | −π/2 | +π/2 |
| prone | π | π |

### 肢體 Euler [x, y, z](rad, order XYZ)

約定:arm 靜止朝 −y;x = −π/2 → 臂朝臉前方(側躺時 = 水平朝對方);z > 0 → 朝角色左側(+x)外展。肢體姿勢只取決於「哪一側在下」:roll > 0 → 左側(L)在下;roll < 0 → 右側(R)在下。兩個角色共用同一張表:

```
[supine]
 armL [0,0,+0.25] armR [0,0,−0.25] legL [0,0,+0.08] legR [0,0,−0.08] head [0,0,0]
[side, L 在下 = male sideFacing / female sideAway, roll=+π/2]
 armL(下) [−1.3,0,+0.2] armR(上) [−1.0,0,−0.1] legL(下) [−0.35,0,0] legR(上) [−0.6,0,−0.05] head [+0.1,0,0]
[side, R 在下 = female sideFacing / male sideAway, roll=−π/2]
 armR(下) [−1.3,0,−0.2] armL(上) [−1.0,0,+0.1] legR(下) [−0.35,0,0] legL(上) [−0.6,0,+0.05] head [+0.1,0,0]
[prone, roll=π]
 armL [0,0,+2.3] armR [0,0,−2.3](仙人掌式舉在頭旁)legL [0,0,+0.08] legR [0,0,−0.08]
 head: male [0,−1.1,0] / female [0,+1.1,0](臉轉向對方那側,半埋枕頭)
```

### 疊加規則(`postures.ts` 匯出純函式 `resolvePose(role, state): { roll, limbs, rootYOffset }`,可用 vitest 測)

依序:basePose(posture) → embrace 覆寫 → armPillow 覆寫。

- **embrace**(`state.embrace`):任何 `posture == sideFacing` 的角色把上臂擺成抱姿;`sideAway` 的角色(被從背後抱)肢體不變。
  - male armR `[−π/2+0.3, 0, 0]` → 手水平伸到 x≈+0.33、z≈−0.30(搭在她腰)
  - female armL `[−π/2−0.3, 0, 0]` → 手伸到 x≈−0.33、z≈−0.60(搭在他肩頸)
  - 兩臂用 x 分量 ±0.3 在 z 方向錯開 0.15,避免中線互穿;手要越過對方軀幹,不可往下壓(會穿進 torso)。
  - 湯匙式(對方 sideAway):抱的人上臂 `[−π/2+0.15, 0, 0]` 環過對方腰。
- **armPillow**(`offered || inUse`),依男方自己的 posture:
  - supine:armL `[0, 0, +2.2]` → 臂朝 +x 並偏向床頭,末端到 x≈+0.24、z≈−0.76,剛好從她頭下穿過(她頭心 x≈0.165、z=−0.70)。
  - sideFacing:armL(在下那隻)`[−π/2−0.35, 0, 0]` → 貼床面朝 +x、偏向床頭。
  - sideAway/prone 不會發生(規則已強制收回)。
  - inUse 時女方 `rootYOffset = +0.05`(頭墊高在臂上),肢體不變。
  - **numbness >= 75**:該手臂材質色往紫偏(`lerp(skin, 0x8a6aa0, (numb−75)/25)`)並小幅顫抖(每幀 rotation.z ± 0.02·sin(30t))。
- embrace 與 inUse 可並存:以 embrace rig 為主,armPillow 只影響男方下臂。

### 呼吸(呼吸頻率 = 可見線索)

- `breathRate(char)`(次/分鐘)由邏輯層匯出(§DESIGN):清醒 16、昏沉 12、睡著 8、熟睡 6;裝睡(lastAction=sleep 且 sleep<30)= 14 但**完全等幅規律**;真睡有 ±15% 的隨機幅度抖動。
- 動畫:`chest.scale.y = 0.6 × (1 + 0.18 × sin(2π × t × rate/60))`,root 的 z 也隨之 ±0.004。tween 目標 rate 用 1s 平滑。
- 打呼(`snore` 事件):睡著角色的 Zzz sprite 尺寸乘 `1 + 0.5×level`、間隔變短;level 3 時頭部每次呼氣微微抬起 0.01;WebAudio 合成鼾聲(低頻鋸齒 90Hz + 噪音 band-pass,0.6s,音量隨 level),AudioContext 未解鎖則略過。

## 3. 棉被(`blanket.ts`)

`PlaneGeometry(1.8, 1.6, 24, 20)`,`rotation.x = −π/2`,`position = (offset × 0.9, 0, +0.45)`(z 覆蓋 −0.35..1.25:從胸口蓋到腳,腳端超出床尾垂下;頭肩露出)。材質 `MeshStandardMaterial({ color: 0x6b7fb3, roughness: 0.95, side: DoubleSide })`。

每幀 `rebuild(xMale, xFemale)` 重寫 position attribute,一律用**世界座標**算(mesh 只在 x 平移):

```
wx = vx + mesh.position.x ; wz = vz
base   = 0.58
bump_i = 0.30 × exp(−(wx − xChar_i)² / (2 × 0.20²)) × taper(wz)   // taper: wz<0.3 → 1,線性降到 wz=0.95 → 0.55
ripple = 0.012 × sin(5.1·wx + 3.7·wz) + 0.008 × sin(7.3·wz)
drape  = max(0, |wx| − 1.05) × 1.6                                   // 超出床沿垂下
y      = base + max(bump_male, bump_female) + ripple − drape          // 用 max,不用加總
computeVertexNormals(); attr.needsUpdate = true                        // 525 頂點/幀,零負擔
```

鼓包用 tween 後的當幀 x → lateral 變化時鼓包跟著人走;offset 變化只平移 mesh。讀感:offset=0 → x∈[−0.9,0.9] 兩人全蓋;offset=+1 → x∈[0,1.8] 男方(x≈−0.39)完全露出;offset=0.5 → 男方約 65% 在棉被下。

## 4. Tween(`tween.ts`,~50 行)

```ts
class Tweens {
  set(key: string, to: number, dur: number, opts?: { angular?: boolean; noWrap?: boolean }): void
  get(key: string): number
  update(dt: number): void   // t = min(1, t + dt/dur); cur = from + (to−from) × easeInOutCubic(t)
}
// angular: delta = ((to − cur + π) mod 2π + 2π) mod 2π − π; to = cur + delta(最短路徑)
// easeInOutCubic(t) = t < 0.5 ? 4t³ : 1 − (−2t+2)³/2
```

頻道命名:`${role}.x|y|roll`(roll angular)、`${role}.armL.x|y|z` …(root 3 + 5 組×3 = 18 個/人)、`${role}.breath`、`blanket.x`、`lamp.i`、`moon.r|g|b`、`cam.yaw`、`cam.roll`、`cam.dolly`、`time.scale`。

`applyState(state, events)` 只做 `set(...)`:posture/embrace/armPillow → `resolvePose` → 0.8s;lateral → `${role}.x` 0.6s;`blanketOffset × 0.9` → `blanket.x` 0.6s;燈光 1s;然後 `effects.trigger(events)`。

### 肢體動作強度 → 動畫質感(由該段 `action` 事件的 `band` 決定)

| band | 姿勢/位移 tween 時長 | 過衝 | 額外 |
|---|---|---|---|
| timid | 1.1s | 無 | 動作做到一半停頓 0.15s 再完成(猶豫) |
| gentle | 0.8s | 無 | — |
| firm | 0.5s | easeOutBack 輕微過衝(s=1.2) | 棉被 ripple 幅度 ×2 持續 0.4s |
| rough | 0.3s | easeOutBack 過衝(s=2.0) | 床架與床墊 y 抖動 0.3s(±0.015)、相機微震 0.25s、棉被 ripple ×3、對方角色被帶動小幅位移 0.03 再彈回 |

`Tweens.set` 增加 `opts.ease?: 'inOut' | 'outBack'` 與 `opts.overshoot?: number`。噪音大的動作在 3D 上就要「看起來很吵」。
`update(dt)`(dt 先乘 `time.scale`):tweens.update → 寫回 group.position/rotation → blanket.rebuild → 呼吸 → effects.update → 相機擺動/拖曳 → render。

## 5. 分段與事件切分(main.ts 約定)

`TurnResult.events` 依 `{type:'phase'}` 事件切三段:`player` 段搭 `intermediate`,`partner`/`endOfTurn` 段搭 `state`。

```
ui.setBusy(true)
scene.applyState(intermediate, evtPlayer);  speak 該段 speech(每句 2.5s 排隊)
await 900ms
scene.applyState(state, [...evtPartner, ...evtEnd]);  speak
await 900ms
if (state.ending) scene.playEnding(state.ending); ui.showEnding(state)   // banner → 2.5s → 結局卡
ui.setBusy(false)
```

`fell`/`kick` 事件觸發角色翻滾動畫(effects.ts);`playEnding` 只做燈光/濾鏡/慢動作/相機/日出/愛心,不重播角色動畫。

## 6. 特效(`effects.ts`)

Sprite 一律用 `CanvasTexture` 畫可靠字元(`Z`、`♥` U+2665、`!!`、`?`),`sans-serif bold`;不用 emoji(跨平台不一致)。Zzz 用 3 個 sprite 循環而非一直 new。

| 事件 | 特效 |
|---|---|
| 睡著(sleep>=70,持續) | `Z` sprite 從頭上飄起、變大、淡出;`snore` level 放大 |
| intimacy delta > 0 | `♥` sprite 2–4 個上升 |
| annoyed / wake | 紅色 `!!` 標記在頭上 1s;wake → 眼睛睜開 |
| cold | 角色 root 微抖 0.8s(±0.01) |
| noticed | 察覺者眼睛睜開、頭朝對方轉 0.3 rad、頭上 `?` 1.5s |
| numb | 手臂顫抖 + 偏紫(見 rig) |
| push | 目標角色 x 彈開(tween 0.4s,overshoot) |
| kick / fell | `set(x, sign×1.75, 1.2)`、`set(y, 0.22, 1.2)`、`set(roll, cur + sign×2π, 1.2, {noWrap:true})`(整圈翻滾,angular wrap 關掉);落地後 y 小彈一次 |
| blanket | 棉被 tween;若 `|Δoffset| >= 0.5` 加一次 ripple 幅度放大 0.5s |
| action(noise) | 從行動者頭部發出 1–3 圈聲波環(`RingGeometry` 平放,透明度淡出 0.6s,半徑 = 0.2 + noise/60);noise > 對方 `wakeThreshold` 時最後一圈變紅並在對方頭上閃 `!!` |
| eyes | 該角色眼睛開/閉(`eye.scale.y` 1 ↔ 0.15,tween 0.2s);**玩家閉眼**:canvas `filter: brightness(0.45) blur(1.5px)` 0.5s + UI 層上下各一片黑色眼皮弧形遮罩(高度 18%);張眼則反向 |

### 結局 `playEnding(ending)`

- `wasted`:`time.scale → 0.25`(維持 2.5s 再回 1);canvas `style.filter` 0.8s 內漸變到 `grayscale(1) contrast(1.15) brightness(0.75)`(用 tween 頻道 `fx.gray` 每幀寫 style);暗角 overlay(UI 層);`cam.roll → 0.21`、`cam.dolly → −0.8`(朝受害者)、`cam.y −0.3`;
  - `kickedOff`/`fellOff`:角色翻滾由事件已觸發;
  - `sleepLoseTired`/`intimacyLoseMorning`:`moon` 色 → 日出 `(1.0, 0.6, 0.35)`、強度 ×2、鬧鐘 `position.x ± 0.02·sin(60t)` 抖 2s、玩家角色 roll → 0 且 root 抬起坐姿(rotation.x −π/2 → −π/6, 0.8s)、黑眼圈 visible;
  - `intimacyLoseFellAsleep`:玩家 Zzz 尺寸 ×3、對方 roll → sideAway;
  - 音效:WebAudio thud(60Hz sine, gain 0.8→0 in 0.4s)+ 下行兩音(220→165Hz, 各 0.25s);AudioContext 未 resume 則略過。
- `passed`:`lamp.i → 2.0` 暖金 1s;`sleepWin` → 日出 + 3 隻小鳥 sprite(`v` 字形)飛過窗;`intimacyWin` → `lamp` 色 → 粉 `(1.0, 0.55, 0.7)` 1.5s,再 `fx.dark → 1`(canvas brightness → 0)並持續放 `♥`。
- `neutral`:粉色 1s 淡出,無慢動作。

## 7. `projectHead(role)`

```ts
projectHead(role) {
  const v = this.chars[role].head.getWorldPosition(this.tmpV);
  v.y += 0.28;                                   // 泡泡錨在頭頂上方
  v.project(this.camera);
  if (v.z < -1 || v.z > 1) return null;
  const el = this.renderer.domElement;
  return { x: (v.x + 1) * 0.5 * el.clientWidth, y: (1 - v.y) * 0.5 * el.clientHeight };
}
```

CSS px、相對 canvas 左上角(用 clientWidth/Height,不乘 DPR)。UI 泡泡層 `position:absolute; pointer-events:none` 蓋在同一容器上;有泡泡存活時用 rAF 每幀重呼叫 anchor 更新 left/top(相機會擺動)。
