// 遊戲規則用到的文字 key。規則層只產生 key;契約中的舊字串欄位(label/reason/note/text…)
// 以繁體中文(參考語系)填入,UI 則依目前語系用 key 翻譯。
import type { GameMessages } from '../i18n/types';
import zh from '../i18n/zh-TW/game';

export type { GameMessages };
export type MsgKey = keyof GameMessages['msg'];
export type SpeechKey = keyof GameMessages['speech'];
export type HintKey = keyof GameMessages['hint'];

/** 繁體中文參考字典 */
export const ZH: GameMessages = zh;
