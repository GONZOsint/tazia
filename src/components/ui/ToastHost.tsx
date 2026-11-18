import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertBanner } from './AlertBanner';

type ToastTone = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
  dedupeKey?: string;
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
      const duration = opts.durationMs ?? DURATION[tone];
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
        return [...next.slice(-1), { id, message: opts.message, tone, dedupeKey }];
      });

      const timer = window.setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(9rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-[420px] flex-col gap-2 px-4 md:bottom-6"
        aria-live="polite"
        aria-relevant="additions"
      >
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-auto"
            >
              <AlertBanner tone={item.tone} role="status" className="w-full shadow-md">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => dismiss(item.id)}
                >
                  {item.message}
                </button>
              </AlertBanner>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
