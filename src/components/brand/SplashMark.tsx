import { TAZIA_MARK_PATHS, TAZIA_MARK_VIEWBOX } from './taziaMarkPaths';

interface SplashMarkProps {
  size?: number;
  className?: string;
}

/**
 * Splash-only mark with radar / stroke-draw / flash hooks for CSS choreography
 * (ported from splash UI mock). Static TaziaMark stays for chrome / Ignite.
 */
export function SplashMark({ size = 128, className = '' }: SplashMarkProps) {
  const { outlineA, outlineB, island, arrow } = TAZIA_MARK_PATHS;

  return (
    <svg
      className={`splash-mark ${className}`.trim()}
      width={size}
      height={size}
      viewBox={TAZIA_MARK_VIEWBOX}
      fill="none"
      role="presentation"
      aria-hidden="true"
    >
      <circle
        className="splash-mark__radar"
        cx="252"
        cy="237"
        r="175"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeOpacity="0.45"
      />
      <path
        className="splash-mark__outline splash-mark__outline--a"
        pathLength={100}
        fill={outlineA.fill}
        d={outlineA.d}
      />
      <path
        className="splash-mark__outline splash-mark__outline--b"
        pathLength={100}
        fill={outlineB.fill}
        d={outlineB.d}
      />
      <path className="splash-mark__island" fill={island.fill} d={island.d} />
      <circle
        className="splash-mark__flash"
        cx="366"
        cy="355"
        r="34"
        fill="var(--color-accent)"
        fillOpacity="0.35"
      />
      <path className="splash-mark__arrow" fill={arrow.fill} d={arrow.d} />
    </svg>
  );
}
