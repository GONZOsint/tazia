export function CapacityDots({
  filled,
  max,
  label,
}: {
  filled: number;
  max: number;
  label: string;
}) {
  return (
    <div
      className="inline-flex items-center gap-1"
      role="meter"
      aria-valuenow={filled}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
    >
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`h-2 w-2 rounded-full transition-colors duration-[var(--dur-micro)] ${
            i < filled ? 'bg-accent' : 'bg-border'
          }`}
        />
      ))}
    </div>
  );
}
