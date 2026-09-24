// 简体中文(中国大陆):游戏规则产生的所有文字。结构必须和繁中参考语系(zh-TW)完全一致。
// speech 每个池的句数与顺序要和 zh-TW 一致(游戏用句子序号对应各语系)。
// 占位符:{name} 由 fmt() 代入({n} = 规则数值,例如想睡的对方需要的心情门槛)。
import type { GameMessages } from '../types';

const SHARED_GOODNIGHT = ['嗯……晚安。', '要关灯吗?'];

const game: GameMessages = {
  action: {
    lieSupine: { label: '平躺', hint: '翻身平躺。睡熟了平躺会打呼噜。' },
    lieSideFacing: { label: '侧躺面向', hint: '面向对方侧躺:亲吻、拥抱、爱抚都得先这么躺。' },
    lieSideAway: { label: '侧躺背对', hint: '背对对方:能防撩,但想亲热的对方会失落。' },
    lieProne: { label: '趴睡', hint: '趴着睡(只有对方会这么睡)。' },
    hug: { label: '拥抱', hint: '抱住对方(对方要侧躺)。抱着一起睡会睡得更香。' },
    kiss: { label: '亲吻', hint: '亲吻:亲密度大涨。对方要面向你或平躺。' },
    caress: { label: '爱抚', hint: '轻抚对方:亲密度上涨,对方什么姿势都行。' },
    whisper: { label: '说悄悄话', hint: '说悄悄话:对方心情变好、亲密度小涨,很安静。' },
    pat: { label: '拍拍安抚', hint: '拍拍对方:消消火气、哄对方入睡;打呼噜的人被拍会翻个身。' },
    offerArm: { label: '伸手当枕头', hint: '伸出手臂让她枕着。很甜,但枕久了手会麻。' },
    restOnArm: { label: '枕上手臂', hint: '枕在他的手臂上:亲密度 +5,枕着更好睡。' },
    leaveArm: { label: '离开手臂', hint: '把头挪开。他手麻的时候会很感激你。' },
    withdrawArm: { label: '收回手臂', hint: '把手臂抽回来。太轻抽不出来,太用力会把她吵醒。' },
    pullBlanket: { label: '拉被子', hint: '把被子拉到自己这边:自己暖和了,但对方会冷。' },
    tuckBlanket: { label: '帮对方盖好', hint: '把被子往对方那边盖:对方心情变好、亲密度小涨。' },
    scootIn: { label: '挪近', hint: '往床中间挪:离得够近才够得着对方。' },
    scootOut: { label: '挪开', hint: '往床沿挪开一点。挪太多会掉下床!' },
    sleep: { label: '闭眼睡', hint: '专心睡觉:睡意 +18。要先闭上眼睛。' },
    push: { label: '推开', hint: '(对方专用)火气 70 以上会把你推开。' },
  },

  /** 动作不可用的原因、动作附注、旁白 */
  msg: {
    alreadyPosture: '已经是这个姿势了',
    armPinned: '她正枕着你的手臂,得先收回手臂',
    eyesClosedHug: '闭着眼抱不准,先睁开眼睛',
    eyesClosedKiss: '闭着眼亲不到,先睁开眼睛',
    alreadyEmbrace: '已经抱着了',
    needFacing: '得先侧躺面向对方',
    partnerNotSide: '对方要侧躺才抱得住',
    tooFar: '离得太远,先挪近一点',
    partnerFacingAway: '对方背对着你',
    partnerProne: '对方趴着睡呢',
    armAlreadyOffered: '手已经伸出去了',
    offerNeedPosture: '得平躺或侧躺面向她',
    herBackTurned: '她背对着你',
    armNotOffered: '他还没伸出手臂',
    alreadyOnArm: '已经枕着了',
    restNeedPosture: '得平躺或侧躺面向他',
    notOnArm: '你没枕着他的手',
    armNotOut: '手没伸出去',
    blanketAllMine: '被子已经全在你这边了',
    blanketAllTheirs: '被子已经全在对方那边了',
    alreadyClose: '已经贴得很近了',
    atCenter: '已经在床中间了',
    closeEyesFirst: '先闭上眼睛',
    onlyPartnerPushes: '只有对方会推人',
    notAngryEnough: '还没那么生气',
    notAllowed: '你不能做这个动作',
    tooRough: '太粗鲁了',
    sneakHug: '偷偷抱住了',
    sneakKiss: '偷偷亲了一下',
    sneakCaress: '轻轻摸了摸',
    ticklish: '痒痒的',
    patRollOver: '拍一下就翻身不打呼噜了',
    armStuck: '手被压着,抽不出来',
    oneHandPull: '只剩一只手,拉不太动',
    fellOffEdge: '你从床沿滚下去了!',
    partnerFellEdge: '对方掉到床沿外面了',
    edgePlayer: '你已经在床沿了!',
    edgePartner: '对方已经在床沿了',
    sleepCold: '好冷,睡不好',
    sleepBadMood: '心情不好,睡不着',
    sleepArmPinned: '手臂被压着,睡不好',
    tooLateAsleep: '对方已经睡着了……',
    tooLateEndTurn: '亲密度满了,可对方已经睡着了……',
    rubEyes: '你揉揉眼睛,硬撑着',
    wokeYourself: '你把自己弄醒了',
    partnerStoleBlanket: '对方在睡梦中把被子卷走了',
    partnerBurrito: '对方把自己卷成了春卷',
  },

  posture: {
    supine: '平躺',
    sideFacing: '侧躺面向对方',
    sideAway: '侧躺背对对方',
    prone: '趴睡',
  },

  band: { timid: '太轻', gentle: '温柔', firm: '用力', rough: '粗鲁' },

  goal: { sleep: '好好睡觉', intimacy: '亲热' },

  ending: {
    kickedOff: {
      title: '被踢下床',
      caption: 'KICKED OUT',
      description: '你被一脚踹到了地板上。晚安。',
      tip: '对方火气到 100 就会踹人。力道保持在绿区,火气大时先“拍拍安抚”。',
    },
    fellOff: {
      title: '掉下床',
      caption: 'FELL OFF',
      description: '没人碰你,你自己滚下去了。',
      tip: '“挪开”太多次会掉下床,留意床位条上红色的床沿。',
    },
    intimacyWin: {
      title: '熄灯了',
      caption: 'LIGHTS OUT',
      description: '两人相视一笑。今晚,尽在不言中。',
      tip: '完美!你读懂了对方的心思。',
    },
    accidentalIntimacy: {
      title: '意外之夜',
      caption: 'PLOT TWIST',
      description: '你本来只想睡觉的……算了,也不错。',
      tip: '想专心睡觉的话,别对对方太热情。',
    },
    sleepWin: {
      title: '一夜好眠',
      caption: 'SWEET DREAMS',
      description: '06:00,你神清气爽地醒来。',
      tip: '完美!闭眼、保暖、不乱动,就是好眠三要素。',
    },
    sleepLoseTired: {
      title: '黑眼圈',
      caption: 'SLEEPLESS',
      description: '天亮了,你压根没睡着。',
      tip: '睡眠分数要到 7 分:闭上眼睛多按“闭眼睡”,注意保暖,别被吵醒。',
    },
    intimacyLoseFellAsleep: {
      title: '你睡着了',
      caption: 'OUT COLD',
      description: '说好的今晚呢?你倒先睡着了。',
      tip: '想亲热就睁着眼睛,别一直闭眼睡。',
    },
    intimacyLoseMorning: {
      title: '天亮了',
      caption: 'TOO LATE',
      description: '什么都没发生。闹钟响了。',
      tip: '先侧躺面向对方、挪近,再亲吻。对方想睡的话,得先把对方心情哄到 {n}。',
    },
  },

  /** 每回合的提示(💡 提示栏) */
  hint: {
    edgeDanger: '你快掉下床了!往中间挪一挪。',
    calmPartner: '对方火气很大,先拍拍安抚(力道放轻)。',
    warmUp: '好冷!把被子拉回来(睡着时这么做会稍微醒过来)。',
    closeEyes: '先闭上眼睛,才能开始睡。',
    lullPartner: '对方还很精神:先拍拍哄对方睡,你再安心睡。',
    stayStill: '翻身太多会被发现没睡,乖乖闭眼睡。',
    keepSleeping: '很好,继续闭眼睡。',
    sleepDone: '睡眠分数达标了!继续睡,撑到天亮。',
    openEyes: '睁开眼睛才能亲吻、拥抱,也看得到对方的状态。',
    faceThem: '先“侧躺面向”对方。',
    scootCloser: '离得太远,先“挪近”一点。',
    partnerAsleep: '对方睡着了。用力一点(黄区)的亲吻也许能叫醒对方,但也可能把人惹毛。',
    cheerUp: '对方心情不好,先说说悄悄话或帮对方盖好被子。',
    moodUp: '对方好像想睡:先把对方心情哄到 {n}(说悄悄话、盖被子)。',
    kiss: '亲一个试试,力道停在绿区。',
    hug: '抱一抱试试,力道停在绿区。',
    caress: '轻抚对方,力道停在绿区。',
    whisper: '说说悄悄话,拉近距离。',
    almostThere: '就差一点!趁对方还醒着再亲一下。',
  },

  speech: {
    // 开场:两个池各有 1/3 共用的暧昧句,不直接暴露目标
    goodnight_sleep: [...SHARED_GOODNIGHT, '今天好累……', '明天要早起,早点睡吧。', '眼睛快睁不开了……', '晚安,别吵我哦。'],
    goodnight_intimacy: [...SHARED_GOODNIGHT, '今天……不太累诶。', '这么早就要睡啦?', '你今天好香哦。', '还不想睡呢……'],
    goodnight: ['我先睡啦。', '晚安晚安。', '真的要睡了,别吵我。'],

    sleepTalk_sleep: ['嗯……那个报表……', '不要……再睡五分钟……', '(嘟囔)……明天再说……', '……闹钟……关掉……'],
    sleepTalk_intimacy: ['嗯……再靠近一点……', '(嘟囔)……抱我……', '……你好香……', '嘿嘿……别走……'],

    wake: ['嗯?怎么了……', '……你干嘛?', '我刚才都睡着了诶……', '啊?几点了……'],
    wakeAngry: ['你好吵啊!', '我好不容易才睡着!', '你到底还睡不睡!', '啊——又被你吵醒了!'],
    coldAwake: ['好冷……被子呢?', '诶!被子被抢走了啦!', '冷死了……'],

    refuseMood: ['我现在没心情。', '不要啦……', '今天不想。'],
    refuseAnnoyed: ['别碰我。', '你走开啦。', '我在生气,看不出来吗?'],
    sleepyDecline: ['我好困……明天好不好?', '嗯……让我睡嘛……', '很晚了诶……', '(翻身)……睡觉啦。'],
    okFine: ['好吧……就一会儿。', '真拿你没办法……', '……那就一小会儿哦。'],

    receptiveKiss: ['嘿嘿……', '再亲一下……', '你今天怎么这么甜?', '(脸红)'],
    receptiveHug: ['好暖和……', '嗯,抱紧一点。', '这样好舒服。'],
    receptiveCaress: ['好痒啦……', '嗯……好舒服。', '你的手好暖。'],
    whisperReply: ['嘻嘻,你好烦哦。', '我也是……', '真的假的?', '嗯哼,然后呢?'],
    patReply: ['干嘛拍我啦……嘿嘿。', '我又不是小孩子……', '再拍一下嘛。'],

    armOffered: ['来,枕我的胳膊。', '要不要躺这儿?', '胳膊借你。'],
    armAccepted: ['嗯……好舒服。', '那我就不客气啦。', '你的手好暖。'],
    numbArm: ['手……手麻了……', '我的手好像不是我的了……', '嘶……好麻……'],
    armRelieved: ['呼……手终于活过来了。', '得救了……', '谢谢……(甩甩手)'],

    blanketPulled: ['诶,被子!', '你把被子全抢走啦。', '好冷哦……'],
    blanketTucked: ['谢谢……', '好暖。', '你好贴心哦。'],
    snore: ['吵死了……', '你呼噜打得好响……', '(捂耳朵)……'],
    roughComplaint: ['太粗鲁了!', '你是在打我吗?', '轻点儿啦!', '好痛啊!'],

    noticedIntimacy: ['你也还没睡?', '嘿,你还醒着呀?', '睡不着吗?……我也是。'],
    noticedSleep: ['别老翻来翻去的。', '你到底睡不睡?', '床一直在晃诶……'],
    breathTell: ['你呼吸太规律了,没睡着吧?', '别装了,我知道你醒着。', '……你在装睡吧?'],
    stare: ['你干嘛一直看我?', '闭上眼睛睡觉啦。', '盯着我干嘛……'],

    push: ['过去点儿啦!', '你挤到我了!', '走开啦!'],
    kick: ['给我下去!', '去睡沙发!', '滚——!'],
    fellOff: ['好痛……', '咚!……我怎么在地上?', '……地板好凉。'],
    tooLate: ['……睡着了?', '怎么偏偏这时候睡着……', '(叹气)'],
    intimacyHigh: ['心跳好快……', '你今天怎么这么黏人?', '气氛好像……有点不一样。'],
    partnerInitiate: ['别躲啦。', '过来一点嘛。', '你离我好远哦。'],
    wakeUp: ['起来啦~', '诶,你睡着啦?陪我嘛。', '不许睡!'],

    // 结局画面:morning_{玩家目标}_{对方目标};together = 亲热成功、floor = 掉下床
    morning_sleep_sleep: ['“早安。你昨晚有没有什么想法?”“没有啊?”', '“睡得好香啊。”“是啊,难得一觉睡到天亮。”', '“早……你昨晚打呼噜了哦。”“你也打了。”'],
    morning_intimacy_sleep: ['“你昨晚老动来动去的,干嘛呢?”“……没事。”', '“昨晚睡得好吗?”“还……还行。”', '“你黑眼圈好重啊。”“……嗯。”'],
    morning_sleep_intimacy: ['“……我昨晚暗示你了诶。”“有吗??”', '“你昨天睡得好快啊。”“对啊,累死了。”“……哦。”', '“今晚早点回家好不好?”“好啊?”'],
    morning_intimacy_intimacy: ['“其实我昨晚也……算了,早安。”', '“我们昨晚是不是都在等对方先开口?”', '“……今晚再试一次?”“好。”'],
    morning_together: ['“早安。”“……早安。”(相视一笑)', '“昨晚……”“嘘,别说。”', '“今天可以晚点起吗?”“可以。”'],
    morning_floor: ['“你昨晚怎么睡在地上?”“……你说呢。”', '“背还好吗?”“……不好。”', '“对不起嘛……”“哼。”'],
  },
};

export default game;
