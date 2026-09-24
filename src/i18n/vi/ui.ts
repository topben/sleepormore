// Tiếng Việt: văn bản giao diện. Cấu trúc phải giống hệt zh-TW.
// Người chơi = "bạn", đối phương = "người ấy". Placeholder {name} do fmt() điền vào.
import type { UiMessages } from '../types';

const ui: UiMessages = {
  meta: {
    title: 'Đồng sàng dị mộng · Sleep or More',
    description: 'Đồng sàng dị mộng — trò chơi 3D nho nhỏ mô phỏng cặp đôi nằm chung giường',
  },

  common: {
    you: 'Bạn',
    partner: 'Người ấy',
    male: 'Chàng',
    female: 'Nàng',
    close: 'Đóng',
    cancel: 'Hủy',
    back: 'Quay lại',
    on: 'Bật',
    off: 'Tắt',
    loadError: 'Không tải được ngôn ngữ. Hãy kiểm tra kết nối mạng rồi thử lại.',
  },

  start: {
    title: 'Đồng sàng dị mộng',
    subtitle: 'SLEEP OR MORE',
    tagline: 'Đêm nay, bạn muốn ngủ thật ngon… hay là?',
    chooseRole: 'Chọn vai của bạn',
    playMale: 'Mình là chàng',
    playFemale: 'Mình là nàng',
    sideLeft: 'Nằm bên trái',
    sideRight: 'Nằm bên phải',
    howToPlay: 'Cách chơi',
    footnote: '12 lượt · khoảng 5 phút · dành cho người lớn nhưng không lộ liễu',
    language: 'Ngôn ngữ',
    plugTag: '[Quảng cáo lộ liễu]',
    plug: 'Chốt lịch đi ngủ nào',
  },

  goal: {
    heading: 'Mục tiêu đêm nay',
    youAre: 'Bạn vào vai {role}, nằm {side}.',
    left: 'bên trái',
    right: 'bên phải',
    winLabel: 'Điều kiện thắng',
    tipsLabel: 'Mẹo nhỏ',
    sleep: {
      win: 'Trụ đến 06:00 và đạt {n} điểm ngủ (mỗi lượt đang ngủ +1, lơ mơ +0.5).',
      tips: [
        'Bấm nút nhắm mắt ở phía trên trước, rồi bấm “💤 Ngủ” để tích lũy cơn buồn ngủ.',
        'Bị giành mất chăn sẽ lạnh, mà lạnh thì ngủ không ngon.',
        'Đừng trằn trọc mãi; ồn quá sẽ đánh thức và chọc giận người ấy.',
      ],
    },
    intimacy: {
      win: 'Đưa độ thân mật lên 100 trước khi trời sáng, và ngay lúc đó người ấy phải còn thức.',
      tips: [
        'Giữ mắt mở, “Quay mặt vào” người ấy trước; xa quá thì “Nhích lại gần”.',
        'Hôn, ôm phải nhấn giữ để tụ lực, thả ra ở vùng xanh; mạnh tay quá sẽ chọc giận người ấy.',
        'Nếu người ấy muốn ngủ, hãy thì thầm, đắp chăn để nâng tâm trạng người ấy lên {n} trước.',
      ],
    },
    secret: 'Người ấy cũng có mục tiêu riêng (bí mật đấy). Hãy đoán qua lời nói và hành động nhé!',
    hintsToggle: 'Hiện gợi ý (khuyên dùng cho người mới)',
    start: 'Bắt đầu',
  },

  hud: {
    turn: 'Lượt {n}/{max}',
    progress: {
      sleep: 'Điểm ngủ {v}/{t}',
      intimacy: 'Độ thân mật {v}/{t}',
    },
    status: {
      done: 'Đạt rồi!',
      onTrack: 'Vẫn kịp',
      tight: 'Hơi gấp',
      impossible: 'Không kịp nữa',
    },
    eyes: {
      open: 'Đang mở mắt',
      closed: 'Đang nhắm mắt',
      toClose: 'Bấm để nhắm mắt',
      toOpen: 'Bấm để mở mắt',
      openInfo: 'Thấy người ấy · Không ngủ được',
      closedInfo: 'Ngủ được · Không thấy người ấy',
    },
    me: 'Mình',
    partner: 'Người ấy',
    stat: {
      sleep: 'Buồn ngủ',
      warmth: 'Độ ấm',
      mood: 'Tâm trạng',
      restless: 'Trằn trọc',
      numb: 'Tê tay',
      annoyance: 'Bực bội',
      eyes: 'Mắt',
      breath: 'Hơi thở',
      snore: 'Ngáy',
      goal: 'Mục tiêu',
    },
    sleepState: {
      awake: 'Còn thức',
      drowsy: 'Lơ mơ',
      asleep: 'Đang ngủ',
      deep: 'Ngủ say',
    },
    breath: {
      fast: 'Gấp',
      steady: 'Đều',
      slow: 'Chậm',
      deep: 'Sâu',
      suspicious: 'Đều đến đáng ngờ',
    },
    eyesState: { open: 'Mở', closed: 'Nhắm' },
    snoreLevel: ['Không', 'Nhỏ', 'Vừa', 'Rất to'],
    cold: 'Lạnh quá!',
    restlessWarn: 'Cẩn thận',
    restlessDanger: 'Sắp bị lộ',
    annoyPush: 'Sắp đẩy bạn ra!',
    annoyHigh: 'Hơi cáu rồi',
    unknown: '?',
    closedNote: 'Nhắm mắt nên không thấy, chỉ nghe được:',
    hidden: 'Bí mật',
    clue: {
      label: 'Linh cảm',
      none: 'Chưa đoán ra',
      sleep: 'Người ấy có vẻ muốn ngủ',
      intimacy: 'Người ấy có vẻ muốn gần gũi',
      count: '😴×{s} 💞×{i}',
    },
    intimacy: 'Độ thân mật',
    intimacyNudge: 'Tranh thủ lúc người ấy còn thức!',
    noise: {
      label: 'Tiếng động',
      last: 'Động tác trước {n}',
      threshold: 'Ngưỡng thức giấc {t}',
      thresholdUnknown: 'Ngưỡng thức giấc ?',
      none: 'Người ấy còn thức, sẽ không bị đánh thức',
    },
    bed: {
      label: 'Chỗ nằm',
      edge: 'Mép giường',
      blanket: 'Chăn',
      blanketHidden: 'Nhắm mắt nên không thấy chăn',
    },
    hint: 'Gợi ý',
    hideHints: 'Ẩn gợi ý',
    log: 'Nhật ký',
    logEmpty: 'Chưa có gì xảy ra.',
    help: 'Hướng dẫn',
    settings: 'Cài đặt',
    sound: 'Âm thanh',
  },

  action: {
    category: {
      rest: 'Nghỉ ngơi',
      posture: 'Tư thế',
      affection: 'Âu yếm',
      blanket: 'Chăn',
      move: 'Di chuyển',
      arm: 'Cánh tay',
      partner: 'Người ấy',
    },
    noise: 'Tiếng động {n}',
    hold: 'Giữ',
    suggested: 'Gợi ý',
    risk: {
      safe: 'Yên lặng',
      risky: 'Có thể đánh thức',
      loud: 'Sẽ đánh thức',
    },
    unavailable: 'Giờ chưa được: {reason}',
    busy: 'Chờ chút, người ấy còn đang cựa quậy…',
  },

  force: {
    title: '{action}',
    instruction: 'Nhấn giữ nút để tụ lực, thả ra ở vùng xanh',
    holdButton: 'Giữ để tụ lực',
    keyboard: 'Hoặc nhấn giữ phím Space',
    tooShort: 'Giữ lâu hơn chút nhé',
    suggested: 'Gợi ý',
    result: '{band}!',
    cancel: 'Hủy (Esc)',
    zones: 'Quá nhẹ · Nhẹ nhàng · Mạnh tay · Thô bạo',
  },

  log: {
    actor: { you: 'Bạn', partner: 'Người ấy' },
    action: '{who} {emoji}{label}',
    // Được nối liền ngay sau dòng động tác nên cần khoảng trắng ở đầu
    band: ' ({band})',
    failed: '{who} muốn “{label}” nhưng không được: {reason}',
    wake: { you: 'Bạn bị đánh thức!', partner: 'Người ấy bị đánh thức!' },
    intimacy: '♥ Độ thân mật {d}',
    annoyed: { you: 'Bực bội của bạn {d}', partner: 'Bực bội của người ấy {d}' },
    mood: { you: 'Tâm trạng của bạn {d}', partner: 'Tâm trạng của người ấy {d}' },
    embraceOn: 'Hai người đã ôm nhau',
    embraceOff: 'Vòng tay đã buông',
    armOffered: 'Cánh tay đã đưa ra làm gối',
    armInUse: 'Đầu đã gối lên tay',
    armFree: 'Cánh tay đã rút về',
    armLeft: 'Đầu đã rời khỏi tay',
    cold: { you: 'Bạn đang lạnh', partner: 'Người ấy đang lạnh' },
    numb: { you: 'Tay bạn tê rồi', partner: 'Tay người ấy tê rồi' },
    noticed: { you: 'Người ấy phát hiện bạn còn thức', partner: 'Bạn phát hiện người ấy còn thức' },
    snore: { you: 'Bạn đang ngáy ({level})', partner: 'Người ấy đang ngáy ({level})' },
    push: 'Người ấy đẩy bạn ra!',
    kick: 'Bạn bị đá khỏi giường!',
    fell: 'Bạn rơi khỏi giường rồi!',
    clue: 'Hình như bạn vừa nhận ra điều gì đó…',
    eyes: {
      youClosed: 'Bạn nhắm mắt lại',
      youOpened: 'Bạn mở mắt ra',
      partnerClosed: 'Người ấy nhắm mắt lại',
      partnerOpened: 'Người ấy mở mắt ra',
    },
    speech: '{who}: “{text}”',
    turn: '— {time} —',
    posture: { you: 'Bạn chuyển sang {posture}', partner: 'Người ấy chuyển sang {posture}' },
    blanket: 'Chăn bị xê dịch',
  },

  ending: {
    partnerWanted: 'Thật ra đêm nay người ấy muốn:',
    goalSleep: '😴 Ngủ thật ngon',
    goalIntimacy: '💞 Gần gũi',
    morning: 'Sáng hôm sau',
    stats: 'Thống kê',
    statTurns: 'Lượt {n}/{max}',
    statIntimacy: 'Độ thân mật {n}',
    statSleep: 'Điểm ngủ {n}',
    statClues: '{n} manh mối',
    tip: 'Lần sau thử xem',
    again: 'Chơi lại',
    changeRole: 'Đổi vai',
    outcome: { win: 'Thắng', lose: 'Thua', draw: 'Hòa' },
  },

  help: {
    title: 'Cách chơi',
    sections: [
      {
        title: 'Mục tiêu',
        body: [
          'Đầu ván, bạn bốc thăm mục tiêu đêm nay: 😴 Ngủ thật ngon, hoặc 💞 Gần gũi. Người ấy cũng có mục tiêu riêng, nhưng đó là bí mật.',
          '😴 Ngủ: trụ đến 06:00 và đạt 7 điểm ngủ (mỗi lượt đang ngủ +1, lơ mơ +0.5).',
          '💞 Gần gũi: đưa độ thân mật lên 100 trước khi trời sáng, và ngay lúc đó người ấy phải còn thức.',
        ],
      },
      {
        title: 'Mỗi lượt',
        body: [
          'Một đêm có 12 lượt (mỗi lượt 40 phút). Bạn chọn một động tác → người ấy hành động → thời gian trôi.',
          '💡 Thanh gợi ý sẽ nhắc bạn bước tiếp theo nên làm gì; nút được gợi ý sẽ sáng lên.',
        ],
      },
      {
        title: 'Nhắm mắt hay mở mắt',
        body: [
          'Nhắm mắt: dùng được “💤 Ngủ” để tích lũy cơn buồn ngủ, người ấy có thể tưởng bạn đã ngủ; nhưng bạn không thấy trạng thái của người ấy, hôn cũng trượt, ôm cũng hụt.',
          'Mở mắt: thấy được tâm trạng, độ bực bội, độ buồn ngủ của người ấy; nhưng không ngủ được. Đang ngủ mà mở mắt là tự làm mình tỉnh giấc.',
        ],
      },
      {
        title: 'Lực',
        body: [
          'Động tác có nhãn “Nhấn giữ” cần tụ lực: nhấn giữ nút (hoặc phím Space), thả ra ở vùng xanh.',
          'Quá nhẹ thì hiệu quả giảm một nửa; mạnh tay thì hiệu quả mạnh hơn nhưng ồn hơn; thô bạo thì chắc chắn chọc giận người ấy.',
        ],
      },
      {
        title: 'Tiếng động và đánh thức',
        body: [
          'Động tác nào cũng gây tiếng động. Khi người ấy đang ngủ, tiếng động vượt “ngưỡng thức giấc” sẽ đánh thức người ấy, và người ấy sẽ bực.',
          'Màu nút: xanh = yên lặng, vàng = có thể đánh thức, đỏ = sẽ đánh thức.',
        ],
      },
      {
        title: 'Cơn bực bội của người ấy',
        body: [
          'Khi bực bội từ 70 trở lên, người ấy sẽ đẩy bạn ra; nếu bị đẩy quá mép giường hoặc bực bội lên tới 100, bạn sẽ bị đá khỏi giường.',
          '“🤲 Vỗ về” giúp làm dịu bực bội, lại còn dỗ được người ấy ngủ.',
        ],
      },
      {
        title: 'Những điều khác',
        body: [
          'Chăn: bị kéo mất sẽ lạnh, lạnh thì ngủ không ngon. “Đắp chăn giúp” sẽ làm người ấy vui.',
          'Trằn trọc nhiều sẽ bị phát hiện là chưa ngủ; nằm ngửa ngủ say sẽ ngáy; gối tay rất ngọt ngào, nhưng sẽ tê tay.',
          'Hãy đoán mục tiêu của người ấy qua lời nói và hành động; cột của người ấy sẽ hiện “Linh cảm” của bạn.',
        ],
      },
      {
        title: 'Điều khiển',
        body: [
          'Bấm nút bằng chuột hoặc chạm màn hình. Space = tụ lực, E = nhắm/mở mắt, H = hướng dẫn, Esc = hủy.',
          'Trong Cài đặt có thể đổi ngôn ngữ, bật/tắt âm thanh và gợi ý, hoặc bật “Lực tự động” để bỏ qua thanh tụ lực.',
        ],
      },
    ],
  },

  settings: {
    title: 'Cài đặt',
    language: 'Ngôn ngữ',
    sound: 'Âm thanh',
    hints: 'Hiện gợi ý',
    autoForce: 'Lực tự động (bỏ qua thanh tụ lực, luôn nhẹ nhàng)',
    restart: 'Bắt đầu lại',
    restartConfirm: 'Bạn chắc chắn muốn bỏ ván này chứ?',
  },
};

export default ui;
