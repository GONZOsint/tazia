import { useCallback, useMemo, useRef, type RefObject } from 'react';
import {
  FIRE_BUDGET,
  ensureFullscreenCanvas,
  scheduleBurnWatchdog,
} from '../../../motion/fireBurnEngine';

export type BurnOverlayFinishOpts = {
  clearCanvas?: boolean;
  /** Fill cleared canvas with this color (session bg veil handoff). */
  fillBg?: string;
};

export type BurnOverlayLifecycle = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  rafRef: RefObject<number | null>;
  doneRef: RefObject<boolean>;
  abortedRef: RefObject<boolean>;
  finish: (opts?: BurnOverlayFinishOpts) => void;
  scheduleWatchdog: (timeouts: number[], finishMs: number, onFire?: () => void) => void;
  bindResize: (
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
  ) => { onResize: () => number; detach: () => void };
};

/**
 * Shared refs + finish / resize / watchdog helpers for canvas burn overlays.
 * Call `resetBurnRunGuards` at the start of each play effect.
 */
export function useBurnOverlayLifecycle(
  onComplete: () => void
): BurnOverlayLifecycle {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const abortedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const finish = useCallback((opts?: BurnOverlayFinishOpts) => {
    if (doneRef.current || abortedRef.current) return;
    doneRef.current = true;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const clearCanvas = opts?.clearCanvas !== false;
    const canvas = canvasRef.current;
    if (clearCanvas && canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (opts?.fillBg) {
          ctx.fillStyle = opts.fillBg;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    }
    onCompleteRef.current();
  }, []);

  const scheduleWatchdog = useCallback(
    (timeouts: number[], finishMs: number, onFire?: () => void) => {
      scheduleBurnWatchdog(timeouts, finishMs, () => (onFire ? onFire() : finish()), {
        doneRef,
        abortedRef,
      });
    },
    [finish]
  );

  const bindResize = useCallback(
    (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
      const onResize = () => ensureFullscreenCanvas(canvas, ctx, FIRE_BUDGET.maxDpr);
      onResize();
      window.addEventListener('resize', onResize);
      return {
        onResize,
        detach: () => window.removeEventListener('resize', onResize),
      };
    },
    []
  );

  return useMemo(
    () => ({
      canvasRef,
      rafRef,
      doneRef,
      abortedRef,
      finish,
      scheduleWatchdog,
      bindResize,
    }),
    [finish, scheduleWatchdog, bindResize]
  );
}

/** Reset lifecycle guards at the start of a play run. */
export function resetBurnRunGuards(life: BurnOverlayLifecycle): void {
  life.doneRef.current = false;
  life.abortedRef.current = false;
}

/** Abort + cancel rAF; call from effect cleanup. */
export function abortBurnRun(
  life: BurnOverlayLifecycle,
  timeouts: number[],
  extra?: () => void
): void {
  life.abortedRef.current = true;
  for (const id of timeouts) window.clearTimeout(id);
  if (life.rafRef.current !== null) cancelAnimationFrame(life.rafRef.current);
  extra?.();
}

/** Staged reduced-motion: onFront → frontMs → onCollapse → collapseMs → onFinish. */
export function runReducedMotionPhases(
  timeouts: number[],
  opts: {
    abortedRef: RefObject<boolean>;
    frontMs: number;
    collapseMs: number;
    onFront: () => void;
    onCollapse: () => void;
    onFinish: () => void;
  }
): void {
  opts.onFront();
  timeouts.push(
    window.setTimeout(() => {
      if (opts.abortedRef.current) return;
      opts.onCollapse();
      timeouts.push(window.setTimeout(opts.onFinish, opts.collapseMs));
    }, opts.frontMs)
  );
}
