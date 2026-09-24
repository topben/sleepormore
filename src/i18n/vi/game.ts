// Tiếng Việt: toàn bộ văn bản do luật chơi tạo ra. Cấu trúc phải giống hệt zh-TW.
// Mỗi nhóm thoại (speech) giữ đúng số câu và thứ tự như zh-TW (game đối chiếu theo số thứ tự câu).
// Các nhóm thoại dùng chung có thể do chàng hoặc nàng nói → tránh đại từ; nếu bắt buộc thì dùng "mình".
import type { GameMessages } from '../types';

// Hai câu mở đầu mập mờ, dùng chung cho cả hai nhóm chúc ngủ ngon (không lộ mục tiêu)
const SHARED_GOODNIGHT = ['Ừm… ngủ ngon.', 'Tắt đèn nhé?'];

const game: GameMessages = {
  action: {
    lieSupine: { label: 'Nằm ngửa', hint: 'Trở mình nằm ngửa. Ngủ say mà nằm ngửa là sẽ ngáy.' },
    lieSideFacing: {
      label: 'Quay mặt vào',
      hint: 'Nằm nghiêng quay mặt về phía người ấy: muốn hôn, ôm hay vuốt ve đều phải nằm thế này trước.',
    },
    lieSideAway: {
      label: 'Quay lưng',
      hint: 'Quay lưng lại với người ấy: chặn được mấy trò quấy rầy, nhưng nếu người ấy đang muốn gần gũi thì sẽ hụt hẫng.',
    },
    lieProne: { label: 'Nằm sấp', hint: 'Nằm sấp mà ngủ (chỉ người ấy mới ngủ kiểu này).' },
    hug: { label: 'Ôm', hint: 'Ôm lấy người ấy (người ấy phải đang nằm nghiêng). Ôm nhau mà ngủ thì ngon giấc hơn.' },
    kiss: { label: 'Hôn', hint: 'Hôn: độ thân mật tăng mạnh. Người ấy phải đang quay mặt về phía bạn hoặc nằm ngửa.' },
    caress: { label: 'Vuốt ve', hint: 'Vuốt ve người ấy: tăng độ thân mật, người ấy nằm tư thế nào cũng được.' },
    whisper: { label: 'Thì thầm', hint: 'Thì thầm to nhỏ: tâm trạng người ấy tốt lên, độ thân mật tăng nhẹ, lại rất yên lặng.' },
    pat: {
      label: 'Vỗ về',
      hint: 'Vỗ về người ấy: làm dịu bực bội, dỗ người ấy ngủ; ai đang ngáy mà được vỗ sẽ trở mình.',
    },
    offerArm: { label: 'Cho gối tay', hint: 'Duỗi tay ra cho cô ấy gối đầu. Ngọt ngào lắm, nhưng gối lâu sẽ tê tay.' },
    restOnArm: { label: 'Gối lên tay', hint: 'Gối đầu lên tay anh ấy: độ thân mật +5, gối thế này dễ ngủ hơn.' },
    leaveArm: { label: 'Thôi gối tay', hint: 'Nhấc đầu ra. Lúc đang tê tay, anh ấy sẽ cảm kích bạn lắm.' },
    withdrawArm: { label: 'Rút tay về', hint: 'Rút tay về. Nhẹ quá thì rút không ra, mạnh quá sẽ làm cô ấy thức giấc.' },
    pullBlanket: { label: 'Kéo chăn', hint: 'Kéo chăn về phía mình: bạn ấm hơn, nhưng người ấy sẽ lạnh.' },
    tuckBlanket: {
      label: 'Đắp chăn giúp',
      hint: 'Kéo chăn đắp sang cho người ấy: tâm trạng người ấy tốt lên, độ thân mật tăng nhẹ.',
    },
    scootIn: { label: 'Nhích lại gần', hint: 'Nhích vào giữa giường: phải đủ gần mới với tới người ấy.' },
    scootOut: { label: 'Nhích ra', hint: 'Nhích ra phía mép giường một chút. Nhích nhiều quá là rơi khỏi giường đấy!' },
    sleep: { label: 'Ngủ', hint: 'Chuyên tâm ngủ: độ buồn ngủ +18. Phải nhắm mắt trước đã.' },
    push: { label: 'Đẩy ra', hint: '(Chỉ người ấy dùng) Khi bực bội từ 70 trở lên, người ấy sẽ đẩy bạn ra.' },
  },

  /** Lý do không làm được động tác, ghi chú kèm động tác, lời dẫn */
  msg: {
    alreadyPosture: 'Đang nằm tư thế này rồi',
    armPinned: 'Cô ấy đang gối lên tay bạn, phải rút tay về trước đã',
    eyesClosedHug: 'Nhắm mắt thì ôm hụt mất, mở mắt ra trước đã',
    eyesClosedKiss: 'Nhắm mắt thì hôn trượt mất, mở mắt ra trước đã',
    alreadyEmbrace: 'Đang ôm nhau rồi',
    needFacing: 'Phải nằm nghiêng quay mặt về phía người ấy trước',
    partnerNotSide: 'Người ấy phải nằm nghiêng mới ôm được',
    tooFar: 'Xa quá, nhích lại gần chút đã',
    partnerFacingAway: 'Người ấy đang quay lưng về phía bạn',
    partnerProne: 'Người ấy đang nằm sấp ngủ',
    armAlreadyOffered: 'Đã đưa tay ra rồi',
    offerNeedPosture: 'Phải nằm ngửa hoặc nằm nghiêng quay về phía cô ấy',
    herBackTurned: 'Cô ấy đang quay lưng về phía bạn',
    armNotOffered: 'Anh ấy chưa đưa tay ra',
    alreadyOnArm: 'Đang gối lên tay rồi',
    restNeedPosture: 'Phải nằm ngửa hoặc nằm nghiêng quay về phía anh ấy',
    notOnArm: 'Bạn đâu có gối lên tay anh ấy',
    armNotOut: 'Chưa đưa tay ra mà',
    blanketAllMine: 'Chăn đã về hết phía bạn rồi',
    blanketAllTheirs: 'Chăn đã sang hết phía người ấy rồi',
    alreadyClose: 'Đã sát nhau lắm rồi',
    atCenter: 'Đã ở giữa giường rồi',
    closeEyesFirst: 'Nhắm mắt lại trước đã',
    onlyPartnerPushes: 'Chỉ người ấy mới đẩy người',
    notAngryEnough: 'Chưa giận đến mức đó',
    notAllowed: 'Bạn không làm động tác này được',
    tooRough: 'Thô bạo quá',
    sneakHug: 'Lén ôm được rồi',
    sneakKiss: 'Lén hôn một cái',
    sneakCaress: 'Khẽ vuốt ve một chút',
    ticklish: 'Nhồn nhột',
    patRollOver: 'Vỗ nhẹ một cái là trở mình, hết ngáy',
    armStuck: 'Tay bị đè, rút không ra',
    oneHandPull: 'Chỉ còn một tay, kéo chẳng được mấy',
    fellOffEdge: 'Bạn lăn khỏi mép giường rồi!',
    partnerFellEdge: 'Người ấy rơi ra ngoài mép giường rồi',
    edgePlayer: 'Bạn đã ra sát mép giường rồi!',
    edgePartner: 'Người ấy đã ra sát mép giường rồi',
    sleepCold: 'Lạnh quá, ngủ không ngon',
    sleepBadMood: 'Tâm trạng không tốt, khó ngủ',
    sleepArmPinned: 'Tay bị đè, ngủ không ngon',
    tooLateAsleep: 'Người ấy ngủ mất rồi…',
    tooLateEndTurn: 'Độ thân mật đã đầy, mà người ấy lại ngủ mất rồi…',
    rubEyes: 'Bạn dụi mắt, cố gượng tỉnh',
    wokeYourself: 'Bạn tự làm mình tỉnh giấc',
    partnerStoleBlanket: 'Người ấy ngủ mơ mà cuốn mất chăn rồi',
    partnerBurrito: 'Người ấy cuộn mình thành cuốn nem rồi',
  },

  // Dùng giữa câu ("Bạn chuyển sang {posture}") nên viết thường
  posture: {
    supine: 'nằm ngửa',
    sideFacing: 'nằm nghiêng quay mặt vào',
    sideAway: 'nằm nghiêng quay lưng lại',
    prone: 'nằm sấp',
  },

  band: { timid: 'Quá nhẹ', gentle: 'Nhẹ nhàng', firm: 'Mạnh tay', rough: 'Thô bạo' },

  goal: { sleep: 'Ngủ thật ngon', intimacy: 'Gần gũi' },

  ending: {
    kickedOff: {
      title: 'Bị đá khỏi giường',
      caption: 'KICKED OUT',
      description: 'Bạn bị đạp một phát rơi xuống sàn. Ngủ ngon nhé.',
      tip: 'Độ bực bội của người ấy lên tới 100 là bạn bị đạp ngay. Giữ lực trong vùng xanh; khi người ấy đang bực thì “Vỗ về” trước đã.',
    },
    fellOff: {
      title: 'Rơi khỏi giường',
      caption: 'FELL OFF',
      description: 'Chẳng ai đụng vào bạn, tự bạn lăn xuống đấy.',
      tip: '“Nhích ra” nhiều lần quá sẽ rơi khỏi giường, để ý phần mép giường màu đỏ trên thanh Chỗ nằm.',
    },
    intimacyWin: {
      title: 'Đèn đã tắt',
      caption: 'LIGHTS OUT',
      description: 'Hai người nhìn nhau mỉm cười. Đêm nay chẳng cần nói thêm gì nữa.',
      tip: 'Hoàn hảo! Bạn đã đọc được tâm trạng của người ấy.',
    },
    accidentalIntimacy: {
      title: 'Một đêm bất ngờ',
      caption: 'PLOT TWIST',
      description: 'Bạn vốn chỉ định ngủ thôi mà… thôi kệ, vậy cũng không tệ.',
      tip: 'Nếu muốn chuyên tâm ngủ, đừng quá nhiệt tình với người ấy.',
    },
    sleepWin: {
      title: 'Một đêm ngon giấc',
      caption: 'SWEET DREAMS',
      description: '06:00, bạn thức dậy tỉnh táo, sảng khoái.',
      tip: 'Hoàn hảo! Nhắm mắt, giữ ấm, nằm yên — ba bí quyết để ngủ ngon.',
    },
    sleepLoseTired: {
      title: 'Mắt gấu trúc',
      caption: 'SLEEPLESS',
      description: 'Trời sáng rồi mà bạn gần như chưa chợp mắt được tí nào.',
      tip: 'Cần đạt 7 điểm ngủ: nhắm mắt rồi bấm “Ngủ” thật đều, nhớ giữ ấm và đừng để bị đánh thức.',
    },
    intimacyLoseFellAsleep: {
      title: 'Bạn ngủ mất rồi',
      caption: 'OUT COLD',
      description: 'Đã hẹn là đêm nay cơ mà? Vậy mà bạn lại ngủ trước.',
      tip: 'Muốn gần gũi thì giữ mắt mở, đừng cứ nhắm mắt ngủ mãi.',
    },
    intimacyLoseMorning: {
      title: 'Trời sáng rồi',
      caption: 'TOO LATE',
      description: 'Chẳng có gì xảy ra cả. Chuông báo thức reo rồi.',
      tip: 'Hãy “Quay mặt vào”, “Nhích lại gần” rồi mới hôn. Người ấy mà muốn ngủ thì phải nâng tâm trạng người ấy lên {n} trước.',
    },
  },

  /** Gợi ý mỗi lượt (thanh 💡) */
  hint: {
    edgeDanger: 'Bạn sắp rơi khỏi giường rồi! Nhích vào giữa một chút.',
    calmPartner: 'Người ấy đang rất bực bội, hãy “Vỗ về” trước (nhẹ tay thôi).',
    warmUp: 'Lạnh quá! Kéo chăn về đi (đang ngủ thì sẽ hơi tỉnh giấc).',
    closeEyes: 'Nhắm mắt lại trước thì mới bắt đầu ngủ được.',
    lullPartner: 'Người ấy vẫn còn tỉnh như sáo: vỗ về dỗ người ấy ngủ trước, rồi bạn hẵng yên tâm ngủ.',
    stayStill: 'Trằn trọc nhiều quá sẽ bị phát hiện là chưa ngủ, ngoan ngoãn nhắm mắt ngủ đi.',
    keepSleeping: 'Tốt lắm, cứ tiếp tục nhắm mắt ngủ.',
    sleepDone: 'Điểm ngủ đã đạt rồi! Ngủ tiếp, cố đến sáng nhé.',
    openEyes: 'Mở mắt ra mới hôn, ôm được, lại còn thấy được trạng thái của người ấy.',
    faceThem: 'Hãy “Quay mặt vào” người ấy trước.',
    scootCloser: 'Xa quá, hãy “Nhích lại gần” một chút.',
    partnerAsleep: 'Người ấy ngủ rồi. Mạnh tay hơn (vùng vàng) là gọi dậy được, nhưng người ấy có thể không vui.',
    partnerDeepSleep:
      'Người ấy ngủ rất say: nhẹ nhàng hay mạnh tay đều không gọi dậy được, chỉ thô bạo mới được (và người ấy sẽ rất bực). Kéo chăn đi cho người ấy lạnh mà ngủ nông hơn cũng là một cách.',
    cheerUp: 'Tâm trạng người ấy không tốt, hãy thì thầm hoặc đắp chăn giúp người ấy trước.',
    moodUp: 'Người ấy có vẻ muốn ngủ: hãy nâng tâm trạng người ấy lên {n} trước (thì thầm, đắp chăn).',
    kiss: 'Thử hôn xem, giữ lực trong vùng xanh.',
    hug: 'Thử ôm xem, giữ lực trong vùng xanh.',
    caress: 'Vuốt ve người ấy, giữ lực trong vùng xanh.',
    whisper: 'Thì thầm vài câu cho gần nhau hơn.',
    almostThere: 'Sắp được rồi! Hôn thêm cái nữa khi người ấy còn thức.',
  },

  speech: {
    // Mở đầu: mỗi nhóm có 1/3 là câu mập mờ dùng chung, không lộ thẳng mục tiêu
    goodnight_sleep: [
      ...SHARED_GOODNIGHT,
      'Hôm nay mệt quá…',
      'Mai phải dậy sớm, ngủ sớm thôi.',
      'Mắt sắp díp lại rồi…',
      'Ngủ ngon nha, cấm phá đó.',
    ],
    goodnight_intimacy: [
      ...SHARED_GOODNIGHT,
      'Hôm nay… cũng không mệt lắm đâu.',
      'Ngủ sớm vậy luôn hả?',
      'Sao hôm nay thơm thế nhỉ?',
      'Vẫn chưa muốn ngủ đâu…',
    ],
    goodnight: ['Ngủ trước nha.', 'Ngủ ngon, ngủ ngon.', 'Ngủ thật đây, đừng phá nữa.'],

    sleepTalk_sleep: ['Ừm… cái báo cáo đó…', 'Không… thêm năm phút nữa…', '(lầm bầm)… để mai tính…', '…báo thức… tắt đi…'],
    sleepTalk_intimacy: ['Ừm… lại gần chút nữa…', '(lầm bầm)… ôm cái nào…', '…thơm quá…', 'Hì hì… đừng đi mà…'],

    wake: ['Hửm? Sao vậy…', '…làm gì đó?', 'Vừa mới ngủ được mà…', 'Hả? Mấy giờ rồi…'],
    wakeAngry: ['Ồn quá đi!', 'Khó khăn lắm mới ngủ được đó!', 'Có chịu ngủ không thì bảo!', 'Hừ — lại bị phá giấc nữa rồi!'],
    coldAwake: ['Lạnh quá… chăn đâu rồi?', 'Ê! Chăn bị kéo mất rồi!', 'Lạnh chết mất…'],

    refuseMood: ['Giờ không có tâm trạng.', 'Thôi mà…', 'Hôm nay không muốn.'],
    refuseAnnoyed: ['Đừng đụng vào.', 'Tránh ra đi.', 'Đang giận đó, không thấy à?'],
    sleepyDecline: ['Buồn ngủ quá… để mai nha?', 'Ừm… cho ngủ đi mà…', 'Khuya lắm rồi đó…', '(trở mình)… ngủ đi.'],
    okFine: ['Thôi được… một chút thôi đó.', 'Đúng là chịu thua luôn…', '…vậy chỉ một xíu thôi nha.'],

    receptiveKiss: ['Hì hì…', 'Thêm chút nữa…', 'Sao hôm nay ngọt ngào thế?', '(đỏ mặt)'],
    receptiveHug: ['Ấm quá…', 'Ừm, ôm chặt chút nữa.', 'Thế này dễ chịu ghê.'],
    receptiveCaress: ['Nhột quá à…', 'Ừm… dễ chịu quá.', 'Tay ấm ghê.'],
    whisperReply: ['Hì hì, đáng ghét ghê.', 'Mình cũng vậy…', 'Thật hay đùa vậy?', 'Ừm hửm, rồi sao nữa?'],
    patReply: ['Vỗ gì mà vỗ… hì hì.', 'Có phải con nít đâu…', 'Vỗ thêm cái nữa đi.'],

    // Chàng đưa tay (armOffered / numbArm / armRelieved), nàng gối lên (armAccepted)
    armOffered: ['Nào, gối lên tay anh này.', 'Nằm đây không em?', 'Tay anh cho mượn nè.'],
    armAccepted: ['Ừm… dễ chịu ghê.', 'Vậy em không khách sáo nha.', 'Tay anh ấm quá.'],
    numbArm: ['Tay… tay tê rồi…', 'Cái tay như không còn là của anh nữa…', 'Ui da… tê quá…'],
    armRelieved: ['Phù… cái tay sống lại rồi.', 'Được cứu rồi…', 'Cảm ơn em… (vẩy vẩy tay)'],

    blanketPulled: ['Ê, cái chăn!', 'Kéo hết chăn đi rồi kìa.', 'Lạnh quá à…'],
    blanketTucked: ['Cảm ơn nha…', 'Ấm ghê.', 'Tâm lý ghê á.'],
    snore: ['Ồn chết đi được…', 'Ngáy to quá trời…', '(bịt tai)…'],
    roughComplaint: ['Thô bạo quá!', 'Định đánh nhau hả?', 'Nhẹ tay thôi!', 'Đau đó nha!'],

    noticedIntimacy: ['Cũng chưa ngủ hả?', 'Ơ, còn thức à?', 'Không ngủ được à?… Mình cũng thế.'],
    noticedSleep: ['Đừng lăn qua lăn lại hoài vậy mà.', 'Rốt cuộc có ngủ không đây?', 'Giường cứ rung lắc hoài…'],
    breathTell: ['Thở đều quá, chưa ngủ đúng không?', 'Đừng giả vờ nữa, biết là còn thức mà.', '…đang giả vờ ngủ đó hả?'],
    stare: ['Sao cứ nhìn hoài vậy?', 'Nhắm mắt lại ngủ đi.', 'Nhìn chằm chằm làm gì…'],

    push: ['Qua bên kia chút đi!', 'Chật quá à!', 'Xích ra!'],
    kick: ['Xuống giường ngay!', 'Ra sofa mà ngủ!', 'Biến điii!'],
    fellOff: ['Đau…', 'Bịch!… Sao lại nằm dưới đất thế này?', '…sàn lạnh ngắt.'],
    tooLate: ['…ngủ rồi à?', 'Sao lại ngủ đúng lúc này chứ…', '(thở dài)'],
    intimacyHigh: ['Tim đập nhanh quá…', 'Sao hôm nay dính như sam vậy?', 'Không khí hình như… hơi khác.'],
    partnerInitiate: ['Đừng trốn mà.', 'Lại đây chút nào.', 'Sao nằm xa tít vậy?'],
    wakeUp: ['Dậy đi mà~', 'Ê, ngủ rồi hả? Thức thêm chút đi mà.', 'Không được ngủ!'],

    // Màn kết: morning_{mục tiêu người chơi}_{mục tiêu người ấy}; together = gần gũi thành công, floor = rơi khỏi giường
    morning_sleep_sleep: [
      '“Chào buổi sáng. Tối qua có muốn gì không?” “Không có gì mà?”',
      '“Ngủ đã ghê.” “Ừ, hiếm lắm mới ngủ một mạch tới sáng.”',
      '“Chào… tối qua ngáy đó nha.” “Có ai kém ai đâu.”',
    ],
    morning_intimacy_sleep: [
      '“Tối qua cứ cựa quậy hoài là sao vậy?” “…Không có gì.”',
      '“Tối qua ngủ ngon không?” “Cũng… cũng được.”',
      '“Quầng thâm mắt đậm ghê.” “…Ừ.”',
    ],
    morning_sleep_intimacy: [
      '“…Tối qua đã bật đèn xanh rồi đó.” “Vậy hả??”',
      '“Hôm qua ngủ nhanh ghê.” “Ừ, mệt muốn xỉu.” “…Ờ.”',
      '“Tối nay về nhà sớm nha?” “Ừ, được thôi?”',
    ],
    morning_intimacy_intimacy: [
      '“Thật ra tối qua mình cũng… thôi, chào buổi sáng.”',
      '“Tối qua có phải hai đứa mình đều chờ đứa kia mở lời trước không?”',
      '“…Tối nay thử lại nhé?” “Ừ.”',
    ],
    morning_together: [
      '“Chào buổi sáng.” “…Chào buổi sáng.” (nhìn nhau mỉm cười)',
      '“Tối qua…” “Suỵt, đừng nói.”',
      '“Hôm nay dậy muộn chút được không?” “Được mà.”',
    ],
    morning_floor: ['“Sao tối qua lại ngủ dưới sàn vậy?” “…Còn phải hỏi à.”', '“Lưng còn ổn không?” “…Không ổn.”', '“Xin lỗi mà…” “Hứ.”'],
  },
};

export default game;
