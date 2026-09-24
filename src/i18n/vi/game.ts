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
    // hard mode
    sleepHot: 'Nóng quá, ngủ không ngon',
    sleepLonely: 'Trong lòng trống trải, ngủ không yên',
    partnerKickedBlanket: 'Người ấy nóng quá nên đạp chăn ra',
    partnerWokeUp: 'Người ấy tỉnh dậy, vươn vai một cái',
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

  /** hard mode intimacy: right now / in the morning */
  timing: { now: 'Gần gũi ngay', morning: 'Gần gũi buổi sáng' },

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
    // hard mode
    intimacyLoseDeadline: {
      title: 'Hết giờ',
      caption: "TIME'S UP",
      description: 'Đã quá {deadline}, chẳng còn không khí gì nữa. Người ấy ngáp một cái thật dài rồi trở mình ngủ mất.',
      tip: '“Gần gũi ngay” là cuộc đua với thời gian: ngay lượt đầu hãy “Quay mặt vào”, “Nhích lại gần”; hôn mạnh tay một chút (vùng vàng) sẽ nhanh hơn, nhưng đừng thô bạo.',
    },
    intimacyMorningWin: {
      title: 'Nụ hôn chào buổi sáng',
      caption: 'GOOD MORNING',
      description: 'Ngủ đủ giấc, trời cũng vừa sáng. Một buổi sáng thật vừa vặn.',
      tip: 'Hoàn hảo! Ngủ cho đã trước, trời sáng mới hành động.',
    },
    intimacyTooEarly: {
      title: 'Không đợi nổi tới sáng',
      caption: 'TOO EAGER',
      description: 'Đã định đợi tới sáng mà… thôi, vậy cũng được.',
      tip: '“Gần gũi buổi sáng” phải ngủ đủ trước (điểm giấc ngủ {sleep}) và chỉ tính từ {morning} trở đi. Ban đêm mà độ thân mật sắp đầy thì hãy quay lưng hoặc nhắm mắt ngủ.',
    },
    intimacyLoseOverslept: {
      title: 'Ngủ quên',
      caption: 'OVERSLEPT',
      description: 'Chuông báo thức reo ba lần rồi mà vẫn nhắm mắt nằm ườn. Kế hoạch buổi sáng đi tong.',
      tip: 'Sau {dawn} ai cũng ngủ nông dần: buổi sáng hãy mở mắt, quay mặt vào người ấy và hôn khi người ấy còn thức (gần gũi buổi sáng hiệu quả gấp đôi).',
    },
  },

  // Kết thúc theo combo: dựa vào cách chơi, mỗi người được xếp một kiểu ngủ (persona); bạn × người ấy = 64 combo (src/game/titles.ts)
  // desc của persona dùng cho cả bạn lẫn người ấy nên không gắn với ngôi nào.
  persona: {
    bandit: { name: 'Thánh cướp chăn', desc: 'Chăn lúc nào cũng tự chạy về phía mình.' },
    talker: { name: 'Cao thủ thả thính', desc: 'Cái miệng không chịu nghỉ, lời đường mật hết câu này đến câu khác.' },
    koala: { name: 'Koala dính người', desc: 'Đã ôm là không buông, dính lấy người ấy suốt cả đêm.' },
    nanny: { name: 'Bảo mẫu 5 sao', desc: 'Vỗ về, đắp chăn, cho gối tay, chăm người ấy như chăm em bé.' },
    sleeper: { name: 'Cỗ máy ngủ siêu tốc', desc: 'Đầu vừa chạm gối là ngủ, câu trả lời duy nhất là tiếng ngáy.' },
    faker: { name: 'Diễn viên giả ngủ', desc: 'Mắt thì nhắm, nhưng đầu óc vẫn tỉnh như sáo.' },
    spinner: { name: 'Con quay trằn trọc', desc: 'Lăn qua lăn lại, cả đêm không chịu dừng.' },
    iceberg: { name: 'Tảng băng mép giường', desc: 'Quay lưng, nhích xa, giãn cách xã hội với người ấy.' },
  },

  /** Combo: `${bạn}_${người ấy}` */
  combo: {
    bandit_bandit: { name: 'Giải vô địch kéo co chăn', desc: 'Bạn kéo qua, người ấy giật lại, cả đêm thi xem ai khỏe hơn.' },
    bandit_talker: { name: 'Lời ngọt không bằng chăn ấm', desc: 'Người ấy thì thầm ngọt ngào bên tai, bạn chỉ lo cuộn chăn chặt thêm chút nữa.' },
    bandit_koala: { name: 'Ôm trọn cả người lẫn chăn', desc: 'Bạn giành hết chăn, người ấy dứt khoát ôm luôn cả bạn lẫn chăn để sưởi ấm.' },
    bandit_nanny: { name: 'Freeship chăn tận giường', desc: 'Người ấy cứ chăm chỉ đắp chăn giúp, thế là chăn được ship thẳng sang phía bạn.' },
    bandit_sleeper: { name: 'Phi vụ cướp chăn hoàn hảo', desc: 'Người ấy đang ngủ ngon lành, bạn nhẹ nhàng cuộn trọn cả cái chăn về mình.' },
    bandit_faker: { name: 'Diễn sâu vẫn mất chăn', desc: 'Người ấy mải giả vờ ngủ, đành nằm im để bạn kéo sạch chăn đi.' },
    bandit_spinner: { name: 'Trở mình là mất chăn', desc: 'Mỗi lần người ấy trở mình, bạn lại nhân cơ hội giành thêm một khúc chăn.' },
    bandit_iceberg: { name: 'Lạnh lùng kèm lạnh cóng', desc: 'Người ấy lạnh lùng quay lưng, bạn tiện tay mang luôn cái chăn đi.' },

    talker_bandit: { name: 'Thính không mua được chăn', desc: 'Bạn nói lời ngọt ngào suốt cả đêm, người ấy chỉ chăm chăm giành chăn.' },
    talker_talker: { name: 'Podcast nửa đêm', desc: 'Bạn một câu, người ấy một câu, tám đến gần sáng luôn.' },
    talker_koala: { name: 'Ngọt đến sâu răng', desc: 'Bạn thì thầm lời yêu, người ấy ôm thật chặt, đến không khí cũng ngọt lịm.' },
    talker_nanny: { name: 'Giờ kể chuyện ru ngủ', desc: 'Bạn kể chuyện, người ấy vỗ về, cứ như đang dỗ nhau ngủ vậy.' },
    talker_sleeper: { name: 'Thì thầm với không khí', desc: 'Lời thì thầm của bạn cảm động lắm, tiếc là người ấy ngủ từ lâu rồi.' },
    talker_faker: { name: 'Khóe môi phản chủ', desc: 'Người ấy nhắm mắt vờ như không nghe thấy, nhưng khóe môi cứ lén cong lên.' },
    talker_spinner: { name: 'Xoay người dò sóng', desc: 'Bạn thì thầm bên tai, người ấy lăn qua lăn lại tìm góc nghe rõ nhất.' },
    talker_iceberg: { name: 'Đàn gảy tai trâu', desc: 'Bạn dịu dàng thì thầm lời yêu, người ấy đáp lại bằng một tấm lưng.' },

    koala_bandit: { name: 'Ôm phải cuốn nem', desc: 'Bạn muốn ôm, người ấy lại cuộn mình thành cuốn nem, ôm được mỗi đống chăn.' },
    koala_talker: { name: 'Bom cẩu lương', desc: 'Bạn ôm chặt, người ấy thì thầm lời yêu, hội FA trong bán kính mười mét gục ngã hết.' },
    koala_koala: { name: 'Dính nhau như sam', desc: 'Hai người ôm nhau thành một cục, chẳng biết tay nào là của ai.' },
    koala_nanny: { name: 'Đại hội làm nũng', desc: 'Bạn bám riết lấy người ấy làm nũng, người ấy xoa đầu bạn và chiều hết.' },
    koala_sleeper: { name: 'Gối ôm biết ngáy', desc: 'Bạn ôm say sưa, còn người ấy đã ngủ tới mức ngáy o o.' },
    koala_faker: { name: 'Kích hoạt chế độ giả ngủ', desc: 'Bạn vừa ôm tới, người ấy đã nhắm tịt mắt giả vờ ngủ say.' },
    koala_spinner: { name: 'Ôm trúng đâu hay đó', desc: 'Bạn muốn ôm, người ấy lăn qua lăn lại, lần nào cũng ôm trúng một chỗ khác.' },
    koala_iceberg: { name: 'Mặt nóng dán mông lạnh', desc: 'Bạn nhiệt tình ôm tới, người ấy lặng lẽ quay lưng đi.' },

    nanny_bandit: { name: 'Đắp đến đâu giành đến đó', desc: 'Bạn vừa đắp chăn cho người ấy, người ấy đã quay người cuộn sạch cả chăn.' },
    nanny_talker: { name: 'Trạm tâm sự đêm khuya', desc: 'Người ấy nói không ngừng, bạn vừa nghe vừa khẽ vỗ về.' },
    nanny_koala: { name: 'Trông trẻ xuyên đêm', desc: 'Người ấy bám lấy bạn làm nũng, bạn dỗ dành như dỗ con nít đến tận sáng.' },
    nanny_nanny: { name: 'Hội tương thân tương ái', desc: 'Bạn đắp chăn cho người ấy, người ấy vỗ về bạn, chẳng ai nỡ ngủ trước.' },
    nanny_sleeper: { name: 'Dỗ ngủ thành công mỹ mãn', desc: 'Vỗ về, đắp chăn, người ấy ngoan ngoãn ngủ mất. Quá chuyên nghiệp!' },
    nanny_faker: { name: 'Gọi không dậy, dỗ không ngủ', desc: 'Người ta bảo không ai gọi dậy được người giả vờ ngủ, hóa ra cũng chẳng dỗ ngủ nổi.' },
    nanny_spinner: { name: 'Cuộc rượt đuổi đắp chăn', desc: 'Người ấy lăn qua lăn lại, bạn hết lần này đến lần khác kéo chăn đắp lại.' },
    nanny_iceberg: { name: 'Túi sưởi gặp tảng băng', desc: 'Bạn không ngừng tỏa hơi ấm, người ấy vẫn co ro ở mép giường mặc kệ bạn.' },

    sleeper_bandit: { name: 'Ngủ dậy chăn bay màu', desc: 'Bạn ngủ một mạch, tỉnh dậy mới biết người ấy đã quấn trọn cái chăn.' },
    sleeper_talker: { name: 'ASMR ru ngủ miễn phí', desc: 'Người ấy thì thầm lời yêu cả đêm, bạn chỉ loáng thoáng nghe thấy trong mơ.' },
    sleeper_koala: { name: 'Gối ôm bất đắc dĩ', desc: 'Bạn vừa nằm đã ngủ, người ấy ôm bạn như gối ôm suốt cả đêm.' },
    sleeper_nanny: { name: 'Em bé to xác', desc: 'Người ấy vừa vỗ về vừa đắp chăn, bạn ngủ ngon lành như em bé.' },
    sleeper_sleeper: { name: 'Bộ đôi ngủ siêu tốc', desc: 'Đèn vừa tắt là cả hai ngủ mất, thế mới gọi là ngủ ngon.' },
    sleeper_faker: { name: 'Một ngủ thật, một ngủ giả', desc: 'Bạn ngủ thật ngon, còn người ấy nhắm mắt diễn bên cạnh suốt cả đêm.' },
    sleeper_spinner: { name: 'Ngủ cạnh máy giặt', desc: 'Bạn ngủ say, còn người ấy lăn lộn bên cạnh như máy giặt lồng ngang.' },
    sleeper_iceberg: { name: 'Ai ngủ phần nấy', desc: 'Bạn ngủ phần bạn, người ấy ngủ ở mép giường, nước sông không phạm nước giếng.' },

    faker_bandit: { name: 'Giả ngủ còn bị cướp chăn', desc: 'Bạn đang giả ngủ thì chăn bị giật phăng, đành run cầm cập diễn tiếp.' },
    faker_talker: { name: 'Thử thách nhịn cười', desc: 'Người ấy thì thầm bên tai, bạn phải cố nhịn cười để tiếp tục giả ngủ.' },
    faker_koala: { name: 'Giả ngủ né ôm bất thành', desc: 'Bạn tính giả ngủ để thoát nạn, ai ngờ người ấy ôm chầm lấy luôn.' },
    faker_nanny: { name: 'Diễn viên cắn rứt lương tâm', desc: 'Bạn đang giả ngủ mà người ấy cứ dịu dàng vỗ về mãi, thấy áy náy ghê.' },
    faker_sleeper: { name: 'Suất diễn không khán giả', desc: 'Bạn giả ngủ cực nhập tâm, tiếc là khán giả duy nhất đã ngủ từ lâu.' },
    faker_faker: { name: 'Ai mở mắt trước là thua', desc: 'Cả hai cùng giả ngủ, thi xem ai không nhịn nổi trước.' },
    faker_spinner: { name: 'Phim trường quá ồn', desc: 'Bạn đang diễn cảnh ngủ rất nghiêm túc, người ấy lăn qua lăn lại làm bạn NG liên tục.' },
    faker_iceberg: { name: 'Đồng sàng dị mộng chính hiệu', desc: 'Bạn giả ngủ, người ấy quay lưng. Đồng sàng dị mộng chuẩn không cần chỉnh.' },

    spinner_bandit: { name: 'Thuế trở mình', desc: 'Mỗi lần bạn trở mình, người ấy lại kéo mất thêm một khúc chăn.' },
    spinner_talker: { name: 'Hành trình đi tìm tư thế', desc: 'Người ấy nói mãi không ngừng, bạn lăn qua lăn lại mà chẳng tìm được tư thế nào thoải mái.' },
    spinner_koala: { name: 'Đu quay tình yêu', desc: 'Bạn lăn qua lăn lại, người ấy ôm riết không buông, xoay vòng theo bạn.' },
    spinner_nanny: { name: 'Lăn một lần, đắp một lần', desc: 'Bạn trở mình, người ấy đắp chăn, cứ thế lặp lại đến sáng.' },
    spinner_sleeper: { name: 'Tiệc nướng một mình', desc: 'Bạn lật tới lật lui như miếng thịt nướng, người ấy thì ngủ say như chết.' },
    spinner_faker: { name: 'Phá đám người giả ngủ', desc: 'Bạn lăn lộn không ngừng, làm người ấy đang giả ngủ suýt nữa thì lộ tẩy.' },
    spinner_spinner: { name: 'Chế độ vắt cực mạnh', desc: 'Cả hai cùng lăn qua lăn lại, cái giường biến thành máy giặt luôn.' },
    spinner_iceberg: { name: 'Xoay đâu cũng thấy lưng', desc: 'Bạn trở qua trở lại, chỉ thấy mỗi tấm lưng lạnh lùng của người ấy.' },

    iceberg_bandit: { name: 'Lạnh thấu xương tủy', desc: 'Bạn quay lưng co ro ở mép giường, còn bị giành mất chăn. Lạnh gấp đôi.' },
    iceberg_talker: { name: 'Tỏ tình với tấm lưng', desc: 'Người ấy thì thầm lời yêu vào lưng bạn suốt cả đêm.' },
    iceberg_koala: { name: 'Mèo vờn chuột trên giường', desc: 'Bạn cứ nhích dần ra mép giường, người ấy cứ bám theo đòi ôm.' },
    iceberg_nanny: { name: 'Chiến dịch làm tan băng', desc: 'Bạn lạnh lùng quay lưng, người ấy vẫn kiên trì đắp chăn cho bạn.' },
    iceberg_sleeper: { name: 'Đêm nay bình an vô sự', desc: 'Bạn thu mình ở mép giường, người ấy thì ngủ say từ lâu, chẳng ai phiền ai.' },
    iceberg_faker: { name: 'Cuộc chiến im lặng', desc: 'Bạn quay lưng, người ấy giả ngủ, chẳng ai chịu mở lời trước.' },
    iceberg_spinner: { name: 'Sinh tồn nơi mép giường', desc: 'Bạn bám mép giường, người ấy lăn tới lăn lui suýt hất bạn xuống đất.' },
    iceberg_iceberg: { name: 'Cách nhau cả dải Ngân Hà', desc: 'Mỗi người một mép giường, khoảng giữa đủ chỗ cho thêm một người nằm.' },
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
    // hard mode
    tooHot: 'Nóng quá! Chia bớt chăn cho người ấy (“Đắp chăn giúp”).',
    needCloseness: 'Trong lòng chưa yên: độ thân mật phải từ {need} trở lên mới ngủ ngon. Ôm một cái hoặc thì thầm đôi câu.',
    hurry: 'Sắp hết giờ rồi! Phải xong trước {deadline}, hôn nhanh khi người ấy còn thức.',
    morningSleepFirst: 'Ngủ cho ngon trước đã: từ {morning} mới là buổi sáng, giờ mà gần gũi thì sớm quá.',
    tooEarlyWarn: 'Độ thân mật sắp đầy mà chưa tới sáng! Quay lưng hoặc nhắm mắt ngủ trước đã.',
    morningPrep: 'Tranh thủ lúc người ấy còn thức, vun đắp chút tình cảm trước (đừng để đầy). Buổi sáng gần gũi hiệu quả gấp đôi.',
    morningGo: 'Trời sáng rồi! Mở mắt, quay mặt vào người ấy và gần gũi khi người ấy còn thức.',
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
    // hard mode
    goodMorning: ['Ưm… sáng rồi à?', '(vươn vai)… chào buổi sáng~', 'Dậy chưa?… Tỉnh rồi nè.', 'Sáng rồi nè… hì hì.'],
    giveUp: ['…thôi, ngủ.', 'Hứ, kệ đó. Ngủ ngon.', '(thở dài)… ngủ thôi.'],
    tooHot: ['Nóng quá…', 'Chăn cho đó, nóng muốn chết.', '(đạp chăn ra)…'],
    needCuddle: ['Ôm một cái rồi hẵng ngủ mà…', 'Chẳng thèm để ý gì hết…', 'Nói chúc ngủ ngon đi mà.'],

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
