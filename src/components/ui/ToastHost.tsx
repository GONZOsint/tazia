import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'motion/react';
import { AlertBanner } from './AlertBanner';
import { TOAST, toastEnter } from '../../motion/tokens';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
  dedupeKey?: string;
  durationMs: number;
}

export type ToastPush =
  | string
  | {
      message: string;
      tone?: ToastTone;
      dedupeKey?: string;
      durationMs?: number;
    };

export interface ToastApi {
  push: (messageOrOpts: ToastPush, tone?: ToastTone) => void;
}

const MAX_TOASTS = 2;

const DURATION: Record<ToastTone, number> = {
  success: TOAST.successMs,
  info: TOAST.infoMs,
  warning: TOAST.warningMs,
  error: TOAST.errorMs,
};

type TimerState = {
  handle: number;
  /** Wall-clock deadline while running; unused while paused. */
  deadline: number;
  /** Remaining ms when paused (hover / focus). */
  remaining: number | null;
};

let fallbackSeq = 0;
function nextToastId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  fallbackSeq += 1;
  return `toast-${Date.now()}-${fallbackSeq}`;
}

const NOOP_TOAST_API: ToastApi = {
  push: () => {
    /* no-op outside provider */
  },
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  return useContext(ToastContext) ?? NOOP_TOAST_API;
}

function ToastCard({
  item,
  onDismiss,
  onPause,
  onResume,
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);
  const [paused, setPaused] = useState(false);

  const syncPause = () => {
    const shouldPause = hoveredRef.current || focusedRef.current;
    setPaused(shouldPause);
    if (shouldPause) {
      onPause(item.id);
    } else {
      onResume(item.id);
    }
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 85 || info.offset.y < -45) {
      onDismiss(item.id);
    }
  };

  return (
    <motion.div
      layout="position"
      initial={reduceMotion ? { opacity: 0 } : toastEnter.initial}
      animate={reduceMotion ? { opacity: 1 } : toastEnter.animate}
      exit={reduceMotion ? { opacity: 0 } : toastEnter.exit}
      transition={reduceMotion ? { duration: 0.12 } : toastEnter.transition}
      drag={!reduceMotion}
      dragConstraints={reduceMotion ? undefined : { left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={reduceMotion ? undefined : 0.72}
      onDragEnd={reduceMotion ? undefined : onDragEnd}
      onPointerEnter={() => {
        hoveredRef.current = true;
        syncPause();
      }}
      onPointerLeave={() => {
        hoveredRef.current = false;
        syncPause();
      }}
      onPointerCancel={() => {
        hoveredRef.current = false;
        syncPause();
      }}
      onFocus={() => {
        focusedRef.current = true;
        syncPause();
      }}
      onBlur={() => {
        focusedRef.current = false;
        syncPause();
      }}
      className="pointer-events-auto tazia-toast-card"
      data-tone={item.tone}
      data-paused={paused || undefined}
      style={{ ['--toast-ttl' as string]: `${item.durationMs}ms` }}
    >
      <AlertBanner
        tone={item.tone}
        role={item.tone === 'error' ? 'alert' : 'status'}
        className={`w-full ${
          item.tone === 'info' || item.tone === 'success'
            ? 'border-transparent px-3 py-2 text-[0.8125rem] font-normal sm:text-[0.8125rem]'
            : ''
        }`}
      >
        <button
          type="button"
          className="w-full cursor-pointer rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={() => onDismiss(item.id)}
        >
          {item.message}
        </button>
      </AlertBanner>
      <div className="tazia-toast-progress" aria-hidden="true">
        <span />
      </div>
    </motion.div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, TimerState>>(new Map());

  const clearTimer = useCallback((id: string) => {
    const state = timers.current.get(id);
    if (!state) return;
    if (state.handle) window.clearTimeout(state.handle);
    timers.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    },
    [clearTimer],
  );

  const armTimer = useCallback(
    (id: string, ms: number) => {
      const prev = timers.current.get(id);
      if (prev?.handle) window.clearTimeout(prev.handle);
      const handle = window.setTimeout(() => dismiss(id), ms);
      timers.current.set(id, { handle, deadline: Date.now() + ms, remaining: null });
    },
    [dismiss],
  );

  const pauseTimer = useCallback((id: string) => {
    const state = timers.current.get(id);
    if (!state || state.remaining !== null) return;
    window.clearTimeout(state.handle);
    const remaining = Math.max(0, state.deadline - Date.now());
    timers.current.set(id, { ...state, handle: 0, remaining });
  }, []);

  const resumeTimer = useCallback(
    (id: string) => {
      const state = timers.current.get(id);
      if (!state || state.remaining === null) return;
      armTimer(id, state.remaining);
    },
    [armTimer],
  );

  // Clean up timers for toasts evicted by dedupeKey or MAX_TOASTS.
  useEffect(() => {
    const activeIds = new Set(items.map((item) => item.id));
    for (const [id, state] of timers.current) {
      if (!activeIds.has(id)) {
        if (state.handle) window.clearTimeout(state.handle);
        timers.current.delete(id);
      }
    }
  }, [items]);

  // Clear all active timers on unmount.
  useEffect(() => {
    const map = timers.current;
    return () => {
      for (const state of map.values()) {
        if (state.handle) window.clearTimeout(state.handle);
      }
      map.clear();
    };
  }, []);

  const push = useCallback(
    (messageOrOpts: ToastPush, toneArg?: ToastTone) => {
      const opts =
        typeof messageOrOpts === 'string'
          ? { message: messageOrOpts, tone: toneArg ?? ('info' as ToastTone) }
          : messageOrOpts;
      const tone = opts.tone ?? 'info';
      const dedupeKey = opts.dedupeKey;
      const durationMs =
        typeof opts.durationMs === 'number' && Number.isFinite(opts.durationMs) && opts.durationMs > 0
          ? opts.durationMs
          : DURATION[tone];
      const id = nextToastId();

      setItems((prev) => {
        const next = dedupeKey ? prev.filter((i) => i.dedupeKey !== dedupeKey) : prev;
        return [
          ...next.slice(-(MAX_TOASTS - 1)),
          { id, message: opts.message, tone, dedupeKey, durationMs },
        ];
      });

      armTimer(id, durationMs);
    },
    [armTimer],
  );

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-[420px] flex-col gap-2 px-4 md:bottom-6">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <ToastCard
              key={item.id}
              item={item}
              onDismiss={dismiss}
              onPause={pauseTimer}
              onResume={resumeTimer}
            />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}