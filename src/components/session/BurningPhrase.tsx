import { useReducedMotion } from 'motion/react';

const EMBER_COUNT = 14;

/**
 * Inline phrase with CodePen ExpozyR-style gooey fire:
 * rising blobs + SVG filter `#tazia-fire-goo` (no extra library).
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
