import { useEffect, useRef, useState } from 'react';
import type { PassphraseStrengthId } from '../../core/crypto/passphraseWords';
import { useT, type MessageKey } from '../../i18n';

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
}

export function PassphraseStrengthBar({ id, score, className = '' }: PassphraseStrengthBarProps) {
  const t = useT();
  const copy = STRENGTH_COPY[id];
  const filled = filledCount(id, score);
  const title = `${t(copy.label)}: ${t(copy.hint)}`;
  const prevId = useRef(id);
  const [tremor, setTremor] = useState(false);

  useEffect(() => {
    const prev = prevId.current;
    prevId.current = id;
    if (!ACCEPTABLE.has(prev) && ACCEPTABLE.has(id)) {
      setTremor(true);
      const timer = window.setTimeout(() => setTremor(false), 320);
      return () => window.clearTimeout(timer);
    }
  }, [id]);

  return (
    <div
      className={`mt-2 ${tremor ? 'strength-accept-tremor' : ''} ${className}`}
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
