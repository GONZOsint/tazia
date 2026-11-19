import { useState } from 'react';
import { motion } from 'motion/react';
import { Identicon } from './Identicon';
import { FlameAvatar } from './FlameAvatar';
import { AvatarPreviewModal } from './AvatarPreviewModal';
import { isValidAvatarSeed } from '../../core/avatar/avatarSeed';
import { TAP, TAP_TRANSITION } from '../../motion/tokens';
import { useT } from '../../i18n';

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
  /**
   * When true and a flame seed exists, tap opens a large preview.
   * Default: true for peers when a label is present.
   */
  previewable?: boolean;
}

/** Person avatar: light-plate flame when seed is present, else Identicon. */
export function PeerAvatar({
  avatarSeed,
  matrix,
  size = 28,
  label,
  fg,
  bg,
  className,
  animated,
  previewable,
}: PeerAvatarProps) {
  const t = useT();
  const [previewOpen, setPreviewOpen] = useState(false);
  const hasFlame = Boolean(avatarSeed && isValidAvatarSeed(avatarSeed));
  const canPreview = (previewable ?? Boolean(label)) && hasFlame;

  const flame = hasFlame ? (
    <FlameAvatar
      seed={avatarSeed!}
      size={size}
      label={label}
      className={className}
      animated={animated}
    />
  ) : null;

  if (hasFlame && canPreview) {
    return (
      <>
        <motion.button
          type="button"
          whileTap={TAP}
          transition={TAP_TRANSITION}
          onClick={(e) => {
            e.stopPropagation();
            setPreviewOpen(true);
          }}
          className="flame-avatar-hit shrink-0 rounded-[var(--radius-ctrl)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          aria-label={t('avatarPreviewOpen', { alias: label || t('presenceNoAlias') })}
        >
          {flame}
        </motion.button>
        <AvatarPreviewModal
          open={previewOpen}
          seed={avatarSeed!}
          alias={label || t('presenceNoAlias')}
          onClose={() => setPreviewOpen(false)}
        />
      </>
    );
  }

  if (hasFlame) return flame;

  if (!matrix || matrix.length === 0) {
    return (
      <div
        className={`shrink-0 rounded-[var(--radius-ctrl)] bg-[var(--flame-plate)] ${className ?? ''}`}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }
  return <Identicon matrix={matrix} size={size} label={label} fg={fg} bg={bg} />;
}
