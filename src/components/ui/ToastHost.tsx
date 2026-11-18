import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertBanner } from './AlertBanner';
import { DUR, EASE } from '../../motion/tokens';

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
  const dragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
  });
  const elRef = useRef<HTMLDivElement>(null);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    d.active = true;
    d.startX = e.clientX;
    d.startY = e.clientY;
    d.dx = 0;
    d.dy = 0;
    elRef.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d.active || !elRef.current) return;
    d.dx = e.clientX - d.startX;
    d.dy = Math.min(0, e.clientY - d.startY);
    const dist = Math.hypot(d.dx, d.dy);
    elRef.current.style.transition = 'none';
    elRef.current.style.transform = `translate(${d.dx}px, ${d.dy}px)`;
    elRef.current.style.opacity = `${Math.max(0.25, 1 - dist / 180)}`;
  };

  const onPointerUp = () => {
    const d = dragRef.current;
    if (!d.active || !elRef.current) return;
    d.active = false;
    const el = elRef.current;
    if (d.dx > 85 || d.dy < -45) {
      el.style.transition = 'transform 220ms cubic-bezier(0.4, 0, 1, 1), opacity 200ms ease';
      el.style.transform = d.dy < -45 ? 'translate(0, -90px)' : 'translate(260px, 0)';
      el.style.opacity = '0';
      window.setTimeout(() => onDismiss(item.id), 220);
    } else {
      el.style.transition =
        'transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity 200ms ease';
      el.style.transform = 'translate(0, 0)';
      el.style.opacity = '1';
    }
    d.dx = 0;
    d.dy = 0;
  };

  return (
    <motion.div
      ref={elRef}
      initial={{ opacity: 0, y: 12, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ duration: DUR.switch, ease: EASE.outExpo }}
      className="pointer-events-auto tazia-toast-card"
      style={{ ['--toast-ttl' as string]: `${item.durationMs}ms` }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <AlertBanner tone={item.tone} role="status" className="w-full shadow-md">
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
        className="pointer-events-none fixed inset-x-0 bottom-[calc(7.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-[420px] flex-col gap-2 px-4 md:bottom-6"
        aria-live="polite"
        aria-relevant="additions"
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
