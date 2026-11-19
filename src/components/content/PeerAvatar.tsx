import { Identicon } from './Identicon';
import { FlameAvatar } from './FlameAvatar';
import { isValidAvatarSeed } from '../../core/avatar/avatarSeed';

interface PeerAvatarProps {
  /** Flame seed from presence / cache; falls back to Identicon when missing/invalid. */
  avatarSeed?: string | null;
  matrix?: boolean[];
  size?: number;
  label?: string;
  fg?: string;
  bg?: string;
  className?: string;
  /** Override auto animate threshold (size ≥ 32). */
  animated?: boolean;
}

/** Person avatar: animated flame when seed is present, else Identicon. */
export function PeerAvatar({
  avatarSeed,
  matrix,
  size = 28,
  label,
  fg,
  bg,
  className,
  animated,
}: PeerAvatarProps) {
  if (avatarSeed && isValidAvatarSeed(avatarSeed)) {
    return (
      <FlameAvatar
        seed={avatarSeed}
        size={size}
        label={label}
        className={className}
        animated={animated}
      />
    );
  }
  if (!matrix || matrix.length === 0) {
    return (
      <div
        className={`shrink-0 rounded-[var(--radius-ctrl)] bg-surface ${className ?? ''}`}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }
  return <Identicon matrix={matrix} size={size} label={label} fg={fg} bg={bg} />;
}
