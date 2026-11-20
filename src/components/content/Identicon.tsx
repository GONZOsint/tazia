import { memo, useMemo } from 'react';

export interface IdenticonProps {
  matrix: readonly boolean[];
  size?: number;
  label?: string;
  fg?: string;
  bg?: string;
  className?: string;
  decorative?: boolean;
}

const GRID_SIZE = 5;
const CELL_COUNT = GRID_SIZE * GRID_SIZE;

export const Identicon = memo(function Identicon({
  matrix,
  size = 28,
  label,
  fg,
  bg,
  className = '',
  decorative = false,
}: IdenticonProps) {
  const safeSize = Number.isFinite(size) && size > 0 ? size : 28;
  const fill = fg ?? 'currentColor';
  const plate = bg ?? 'var(--color-bg)';

  const pathData = useMemo(() => {
    const limit = Math.min(matrix.length, CELL_COUNT);
    let d = '';
    for (let idx = 0; idx < limit; idx++) {
      if (!matrix[idx]) continue;
      const x = idx % GRID_SIZE;
      const y = Math.floor(idx / GRID_SIZE);
      d += `M${x} ${y}h1v1h-1z`;
    }
    return d;
  }, [matrix]);

  const accessibleLabel = label
    ? `Identificador visual de ${label}`
    : 'Identificador visual criptográfico';

  return (
    <svg
      width={safeSize}
      height={safeSize}
      viewBox={`0 0 ${GRID_SIZE} ${GRID_SIZE}`}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : accessibleLabel}
      aria-hidden={decorative || undefined}
      focusable="false"
      className={`block shrink-0 overflow-hidden rounded-[var(--radius-ctrl)] ${className}`}
      style={{ backgroundColor: plate }}
    >
      {pathData && <path d={pathData} fill={fill} shapeRendering="crispEdges" />}
    </svg>
  );
});