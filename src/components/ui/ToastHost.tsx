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
import { toastEnter } from '../../motion/tokens';

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
  success: 2500,
  info: 2500,
  warning: 4000,
  error: 5000,
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
}: {
  item: ToastItem;
  onDismiss: (id: string) => void;
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
  const timers = useRef<Map<string, number>>(new Map());

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) window.clearTimeout(t);
    timers.current.delete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

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
            if (old.dedupeKey === dedupeKey) {
              const t = timers.current.get(old.id);
              if (t) window.clearTimeout(t);
              timers.current.delete(old.id);
            }
          }
          next = prev.filter((i) => i.dedupeKey !== dedupeKey);
        }
        return [...next.slice(-1), { id, message: opts.message, tone, dedupeKey, durationMs }];
      });

      const timer = window.setTimeout(() => dismiss(id), durationMs);
      timers.current.set(id, timer);
    },
    [dismiss]
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
            <ToastCard key={item.id} item={item} onDismiss={dismiss} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
