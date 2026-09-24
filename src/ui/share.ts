// 分享:結局圖卡(Web Share API 的檔案分享)與文字複製。

type ShareNavigator = Navigator & {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
};

/** 瀏覽器能不能直接把這個檔案丟進系統分享選單(手機大多可以) */
export function canShareFile(file: File): boolean {
  const nav = navigator as ShareNavigator;
  try {
    return typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] });
  } catch {
    return false;
  }
}

/** 分享圖檔。必須在使用者點擊的同一個事件裡呼叫(不能先 await 別的東西) */
export async function shareFile(file: File, text: string): Promise<'shared' | 'cancelled' | 'failed'> {
  const nav = navigator as ShareNavigator;
  if (typeof nav.share !== 'function') return 'failed';
  try {
    await nav.share({ files: [file], text });
    return 'shared';
  } catch (err) {
    return (err as { name?: string } | null)?.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}

/** 複製文字到剪貼簿;沒有剪貼簿權限時用舊方法。成功 → true */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* 沒有權限 → 舊方法 */
  }
  const ta = document.createElement('textarea');
  try {
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    ta.remove();
  }
}
