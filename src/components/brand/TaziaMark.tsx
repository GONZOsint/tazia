import { motion, type MotionProps } from 'motion/react';
import { TAZIA_MARK_PATHS, TAZIA_MARK_VIEWBOX } from './taziaMarkPaths';

type MarkPart = keyof typeof TAZIA_MARK_PATHS;

interface TaziaMarkProps {
  className?: string;
  size?: number;
  /** When false, omit decorative title (parent supplies accessible name). */
  labelled?: boolean;
  /** Per-part motion props for splash / boot choreography. */
  partMotion?: Partial<Record<MarkPart, MotionProps>>;
}

const PAINT_ORDER: MarkPart[] = ['outlineA', 'outlineB', 'island', 'arrow'];

/** Inline SVG brand mark — cream outline + lime island/flag + chevron. */
export function TaziaMark({
  className = '',
  size = 40,
  labelled = true,
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
      aria-label={labelled ? 'TAZIA' : undefined}
    >
      {PAINT_ORDER.map((key) => {
        const { fill, d } = TAZIA_MARK_PATHS[key];
        const motionProps = partMotion?.[key];
        if (motionProps) {
          return <motion.path key={key} fill={fill} d={d} {...motionProps} />;
        }
        return <path key={key} fill={fill} d={d} />;
      })}
    </svg>
  );
}
