// 日本語:インターフェースのテキスト。構造は zh-TW(参照言語)とまったく同じ。
// プレースホルダー {name} は fmt() が置き換える。
import type { UiMessages } from '../types';

const ui: UiMessages = {
  meta: {
    title: '同床異夢 · Sleep or More',
    description: '同床異夢 — ひとつのベッドで眠るカップルの 3D シミュレーションミニゲーム',
  },

  common: {
    you: 'あなた',
    partner: '相手',
    male: '男性',
    female: '女性',
    close: '閉じる',
    cancel: 'キャンセル',
    back: '戻る',
    on: 'オン',
    off: 'オフ',
    loadError: '言語データを読み込めませんでした。接続を確認して、もう一度お試しください。',
  },

  start: {
    title: '同床異夢',
    subtitle: 'SLEEP OR MORE',
    tagline: '今夜は、ぐっすり眠りたい……それとも?',
    chooseRole: 'キャラクターを選ぼう',
    playMale: '男性でプレイ',
    playFemale: '女性でプレイ',
    sideLeft: '左側で寝る',
    sideRight: '右側で寝る',
    howToPlay: '遊び方',
    footnote: '12 ターン · 約 5 分 · 大人向け(露骨な表現なし)',
    language: '言語',
  },

  goal: {
    heading: '今夜の目標',
    youAre: 'あなたは{role}。ベッドの{side}で寝ている。',
    left: '左側',
    right: '右側',
    winLabel: '勝利条件',
    tipsLabel: 'コツ',
    sleep: {
      win: '06:00 まで乗り切り、睡眠スコア {n} 点を達成する(眠っているターンは +1、うとうとなら +0.5)。',
      tips: [
        'まず上のボタンで目を閉じて、「💤 寝る」で眠気をためよう。',
        '布団を取られると寒くなり、寒いとよく眠れない。',
        '寝返りはほどほどに。うるさいと相手を起こして、怒らせてしまう。',
      ],
    },
    intimacy: {
      win: '夜明けまでに親密度を 100 にする。そのとき相手が起きていること。',
      tips: [
        '目は開けたまま。まず「向き合う」、遠ければ「近づく」。',
        'キスとハグは長押しで力をためて、緑ゾーンで離す。強すぎると相手を怒らせる。',
        '相手が眠たそうなら、「ささやく」や「布団をかける」で先に機嫌を {n} まで上げよう。',
      ],
    },
    secret: '相手にも自分の目標がある(ヒミツ)。セリフや行動から当ててみよう!',
    hintsToggle: 'アドバイスを表示(初心者におすすめ)',
    start: 'スタート',
  },

  hud: {
    turn: 'ターン {n}/{max}',
    progress: {
      sleep: '睡眠スコア {v}/{t}',
      intimacy: '親密度 {v}/{t}',
    },
    status: {
      done: '達成!',
      onTrack: '順調',
      tight: 'ギリギリ',
      impossible: '間に合わない',
    },
    eyes: {
      open: '目を開けている',
      closed: '目を閉じている',
      toClose: '押して目を閉じる',
      toOpen: '押して目を開ける',
      openInfo: '相手が見える · 眠れない',
      closedInfo: '眠れる · 相手が見えない',
    },
    me: 'あなた',
    partner: '相手',
    stat: {
      sleep: '眠気',
      warmth: 'あたたかさ',
      mood: '機嫌',
      restless: '寝返り',
      numb: 'しびれ',
      annoyance: 'イライラ',
      eyes: '目',
      breath: '呼吸',
      snore: 'いびき',
      goal: '目標',
    },
    sleepState: {
      awake: '起きてる',
      drowsy: 'うとうと',
      asleep: 'すやすや',
      deep: 'ぐっすり',
    },
    breath: {
      fast: '速い',
      steady: 'おだやか',
      slow: 'ゆっくり',
      deep: '深い',
      suspicious: '怪しいほど規則的',
    },
    eyesState: { open: '開いている', closed: '閉じている' },
    snoreLevel: ['なし', '小さめ', '中くらい', '大きい'],
    cold: '寒い!',
    restlessWarn: '注意',
    restlessDanger: 'バレそう',
    annoyPush: '押しのけ寸前!',
    annoyHigh: 'ちょっとイライラ',
    unknown: '?',
    closedNote: '目を閉じているので見えない。聞こえるのは:',
    hidden: 'ヒミツ',
    clue: {
      label: '直感',
      none: 'まだわからない',
      sleep: '相手は眠りたいみたい',
      intimacy: '相手はイチャイチャしたいみたい',
      count: '😴×{s} 💞×{i}',
    },
    intimacy: '親密度',
    intimacyNudge: '相手が起きているうちに!',
    noise: {
      label: '物音',
      last: '直前の行動 {n}',
      threshold: '相手の起きるライン {t}',
      thresholdUnknown: '起きるライン ?',
      none: '相手は起きているので、起こす心配なし',
    },
    bed: {
      label: '位置',
      edge: '端',
      blanket: '布団',
      blanketHidden: '目を閉じていると布団が見えない',
    },
    hint: 'アドバイス',
    hideHints: 'アドバイスを隠す',
    log: 'ログ',
    logEmpty: 'まだ何も起きていない。',
    help: 'ヘルプ',
    settings: '設定',
    sound: 'サウンド',
  },

  action: {
    category: {
      rest: '休む',
      posture: '体勢',
      affection: 'スキンシップ',
      blanket: '布団',
      move: '移動',
      arm: '腕枕',
      partner: '相手',
    },
    noise: '物音 {n}',
    hold: '長押し',
    suggested: 'おすすめ',
    risk: {
      safe: '静か',
      risky: '起こすかも',
      loud: '起こしちゃう',
    },
    unavailable: '今はできない:{reason}',
    busy: 'ちょっと待って、相手がまだ動いている……',
  },

  force: {
    title: '{action}',
    instruction: 'ボタンを長押しして力をため、緑ゾーンで離す',
    holdButton: '長押しでためる',
    keyboard: 'スペースキーの長押しでもOK',
    tooShort: 'もう少し長く押してね',
    suggested: 'おすすめ',
    result: '{band}!',
    cancel: 'キャンセル(Esc)',
    zones: '弱すぎ · やさしく · 強め · 乱暴',
  },

  log: {
    actor: { you: 'あなた', partner: '相手' },
    action: '{who}:{emoji}{label}',
    band: '({band})',
    failed: '{who}の「{label}」は失敗:{reason}',
    wake: { you: 'あなたは起こされた!', partner: '相手が起きてしまった!' },
    intimacy: '♥ 親密度 {d}',
    annoyed: { you: 'あなたのイライラ {d}', partner: '相手のイライラ {d}' },
    mood: { you: 'あなたの機嫌 {d}', partner: '相手の機嫌 {d}' },
    embraceOn: 'ふたりは抱き合った',
    embraceOff: 'ハグがほどけた',
    armOffered: '腕が枕として差し出された',
    armInUse: '頭が腕枕にのった',
    armFree: '腕が引き抜かれた',
    armLeft: '頭が腕から離れた',
    cold: { you: 'あなたは寒くて震えている', partner: '相手は寒くて震えている' },
    numb: { you: 'あなたの腕がしびれた', partner: '相手の腕がしびれた' },
    noticed: { you: '起きているのが相手にバレた', partner: '相手が起きているのに気づいた' },
    snore: { you: 'あなたはいびきをかいている({level})', partner: '相手はいびきをかいている({level})' },
    push: '相手に押しのけられた!',
    kick: 'ベッドから蹴り落とされた!',
    fell: 'ベッドから落ちた!',
    clue: '何かに気づいた気がする……',
    eyes: {
      youClosed: 'あなたは目を閉じた',
      youOpened: 'あなたは目を開けた',
      partnerClosed: '相手が目を閉じた',
      partnerOpened: '相手が目を開けた',
    },
    speech: '{who}:「{text}」',
    turn: '— {time} —',
    posture: { you: 'あなたは{posture}になった', partner: '相手は{posture}になった' },
    blanket: '布団が動いた',
  },

  ending: {
    partnerWanted: '実は相手の本音は:',
    goalSleep: '😴 ぐっすり眠りたい',
    goalIntimacy: '💞 イチャイチャしたい',
    morning: '翌朝',
    stats: '記録',
    statTurns: 'ターン {n}/{max}',
    statIntimacy: '親密度 {n}',
    statSleep: '睡眠スコア {n}',
    statClues: '手がかり {n} 個',
    tip: '次はこうしてみよう',
    again: 'もう一度遊ぶ',
    changeRole: 'キャラクターを変える',
    outcome: { win: '勝利', lose: '敗北', draw: '引き分け' },
  },

  help: {
    title: '遊び方',
    sections: [
      {
        title: '目標',
        body: [
          'ゲーム開始時に今夜の目標が決まる:😴 ぐっすり眠る、または 💞 イチャイチャする。相手にも目標があるけど、それはヒミツ。',
          '😴 眠る:06:00 まで乗り切り、睡眠スコア 7 点を達成(眠っているターンは +1、うとうとなら +0.5)。',
          '💞 イチャイチャ:夜明けまでに親密度を 100 に。そのとき相手が起きていること。',
        ],
      },
      {
        title: '1 ターンの流れ',
        body: [
          'ひと晩は 12 ターン(1 ターン 40 分)。あなたが行動を選ぶ → 相手が行動 → 時間が進む。',
          '💡 アドバイス欄が次にできることを教えてくれる。おすすめのボタンは光る。',
        ],
      },
      {
        title: '目を閉じる vs 目を開ける',
        body: [
          '目を閉じる:「💤 寝る」で眠気をためられて、相手はあなたが寝たと思うかも。ただし相手の様子は見えず、キスもハグもうまくできない。',
          '目を開ける:相手の機嫌・イライラ・眠気が見える。ただし眠れない。眠っているときに目を開けると、自分で目が覚めてしまう。',
        ],
      },
      {
        title: '力加減',
        body: [
          '「長押し」マークのある行動は力をためる:ボタン(またはスペースキー)を長押しして、緑ゾーンで離す。',
          '弱すぎると効果は半分。強めは効果が大きいけど音も大きい。乱暴は必ず相手を怒らせる。',
        ],
      },
      {
        title: '物音と目覚め',
        body: [
          'どの行動にも物音がある。相手が眠っているとき、物音が「起きるライン」を超えると相手は起きてしまい、怒る。',
          'ボタンの色:緑 = 静か、黄 = 起こすかも、赤 = 起こしちゃう。',
        ],
      },
      {
        title: '相手のイライラ',
        body: [
          'イライラが 70 以上になると、相手はあなたを押しのける。ベッドの外まで押し出されるか、イライラが 100 になると、ベッドから蹴り落とされる。',
          '「🤲 トントン」でイライラを鎮められて、寝かしつけにも使える。',
        ],
      },
      {
        title: 'その他',
        body: [
          '布団:取られると寒くなり、寒いとよく眠れない。「布団をかける」で相手は喜ぶ。',
          '寝返りが多いと、起きているのがバレる。仰向けで熟睡するといびきをかく。腕枕は甘いけど、腕がしびれる。',
          '相手のセリフや行動から目標を推理しよう。相手の欄にあなたの「直感」が表示される。',
        ],
      },
      {
        title: '操作方法',
        body: [
          'マウスかタッチでボタンを押す。スペース = 力をためる、E = 目を閉じる/開ける、H = ヘルプ、Esc = キャンセル。',
          '設定では言語の切り替え、サウンドとアドバイスのオン/オフができる。「オート力加減」をオンにするとゲージを省略できる。',
        ],
      },
    ],
  },

  settings: {
    title: '設定',
    language: '言語',
    sound: 'サウンド',
    hints: 'アドバイスを表示',
    autoForce: 'オート力加減(ゲージを省略して、常に「やさしく」)',
    restart: 'リスタート',
    restartConfirm: '今のゲームをやめて、最初からやり直す?',
  },
};

export default ui;
