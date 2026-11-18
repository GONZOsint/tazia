/**
 * Cross-browser copy. Async Clipboard API first; execCommand fallback for
 * Safari/iOS and in-app WebViews that reject clipboard.writeText.
 * @see https://web.dev/patterns/clipboard/copy-text
 */

function copyViaExecCommand(text: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.top = '0';
  ta.style.left = '0';
  ta.style.width = '1px';
  ta.style.height = '1px';
  ta.style.padding = '0';
  ta.style.border = 'none';
  ta.style.outline = 'none';
  ta.style.boxShadow = 'none';
  ta.style.background = 'transparent';
  ta.style.opacity = '0';
  document.body.appendChild(ta);

  const selection = document.getSelection();
  const previousRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

  ta.focus();
  ta.select();
  ta.setSelectionRange(0, text.length);

  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }

  document.body.removeChild(ta);
  if (selection) {
    selection.removeAllRanges();
    if (previousRange) selection.addRange(previousRange);
  }
  return ok;
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through — common on iOS Safari outside a tight user-gesture window */
    }
  }

  try {
    return copyViaExecCommand(text);
  } catch {
    return false;
  }
}
