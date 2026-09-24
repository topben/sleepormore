// 字典型別以繁體中文(參考語系)為準;其他語系必須提供完全相同的結構。
import type zhTWGame from './zh-TW/game';
import type zhTWUi from './zh-TW/ui';

export type GameMessages = typeof zhTWGame;
export type UiMessages = typeof zhTWUi;

export interface Messages {
  game: GameMessages;
  ui: UiMessages;
}

export type Locale = 'zh-TW' | 'zh-CN' | 'ja' | 'ko' | 'vi' | 'en' | 'es';
