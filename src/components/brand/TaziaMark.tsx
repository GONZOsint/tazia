import { motion, type MotionProps } from 'motion/react';
import { TAZIA_MARK_PATHS, TAZIA_MARK_VIEWBOX } from './taziaMarkPaths';

type MarkPart = keyof typeof TAZIA_MARK_PATHS;

interface TaziaMarkProps {
  className?: string;
  size?: number;
  /** When false, omit decorative title (parent supplies accessible name). */
  labelled?: boolean;
  /** Accessible name when `labelled` — prefer `t('brand')` from callers. */
  ariaLabel?: string;
  /**
   * Per-part motion for splash assembly.
   * Applied on `<g>` (not `<path>`) so scale/opacity transforms are reliable in SVG.
   */
  partMotion?: Partial<Record<MarkPart, MotionProps>>;
}

const PAINT_ORDER: MarkPart[] = ['outlineA', 'outlineB', 'island', 'arrow'];

/** Inline SVG brand mark — brand-cream outline + accent lime island/flag + chevron. */
export function TaziaMark({
  className = '',
  size = 40,
  labelled = true,
  ariaLabel = 'TAZIA',
  partMotion,
}: TaziaMarkProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={TAZIA_MARK_VIEWBOX}
      fill="none"
      role={labelled ? 'img' : 'presentation'}
      aria-hidden={labelled ? undefined : true}
      aria-label={labelled ? ariaLabel : undefined}
    >
      {PAINT_ORDER.map((key) => {
        const { fill, d } = TAZIA_MARK_PATHS[key];
        const motionProps = partMotion?.[key];
        if (motionProps) {
          return (
            <motion.g key={key} {...motionProps}>
              <path fill={fill} d={d} />
            </motion.g>
          );
        }
        return <path key={key} fill={fill} d={d} />;
      })}
    </svg>
  );
}
