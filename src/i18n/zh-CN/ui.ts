// 简体中文(中国大陆):界面文字。结构必须和繁中参考语系(zh-TW)完全一致。
// 占位符 {name} 由 fmt() 代入。
import type { UiMessages } from '../types';

const ui: UiMessages = {
  meta: {
    title: '同床异梦 · Sleep or More',
    description: '同床异梦 — 3D 情侣同床模拟小游戏',
  },

  common: {
    you: '你',
    partner: '对方',
    male: '男方',
    female: '女方',
    close: '关闭',
    cancel: '取消',
    back: '返回',
    on: '开',
    off: '关',
  },

  start: {
    title: '同床异梦',
    subtitle: 'SLEEP OR MORE',
    tagline: '今晚,你想好好睡……还是?',
    chooseRole: '选择你的角色',
    playMale: '我是男方',
    playFemale: '我是女方',
    sideLeft: '睡左边',
    sideRight: '睡右边',
    howToPlay: '怎么玩',
    footnote: '12 回合 · 约 5 分钟 · 成人向但不露骨',
    language: '语言',
  },

  goal: {
    heading: '今晚的目标',
    youAre: '你是{role},睡在{side}。',
    left: '左边',
    right: '右边',
    winLabel: '怎么算赢',
    tipsLabel: '小贴士',
    sleep: {
      win: '撑到 06:00,睡眠分数达到 {n} 分(睡着的回合 +1,迷糊 +0.5)。',
      tips: [
        '先点上方的“闭眼”,再按“💤 闭眼睡”积累睡意。',
        '被子被抢走会冷,一冷就睡不好。',
        '别老翻身;动静太大会吵醒对方、惹对方生气。',
      ],
    },
    intimacy: {
      win: '天亮前让亲密度达到 100,而且那时对方还醒着。',
      tips: [
        '保持睁眼,先“侧躺面向”对方,离得远就“挪近”。',
        '亲吻、拥抱要按住蓄力,在绿区松开;太用力会惹对方生气。',
        '对方想睡的话,先靠悄悄话、盖被子把对方心情哄到 {n}。',
      ],
    },
    secret: '对方也有自己的目标(是秘密哦)。从对话和举动里猜猜看!',
    hintsToggle: '显示提示(新手推荐)',
    start: '开始',
  },

  hud: {
    turn: '回合 {n}/{max}',
    progress: {
      sleep: '睡眠分数 {v}/{t}',
      intimacy: '亲密度 {v}/{t}',
    },
    status: {
      done: '达标!',
      onTrack: '来得及',
      tight: '有点赶',
      impossible: '来不及了',
    },
    eyes: {
      open: '睁眼中',
      closed: '闭眼中',
      toClose: '点一下闭眼',
      toOpen: '点一下睁眼',
      openInfo: '看得到对方 · 不能睡',
      closedInfo: '可以睡 · 看不到对方',
    },
    me: '我',
    partner: '对方',
    stat: {
      sleep: '睡意',
      warmth: '温暖',
      mood: '心情',
      restless: '翻身',
      numb: '手麻',
      annoyance: '火气',
      eyes: '眼睛',
      breath: '呼吸',
      snore: '呼噜',
      goal: '目标',
    },
    sleepState: {
      awake: '醒着',
      drowsy: '迷糊',
      asleep: '睡着',
      deep: '熟睡',
    },
    breath: {
      fast: '急促',
      steady: '平稳',
      slow: '缓慢',
      deep: '深沉',
      suspicious: '规律得可疑',
    },
    eyesState: { open: '睁着', closed: '闭着' },
    snoreLevel: ['没有', '小声', '中等', '很响'],
    cold: '好冷!',
    restlessWarn: '小心',
    restlessDanger: '快被发现了',
    annoyPush: '要推人了!',
    annoyHigh: '有点火大',
    unknown: '?',
    closedNote: '闭着眼看不到,只听得到:',
    hidden: '秘密',
    clue: {
      label: '直觉',
      none: '还看不出来',
      sleep: '对方好像想睡觉',
      intimacy: '对方好像想亲热',
      count: '😴×{s} 💞×{i}',
    },
    intimacy: '亲密度',
    intimacyNudge: '趁对方还醒着!',
    noise: {
      label: '噪音',
      last: '上个动作 {n}',
      threshold: '对方门槛 {t}',
      thresholdUnknown: '门槛 ?',
      none: '对方还醒着,不会被吵醒',
    },
    bed: {
      label: '床位',
      edge: '床沿',
      blanket: '被子',
      blanketHidden: '闭着眼看不到被子',
    },
    hint: '提示',
    hideHints: '隐藏提示',
    log: '事件记录',
    logEmpty: '还没发生什么事。',
    help: '说明',
    settings: '设置',
    sound: '音效',
  },

  action: {
    category: {
      rest: '休息',
      posture: '姿势',
      affection: '亲密',
      blanket: '被子',
      move: '移动',
      arm: '手臂',
      partner: '对方',
    },
    noise: '噪音 {n}',
    hold: '按住',
    suggested: '推荐',
    risk: {
      safe: '安静',
      risky: '可能吵醒',
      loud: '会吵醒',
    },
    unavailable: '现在不行:{reason}',
    busy: '稍等,对方还在动……',
  },

  force: {
    title: '{action}',
    instruction: '按住按钮蓄力,在绿区松开',
    holdButton: '按住蓄力',
    keyboard: '也可以按住空格键',
    tooShort: '要按住久一点哦',
    suggested: '推荐',
    result: '{band}!',
    cancel: '取消(Esc)',
    zones: '太轻 · 温柔 · 用力 · 粗鲁',
  },

  log: {
    actor: { you: '你', partner: '对方' },
    action: '{who} {emoji}{label}',
    band: '({band})',
    failed: '{who}想{label},可是:{reason}',
    wake: { you: '你被吵醒了!', partner: '对方被吵醒了!' },
    intimacy: '♥ 亲密度 {d}',
    annoyed: { you: '你的火气 {d}', partner: '对方火气 {d}' },
    mood: { you: '你的心情 {d}', partner: '对方心情 {d}' },
    embraceOn: '你们抱在一起了',
    embraceOff: '拥抱松开了',
    armOffered: '手臂伸出来当枕头了',
    armInUse: '头枕到手臂上了',
    armFree: '手臂收回来了',
    armLeft: '头从手臂上挪开了',
    cold: { you: '你好冷', partner: '对方好冷' },
    numb: { you: '你的手麻了', partner: '对方的手麻了' },
    noticed: { you: '对方发现你还醒着', partner: '你发现对方还醒着' },
    snore: { you: '你在打呼噜({level})', partner: '对方在打呼噜({level})' },
    push: '对方把你推开了!',
    kick: '你被踢下床了!',
    fell: '你掉下床了!',
    clue: '你好像察觉到了什么……',
    eyes: {
      youClosed: '你闭上了眼睛',
      youOpened: '你睁开了眼睛',
      partnerClosed: '对方闭上了眼睛',
      partnerOpened: '对方睁开了眼睛',
    },
    speech: '{who}:“{text}”',
    turn: '— {time} —',
    posture: { you: '你换成了{posture}', partner: '对方换成了{posture}' },
    blanket: '被子挪动了',
  },

  ending: {
    partnerWanted: '其实今晚对方想:',
    goalSleep: '😴 好好睡觉',
    goalIntimacy: '💞 亲热',
    morning: '第二天早上',
    stats: '统计',
    statTurns: '回合 {n}/{max}',
    statIntimacy: '亲密度 {n}',
    statSleep: '睡眠分数 {n}',
    statClues: '线索 {n} 条',
    tip: '下次可以试试',
    again: '再玩一次',
    changeRole: '换个角色',
    outcome: { win: '胜利', lose: '失败', draw: '平局' },
  },

  help: {
    title: '怎么玩',
    sections: [
      {
        title: '目标',
        body: [
          '开局会抽到今晚的目标:😴 好好睡觉,或 💞 亲热。对方也有自己的目标,不过那是秘密。',
          '😴 睡觉:撑到 06:00,睡眠分数达到 7 分(睡着的回合 +1,迷糊 +0.5)。',
          '💞 亲热:天亮前让亲密度达到 100,而且那时对方还醒着。',
        ],
      },
      {
        title: '每个回合',
        body: [
          '一晚共 12 回合(每回合 40 分钟)。你选一个动作 → 对方行动 → 时间流逝。',
          '💡 提示栏会告诉你下一步可以做什么,推荐的按钮会发光。',
        ],
      },
      {
        title: '闭眼 vs 睁眼',
        body: [
          '闭眼:可以用“💤 闭眼睡”积累睡意,对方可能以为你睡着了;但看不到对方的状态,也亲不到、抱不准。',
          '睁眼:看得到对方的心情、火气、睡意;但不能睡。睡着时睁眼会把自己弄醒。',
        ],
      },
      {
        title: '力道',
        body: [
          '带“按住”标记的动作要蓄力:按住按钮(或空格键),在绿区松开。',
          '太轻效果减半;用力效果强但比较吵;粗鲁一定会惹对方生气。',
        ],
      },
      {
        title: '噪音与吵醒',
        body: [
          '每个动作都有噪音。对方睡着时,噪音超过“门槛”就会把对方吵醒,对方会生气。',
          '按钮颜色:绿 = 安静、黄 = 可能吵醒、红 = 会吵醒。',
        ],
      },
      {
        title: '对方的火气',
        body: [
          '火气 70 以上对方会把你推开;被推出床沿、或火气到 100,你就会被踢下床。',
          '“🤲 拍拍安抚”可以消火气,也能哄对方入睡。',
        ],
      },
      {
        title: '其他',
        body: [
          '被子:被抢走会冷,冷了睡不好。“帮对方盖好”会让对方开心。',
          '翻身太多会被发现没睡;平躺睡熟了会打呼噜;手臂当枕头很甜,但会手麻。',
          '从对方的话和举动推理对方的目标,对方栏会显示你的“直觉”。',
        ],
      },
      {
        title: '操作',
        body: [
          '用鼠标或触屏点按钮。空格键 = 蓄力、E = 闭眼/睁眼、H = 说明、Esc = 取消。',
          '设置里可以切换语言、开关音效和提示,也可以打开“自动力道”跳过蓄力条。',
        ],
      },
    ],
  },

  settings: {
    title: '设置',
    language: '语言',
    sound: '音效',
    hints: '显示提示',
    autoForce: '自动力道(跳过蓄力条,一律温柔)',
    restart: '重新开始',
    restartConfirm: '确定要放弃这一局吗?',
  },
};

export default ui;
