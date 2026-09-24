// 事件 → 一行文字(依目前語系即時翻譯,所以換語言時記錄也會跟著換)
import { ACTIONS } from '../game/actions';
import { clockLabel } from '../game/constants';
import type { MsgKey } from '../game/text';
import type { GameEvent, Role } from '../game/types';
import { fmt, m, speechLine } from '../i18n';

export interface LogItem {
  ev: GameEvent;
  playerRole: Role;
  /** 事件發生時玩家閉著眼(看不到對方的數值變化與眼睛) */
  eyesClosed: boolean;
}

export type LogTone = 'normal' | 'good' | 'bad' | 'love' | 'speech' | 'turn' | 'clue';

const signed = (d: number) => (d > 0 ? `+${Math.round(d)}` : `${Math.round(d)}`);

export function msgText(keys: readonly string[] | undefined): string {
  if (!keys?.length) return '';
  const msg = m().game.msg as Record<string, string>;
  return keys.map((k) => msg[k as MsgKey] ?? k).join(' · ');
}

/** 回傳 null = 不記錄 */
export function describe(item: LogItem): { text: string; tone: LogTone } | null {
  const { ev, playerRole, eyesClosed } = item;
  const t = m().ui.log;
  const g = m().game;
  const mine = (who: Role) => who === playerRole;
  const who = (r: Role) => (mine(r) ? t.actor.you : t.actor.partner);
  const pick = <T>(r: Role, o: { you: T; partner: T }) => (mine(r) ? o.you : o.partner);

  switch (ev.type) {
    case 'action': {
      const def = ACTIONS[ev.action];
      const label = g.action[ev.action].label;
      const notes = msgText(ev.noteKeys);
      if (!ev.success) {
        return { text: fmt(t.failed, { who: who(ev.who), label, reason: notes || '—' }), tone: 'bad' };
      }
      let text = fmt(t.action, { who: who(ev.who), emoji: def.emoji, label });
      if (def.usesForce) {
        const band = fmt(t.band, { band: g.band[ev.band] });
        text += band.startsWith('(') ? ` ${band}` : band; // 半形括號前補空格;全形括號與自帶空格的不動
      }
      if (notes) text += ` · ${notes}`;
      return { text, tone: ev.band === 'rough' ? 'bad' : 'normal' };
    }
    case 'speech': {
      const text = ev.key ? speechLine(ev.key as keyof typeof g.speech, ev.index ?? 0) : ev.text;
      return { text: fmt(t.speech, { who: who(ev.who), text }), tone: 'speech' };
    }
    case 'wake':
      return { text: pick(ev.who, t.wake), tone: 'bad' };
    case 'intimacy':
      return { text: fmt(t.intimacy, { d: signed(ev.delta) }), tone: ev.delta > 0 ? 'love' : 'normal' };
    case 'annoyed':
      if (mine(ev.who) || eyesClosed || Math.abs(ev.delta) < 0.5) return null;
      return { text: fmt(t.annoyed.partner, { d: signed(ev.delta) }), tone: ev.delta > 0 ? 'bad' : 'good' };
    case 'mood':
      if (mine(ev.who) || eyesClosed || Math.abs(ev.delta) < 0.5) return null;
      return { text: fmt(t.mood.partner, { d: signed(ev.delta) }), tone: ev.delta > 0 ? 'good' : 'bad' };
    case 'embrace':
      return { text: ev.on ? t.embraceOn : t.embraceOff, tone: ev.on ? 'love' : 'normal' };
    case 'armPillow':
      return { text: ev.inUse ? t.armInUse : ev.offered ? t.armOffered : t.armFree, tone: 'normal' };
    case 'cold':
      return { text: pick(ev.who, t.cold), tone: mine(ev.who) ? 'bad' : 'normal' };
    case 'numb':
      return { text: pick(ev.who, t.numb), tone: 'bad' };
    case 'noticed':
      return { text: pick(ev.who, t.noticed), tone: mine(ev.who) ? 'bad' : 'clue' };
    case 'snore':
      return { text: fmt(pick(ev.who, t.snore), { level: m().ui.hud.snoreLevel[ev.level] }), tone: 'normal' };
    case 'push':
      return { text: t.push, tone: 'bad' };
    case 'kick':
      return { text: t.kick, tone: 'bad' };
    case 'fell':
      return { text: t.fell, tone: 'bad' };
    case 'note':
      return { text: ev.key ? msgText([ev.key]) : ev.text, tone: 'normal' };
    case 'clue':
      return { text: t.clue, tone: 'clue' };
    case 'eyes':
      if (mine(ev.who)) return { text: ev.eyes === 'closed' ? t.eyes.youClosed : t.eyes.youOpened, tone: 'normal' };
      if (eyesClosed) return null;
      return { text: ev.eyes === 'closed' ? t.eyes.partnerClosed : t.eyes.partnerOpened, tone: 'normal' };
    case 'turnEnd':
      return { text: fmt(t.turn, { time: clockLabel(ev.turn) }), tone: 'turn' };
    default:
      return null; // phase / posture / move / blanket / ending
  }
}
