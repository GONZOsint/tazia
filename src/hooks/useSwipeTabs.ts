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

const SNAP_MS = 160;

/**
 * Horizontal swipe on the given element.
 * Writes transform on the active `.tab-panel` (not an inherited CSS var).
 * Cancel / commit release with a short CSS snap so the panel does not jump.
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
    let activePanel: HTMLElement | null = null;
    let snapTimer: number | null = null;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const findActivePanel = (): HTMLElement | null => {
      const panel = el.querySelector('.tab-panel[data-active="true"]');
      return panel instanceof HTMLElement ? panel : null;
    };

    const hardClear = () => {
      if (snapTimer != null) {
        window.clearTimeout(snapTimer);
        snapTimer = null;
      }
      delete el.dataset.swiping;
      if (activePanel) {
        activePanel.style.removeProperty('transition');
        activePanel.style.removeProperty('transform');
        activePanel = null;
      }
    };

    /** Tween transform to a final value, then clear inline styles. */
    const snapClear = (toX: number, then?: () => void) => {
      delete el.dataset.swiping;
      const panel = activePanel;
      if (!panel) {
        then?.();
        return;
      }
      if (prefersReduced) {
        panel.style.removeProperty('transition');
        panel.style.removeProperty('transform');
        activePanel = null;
        then?.();
        return;
      }
      panel.style.transition = `transform ${SNAP_MS}ms var(--ease-out-expo, cubic-bezier(0.16, 1, 0.3, 1))`;
      panel.style.transform = `translateX(${toX}px)`;
      if (snapTimer != null) window.clearTimeout(snapTimer);
      snapTimer = window.setTimeout(() => {
        snapTimer = null;
        panel.style.removeProperty('transition');
        panel.style.removeProperty('transform');
        if (activePanel === panel) activePanel = null;
        then?.();
      }, SNAP_MS);
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
      // Interrupt any in-flight snap from a prior gesture.
      if (snapTimer != null) hardClear();
      const touch = e.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      tracking = true;
      axis = 'undecided';
      activePanel = findActivePanel();
      el.dataset.swiping = 'true';
      if (activePanel) {
        activePanel.style.removeProperty('transition');
        activePanel.style.transform = 'translateX(0px)';
      }
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
          hardClear();
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
      if (activePanel) activePanel.style.transform = `translateX(${damped}px)`;
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!tracking || optsRef.current.disabled) {
        hardClear();
        tracking = false;
        return;
      }
      tracking = false;
      const touch = e.changedTouches[0];
      if (!touch || axis !== 'h') {
        hardClear();
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
        const width = activePanel?.offsetWidth ?? el.offsetWidth ?? 320;
        const exitX = dx < 0 ? -Math.min(width * 0.28, 120) : Math.min(width * 0.28, 120);
        snapClear(exitX, () => onSwipe(next));
      } else {
        snapClear(0);
      }
      axis = 'undecided';
    };

    const onTouchCancel = () => {
      tracking = false;
      axis = 'undecided';
      snapClear(0);
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
      hardClear();
    };
  }, [ref]);
}
