// English: all text produced by the game rules. Must mirror zh-TW/game.ts exactly (same keys and nesting).
// Every speech pool keeps the same number and order of lines as zh-TW (the game picks lines by index).
// Placeholders: {name} is filled in by fmt() ({n} = a rule value, e.g. the mood a sleepy partner needs).
import type { GameMessages } from '../types';

/** The first two lines of both goodnight pools are shared and ambiguous, so they give nothing away. */
const SHARED_GOODNIGHT = ['Mm… goodnight.', 'Want the lights off?'];

const game: GameMessages = {
  action: {
    lieSupine: { label: 'Lie on back', hint: 'Roll onto your back. Fall into deep sleep like this and you’ll snore.' },
    lieSideFacing: { label: 'Face them', hint: 'Lie on your side facing your partner. You need this to kiss, hug or caress.' },
    lieSideAway: { label: 'Turn away', hint: 'Turn your back to your partner: blocks advances, but a partner in the mood will be let down.' },
    lieProne: { label: 'Lie face down', hint: 'Sleep on your stomach (only your partner sleeps like this).' },
    hug: { label: 'Hug', hint: 'Wrap your arms around your partner (they must be on their side). Falling asleep in a hug is easier.' },
    kiss: { label: 'Kiss', hint: 'A kiss: big intimacy boost. Your partner must be facing you or lying on their back.' },
    caress: { label: 'Caress', hint: 'Gently stroke your partner: raises intimacy, whatever position they’re in.' },
    whisper: { label: 'Whisper', hint: 'Sweet nothings: lifts their mood and nudges intimacy up. Nice and quiet.' },
    pat: { label: 'Pat', hint: 'Soothing pats: cool their annoyance and lull them to sleep. A snorer will roll over.' },
    offerArm: { label: 'Offer arm', hint: 'Stretch out your arm as her pillow. Sweet, but it goes numb after a while.' },
    restOnArm: { label: 'Rest on arm', hint: 'Rest your head on his arm: intimacy +5, and you’ll sleep better.' },
    leaveArm: { label: 'Leave arm', hint: 'Lift your head off. He’ll be grateful once his arm has gone numb.' },
    withdrawArm: { label: 'Pull arm back', hint: 'Slide your arm out. Too soft and it’s stuck; too hard and you’ll wake her.' },
    pullBlanket: { label: 'Pull blanket', hint: 'Tug the blanket your way: you warm up, but your partner gets cold.' },
    tuckBlanket: { label: 'Tuck them in', hint: 'Spread the blanket over your partner: lifts their mood and nudges intimacy up.' },
    scootIn: { label: 'Scoot closer', hint: 'Shift toward the middle of the bed. You have to be close to reach your partner.' },
    scootOut: { label: 'Scoot away', hint: 'Shift a little toward the edge. Scoot too far and you’ll fall off the bed!' },
    sleep: { label: 'Sleep', hint: 'Focus on sleeping: sleepiness +18. Close your eyes first.' },
    push: { label: 'Push away', hint: '(Partner only) At 70+ annoyance, they’ll push you away.' },
  },

  /** Why an action is unavailable, action notes, narration */
  msg: {
    alreadyPosture: 'Already lying like that',
    armPinned: 'She’s on your arm — pull it back first',
    eyesClosedHug: 'Can’t aim a hug with your eyes closed — open them first',
    eyesClosedKiss: 'Can’t find their lips with your eyes closed — open them first',
    alreadyEmbrace: 'Already hugging',
    needFacing: 'Lie on your side facing them first',
    partnerNotSide: 'They need to be on their side for a hug',
    tooFar: 'Too far apart — scoot closer first',
    partnerFacingAway: 'Your partner has their back to you',
    partnerProne: 'Your partner is sleeping face down',
    armAlreadyOffered: 'Your arm is already out',
    offerNeedPosture: 'Lie on your back or face her first',
    herBackTurned: 'Her back is turned to you',
    armNotOffered: 'He hasn’t offered his arm yet',
    alreadyOnArm: 'Already resting on it',
    restNeedPosture: 'Lie on your back or face him first',
    notOnArm: 'You’re not resting on his arm',
    armNotOut: 'Your arm isn’t out',
    blanketAllMine: 'The blanket is already all on your side',
    blanketAllTheirs: 'The blanket is already all on their side',
    alreadyClose: 'Already snuggled up close',
    atCenter: 'Already in the middle of the bed',
    closeEyesFirst: 'Close your eyes first',
    onlyPartnerPushes: 'Only your partner does the pushing',
    notAngryEnough: 'Not angry enough yet',
    notAllowed: 'You can’t do that',
    tooRough: 'Way too rough',
    sneakHug: 'Snuck in a hug',
    sneakKiss: 'Stole a little kiss',
    sneakCaress: 'A soft, sneaky stroke',
    ticklish: 'Tickles!',
    patRollOver: 'One pat and a roll over — snoring stopped',
    armStuck: 'Arm’s pinned — can’t slide it out',
    oneHandPull: 'Only one free hand — hard to pull',
    fellOffEdge: 'You rolled right off the edge!',
    partnerFellEdge: 'Your partner slid off the edge',
    edgePlayer: 'You’re right at the edge!',
    edgePartner: 'Your partner is right at the edge',
    sleepCold: 'Too cold to sleep well',
    sleepBadMood: 'Too grumpy to fall asleep',
    sleepArmPinned: 'Arm’s pinned — hard to sleep',
    tooLateAsleep: 'Your partner is already asleep…',
    tooLateEndTurn: 'Intimacy maxed out, but your partner already fell asleep…',
    rubEyes: 'You rub your eyes, half asleep',
    wokeYourself: 'You woke yourself up',
    partnerStoleBlanket: 'Your partner stole the blanket in their sleep',
    partnerBurrito: 'Your partner rolled up into a blanket burrito',
  },

  posture: {
    supine: 'lying face up',
    sideFacing: 'lying sideways, facing in',
    sideAway: 'lying sideways, back turned',
    prone: 'lying face down',
  },

  band: { timid: 'Too soft', gentle: 'Gentle', firm: 'Firm', rough: 'Rough' },

  goal: { sleep: 'Sleep well', intimacy: 'Get intimate' },

  ending: {
    kickedOff: {
      title: 'Booted!',
      caption: 'KICKED OUT',
      description: 'One kick and you’re on the floor. Goodnight.',
      tip: 'Your partner kicks at 100 annoyance. Keep your force in the green zone, and when tempers run high, “Pat” them first.',
    },
    fellOff: {
      title: 'Gravity Wins',
      caption: 'FELL OFF',
      description: 'Nobody touched you. You rolled off all by yourself.',
      tip: '“Scoot away” too often and you’ll fall off. Keep an eye on the red edges of the bed bar.',
    },
    intimacyWin: {
      title: 'Sparks Fly',
      caption: 'LIGHTS OUT',
      description: 'You share a smile. No need for words tonight.',
      tip: 'Perfect! You read your partner’s mood just right.',
    },
    accidentalIntimacy: {
      title: 'Well, That Happened',
      caption: 'PLOT TWIST',
      description: 'You only wanted to sleep… oh well, not bad at all.',
      tip: 'Want to actually sleep? Go easy on the affection.',
    },
    sleepWin: {
      title: 'Rise and Shine',
      caption: 'SWEET DREAMS',
      description: '06:00. You wake up refreshed and full of energy.',
      tip: 'Perfect! Eyes closed, stay warm, lie still: the three keys to a good night’s sleep.',
    },
    sleepLoseTired: {
      title: 'Panda Eyes',
      caption: 'SLEEPLESS',
      description: 'It’s morning, and you barely slept a wink.',
      tip: 'You need a sleep score of 7: close your eyes, tap “Sleep” a lot, stay warm, and don’t get woken up.',
    },
    intimacyLoseFellAsleep: {
      title: 'Snooze, You Lose',
      caption: 'OUT COLD',
      description: 'So much for tonight… you fell asleep first.',
      tip: 'Want to get intimate? Keep your eyes open and don’t keep tapping “Sleep”.',
    },
    intimacyLoseMorning: {
      title: 'Dawn Already?',
      caption: 'TOO LATE',
      description: 'Nothing happened. Then the alarm went off.',
      tip: 'Face them, scoot closer, then kiss. If your partner wants sleep, raise their mood to {n} first.',
    },
  },

  /** Coach hint for each turn (the 💡 hint bar) */
  hint: {
    edgeDanger: 'You’re about to fall off the bed! Scoot toward the middle.',
    calmPartner: 'Your partner is fuming. Pat them first (go gentle).',
    warmUp: 'Brr! Pull the blanket back (you’ll stir a little if you’re asleep).',
    closeEyes: 'Close your eyes first so you can start sleeping.',
    lullPartner: 'Your partner is wide awake. Pat them to sleep first, then you can sleep in peace.',
    stayStill: 'Toss and turn too much and they’ll notice you’re awake. Lie still and sleep.',
    keepSleeping: 'Nice. Keep your eyes closed and sleep.',
    sleepDone: 'Sleep score reached! Keep sleeping till morning.',
    openEyes: 'Open your eyes to kiss and hug, and to see how your partner is doing.',
    faceThem: 'Use “Face them” first.',
    scootCloser: 'Too far apart. “Scoot closer” first.',
    partnerAsleep: 'Your partner is asleep. A firmer kiss (yellow zone) might wake them, or annoy them.',
    cheerUp: 'Your partner is in a bad mood. Whisper or tuck them in first.',
    moodUp: 'Your partner seems sleepy. Raise their mood to {n} first (whisper, tuck them in).',
    kiss: 'Try a kiss. Release in the green zone.',
    hug: 'Try a hug. Release in the green zone.',
    caress: 'Try a caress. Release in the green zone.',
    whisper: 'Whisper sweet nothings to bring you closer.',
    almostThere: 'So close! One more kiss while they’re still awake.',
  },

  speech: {
    // Opening: in each goodnight pool the first 2 of 6 lines are shared and ambiguous, so they don't reveal the goal
    goodnight_sleep: [...SHARED_GOODNIGHT, 'So tired today…', 'Early start tomorrow. Let’s sleep.', 'Can barely keep my eyes open…', 'Night. No bugging me, okay?'],
    goodnight_intimacy: [...SHARED_GOODNIGHT, 'I’m… not that tired tonight.', 'Going to sleep already?', 'You smell really nice tonight.', 'I don’t feel like sleeping yet…'],
    goodnight: ['I’m gonna sleep now.', 'Night-night.', 'Really sleeping now. Don’t bug me.'],

    sleepTalk_sleep: ['Mm… that report…', 'No… five more minutes…', '(mumbles)… tomorrow…', '…alarm… turn it off…'],
    sleepTalk_intimacy: ['Mm… come closer…', '(mumbles)… hold me…', '…you smell nice…', 'Hehe… don’t go…'],

    wake: ['Hm? What is it…', '…What are you doing?', 'I’d just dozed off…', 'Huh? What time is it…'],
    wakeAngry: ['You’re so noisy!', 'I finally fell asleep!', 'Are you going to sleep or not?!', 'Ugh—you woke me up AGAIN!'],
    coldAwake: ['So cold… where’s the blanket?', 'Hey! The blanket’s gone!', 'I’m freezing…'],

    refuseMood: ['I’m not in the mood.', 'Nooo…', 'Not tonight.'],
    refuseAnnoyed: ['Don’t touch me.', 'Go away.', 'I’m mad. Can’t you tell?'],
    sleepyDecline: ['I’m so sleepy… tomorrow, okay?', 'Mm… let me sleep…', 'It’s really late…', '(rolls over)… Bedtime.'],
    okFine: ['Fine… just for a bit.', 'What am I gonna do with you…', '…Okay, but just a little.'],

    receptiveKiss: ['Hehe…', 'One more…', 'Why are you so sweet tonight?', '(blushes)'],
    receptiveHug: ['So warm…', 'Mm, hold me tighter.', 'This is so nice.'],
    receptiveCaress: ['That tickles…', 'Mm… that feels nice.', 'Your hands are so warm.'],
    whisperReply: ['Hehe, you’re such a pest.', 'Me too…', 'Wait, really?', 'Uh-huh, and then?'],
    patReply: ['What’s with the pats… hehe.', 'I’m not a little kid…', 'Pat me again.'],

    armOffered: ['Here, use my arm as a pillow.', 'Wanna lie here?', 'My arm’s all yours.'],
    armAccepted: ['Mm… so comfy.', 'Don’t mind if I do.', 'Your arm’s so warm.'],
    numbArm: ['My arm… it’s gone numb…', 'I can’t feel my arm anymore…', 'Sss… pins and needles…'],
    armRelieved: ['Phew… my arm’s alive again.', 'Sweet relief…', 'Thanks… (shakes out arm)'],

    blanketPulled: ['Hey, the blanket!', 'You took the whole blanket.', 'Brr… so cold…'],
    blanketTucked: ['Thanks…', 'Toasty.', 'You’re so thoughtful.'],
    snore: ['Ugh, so loud…', 'You snore so loud…', '(covers ears)…'],
    roughComplaint: ['Too rough!', 'Are you hitting me?!', 'Be gentle!', 'Ow, that hurts!'],

    noticedIntimacy: ['You’re still up too?', 'Hey, you’re awake?', 'Can’t sleep? …Me neither.'],
    noticedSleep: ['Quit tossing and turning.', 'Are you ever going to sleep?', 'The bed keeps shaking…'],
    breathTell: ['Your breathing’s way too even. You’re not asleep, are you?', 'Quit faking. I know you’re awake.', '…Are you pretending to sleep?'],
    stare: ['Why do you keep looking at me?', 'Close your eyes and go to sleep.', 'What are you staring at…'],

    push: ['Scoot over!', 'You’re squishing me!', 'Move it!'],
    kick: ['Get off the bed!', 'Go sleep on the couch!', 'Scram—!'],
    fellOff: ['Owww…', 'Thud! …Why am I on the floor?', '…The floor’s so cold.'],
    tooLate: ['…Asleep?', 'Of all the times to fall asleep…', '(sigh)'],
    intimacyHigh: ['My heart’s racing…', 'Why are you so clingy tonight?', 'The vibe’s… different tonight.'],
    partnerInitiate: ['Don’t hide from me.', 'Come a little closer.', 'You’re so far away.'],
    wakeUp: ['Wake uuup~', 'Hey, are you asleep? Stay up with me.', 'No sleeping allowed!'],

    // Ending screen: morning_{player goal}_{partner goal}; together = intimacy happened, floor = ended up on the floor
    morning_sleep_sleep: ['“Morning. Did you have anything in mind last night?” “Nope?”', '“I slept so well.” “Right? Straight through till morning for once.”', '“Morning… you were snoring last night.” “So were you.”'],
    morning_intimacy_sleep: ['“What was with all the wriggling last night?” “…Nothing.”', '“Sleep okay last night?” “Y-yeah, fine.”', '“Whoa, those dark circles.” “…Yeah.”'],
    morning_sleep_intimacy: ['“…I was dropping hints last night, you know.” “You were??”', '“You fell asleep so fast last night.” “Yeah, I was wiped out.” “…Oh.”', '“Come home early tonight, okay?” “Sure…?”'],
    morning_intimacy_intimacy: ['“Actually, last night I was kind of… never mind. Morning.”', '“Were we both waiting for the other one to make the first move last night?”', '“…Try again tonight?” “Deal.”'],
    morning_together: ['“Morning.” “…Morning.” (shared smiles)', '“About last night…” “Shh, don’t.”', '“Can we sleep in today?” “We can.”'],
    morning_floor: ['“Why were you sleeping on the floor?” “…What do you think?”', '“How’s your back?” “…Not great.”', '“I said I’m sorry…” “Hmph.”'],
  },
};

export default game;
