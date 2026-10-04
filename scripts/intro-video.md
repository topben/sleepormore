# 一分鐘遊戲介紹影片

影片為 60 秒、16:9、1920 × 1080、30 fps，使用實際 3D 臥室場景、成年角色立繪與繁體中文字幕。

已完成的 [YouTube MP4](../output/video/sleep-or-more-youtube-intro.mp4) 與 [縮圖](../output/video/youtube-thumbnail.png) 已隨專案保存，可直接下載使用。

- 主標題：**華人AI 第一小黃遊**
- 副標題：**拯救台灣生育率**

配樂由頁面內的 WebAudio 合成器產生，包含鐘琴旋律與低音，屬於本影片原創配樂；沒有使用外部音樂或旁白。錄製串流會同時包含畫布影像與配樂音軌。

## 分鏡

| 時間 | 內容 |
| --- | --- |
| 00:00–00:07 | 主標題、副標題與月光臥室 |
| 00:07–00:15 | 男女角色展示 |
| 00:15–00:23 | 睡覺／親熱兩種目標，以及 12 回合的一夜 |
| 00:23–00:34 | 實際 3D 翻身、挪近、悄悄話互動 |
| 00:34–00:43 | 蓄力綠區與溫柔擁抱 |
| 00:43–00:51 | 觀察反應、試探對方的秘密目標 |
| 00:51–00:55 | 64 種組合結局 |
| 00:55–01:00 | 主副標題與開始故事的結尾卡 |

## 重製與錄製

先安裝專案相依套件並啟動 Vite：

```sh
pnpm install
pnpm dev --host 127.0.0.1
```

使用支援 MediaRecorder 的 Chrome 開啟 `http://127.0.0.1:5173/scripts/intro-video.html`。可先點分鏡按鈕檢查畫面，再點「錄製一分鐘 WebM」。保持該分頁可見，等待 60 秒；完成後會下載 `sleep-or-more-intro.webm`，也可點「下載 1080p WebM」再次下載。

若 Vite 使用其他連接埠，請依終端顯示的網址調整。錄製時切換分頁會使 3D 場景暫停更新。

## 轉成 YouTube MP4

安裝含 `libx264` 的 FFmpeg，將下載檔放在專案的 `output/video/`，執行：

```sh
mkdir -p output/video
ffmpeg -i output/video/sleep-or-more-intro.webm \
  -vf "fps=30,tpad=stop_mode=clone:stop_duration=1" \
  -af "volume=20dB,apad" -t 60 \
  -c:v libx264 -preset medium -crf 18 \
  -maxrate 12M -bufsize 24M -profile:v high -level 4.1 \
  -pix_fmt yuv420p -g 60 \
  -c:a aac -b:a 320k -ar 48000 -ac 2 \
  -movflags +faststart \
  output/video/sleep-or-more-youtube-intro.mp4
```

輸出為 H.264／AAC、1080p、30 fps 的 MP4。配樂增加 20 dB，讓原本偏小的合成音樂更清楚，仍保留峰值餘裕。補幀、補音與 `-t 60` 可消除瀏覽器錄製尾端的細微時長誤差；`faststart` 方便網路播放。格式依據 [YouTube 建議的上傳編碼設定](https://support.google.com/youtube/answer/1722171?hl=zh-Hant)。

可用以下命令確認影像、音訊與時長，並完整解碼檢查：

```sh
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,sample_rate,channels -show_entries format=duration -of json output/video/sleep-or-more-youtube-intro.mp4
ffmpeg -v error -i output/video/sleep-or-more-youtube-intro.mp4 -f null -
```

確認 `duration` 為 `60.000000`，影片為 `h264`／`1920 × 1080`／`30/1`，音訊為 `aac`／`48000`／雙聲道，再將 MP4 上傳至 YouTube。
