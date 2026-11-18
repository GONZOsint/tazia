import { useCallback, useEffect, useRef, useState } from 'react';

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
      try {
        await navigator.clipboard.writeText(text);
        setCopiedKey(key);
        if (timerRef.current !== null) {
          window.clearTimeout(timerRef.current);
        }
        timerRef.current = window.setTimeout(() => {
          setCopiedKey(null);
          timerRef.current = null;
        }, resetDelayMs);
      } catch {
        // Silencio si el portapapeles no está disponible
      }
    },
    [resetDelayMs]
  );

  return {
    copiedKey,
    isCopied: (key = 'default') => copiedKey === key,
    copyText,
  };
}
