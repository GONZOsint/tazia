import { useEffect, useRef } from 'react';

interface UseSwipeTabsOptions<T extends string> {
  tabs: readonly T[];
  activeTab: T;
  onSwipe: (tab: T) => void;
  /** Minimum horizontal distance (px) to count as a swipe. Default 60. */
  threshold?: number;
  /** If true, swipe gestures are disabled. */
  disabled?: boolean;
}

/**
 * Attach a horizontal swipe gesture to the given ref element.
 * Left swipe → next tab; right swipe → previous tab.
 */
export function useSwipeTabs<T extends string>(
  ref: React.RefObject<HTMLElement | null>,
  opts: UseSwipeTabsOptions<T>,
): void {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let startX = 0;
    let startY = 0;
    let tracking = false;

    const onTouchStart = (e: TouchEvent) => {
      if (optsRef.current.disabled) return;
      const target = e.target;
      if (
        target instanceof Element &&
        target.closest(
          'input, textarea, select, [contenteditable="true"], [role="dialog"], [data-no-swipe]'
        )
      ) {
        return;
      }
      const touch = e.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      // Vertical scroll wins early — avoids tab flicker mid-scroll.
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
        tracking = false;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking || optsRef.current.disabled) return;
      tracking = false;
      const touch = e.changedTouches[0];
      if (!touch) return;

      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const threshold = optsRef.current.threshold ?? 60;

      if (Math.abs(dx) < threshold || Math.abs(dy) > Math.abs(dx)) return;

      const { tabs, activeTab, onSwipe } = optsRef.current;
      const idx = tabs.indexOf(activeTab);
      if (idx < 0) return;

      if (dx < 0 && idx < tabs.length - 1) {
        onSwipe(tabs[idx + 1]!);
      } else if (dx > 0 && idx > 0) {
        onSwipe(tabs[idx - 1]!);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [ref]);
}
