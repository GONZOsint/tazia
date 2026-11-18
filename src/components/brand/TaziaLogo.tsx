interface TaziaLogoProps {
  className?: string;
  size?: number;
}

export function TaziaLogo({ className = '', size = 40 }: TaziaLogoProps) {
  const base = import.meta.env.BASE_URL;
  // Dark mark keeps contrast on light and dark chrome; light JPG washes out on white.
  const src = `${base}brand/tazia-logo-dark.jpg`;

  return (
    <img
      src={src}
      alt="TAZIA"
      width={size}
      height={size}
      className={`rounded-lg object-cover ring-1 ring-border shadow-sm ${className}`}
      decoding="async"
    />
  );
}
