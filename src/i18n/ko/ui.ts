// 한국어: 인터페이스 문구. zh-TW/ui.ts와 키·구조가 완전히 같아야 한다.
// 자리표시자 {name}은 fmt()가 채운다. 플레이어는 「나」, 상대는 「상대」.
import type { UiMessages } from '../types';

const ui: UiMessages = {
  meta: {
    title: '동상이몽 · Sleep or More',
    description: '동상이몽 — 한 침대에 누운 커플의 3D 시뮬레이션 미니게임',
  },

  common: {
    you: '나',
    partner: '상대',
    male: '남자',
    female: '여자',
    close: '닫기',
    cancel: '취소',
    back: '뒤로',
    on: '켬',
    off: '끔',
    loadError: '언어 파일을 불러오지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.',
  },

  start: {
    title: '동상이몽',
    subtitle: 'SLEEP OR MORE',
    tagline: '오늘 밤은 푹 잘까…… 아니면?',
    chooseRole: '역할을 고르세요',
    modeLabel: '난이도',
    mode: { easy: '쉬움', hard: '어려움' },
    modeHint: { easy: '간단한 규칙으로 수면과 애정을 배워요.', hard: '체온, 친밀도, 타이밍을 함께 챙겨요.' },
    playMale: '남자로 플레이',
    playFemale: '여자로 플레이',
    sideLeft: '왼쪽에서 자요',
    sideRight: '오른쪽에서 자요',
    howToPlay: '게임 방법',
    gallery: '도감',
    footnote: '12턴 · 약 5분 · 성인향이지만 순한 맛',
    language: '언어',
    plugTag: '[대놓고 광고]',
    plug: '잘 시간 좀 맞춰 보자',
  },

  goal: {
    heading: '오늘 밤의 목표',
    youAre: '나는 {role}, 침대 {side}에서 자요.',
    left: '왼쪽',
    right: '오른쪽',
    winLabel: '승리 조건',
    tipsLabel: '꿀팁',
    sleep: {
      win: [
        '🏆 06:00에 수면 점수가 {n}점 이상이면 승리.',
        '💤 수면 점수: 매 턴이 끝날 때 잠들어 있으면 +1, 비몽사몽이면 +0.5.',
      ],
      tips: [
        '먼저 위쪽의 ‘눈 감기’를 누른 뒤, ‘💤 잠자기’로 졸음을 쌓아요.',
        '이불을 뺏기면 추워지고, 추우면 잠을 잘 못 자요.',
        '자꾸 뒤척이지 마세요. 시끄러우면 상대가 깨서 짜증을 내요.',
      ],
    },
    intimacy: {
      win: [
        '🏆 06:00 전에 친밀도를 100까지 올리면 승리 (그때 상대가 깨어 있어야 해요).',
      ],
      tips: [
        '눈을 뜬 채로 먼저 ‘마주 보기’, 너무 멀면 ‘다가가기’.',
        '뽀뽀·안아 주기는 버튼을 꾹 눌러 힘을 모았다가 초록 구간에서 떼요. 너무 세면 상대가 짜증 내요.',
        '상대가 자고 싶어 하면 속삭이기·이불 덮어 주기로 먼저 기분을 {n}까지 올려요.',
      ],
    },
    // hard mode
    hardBadge: '🔥 어려움 모드',
    now: {
      win: [
        '🏆 {deadline} 전에 친밀도를 100까지 올리면 승리 (그때 상대가 깨어 있어야 해요).',
        '💀 {deadline}까지 못 하면 패배, 게임도 거기서 끝나요.',
      ],
      tips: [
        '첫 턴부터 ‘마주 보기’, 너무 멀면 ‘다가가기’.',
        '뽀뽀는 조금 세게(노란 구간) 하면 빨라져요. 하지만 거칠면 안 돼요.',
        '상대가 자고 싶어 하면 거의 불가능해요. 상대의 반응을 잘 살펴요.',
      ],
    },
    morning: {
      win: [
        '🏆 {morning} 이후에 친밀도를 100까지 올리면 승리 (그때 수면 점수가 {sleep}점 이상이고 상대도 깨어 있어야 해요).',
        '🤝 너무 일찍 100이 되면 무승부 ({morning} 전이거나 수면 점수가 {sleep}점 미만일 때).',
        '💀 06:00까지 못 하면 패배.',
        '💤 수면 점수: 매 턴이 끝날 때 편하게 잠들어 있으면 +1, 잠들었지만 불편하거나 비몽사몽이지만 편하면 +0.5. 편한 조건은 아래를 보세요.',
      ],
      tips: [
        '밤에는 상대가 깨어 있을 때 조금 친해진 다음, 눈을 감고 자요.',
        '친밀도가 거의 차면 등을 돌리거나 눈을 감아서, 밤에 가득 차지 않게 해요.',
        '{dawn} 이후에는 다들 잠이 얕아져요. 아침 스킨십은 효과 두 배, 상대가 깨어 있을 때 해요.',
      ],
    },
    sleepHard: {
      win: [
        '🏆 06:00에 수면 점수가 {n}점 이상이면 승리.',
        '💤 수면 점수: 매 턴이 끝날 때 편하게 잠들어 있으면 +1, 잠들었지만 불편하거나 비몽사몽이지만 편하면 +0.5. 편한 조건은 아래를 보세요.',
      ],
      tips: [
        '체온은 들쭉날쭉하고 한밤중엔 추워져요. 더우면 이불을 상대에게 나눠 주고(‘이불 덮어 주기’), 추우면 다시 당겨요.',
        '친밀도가 모자라면 깊이 못 자요. 자기 전에 속삭이거나 안아 주세요. 둘 중 한 명이라도 자는 동안엔 친밀도가 안 떨어져요.',
        '{dawn} 이후에는 다들 잠이 얕아져요. 날이 밝기 전에 푹 자 두세요.',
      ],
    },
    body: {
      male: '🐻 곰은 더위를 타요: 체온 {lo}–{hi} 사이가 편하고, 친밀도는 {need} 이상 필요해요.',
      female: '🐰 롭이어 토끼는 추위를 타요: 체온 {lo} 이상이 편하고, 친밀도 {need} 이상이어야 안심하고 자요.',
    },
    secret: '상대에게도 목표가 있어요 (비밀!). 말과 행동을 보고 추리해 보세요!',
    hintsToggle: '힌트 표시 (초보자 추천)',
    start: '시작',
  },

  hud: {
    turn: '턴 {n}/{max}',
    progress: {
      sleep: '수면 점수 {v}/{t}',
      intimacy: '친밀도 {v}/{t}',
      now: '친밀도 {v}/{t} · {deadline} 전',
      morningSleep: '먼저 수면 {v}/{t}',
      morningLove: '친밀도 {v}/{t} · {morning} 이후',
    },
    status: {
      done: '달성!',
      onTrack: '순조로움',
      tight: '빠듯함',
      impossible: '이미 늦음',
    },
    eyes: {
      open: '눈 뜬 상태',
      closed: '눈 감은 상태',
      toClose: '눌러서 눈 감기',
      toOpen: '눌러서 눈 뜨기',
      openInfo: '상대가 보여요 · 잠들 수 없어요',
      closedInfo: '잠들 수 있어요 · 상대가 안 보여요',
    },
    me: '나',
    partner: '상대',
    stat: {
      sleep: '졸음',
      warmth: '따뜻함',
      mood: '기분',
      restless: '뒤척임',
      numb: '저림',
      annoyance: '짜증',
      eyes: '눈',
      breath: '호흡',
      snore: '코골이',
      goal: '목표',
    },
    sleepState: {
      awake: '깨어 있음',
      drowsy: '비몽사몽',
      asleep: '잠듦',
      deep: '깊이 잠듦',
    },
    breath: {
      fast: '빠름',
      steady: '차분함',
      slow: '느림',
      deep: '깊음',
      suspicious: '수상하게 규칙적',
    },
    eyesState: { open: '떠 있음', closed: '감겨 있음' },
    snoreLevel: ['없음', '작게', '보통', '엄청 크게'],
    cold: '추워요!',
    hot: '더워요!',
    need: '필요한 안정감 {n}',
    hardTag: '어려움',
    restlessWarn: '조심',
    restlessDanger: '들키기 직전',
    annoyPush: '밀쳐 내기 직전!',
    annoyHigh: '살짝 짜증 남',
    unknown: '?',
    closedNote: '눈을 감고 있어서 안 보여요. 들리는 건:',
    hidden: '비밀',
    clue: {
      label: '직감',
      none: '아직 잘 모르겠어요',
      sleep: '상대는 자고 싶은 것 같아요',
      intimacy: '상대는 스킨십을 원하는 것 같아요',
      count: '😴×{s} 💞×{i}',
    },
    intimacy: '친밀도',
    intimacyNudge: '상대가 깨어 있을 때 어서!',
    noise: {
      label: '소음',
      last: '직전 동작 {n}',
      threshold: '상대 깨는 기준 {t}',
      thresholdUnknown: '깨는 기준 ?',
      none: '상대가 깨어 있어요 · 깨울 걱정 없음',
    },
    bed: {
      label: '위치',
      edge: '가장자리',
      blanket: '이불',
      blanketHidden: '눈을 감아서 이불이 안 보여요',
    },
    hint: '힌트',
    hideHints: '힌트 숨기기',
    log: '기록',
    logEmpty: '아직 아무 일도 없어요.',
    help: '도움말',
    settings: '설정',
    sound: '효과음',
  },

  action: {
    category: {
      rest: '휴식',
      posture: '자세',
      affection: '애정',
      blanket: '이불',
      move: '이동',
      arm: '팔',
      partner: '상대',
    },
    noise: '소음 {n}',
    hold: '꾹',
    suggested: '추천',
    risk: {
      safe: '조용함',
      risky: '깰 수도 있음',
      loud: '무조건 깨움',
    },
    unavailable: '지금은 안 돼요: {reason}',
    busy: '잠깐만요, 상대가 아직 움직이는 중이에요……',
  },

  force: {
    title: '{action}',
    instruction: '버튼을 꾹 눌러 힘을 모으고, 초록 구간에서 떼세요',
    holdButton: '꾹 눌러 힘 모으기',
    keyboard: '스페이스 바를 꾹 눌러도 돼요',
    tooShort: '조금 더 길게 눌러 주세요',
    suggested: '추천',
    result: '{band}!',
    cancel: '취소 (Esc)',
    zones: '너무 약함 · 부드럽게 · 세게 · 거칠게',
  },

  log: {
    actor: { you: '나', partner: '상대' },
    action: '{who} {emoji}{label}',
    band: '({band})',
    failed: '{who} · {label} 실패: {reason}',
    wake: { you: '내가 잠에서 깼어요!', partner: '상대가 잠에서 깼어요!' },
    intimacy: '♥ 친밀도 {d}',
    annoyed: { you: '내 짜증 {d}', partner: '상대 짜증 {d}' },
    mood: { you: '내 기분 {d}', partner: '상대 기분 {d}' },
    embraceOn: '둘이 꼭 끌어안았어요',
    embraceOff: '포옹이 풀렸어요',
    armOffered: '팔베개가 준비됐어요',
    armInUse: '팔베개를 베었어요',
    armFree: '팔을 뺐어요',
    armLeft: '팔베개에서 머리를 뗐어요',
    cold: { you: '너무 추워요', partner: '상대가 추워해요' },
    hot: { you: '너무 더워요', partner: '상대가 더워해요' },
    numb: { you: '내 팔이 저려요', partner: '상대 팔이 저려요' },
    noticed: { you: '내가 안 자는 걸 상대가 눈치챘어요', partner: '상대가 안 자는 걸 눈치챘어요' },
    snore: { you: '내가 코를 골아요 ({level})', partner: '상대가 코를 골아요 ({level})' },
    push: '상대가 나를 밀쳐 냈어요!',
    kick: '침대 밖으로 걷어차였어요!',
    fell: '침대에서 떨어졌어요!',
    clue: '뭔가 눈치챈 것 같아요……',
    eyes: {
      youClosed: '눈을 감았어요',
      youOpened: '눈을 떴어요',
      partnerClosed: '상대가 눈을 감았어요',
      partnerOpened: '상대가 눈을 떴어요',
    },
    speech: '{who}: “{text}”',
    turn: '— {time} —',
    posture: { you: '자세를 바꿨어요: {posture}', partner: '상대가 자세를 바꿨어요: {posture}' },
    blanket: '이불이 움직였어요',
  },

  ending: {
    partnerWanted: '사실 오늘 밤 상대가 원한 건:',
    goalSleep: '😴 꿀잠',
    goalIntimacy: '💞 스킨십',
    hardTag: '🔥 어려움 모드',
    morning: '다음 날 아침',
    stats: '통계',
    statTurns: '턴 {n}/{max}',
    statIntimacy: '친밀도 {n}',
    statSleep: '수면 점수 {n}',
    statClues: '단서 {n}개',
    tip: '다음엔 이렇게 해 봐요',
    again: '한 판 더',
    changeRole: '역할 바꾸기',
    outcome: { win: '승리', lose: '패배', draw: '무승부' },
    comboLabel: '오늘 밤의 조합',
    newCombo: 'NEW!',
    collection: '도감 {n}/{max}',
    gallery: '도감 보기',
    share: '공유하기',
    /** 공유 문구 (뒤에 URL이 붙음). {a}·{b} 뒤에는 조사가 붙지 않게 쓴다 */
    shareText: '《동상이몽》에서 {rarity} 조합 【{name}】 획득! ({a} × {b}) 너는 몇 개나 모을 수 있을까?',
    copied: '복사했어요! 친구에게 보내 보세요',
    rarity: { N: '일반', R: '레어', SR: '에픽', SSR: '레전드' },
  },

  gallery: {
    title: '조합 도감',
    progress: '수집 {n}/{max}',
    axes: '가로줄 = 나 · 세로줄 = 상대',
    locked: '아직 잠겨 있어요',
    lockedHint: '다르게 플레이하면 만날 수 있을지도 몰라요.',
  },
  shareCard: {
    title: '공유 이미지',
    making: '이미지 만드는 중…',
    share: '이미지 공유',
    download: '이미지 저장',
    copy: '텍스트 복사',
    saveHint: '휴대폰에서는 이미지를 길게 눌러 저장할 수도 있어요.',
    failed: '이미지를 만들지 못했어요. 텍스트로 공유해 주세요.',
    cta: '조합 몇 개까지 모을 수 있을까?',
  },

  help: {
    title: '게임 방법',
    sections: [
      {
        title: '목표',
        body: [
          '시작하면 오늘 밤의 목표가 정해져요: 😴 꿀잠 또는 💞 스킨십. 상대에게도 목표가 있지만 비밀이에요.',
          '😴 꿀잠: 06:00까지 버티면서 수면 점수 7점을 모으세요 (잠든 턴 +1, 비몽사몽 +0.5).',
          '💞 스킨십: 날이 밝기 전에 친밀도를 100까지 올리세요. 단, 그 순간 상대가 깨어 있어야 해요.',
        ],
      },
      {
        title: '🔥 어려움 모드',
        body: [
          '시작 화면에서 ‘어려움’을 고를 수 있어요. 스킨십은 두 가지: ⏱️ 지금 당장({deadline} 전에 성공, 시간이 지나면 패배)과 🌅 아침 스킨십(먼저 푹 자고 {morning} 이후에만 인정, 너무 이르면 무승부).',
          '수면 점수는 {sleepWin}점이면 되지만, 잠은 ‘편하게’ 자야 점수가 돼요: 체온은 들쭉날쭉하고 한밤중엔 추워지며, 둘 다 깨어 있는데 아무것도 안 하면 친밀도가 떨어져요. 곰은 더위를 타고(체온 {bearLo}–{bearHi}), 롭이어 토끼는 추위를 타며({bunnyLo} 이상) 안정감도 더 필요해요.',
          '{dawn} 이후에는 다들 잠이 얕아져요. 아침 스킨십은 효과 두 배.',
        ],
      },
      {
        title: '매 턴',
        body: [
          '하룻밤은 12턴이에요 (한 턴에 40분). 내가 동작을 하나 고르면 → 상대가 움직이고 → 시간이 흘러요.',
          '💡 힌트 줄이 다음에 할 만한 일을 알려 주고, 추천 버튼은 반짝여요.',
        ],
      },
      {
        title: '눈 감기 vs 눈 뜨기',
        body: [
          '눈 감기: ‘💤 잠자기’로 졸음을 쌓을 수 있고, 상대는 내가 잠든 줄 알 수도 있어요. 대신 상대 상태가 안 보이고, 뽀뽀도 안아 주기도 못 해요.',
          '눈 뜨기: 상대의 기분·짜증·졸음이 보여요. 대신 잠들 수 없어요. 자다가 눈을 뜨면 잠이 깨 버려요.',
        ],
      },
      {
        title: '힘 조절',
        body: [
          '‘꾹 누르기’ 표시가 있는 동작은 힘을 모아야 해요. 버튼(또는 스페이스 바)을 꾹 누르고 초록 구간에서 떼세요.',
          '너무 약하면 효과가 절반이에요. 세게 하면 효과는 크지만 더 시끄럽고, 거칠게 하면 상대가 무조건 짜증 내요.',
        ],
      },
      {
        title: '소음과 깨우기',
        body: [
          '모든 동작에는 소음이 있어요. 상대가 자고 있을 때 소음이 ‘깨는 기준’을 넘으면 상대가 깨서 짜증을 내요.',
          '버튼 색: 초록 = 조용함, 노랑 = 깰 수도 있음, 빨강 = 무조건 깨움.',
        ],
      },
      {
        title: '상대의 짜증',
        body: [
          '짜증이 70 이상이면 상대가 나를 밀쳐 내요. 가장자리 밖으로 밀려나거나 짜증이 100이 되면 침대에서 걷어차여요.',
          '‘🤲 토닥토닥’으로 짜증을 풀어 줄 수 있고, 상대를 재울 수도 있어요.',
        ],
      },
      {
        title: '기타',
        body: [
          '이불: 뺏기면 추워지고, 추우면 잠을 잘 못 자요. ‘이불 덮어 주기’를 하면 상대가 좋아해요.',
          '너무 뒤척이면 안 자는 게 들통나요. 바로 누워 깊이 잠들면 코를 골아요. 팔베개는 달달하지만 팔이 저려요.',
          '상대의 말과 행동으로 목표를 추리해 보세요. 상대 칸에 나의 ‘직감’이 표시돼요.',
        ],
      },
      {
        title: '조작',
        body: [
          '마우스나 터치로 버튼을 누르세요. 스페이스 바 = 힘 모으기, E = 눈 감기/뜨기, H = 도움말, Esc = 취소.',
          '설정에서 언어를 바꾸고 효과음·힌트를 켜고 끌 수 있어요. ‘자동 힘 조절’을 켜면 힘 모으기 바를 건너뛰어요.',
        ],
      },
    ],
  },

  settings: {
    title: '설정',
    language: '언어',
    sound: '효과음',
    hints: '힌트 표시',
    autoForce: '자동 힘 조절 (힘 모으기 바 생략, 항상 부드럽게)',
    restart: '처음부터 다시',
    restartConfirm: '이번 판을 포기할까요?',
  },
};

export default ui;
