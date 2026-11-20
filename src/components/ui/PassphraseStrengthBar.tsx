import { useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import type { PassphraseStrengthId } from '../../core/crypto/passphraseWords';
import { useT, type MessageKey } from '../../i18n';
import { DUR } from '../../motion/tokens';

/** Match strength-accept-tremor / passphrase-douse CSS durations. */
const TREMOR_MS = Math.round(DUR.flash * 1000);
const DOUSE_MS = Math.round(DUR.ritual * 1000);

const STRENGTH_COPY: Record<PassphraseStrengthId, { label: MessageKey; hint: MessageKey }> = {
  empty: { label: 'strengthEmpty', hint: 'strengthEmptyHint' },
  weak: { label: 'strengthWeak', hint: 'strengthWeakHint' },
  short: { label: 'strengthShort', hint: 'strengthShortHint' },
  strong: { label: 'strengthStrong', hint: 'strengthStrongHint' },
  good: { label: 'strengthGood', hint: 'strengthGoodHint' },
  ok: { label: 'strengthOk', hint: 'strengthOkHint' },
};

const SEGMENT_COUNT = 4;
const ACCEPTABLE = new Set<PassphraseStrengthId>(['ok', 'good', 'strong']);

function filledCount(id: PassphraseStrengthId, score: 0 | 1 | 2 | 3): number {
  if (id === 'empty') return 0;
  if (id === 'weak' || id === 'short') return 1;
  return Math.min(SEGMENT_COUNT, Math.max(0, score + 1));
}

function segmentTone(id: PassphraseStrengthId, index: number, filled: number): string {
  if (index >= filled) return 'bg-border';
  if (id === 'weak' || id === 'short') return 'bg-danger';
  if (id === 'ok') return 'bg-warn';
  if (id === 'good') return 'bg-accent';
  return 'bg-ok';
}

export interface PassphraseStrengthBarProps {
  id: PassphraseStrengthId;
  score: 0 | 1 | 2 | 3;
  className?: string;
  /** Increment to force passphrase-douse (e.g. join error). */
  douseKey?: number;
}

export function PassphraseStrengthBar({
  id,
  score,
  className = 'mt-2',
  douseKey = 0,
}: PassphraseStrengthBarProps) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const copy = STRENGTH_COPY[id] ?? STRENGTH_COPY.empty;
  const filled = filledCount(id, score);
  const title = `${t(copy.label)}: ${t(copy.hint)}`;

  const [prevId, setPrevId] = useState(id);
  const [prevDouseKey, setPrevDouseKey] = useState(douseKey);
  const [tremor, setTremor] = useState(false);
  const [dousePulse, setDousePulse] = useState(0);

  if (prevId !== id) {
    setPrevId(id);
    if (!reduceMotion) {
      if (!ACCEPTABLE.has(prevId) && ACCEPTABLE.has(id)) {
        setTremor(true);
        setDousePulse(0);
      } else if (ACCEPTABLE.has(prevId) && !ACCEPTABLE.has(id) && id !== 'empty') {
        setTremor(false);
        setDousePulse((n) => n + 1);
      } else if (!ACCEPTABLE.has(id)) {
        setTremor(false);
      }
    }
  }

  if (prevDouseKey !== douseKey) {
    setPrevDouseKey(douseKey);
    if (!reduceMotion && douseKey > 0) {
      setTremor(false);
      setDousePulse((n) => n + 1);
    }
  }

  useEffect(() => {
    if (!tremor) return;
    const timer = window.setTimeout(() => setTremor(false), TREMOR_MS);
    return () => window.clearTimeout(timer);
  }, [tremor]);

  useEffect(() => {
    if (dousePulse === 0) return;
    const timer = window.setTimeout(() => setDousePulse(0), DOUSE_MS);
    return () => window.clearTimeout(timer);
  }, [dousePulse]);

  const douse = dousePulse > 0;
  const rootClassName = [
    tremor ? 'strength-accept-tremor' : '',
    douse ? 'passphrase-douse' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rootClassName}
      title={title}
      role="status"
      aria-atomic="true"
    >
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-[var(--dur-micro)] ${segmentTone(id, i, filled)}`}
          />
        ))}
      </div>
      <span className="sr-only">{title}</span>
    </div>
  );
}