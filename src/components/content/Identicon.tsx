interface IdenticonProps {
  matrix: boolean[];
  size?: number;
  label?: string;
}

export function Identicon({ matrix, size = 28, label }: IdenticonProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 5 5"
      role="img"
      aria-label={label ? `Identificador visual de ${label}` : 'Identificador visual criptográfico'}
      className="shrink-0 rounded-lg border border-border bg-bg p-1"
    >
      {matrix.map((filled, idx) => {
        if (!filled) return null;
        const x = idx % 5;
        const y = Math.floor(idx / 5);
        return <rect key={idx} x={x} y={y} width={1} height={1} fill="#0f172a" />;
      })}
    </svg>
  );
}
