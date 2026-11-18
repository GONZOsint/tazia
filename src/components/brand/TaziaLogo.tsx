import { useTheme } from '../../theme';

interface TaziaLogoProps {
  className?: string;
  size?: number;
}

export function TaziaLogo({ className = '', size = 36 }: TaziaLogoProps) {
  const { theme } = useTheme();
  const src =
    theme === 'dark' ? '/brand/tazia-logo-dark.jpg' : '/brand/tazia-logo-light.jpg';

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
