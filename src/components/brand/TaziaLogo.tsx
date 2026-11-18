import { useTheme } from '../../theme';

interface TaziaLogoProps {
  className?: string;
  size?: number;
}

export function TaziaLogo({ className = '', size = 36 }: TaziaLogoProps) {
  const { theme } = useTheme();
  const base = import.meta.env.BASE_URL;
  const src =
    theme === 'dark'
      ? `${base}brand/tazia-logo-dark.jpg`
      : `${base}brand/tazia-logo-light.jpg`;


  return (
    <img
      src={src}
      alt="TAZIA"
      width={size}
      height={size}
      className={`rounded-md object-contain ${className}`}
      decoding="async"
    />
  );
}
