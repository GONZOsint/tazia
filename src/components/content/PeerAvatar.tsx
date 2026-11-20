import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { Identicon } from './Identicon';
import { FlameAvatar } from './FlameAvatar';
import { AvatarPreviewModal } from './AvatarPreviewModal';
import { isValidAvatarSeed } from '../../core/avatar/avatarSeed';
import { TAP, TAP_TRANSITION } from '../../motion/tokens';
import { useT } from '../../i18n';

export interface PeerAvatarProps {
  /** Flame seed from presence / cache; falls back to Identicon when missing/invalid. */
  avatarSeed?: string | null;
  matrix?: readonly boolean[];
  size?: number;
  label?: string;
  fg?: string;
  bg?: string;
  className?: string;
  /** Override auto animate threshold (size ≥ 32). */
  animated?: boolean;
  /**
   * When true and a flame seed exists, tap opens a large preview.
   * Default: true whenever a valid flame seed is present (self included).
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
  className = '',
  animated,
  previewable = true,
}: PeerAvatarProps) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const [previewOpen, setPreviewOpen] = useState(false);

  const safeSize = Number.isFinite(size) && size > 0 ? size : 28;
  const validSeed = avatarSeed && isValidAvatarSeed(avatarSeed) ? avatarSeed : null;
  const canPreview = previewable && validSeed !== null;

  useEffect(() => {
    if (!canPreview) setPreviewOpen(false);
  }, [canPreview]);

  if (validSeed !== null && canPreview) {
    const alias = label || t('presenceNoAlias');
    const openLabel = t('avatarPreviewOpen', { alias });

    return (
      <>
        <motion.button
          type="button"
          whileTap={reduceMotion ? undefined : TAP}
          transition={TAP_TRANSITION}
          onClick={(e) => {
            e.stopPropagation();
            setPreviewOpen(true);
          }}
          className={`flame-avatar-hit shrink-0 cursor-pointer select-none rounded-[var(--radius-ctrl)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${className}`}
          aria-label={openLabel}
          title={openLabel}
        >
          {/* Decorative inside the button so screen readers don't see a nested img label. */}
          <FlameAvatar seed={validSeed} size={safeSize} animated={animated} />
        </motion.button>
        <AvatarPreviewModal
          open={previewOpen}
          seed={validSeed}
          alias={alias}
          onClose={() => setPreviewOpen(false)}
        />
      </>
    );
  }

  if (validSeed !== null) {
    return (
      <FlameAvatar
        seed={validSeed}
        size={safeSize}
        label={label}
        className={className}
        animated={animated}
      />
    );
  }

  if (!matrix || matrix.length === 0) {
    return (
      <div
        className={`shrink-0 rounded-[var(--radius-ctrl)] bg-[var(--flame-plate)] ${className}`}
        style={{ width: safeSize, height: safeSize }}
        aria-hidden="true"
      />
    );
  }

  return (
    <Identicon
      matrix={matrix}
      size={safeSize}
      label={label}
      fg={fg}
      bg={bg}
      className={className}
    />
  );
}