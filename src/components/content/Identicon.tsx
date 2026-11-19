interface IdenticonProps {
  matrix: boolean[];
  size?: number;
  label?: string;
  fg?: string;
  bg?: string;
}

export function Identicon({ matrix, size = 28, label, fg, bg }: IdenticonProps) {
  const fill = fg ?? 'currentColor';
  const plate = bg ?? 'var(--color-bg)';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 5 5"
      role="img"
      aria-label={label ? `Identificador visual de ${label}` : 'Identificador visual criptográfico'}
      className="shrink-0 overflow-hidden rounded-[var(--radius-ctrl)]"
      style={{ backgroundColor: plate }}
    >
      {matrix.map((filled, idx) => {
        if (!filled) return null;
        const x = idx % 5;
        const y = Math.floor(idx / 5);
        return <rect key={idx} x={x} y={y} width={1} height={1} fill={fill} />;
      })}
    </svg>
  );
}
