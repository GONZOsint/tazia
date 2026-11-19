import { useReducedMotion } from 'motion/react';

/** Fewer, larger blobs so the SVG goo filter fuses into one short plume. */
const EMBER_COUNT = 11;

/**
 * Inline phrase: soft fire plume rises from behind sharp type
 * (transform/opacity particles only — no SVG filters; text stays sharp).
 */
export function BurningPhrase({ children }: { children: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <span className={`hero-burn-phrase${reduceMotion ? ' hero-burn-phrase--static' : ''}`}>
      {!reduceMotion ? (
        <span className="hero-burn-phrase__embers" aria-hidden="true">
          {Array.from({ length: EMBER_COUNT }, (_, i) => (
            <span key={i} className="hero-burn-phrase__p" />
          ))}
        </span>
      ) : null}
      <span className="hero-burn-phrase__text">{children}</span>
    </span>
  );
}
