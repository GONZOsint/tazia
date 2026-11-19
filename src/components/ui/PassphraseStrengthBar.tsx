import { useEffect, useRef, useState } from 'react';
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
  return Math.min(SEGMENT_COUNT, score + 1);
}

function segmentTone(id: PassphraseStrengthId, index: number, filled: number): string {
  if (index >= filled) return 'bg-border';
  if (id === 'weak' || id === 'short') return 'bg-danger';
  if (id === 'ok') return 'bg-warn';
  if (id === 'good') return 'bg-accent';
  return 'bg-ok';
}

interface PassphraseStrengthBarProps {
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
  const copy = STRENGTH_COPY[id];
  const filled = filledCount(id, score);
  const title = `${t(copy.label)}: ${t(copy.hint)}`;
  const prevId = useRef(id);
  const prevDouseKey = useRef(douseKey);
  const [tremor, setTremor] = useState(false);
  const [douse, setDouse] = useState(false);

  useEffect(() => {
    const prev = prevId.current;
    prevId.current = id;
    if (!ACCEPTABLE.has(prev) && ACCEPTABLE.has(id)) {
      setTremor(true);
      const timer = window.setTimeout(() => setTremor(false), TREMOR_MS);
      return () => window.clearTimeout(timer);
    }
    if (ACCEPTABLE.has(prev) && !ACCEPTABLE.has(id) && id !== 'empty') {
      setDouse(true);
      const timer = window.setTimeout(() => setDouse(false), DOUSE_MS);
      return () => window.clearTimeout(timer);
    }
  }, [id]);

  useEffect(() => {
    if (douseKey <= 0 || douseKey === prevDouseKey.current) return;
    prevDouseKey.current = douseKey;
    setDouse(true);
    const timer = window.setTimeout(() => setDouse(false), DOUSE_MS);
    return () => window.clearTimeout(timer);
  }, [douseKey]);

  return (
    <div
      className={`${tremor ? 'strength-accept-tremor' : ''} ${douse ? 'passphrase-douse' : ''} ${className}`}
      title={title}
      role="status"
      aria-label={title}
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
