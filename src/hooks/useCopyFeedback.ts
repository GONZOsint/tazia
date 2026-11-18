import { useCallback, useEffect, useRef, useState } from 'react';
import { copyTextToClipboard } from '../core/utils/clipboard';

export function useCopyFeedback(resetDelayMs = 1800) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const copyText = useCallback(
    async (text: string, key = 'default') => {
      const ok = await copyTextToClipboard(text);
      if (!ok) return false;
      setCopiedKey(key);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        setCopiedKey(null);
        timerRef.current = null;
      }, resetDelayMs);
      return true;
    },
    [resetDelayMs]
  );

  return {
    copiedKey,
    isCopied: (key = 'default') => copiedKey === key,
    copyText,
  };
}
