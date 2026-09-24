// 分享:手機用系統分享選單(Web Share API),其他情況複製到剪貼簿。
export type ShareResult = 'shared' | 'copied' | 'cancelled' | 'failed';

export async function shareText(text: string, url: string): Promise<ShareResult> {
  const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ text, url });
      return 'shared';
    } catch (err) {
      if ((err as { name?: string } | null)?.name === 'AbortError') return 'cancelled';
      // 不支援 / 被擋 → 改用複製
    }
  }
  const full = `${text} ${url}`;
  try {
    await navigator.clipboard.writeText(full);
    return 'copied';
  } catch {
    /* 沒有剪貼簿權限 → 舊方法 */
  }
  const ta = document.createElement('textarea');
  try {
    ta.value = full;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.append(ta);
    ta.select();
    return document.execCommand('copy') ? 'copied' : 'failed';
  } catch {
    return 'failed';
  } finally {
    ta.remove();
  }
}
