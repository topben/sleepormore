// 對方 AI(DESIGN §8)。只看表象判斷玩家睡了沒;必須回傳可用的動作,保底 sleep。
import { POSTURE_OF, canUse, isAffection } from './actions';
import { BAL, REACH, SLEEP_ASLEEP, SLEEP_AWAKE } from './constants';
import type { Rng } from './rng';
import { apparentlyAsleep, snoreLevel, type ResolveOpts } from './rules';
import type { SpeechKey } from './speech';
import type { MsgKey } from './text';
import type { ActionId, GameState, Posture } from './types';
import { partnerOf } from './types';
import { distanceOf } from './util';

export interface PartnerChoice extends ResolveOpts {
  actionId: ActionId;
  force: number;
}

const LIE: Record<Posture, ActionId> = {
  supine: 'lieSupine',
  sideFacing: 'lieSideFacing',
  sideAway: 'lieSideAway',
  prone: 'lieProne',
};

const c = (actionId: ActionId, force = 0, extra: ResolveOpts = {}): PartnerChoice => ({ actionId, force, ...extra });

export function choosePartnerAction(s: GameState, rng: Rng): PartnerChoice {
  const pr = partnerOf(s.playerRole);
  const P = s.chars[pr];
  const Y = s.chars[s.playerRole];
  const ap = s.armPillow;
  const can = (id: ActionId) => canUse(s, pr, id);
  /** 依序挑第一個可用的候選;都不行 → sleep */
  const first = (...cands: PartnerChoice[]): PartnerChoice => cands.find((x) => can(x.actionId)) ?? c('sleep');
  const yAsleep = apparentlyAsleep(Y);

  // 開場:不暴露目標
  if (s.turn === 0) {
    let id: ActionId = rng() < 0.5 ? 'lieSideFacing' : 'lieSupine';
    if (POSTURE_OF[id] === P.posture) id = id === 'lieSideFacing' ? 'lieSupine' : 'lieSideFacing';
    return first(c(id, 0, { speech: `goodnight_${P.goal}` }));
  }

  // 睡著(無意識,不自醒):單一 r 依累積門檻分支
  if (P.sleep >= SLEEP_ASLEEP) {
    const r = rng();
    const pullNote: MsgKey = s.memo.pullStreak >= 1 ? 'partnerBurrito' : 'partnerStoleBlanket';
    const pull = (f: number) => c('pullBlanket', f, { notes: [pullNote], unconscious: true });
    if (P.warmth < 30 && can('pullBlanket')) return pull(70);
    if (r < 0.25 && can('pullBlanket')) return pull(55);
    if (r < 0.35) {
      const opts = (Object.keys(LIE) as Posture[]).filter((p) => p !== P.posture && can(LIE[p]));
      if (opts.length) return c(LIE[opts[Math.floor(rng() * opts.length) % opts.length]], 0, { unconscious: true });
    }
    if (r < 0.45) {
      const talk: SpeechKey = `sleepTalk_${P.goal}`;
      return c('sleep', 0, { speech: talk, noiseBonus: 8, unconscious: true });
    }
    return c('sleep', 0, { unconscious: true });
  }

  if (P.annoyance >= 70 && P.annoyance < 100) return first(c('push'));

  if (pr === 'male' && ap.offered && ap.numbness >= 75) return first(c('withdrawArm', 40));

  if (P.goal === 'sleep') {
    if (P.warmth < 55 && can('pullBlanket')) return c('pullBlanket', 50);
    if (
      pr === 'female' &&
      ap.offered &&
      !ap.inUse &&
      P.mood >= 40 &&
      (P.posture === 'sideFacing' || P.posture === 'supine') &&
      rng() < 0.5 &&
      can('restOnArm')
    ) {
      return c('restOnArm');
    }
    if (
      isAffection(Y.lastAction) &&
      P.posture !== 'sideAway' &&
      (P.annoyance >= 30 || (P.sleep >= SLEEP_AWAKE && P.mood < BAL.sleepyMood && rng() < BAL.drowsyTurnAway)) &&
      can('lieSideAway')
    ) {
      return c('lieSideAway', 0, { speech: 'sleepyDecline' });
    }
    if (P.mood >= BAL.sleepyMood && s.intimacy >= 55 && P.annoyance < 40 && !yAsleep) {
      // 「好吧…就一下下」
      if (P.posture !== 'sideFacing' && can('lieSideFacing')) return c('lieSideFacing', 0, { speech: 'okFine' });
      const kissFirst = rng() < 0.5;
      const kiss = c('kiss', 40, { speech: 'okFine' });
      const caress = c('caress', 40, { speech: 'okFine' });
      const pick = (kissFirst ? [kiss, caress] : [caress, kiss]).find((x) => can(x.actionId));
      if (pick) return pick;
    }
    const soothing: ActionId[] = ['whisper', 'tuckBlanket', 'offerArm', 'pat'];
    if (
      Y.lastAction &&
      soothing.includes(Y.lastAction) &&
      P.sleep < SLEEP_AWAKE &&
      P.mood >= 60 &&
      P.annoyance < 30 &&
      rng() < BAL.replyChance
    ) {
      return c('whisper');
    }
    if (!yAsleep && snoreLevel(Y) >= 2 && rng() < 0.6) return c('pat', 30);
    if (!yAsleep && rng() < 0.3) return c('pat', 30);
    return c('sleep', 0, s.memo.goodnightSpoken ? {} : { speech: 'goodnight' });
  }

  // P.goal === 'intimacy'
  // 已經閉眼睡了、沒被打擾 → 繼續睡;被拍拍 → 可能就這樣被哄睡
  const disturbed = isAffection(Y.lastAction) || Y.lastAction === 'scootIn' || Y.lastAction === 'pullBlanket';
  if (P.lastAction === 'sleep' && P.sleep >= BAL.momentumMinSleep && !disturbed) return c('sleep');
  if (Y.lastAction === 'pat' && rng() < BAL.lullChance) return c('sleep');
  if (
    pr === 'female' &&
    ap.offered &&
    !ap.inUse &&
    P.mood >= 40 &&
    P.annoyance < 50 &&
    (P.posture === 'sideFacing' || P.posture === 'supine') &&
    can('restOnArm')
  ) {
    return c('restOnArm');
  }
  if (P.mood >= 50 && P.annoyance < 40 && !yAsleep) {
    if (P.posture !== 'sideFacing') return first(c('lieSideFacing'));
    if (distanceOf(s) > REACH) return first(c('scootIn', 40, { speech: 'partnerInitiate' }), c('whisper'));
    if (pr === 'male' && !ap.offered && (Y.posture === 'sideFacing' || Y.posture === 'supine') && rng() < 0.3 && can('offerArm')) {
      return c('offerArm');
    }
    if (Y.posture === 'sideAway' && !s.embrace) return first(c('hug', 40), c('caress', 40), c('whisper'));
    if (Y.posture === 'sideFacing' || Y.posture === 'supine') {
      const r = rng();
      let id: ActionId = r < 0.35 ? 'kiss' : r < 0.7 ? 'caress' : r < 0.9 ? 'hug' : 'whisper';
      if (id === 'hug' && (s.embrace || Y.posture === 'supine')) id = 'caress';
      const force = rng() < 0.85 ? 40 : 80;
      return first(c(id, id === 'whisper' ? 0 : force), c('caress', force), c('whisper'));
    }
    return c('whisper'); // Y 趴著
  }
  if (yAsleep && P.mood >= 50) {
    // 背對著睡 = 盾牌:偷偷從背後抱、小聲試探,不然就放棄去睡
    if (Y.posture === 'sideAway') {
      const r = rng();
      if (r < BAL.shieldHug) return first(c('hug', 40), c('whisper'));
      if (r < BAL.shieldHug + BAL.shieldWhisper) return c('whisper');
      if (r < BAL.shieldHug + BAL.shieldWhisper + BAL.shieldGiveUp) return c('sleep');
    }
    // 試探 / 叫醒
    if (rng() < 0.2) return c('whisper');
    if (P.posture !== 'sideFacing') return first(c('lieSideFacing'));
    return first(c('caress', 80, { speech: 'wakeUp' }), c('scootIn', 40), c('whisper'));
  }
  if (P.mood < 50) {
    const r = rng();
    if (r < BAL.sulkWhisper) return c('whisper');
    if (r < BAL.sulkWhisper + BAL.sulkTuck) return first(c('tuckBlanket', 30), c('whisper'));
    return c('sleep'); // 賭氣睡覺
  }
  return c('sleep');
}
