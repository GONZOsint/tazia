import { useEffect, useRef } from 'react';

interface UseSwipeTabsOptions<T extends string> {
  tabs: readonly T[];
  activeTab: T;
  onSwipe: (tab: T) => void;
  /** Minimum horizontal distance (px) to count as a swipe. Default 56. */
  threshold?: number;
  /** If true, swipe gestures are disabled. */
  disabled?: boolean;
}

/**
 * Horizontal swipe on the given element.
 * Follows the finger via `--tab-drag`, then snaps / commits the tab change.
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
    let axis: 'undecided' | 'h' | 'v' = 'undecided';

    const clearDrag = () => {
      delete el.dataset.swiping;
      el.style.removeProperty('--tab-drag');
    };

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
      axis = 'undecided';
      el.dataset.swiping = 'true';
      el.style.setProperty('--tab-drag', '0px');
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!tracking) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      if (axis === 'undecided') {
        if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) {
          axis = 'v';
          tracking = false;
          clearDrag();
          return;
        }
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          axis = 'h';
        } else {
          return;
        }
      }

      if (axis !== 'h') return;

      const { tabs, activeTab } = optsRef.current;
      const idx = tabs.indexOf(activeTab);
      const atStart = idx <= 0;
      const atEnd = idx >= tabs.length - 1;
      // Rubber-band at edges.
      let damped = dx;
      if ((atStart && dx > 0) || (atEnd && dx < 0)) {
        damped = dx * 0.28;
      } else {
        damped = dx * 0.55;
      }
      el.style.setProperty('--tab-drag', `${damped}px`);
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking || optsRef.current.disabled) {
        clearDrag();
        tracking = false;
        return;
      }
      tracking = false;
      const touch = e.changedTouches[0];
      if (!touch || axis !== 'h') {
        clearDrag();
        return;
      }

      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const threshold = optsRef.current.threshold ?? 56;
      const { tabs, activeTab, onSwipe } = optsRef.current;
      const idx = tabs.indexOf(activeTab);

      const commit =
        Math.abs(dx) >= threshold &&
        Math.abs(dx) > Math.abs(dy) &&
        idx >= 0 &&
        ((dx < 0 && idx < tabs.length - 1) || (dx > 0 && idx > 0));

      if (commit) {
        const next = dx < 0 ? tabs[idx + 1]! : tabs[idx - 1]!;
        clearDrag();
        onSwipe(next);
      } else {
        clearDrag();
      }
      axis = 'undecided';
    };

    const onTouchCancel = () => {
      tracking = false;
      axis = 'undecided';
      clearDrag();
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchCancel, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchCancel);
      clearDrag();
    };
  }, [ref]);
}
