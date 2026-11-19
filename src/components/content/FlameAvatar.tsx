import { useEffect, useRef } from 'react';
import {
  mountFlameAvatar,
  type FlameAvatarHandle,
} from '../../core/avatar/flameEngine';

interface FlameAvatarProps {
  seed: string;
  size?: number;
  label?: string;
  className?: string;
  /**
   * When false, bake one static pose (no rAF). Default: animate for size ≥ 32.
   */
  animated?: boolean;
}

/** Flame avatar on a fixed light plate (independent of app dark/light chrome). */
export function FlameAvatar({
  seed,
  size = 28,
  label,
  className = '',
  animated,
}: FlameAvatarProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<FlameAvatarHandle | null>(null);
  const shouldAnimate = animated ?? size >= 32;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    handleRef.current?.destroy();
    handleRef.current = mountFlameAvatar(host, seed, {
      label: label ? `Avatar de ${label}` : 'Avatar llamita',
      theme: 'light',
      size,
      animated: shouldAnimate,
    });

    return () => {
      handleRef.current?.destroy();
      handleRef.current = null;
    };
  }, [seed, size, shouldAnimate]);

  useEffect(() => {
    const svg = handleRef.current?.svg;
    if (!svg) return;
    svg.setAttribute('aria-label', label ? `Avatar de ${label}` : 'Avatar llamita');
  }, [label]);

  return (
    <div
      ref={hostRef}
      className={`flame-avatar-host shrink-0 overflow-hidden rounded-[var(--radius-ctrl)] ${className}`}
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label ? `Avatar de ${label}` : undefined}
      aria-hidden={label ? undefined : true}
    />
  );
}
