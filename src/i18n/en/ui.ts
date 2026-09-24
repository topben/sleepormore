// English: interface text. Must mirror zh-TW/ui.ts exactly (same keys, nesting and array lengths).
// Placeholders {name} are filled in by fmt().
import type { UiMessages } from '../types';

const ui: UiMessages = {
  meta: {
    title: 'Same Bed, Different Dreams · Sleep or More',
    description: 'Same Bed, Different Dreams — a cute 3D mini-game about a couple sharing a bed.',
  },

  common: {
    you: 'You',
    partner: 'Partner',
    male: 'Him',
    female: 'Her',
    close: 'Close',
    cancel: 'Cancel',
    back: 'Back',
    on: 'On',
    off: 'Off',
    loadError: 'Couldn’t load that language. Check your connection and try again.',
  },

  start: {
    title: 'Same Bed, Different Dreams',
    subtitle: 'SLEEP OR MORE',
    tagline: 'Tonight, do you just want to sleep… or?',
    chooseRole: 'Choose your role',
    playMale: 'Play as him',
    playFemale: 'Play as her',
    sideLeft: 'Sleeps on the left',
    sideRight: 'Sleeps on the right',
    howToPlay: 'How to play',
    footnote: '12 turns · about 5 min · adult themes, never explicit',
    language: 'Language',
  },

  goal: {
    heading: 'Tonight’s goal',
    youAre: 'You’re playing as {role}, sleeping on the {side}.',
    left: 'left',
    right: 'right',
    winLabel: 'How to win',
    tipsLabel: 'Tips',
    sleep: {
      win: 'Make it to 06:00 with a sleep score of {n} (+1 per turn asleep, +0.5 per turn drowsy).',
      tips: [
        'First close your eyes with the eye button up top, then tap “💤 Sleep” to build sleepiness.',
        'Lose the blanket and you’ll get cold, and it’s hard to sleep when you’re cold.',
        'Don’t keep tossing and turning. Too much noise wakes your partner and annoys them.',
      ],
    },
    intimacy: {
      win: 'Get intimacy to 100 before dawn, while your partner is still awake.',
      tips: [
        'Keep your eyes open, use “Face them”, and “Scoot closer” if you’re too far apart.',
        'Kisses and hugs need charging: hold, then release in the green zone. Too much force annoys your partner.',
        'If your partner wants to sleep, first raise their mood to {n} with whispers and tucking them in.',
      ],
    },
    secret: 'Your partner has a goal of their own (it’s a secret). Figure it out from what they say and do!',
    hintsToggle: 'Show hints (recommended for beginners)',
    start: 'Start',
  },

  hud: {
    turn: 'Turn {n}/{max}',
    progress: {
      sleep: 'Sleep score {v}/{t}',
      intimacy: 'Intimacy {v}/{t}',
    },
    status: {
      done: 'Goal reached!',
      onTrack: 'On track',
      tight: 'Cutting it close',
      impossible: 'Won’t make it',
    },
    eyes: {
      open: 'Eyes open',
      closed: 'Eyes closed',
      toClose: 'Tap to close eyes',
      toOpen: 'Tap to open eyes',
      openInfo: 'See your partner · can’t sleep',
      closedInfo: 'Can sleep · can’t see your partner',
    },
    me: 'Me',
    partner: 'Partner',
    stat: {
      sleep: 'Sleepiness',
      warmth: 'Warmth',
      mood: 'Mood',
      restless: 'Restlessness',
      numb: 'Numbness',
      annoyance: 'Annoyance',
      eyes: 'Eyes',
      breath: 'Breathing',
      snore: 'Snoring',
      goal: 'Goal',
    },
    sleepState: {
      awake: 'Awake',
      drowsy: 'Drowsy',
      asleep: 'Asleep',
      deep: 'Deep sleep',
    },
    breath: {
      fast: 'Quick',
      steady: 'Steady',
      slow: 'Slow',
      deep: 'Deep',
      suspicious: 'Suspiciously even',
    },
    eyesState: { open: 'Open', closed: 'Closed' },
    snoreLevel: ['None', 'Soft', 'Medium', 'Very loud'],
    cold: 'So cold!',
    restlessWarn: 'Careful',
    restlessDanger: 'Almost busted!',
    annoyPush: 'About to push!',
    annoyHigh: 'Getting cranky',
    unknown: '?',
    closedNote: 'Eyes closed — you can only hear:',
    hidden: 'Secret',
    clue: {
      label: 'Hunch',
      none: 'Can’t tell yet',
      sleep: 'They seem to want to sleep',
      intimacy: 'They seem to be in the mood',
      count: '😴×{s} 💞×{i}',
    },
    intimacy: 'Intimacy',
    intimacyNudge: 'While they’re still awake!',
    noise: {
      label: 'Noise',
      last: 'Last action: {n}',
      threshold: 'Wake threshold {t}',
      thresholdUnknown: 'Threshold ?',
      none: 'Partner’s awake — noise won’t wake them',
    },
    bed: {
      label: 'Bed',
      edge: 'Edge',
      blanket: 'Blanket',
      blanketHidden: 'Eyes closed — can’t see the blanket',
    },
    hint: 'Hint',
    hideHints: 'Hide hints',
    log: 'Event log',
    logEmpty: 'Nothing has happened yet.',
    help: 'Help',
    settings: 'Settings',
    sound: 'Sound',
  },

  action: {
    category: {
      rest: 'Rest',
      posture: 'Posture',
      affection: 'Affection',
      blanket: 'Blanket',
      move: 'Move',
      arm: 'Arm',
      partner: 'Partner',
    },
    noise: 'Noise {n}',
    hold: 'Hold',
    suggested: 'Suggested',
    risk: {
      safe: 'Quiet',
      risky: 'Might wake',
      loud: 'Will wake',
    },
    unavailable: 'Not now: {reason}',
    busy: 'Hang on, your partner is still moving…',
  },

  force: {
    title: '{action}',
    instruction: 'Hold the button to charge, release in the green zone',
    holdButton: 'Hold to charge',
    keyboard: 'Or hold the Space bar',
    tooShort: 'Hold it a little longer',
    suggested: 'Suggested',
    result: '{band}!',
    cancel: 'Cancel (Esc)',
    zones: 'Too soft · Gentle · Firm · Rough',
  },

  log: {
    actor: { you: 'You', partner: 'Partner' },
    action: '{who}: {emoji} {label}',
    band: '({band})',
    failed: '{who} tried “{label}”, but… {reason}',
    wake: { you: 'You got woken up!', partner: 'Your partner got woken up!' },
    intimacy: '♥ Intimacy {d}',
    annoyed: { you: 'Your annoyance {d}', partner: 'Partner’s annoyance {d}' },
    mood: { you: 'Your mood {d}', partner: 'Partner’s mood {d}' },
    embraceOn: 'You’re in each other’s arms',
    embraceOff: 'The hug ended',
    armOffered: 'Arm offered as a pillow',
    armInUse: 'Head resting on the arm',
    armFree: 'Arm pulled back',
    armLeft: 'Head lifted off the arm',
    cold: { you: 'You’re cold', partner: 'Your partner is cold' },
    numb: { you: 'Your arm went numb', partner: 'Your partner’s arm went numb' },
    noticed: { you: 'Your partner noticed you’re still awake', partner: 'You noticed your partner is still awake' },
    snore: { you: 'You’re snoring ({level})', partner: 'Your partner is snoring ({level})' },
    push: 'Your partner shoved you away!',
    kick: 'You got kicked out of bed!',
    fell: 'You fell out of bed!',
    clue: 'You picked up on something…',
    eyes: {
      youClosed: 'You closed your eyes',
      youOpened: 'You opened your eyes',
      partnerClosed: 'Your partner closed their eyes',
      partnerOpened: 'Your partner opened their eyes',
    },
    speech: '{who}: “{text}”',
    turn: '— {time} —',
    posture: { you: 'You’re now {posture}', partner: 'Your partner is now {posture}' },
    blanket: 'The blanket shifted',
  },

  ending: {
    partnerWanted: 'Turns out your partner wanted to:',
    goalSleep: '😴 Sleep well',
    goalIntimacy: '💞 Get intimate',
    morning: 'The next morning',
    stats: 'Stats',
    statTurns: 'Turns {n}/{max}',
    statIntimacy: 'Intimacy {n}',
    statSleep: 'Sleep score {n}',
    statClues: 'Clues: {n}',
    tip: 'Tip for next time',
    again: 'Play again',
    changeRole: 'Switch roles',
    outcome: { win: 'Victory', lose: 'Defeat', draw: 'Draw' },
  },

  help: {
    title: 'How to play',
    sections: [
      {
        title: 'Goals',
        body: [
          'At the start you draw tonight’s goal: 😴 Sleep well or 💞 Get intimate. Your partner has a goal too, but it’s a secret.',
          '😴 Sleep: make it to 06:00 with a sleep score of 7 (+1 per turn asleep, +0.5 per turn drowsy).',
          '💞 Intimacy: get intimacy to 100 before dawn, while your partner is still awake.',
        ],
      },
      {
        title: 'Each turn',
        body: [
          'A night has 12 turns (40 minutes each). You pick an action → your partner acts → time passes.',
          'The 💡 hint bar suggests what to do next, and the suggested button glows.',
        ],
      },
      {
        title: 'Eyes closed vs. open',
        body: [
          'Eyes closed: use “💤 Sleep” to build sleepiness, and your partner may think you’re asleep. But you can’t see how they’re doing, and you can’t kiss or aim a hug.',
          'Eyes open: you can see your partner’s mood, annoyance and sleepiness, but you can’t sleep. Opening your eyes while asleep wakes you up.',
        ],
      },
      {
        title: 'Force',
        body: [
          'Actions marked “Hold” need charging: hold the button (or Space bar) and release in the green zone.',
          'Too soft halves the effect; firm is stronger but noisier; rough always annoys your partner.',
        ],
      },
      {
        title: 'Noise and waking up',
        body: [
          'Every action makes noise. If your partner is asleep and the noise goes over their wake threshold, they wake up, and they won’t be happy.',
          'Button colors: green = quiet, yellow = might wake, red = will wake.',
        ],
      },
      {
        title: 'Your partner’s annoyance',
        body: [
          'At 70+ annoyance your partner pushes you away. Get pushed past the edge, or let their annoyance hit 100, and you’re kicked out of bed.',
          '“🤲 Pat” cools annoyance and can also lull your partner to sleep.',
        ],
      },
      {
        title: 'Good to know',
        body: [
          'Blanket: lose it and you’ll get cold, and cold means poor sleep. “Tuck them in” makes your partner happy.',
          'Toss and turn too much and they’ll notice you’re awake; deep sleep on your back means snoring; an arm pillow is sweet, but the arm goes numb.',
          'Work out your partner’s goal from what they say and do. Your “Hunch” shows up in the partner panel.',
        ],
      },
      {
        title: 'Controls',
        body: [
          'Click or tap the buttons. Space = charge, E = close/open eyes, H = help, Esc = cancel.',
          'In Settings you can switch language, toggle sound and hints, or turn on “Auto force” to skip the charge bar.',
        ],
      },
    ],
  },

  settings: {
    title: 'Settings',
    language: 'Language',
    sound: 'Sound',
    hints: 'Show hints',
    autoForce: 'Auto force (skip the charge bar, always gentle)',
    restart: 'Restart',
    restartConfirm: 'Really give up on this round?',
  },
};

export default ui;
