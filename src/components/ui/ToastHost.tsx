import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'motion/react';
import { AlertBanner } from './AlertBanner';
import { TOAST, toastEnter } from '../../motion/tokens';

type ToastTone = 'success' | 'error' | 'warning' | 'info';

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

interface ToastApi {
  push: (messageOrOpts: ToastPush, tone?: ToastTone) => void;
}

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
  /** Remaining ms when paused (hover). */
  remaining: number | null;
};

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      push: () => {
        /* no-op outside provider */
      },
    };
  }
  return ctx;
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
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 85 || info.offset.y < -45) {
      onDismiss(item.id);
    }
  };

  return (
    <motion.div
      layout="position"
      initial={toastEnter.initial}
      animate={toastEnter.animate}
      exit={toastEnter.exit}
      transition={toastEnter.transition}
      drag={reduceMotion ? false : true}
      dragConstraints={reduceMotion ? undefined : { left: 0, right: 0, top: 0, bottom: 0 }}
      dragElastic={reduceMotion ? undefined : 0.72}
      onDragEnd={reduceMotion ? undefined : onDragEnd}
      onPointerEnter={() => onPause(item.id)}
      onPointerLeave={() => onResume(item.id)}
      className="pointer-events-auto tazia-toast-card"
      data-tone={item.tone}
      style={{ ['--toast-ttl' as string]: `${item.durationMs}ms` }}
    >
      <AlertBanner tone={item.tone} role="status" className="w-full">
        <button
          type="button"
          className="w-full text-left"
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
    window.clearTimeout(state.handle);
    timers.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    },
    [clearTimer]
  );

  const armTimer = useCallback(
    (id: string, ms: number) => {
      const prev = timers.current.get(id);
      if (prev) window.clearTimeout(prev.handle);
      const handle = window.setTimeout(() => dismiss(id), ms);
      timers.current.set(id, { handle, deadline: Date.now() + ms, remaining: null });
    },
    [dismiss]
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
    [armTimer]
  );

  const push = useCallback(
    (messageOrOpts: ToastPush, toneArg?: ToastTone) => {
      const opts =
        typeof messageOrOpts === 'string'
          ? { message: messageOrOpts, tone: toneArg ?? ('info' as ToastTone) }
          : messageOrOpts;
      const tone = opts.tone ?? 'info';
      const dedupeKey = opts.dedupeKey;
      const durationMs = opts.durationMs ?? DURATION[tone];
      const id = crypto.randomUUID();

      setItems((prev) => {
        let next = prev;
        if (dedupeKey) {
          for (const old of prev) {
            if (old.dedupeKey === dedupeKey) clearTimer(old.id);
          }
          next = prev.filter((i) => i.dedupeKey !== dedupeKey);
        }
        return [...next.slice(-1), { id, message: opts.message, tone, dedupeKey, durationMs }];
      });

      armTimer(id, durationMs);
    },
    [armTimer, clearTimer]
  );

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-[420px] flex-col gap-2 px-4 md:bottom-6"
        aria-live="polite"
        aria-relevant="additions removals"
      >
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
