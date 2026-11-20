import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
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
   * When false, bake one static pose (no rAF). Default: animate for size ≥ 32
   * unless prefers-reduced-motion is enabled.
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
  const reduceMotion = useReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<FlameAvatarHandle | null>(null);
  const labelRef = useRef(label);
  labelRef.current = label;

  const safeSize = Number.isFinite(size) && size > 0 ? size : 28;
  // Treat unresolved reduced-motion as static to avoid remount thrash on hydrate.
  const shouldAnimate = reduceMotion !== true && (animated ?? safeSize >= 32);
  const accessibleLabel = label ? `Avatar de ${label}` : undefined;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    handleRef.current?.destroy();
    host.replaceChildren();

    const handle = mountFlameAvatar(host, seed, {
      label: labelRef.current ? `Avatar de ${labelRef.current}` : 'Avatar llamita',
      theme: 'light',
      size: safeSize,
      animated: shouldAnimate,
    });
    handleRef.current = handle;
    if (!handle) {
      return () => {
        host.replaceChildren();
      };
    }

    // Accessibility lives on the React host wrapper so the imperative SVG never duplicates roles.
    if (handle.svg) {
      handle.svg.setAttribute('aria-hidden', 'true');
      handle.svg.setAttribute('focusable', 'false');
    }

    return () => {
      handle.destroy();
      if (handleRef.current === handle) {
        handleRef.current = null;
      }
      host.replaceChildren();
    };
  }, [seed, safeSize, shouldAnimate]);

  return (
    <div
      ref={hostRef}
      className={`flame-avatar-host shrink-0 overflow-hidden rounded-[var(--radius-ctrl)] ${className}`}
      style={{ width: safeSize, height: safeSize }}
      role={accessibleLabel ? 'img' : undefined}
      aria-label={accessibleLabel}
      aria-hidden={accessibleLabel ? undefined : true}
    />
  );
}