// 한국어: 게임 규칙이 만드는 모든 문구. zh-TW/game.ts와 키·구조가 완전히 같아야 한다.
// speech의 각 대사 풀은 zh-TW와 문장 수·순서가 같다(게임이 문장 번호로 각 언어를 대응시킴).
// 자리표시자 {name}은 fmt()가 채운다({n} = 규칙 수치. 예: 자고 싶어 하는 상대에게 필요한 기분 수치).
import type { GameMessages } from '../types';

/** goodnight_sleep / goodnight_intimacy 풀의 첫 두 줄은 공용 대사: 목표를 드러내지 않는 애매한 말 */
const SHARED_GOODNIGHT = ['음…… 잘 자.', '불 끌까?'];

const game: GameMessages = {
  action: {
    lieSupine: { label: '바로 눕기', hint: '반듯하게 바로 누워요. 바로 누운 채 깊이 잠들면 코를 골아요.' },
    lieSideFacing: { label: '마주 보기', hint: '상대 쪽으로 돌아누워요: 뽀뽀·안아 주기·쓰다듬기는 먼저 이렇게 누워야 해요.' },
    lieSideAway: { label: '등 돌리기', hint: '상대에게 등을 돌려요: 들이대기는 막을 수 있지만, 스킨십을 원하는 상대는 서운해해요.' },
    lieProne: { label: '엎드리기', hint: '엎드려서 자요 (상대만 이렇게 자요).' },
    hug: { label: '안아 주기', hint: '상대를 꼭 안아요 (상대가 옆으로 누워 있어야 해요). 안고 같이 자면 더 잘 자요.' },
    kiss: { label: '뽀뽀', hint: '뽀뽀해요: 친밀도가 크게 올라요. 상대가 나를 보고 있거나 바로 누워 있어야 해요.' },
    caress: { label: '쓰다듬기', hint: '상대를 살살 쓰다듬어요: 친밀도가 올라요. 상대가 어떤 자세든 괜찮아요.' },
    whisper: { label: '속삭이기', hint: '귓속말을 해요: 상대 기분이 좋아지고 친밀도가 조금 올라요. 아주 조용해요.' },
    pat: { label: '토닥토닥', hint: '상대를 토닥여요: 짜증을 풀어 주고 잠을 재워요. 코 고는 사람은 토닥이면 돌아누워요.' },
    offerArm: { label: '팔베개 해 주기', hint: '팔을 뻗어 그녀에게 팔베개를 해 줘요. 달달하지만 오래 베고 있으면 팔이 저려요.' },
    restOnArm: { label: '팔베개 베기', hint: '그의 팔을 베고 누워요: 친밀도 +5, 베고 있으면 더 잘 자요.' },
    leaveArm: { label: '팔베개 그만', hint: '팔에서 머리를 내려요. 그의 팔이 저릴 때 비켜 주면 무척 고마워해요.' },
    withdrawArm: { label: '팔 빼기', hint: '팔을 빼요. 너무 약하면 안 빠지고, 너무 세면 그녀가 깨요.' },
    pullBlanket: { label: '이불 당기기', hint: '이불을 내 쪽으로 당겨요: 나는 따뜻해지지만 상대는 추워져요.' },
    tuckBlanket: { label: '이불 덮어 주기', hint: '이불을 상대 쪽으로 덮어 줘요: 상대 기분이 좋아지고 친밀도가 조금 올라요.' },
    scootIn: { label: '다가가기', hint: '침대 가운데로 다가가요: 충분히 가까워야 상대에게 손이 닿아요.' },
    scootOut: { label: '물러나기', hint: '침대 가장자리 쪽으로 조금 물러나요. 너무 물러나면 침대에서 떨어져요!' },
    sleep: { label: '잠자기', hint: '잠에 집중해요: 졸음 +18. 먼저 눈을 감아야 해요.' },
    push: { label: '밀어내기', hint: '(상대 전용) 짜증이 70 이상이면 나를 밀어내요.' },
  },

  /** 동작을 할 수 없는 이유, 동작 메모, 내레이션 */
  msg: {
    alreadyPosture: '이미 그 자세예요',
    armPinned: '그녀가 내 팔을 베고 있어요. 먼저 팔을 빼야 해요',
    eyesClosedHug: '눈을 감고는 제대로 못 안아요. 먼저 눈을 뜨세요',
    eyesClosedKiss: '눈을 감고는 뽀뽀를 못 해요. 먼저 눈을 뜨세요',
    alreadyEmbrace: '이미 안고 있어요',
    needFacing: '먼저 상대 쪽으로 돌아누워야 해요',
    partnerNotSide: '상대가 옆으로 누워 있어야 안을 수 있어요',
    tooFar: '너무 멀어요. 먼저 다가가세요',
    partnerFacingAway: '상대가 등을 돌리고 있어요',
    partnerProne: '상대가 엎드려 자고 있어요',
    armAlreadyOffered: '이미 팔을 뻗었어요',
    offerNeedPosture: '바로 눕거나 그녀 쪽으로 돌아누워야 해요',
    herBackTurned: '그녀가 등을 돌리고 있어요',
    armNotOffered: '그가 아직 팔을 뻗지 않았어요',
    alreadyOnArm: '이미 팔베개를 베고 있어요',
    restNeedPosture: '바로 눕거나 그를 향해 돌아누워야 해요',
    notOnArm: '그의 팔을 베고 있지 않아요',
    armNotOut: '팔을 뻗지 않았어요',
    blanketAllMine: '이불이 벌써 전부 내 쪽에 있어요',
    blanketAllTheirs: '이불이 벌써 전부 상대 쪽에 있어요',
    alreadyClose: '이미 딱 붙어 있어요',
    atCenter: '이미 침대 한가운데예요',
    closeEyesFirst: '먼저 눈을 감으세요',
    onlyPartnerPushes: '밀어내기는 상대만 할 수 있어요',
    notAngryEnough: '아직 그 정도로 짜증 나진 않았어요',
    notAllowed: '할 수 없는 동작이에요',
    tooRough: '너무 거칠었어요',
    sneakHug: '몰래 꼭 안았어요',
    sneakKiss: '몰래 쪽 뽀뽀했어요',
    sneakCaress: '살살 쓰다듬었어요',
    ticklish: '간질간질해요',
    patRollOver: '토닥이자 돌아누우며 코골이가 멈췄어요',
    armStuck: '팔이 깔려서 안 빠져요',
    oneHandPull: '한 손뿐이라 잘 안 당겨져요',
    fellOffEdge: '침대 가장자리에서 굴러떨어졌어요!',
    partnerFellEdge: '상대가 침대 밖으로 떨어졌어요',
    edgePlayer: '벌써 침대 가장자리예요!',
    edgePartner: '상대가 벌써 침대 가장자리에 있어요',
    sleepCold: '추워서 잠이 잘 안 와요',
    sleepBadMood: '기분이 안 좋아서 잠이 안 와요',
    sleepArmPinned: '팔이 눌려서 잠이 잘 안 와요',
    tooLateAsleep: '상대는 이미 잠들었어요……',
    tooLateEndTurn: '친밀도가 가득 찼는데, 상대는 이미 잠들었어요……',
    rubEyes: '눈을 비비며 버텼어요',
    wokeYourself: '스스로 잠을 깨 버렸어요',
    partnerStoleBlanket: '상대가 잠결에 이불을 돌돌 말아 가져갔어요',
    partnerBurrito: '상대가 이불 김밥이 되어 버렸어요',
  },

  posture: {
    supine: '바로 누움',
    sideFacing: '마주 보고 누움',
    sideAway: '등 돌리고 누움',
    prone: '엎드림',
  },

  band: { timid: '너무 약함', gentle: '부드럽게', firm: '세게', rough: '거칠게' },

  goal: { sleep: '꿀잠', intimacy: '스킨십' },

  ending: {
    kickedOff: {
      title: '걷어차였다',
      caption: 'KICKED OUT',
      description: '발길질 한 방에 바닥으로 직행했어요. 잘 자요.',
      tip: '상대 짜증이 100이 되면 발로 차 버려요. 힘은 초록 구간에서, 짜증이 높을 땐 먼저 ‘토닥토닥’.',
    },
    fellOff: {
      title: '굴러떨어졌다',
      caption: 'FELL OFF',
      description: '아무도 안 건드렸는데 혼자 침대 밖으로 떨어졌어요.',
      tip: '‘물러나기’를 너무 많이 하면 침대에서 떨어져요. 위치 바의 빨간 가장자리를 조심하세요.',
    },
    intimacyWin: {
      title: '불이 꺼졌다',
      caption: 'LIGHTS OUT',
      description: '두 사람은 마주 보고 웃었어요. 오늘 밤엔 더 말이 필요 없겠죠.',
      tip: '완벽해요! 상대의 마음을 제대로 읽었어요.',
    },
    accidentalIntimacy: {
      title: '뜻밖의 밤',
      caption: 'PLOT TWIST',
      description: '그냥 자고 싶었을 뿐인데…… 뭐, 이것도 나쁘지 않네요.',
      tip: '잠에 집중하고 싶다면 상대에게 너무 다정하게 굴지 마세요.',
    },
    sleepWin: {
      title: '아침까지 꿀잠',
      caption: 'SWEET DREAMS',
      description: '06:00, 개운하게 눈을 떴어요.',
      tip: '완벽해요! 눈 감기, 따뜻하게, 뒤척이지 않기 — 꿀잠의 3요소예요.',
    },
    sleepLoseTired: {
      title: '다크서클',
      caption: 'SLEEPLESS',
      description: '날이 밝았는데, 한숨도 못 잤어요.',
      tip: '수면 점수 7점이 필요해요. 눈을 감고 ‘잠자기’를 자주 누르고, 따뜻하게 지내고, 깨지 않게 조심하세요.',
    },
    intimacyLoseFellAsleep: {
      title: '잠들어 버렸다',
      caption: 'OUT COLD',
      description: '오늘 밤은 어쩌고? 먼저 곯아떨어져 버렸어요.',
      tip: '스킨십이 목표라면 눈을 뜨고 있어요. ‘잠자기’만 계속 누르면 안 돼요.',
    },
    intimacyLoseMorning: {
      title: '날이 밝았다',
      caption: 'TOO LATE',
      description: '아무 일도 없었어요. 알람이 울려요.',
      tip: '‘마주 보기’ → ‘다가가기’ → ‘뽀뽀’ 순서로 해 보세요. 자고 싶어 하는 상대라면 먼저 기분을 {n}까지 올려야 해요.',
    },
  },

  /** 매 턴의 추천 (💡 힌트 줄) */
  hint: {
    edgeDanger: '침대에서 떨어지기 직전이에요! 가운데로 조금 다가가세요.',
    calmPartner: '상대가 잔뜩 짜증이 났어요. 먼저 토닥토닥 달래 주세요 (힘은 살살).',
    warmUp: '추워요! 이불을 다시 당겨 오세요 (자고 있었다면 살짝 깨요).',
    closeEyes: '먼저 눈을 감아야 잠들 수 있어요.',
    lullPartner: '상대가 아직 쌩쌩해요. 토닥토닥 먼저 재운 뒤에 마음 놓고 자요.',
    stayStill: '너무 뒤척이면 안 자는 게 들통나요. 얌전히 눈 감고 자요.',
    keepSleeping: '좋아요, 계속 눈 감고 자요.',
    sleepDone: '수면 점수 달성! 아침까지 계속 자요.',
    openEyes: '눈을 떠야 뽀뽀도 포옹도 할 수 있고, 상대 상태도 보여요.',
    faceThem: '먼저 ‘마주 보기’로 상대 쪽을 봐요.',
    scootCloser: '너무 멀어요. 먼저 ‘다가가기’로 가까이 가요.',
    partnerAsleep: '상대가 잠들었어요. 세게(노란 구간) 하면 깨울 수 있지만, 기분이 상할 수도 있어요.',
    partnerDeepSleep:
      '상대가 깊이 잠들었어요. 부드럽게도 세게도 못 깨우고, 거칠게 해야만 깨는데 엄청 화낼 거예요. 이불을 당겨서 추위에 잠이 얕아지게 하는 것도 방법이에요.',
    cheerUp: '상대 기분이 별로예요. 먼저 속삭이거나 이불을 덮어 주세요.',
    moodUp: '상대가 자고 싶은가 봐요. 먼저 기분을 {n}까지 올려 주세요 (속삭이기, 이불 덮어 주기).',
    kiss: '뽀뽀해 봐요. 힘은 초록 구간에서.',
    hug: '꼭 안아 봐요. 힘은 초록 구간에서.',
    caress: '살살 쓰다듬어요. 힘은 초록 구간에서.',
    whisper: '속삭이며 거리를 좁혀 봐요.',
    almostThere: '조금만 더! 상대가 깨어 있을 때 한 번 더 뽀뽀해요.',
  },

  speech: {
    // 시작: 두 풀의 1/3은 공용 애매한 대사라 목표가 바로 드러나지 않는다
    goodnight_sleep: [...SHARED_GOODNIGHT, '오늘 너무 피곤했어……', '내일 일찍 일어나야 돼. 얼른 자자.', '눈이 자꾸 감겨……', '잘 자. 나 깨우지 마~'],
    goodnight_intimacy: [...SHARED_GOODNIGHT, '오늘은…… 별로 안 피곤하네.', '벌써 자려고?', '너 오늘 좋은 냄새 난다.', '아직 안 졸린데……'],
    goodnight: ['나 먼저 잘게.', '잘 자, 잘 자~', '진짜 잔다. 건드리지 마.'],

    sleepTalk_sleep: ['음…… 그 보고서……', '싫어…… 5분만 더……', '(웅얼웅얼)…… 내일 하자……', '……알람…… 꺼 줘……'],
    sleepTalk_intimacy: ['음…… 좀 더 가까이……', '(웅얼웅얼)…… 안아 줘……', '……너 좋은 냄새 나……', '헤헤…… 가지 마……'],

    wake: ['응? 왜 그래……', '……뭐 해?', '나 방금 잠들었었는데……', '어? 몇 시야……'],
    wakeAngry: ['너 진짜 시끄러워!', '겨우 잠들었는데!', '잘 거야, 말 거야!', '아으—— 너 때문에 또 깼잖아!'],
    coldAwake: ['추워…… 이불 어디 갔어?', '아 뭐야! 이불 다 가져갔잖아!', '추워 죽겠어……'],

    refuseMood: ['지금은 그럴 기분 아니야.', '싫어……', '오늘은 안 내켜.'],
    refuseAnnoyed: ['건드리지 마.', '저리 가.', '나 화난 거 안 보여?'],
    sleepyDecline: ['너무 졸려…… 내일 하면 안 돼?', '음…… 좀 자게 해 줘……', '시간이 너무 늦었어……', '(뒤척)……얼른 자.'],
    okFine: ['알았어…… 잠깐만이야.', '진짜 못 말려……', '……그럼 조금만이다?'],

    receptiveKiss: ['헤헤……', '한 번 더……', '오늘 왜 이렇게 달달해?', '(발그레)'],
    receptiveHug: ['따뜻해……', '응, 더 꼭 안아 줘.', '이러고 있으니까 좋다.'],
    receptiveCaress: ['아, 간지러워……', '음…… 좋다.', '손 따뜻하다.'],
    whisperReply: ['히히, 귀찮게 굴기는.', '나도……', '진짜로?', '응응, 그래서?'],
    patReply: ['왜 토닥여…… 헤헤.', '나 애 아니거든……', '한 번 더 토닥여 줘.'],

    armOffered: ['자, 내 팔 베고 누워.', '여기 누울래?', '팔 빌려줄게.'],
    armAccepted: ['음…… 편하다.', '그럼 사양 안 할게~', '팔 따뜻하다.'],
    numbArm: ['팔…… 팔이 저려……', '내 팔이 내 팔이 아닌 것 같아……', '스읍…… 찌릿찌릿해……'],
    armRelieved: ['휴…… 팔이 드디어 살아났다.', '살았다……', '고마워…… (팔을 털며)'],

    blanketPulled: ['아, 이불!', '이불 다 가져가면 어떡해.', '으, 추워……'],
    blanketTucked: ['고마워……', '따뜻해.', '어쩜 이렇게 다정해.'],
    snore: ['시끄러워 죽겠네……', '코 고는 소리 진짜 크다……', '(귀를 막으며)……'],
    roughComplaint: ['너무 거칠잖아!', '지금 나 때린 거야?', '살살 좀 해!', '아프다고!'],

    noticedIntimacy: ['너도 아직 안 자?', '어, 너 깨어 있어?', '잠 안 와? ……나도.'],
    noticedSleep: ['그만 좀 뒤척여.', '너 자긴 잘 거야?', '침대가 계속 흔들리잖아……'],
    breathTell: ['숨소리가 너무 규칙적인데? 안 자지?', '연기하지 마. 깨어 있는 거 다 알아.', '……자는 척하는 거야?'],
    stare: ['왜 자꾸 쳐다봐?', '눈 감고 자.', '뭘 그렇게 빤히 봐……'],

    push: ['좀 저리 가!', '좁다고!', '비켜!'],
    kick: ['침대에서 내려가!', '소파 가서 자!', '나가——!'],
    fellOff: ['아야……', '쿵! ……내가 왜 바닥에 있지?', '……바닥 차갑다.'],
    tooLate: ['……잠들었어?', '하필 지금 잠들면 어떡해……', '(한숨)'],
    intimacyHigh: ['심장이 막 뛰어……', '오늘따라 왜 이렇게 달라붙어?', '분위기가…… 뭔가 다른데?'],
    partnerInitiate: ['피하지 마~', '좀 더 가까이 와~', '왜 이렇게 멀리 있어?'],
    wakeUp: ['일어나~', '어, 자는 거야? 나랑 놀아 줘~', '자지 마!'],

    // 엔딩 화면: morning_{내 목표}_{상대 목표}; together = 스킨십 성공, floor = 침대에서 떨어짐
    morning_sleep_sleep: ['“좋은 아침. 어젯밤에 무슨 생각 했어?” “아니, 딱히?”', '“잘 잤다~” “응, 오랜만에 아침까지 푹 잤어.”', '“좋은 아침…… 너 어젯밤에 코 골더라.” “너도.”'],
    morning_intimacy_sleep: ['“어젯밤에 왜 그렇게 꼼지락거렸어?” “……아무것도 아니야.”', '“어젯밤에 잘 잤어?” “그…… 그럭저럭.”', '“너 다크서클 장난 아니다.” “……응.”'],
    morning_sleep_intimacy: ['“……나 어젯밤에 신호 보냈었는데.” “그랬어??”', '“어제 엄청 빨리 잠들더라.” “응, 완전 피곤했거든.” “……아, 그래.”', '“오늘은 일찍 들어와, 알았지?” “응? 그래.”'],
    morning_intimacy_intimacy: ['“사실 나도 어젯밤에…… 아니다, 좋은 아침.”', '“우리 어젯밤에 서로 먼저 말 꺼내길 기다린 거지?”', '“……오늘 밤에 다시 해 볼까?” “좋아.”'],
    morning_together: ['“좋은 아침.” “……좋은 아침.” (마주 보고 웃는다)', '“어젯밤……” “쉿, 말하지 마.”', '“오늘은 좀 늦게 일어나도 돼?” “응, 그러자.”'],
    morning_floor: ['“어젯밤에 왜 바닥에서 잤어?” “……몰라서 물어?”', '“허리는 괜찮아?” “……안 괜찮아.”', '“미안해애……” “흥.”'],
  },
};

export default game;
