import { memo, useEffect, useRef, useState } from 'react';
import { Loader2, Wifi, WifiOff } from 'lucide-react';
import { useT } from '../../i18n';
import type { MeshStatus } from '../../core/protocol';
import { DUR, MESH_BIRTH } from '../../motion/tokens';
import { haptic, HAPTIC_TAP } from '../../motion/haptic';

interface MeshStatusBadgeProps {
  status: MeshStatus;
  onlineCount: number;
  /** Icon + peer dots only; full label in aria/title. */
  compact?: boolean;
  /** Sticky encrypted relay path (color/border tint). */
  relayActive?: boolean;
}

export const MeshStatusBadge = memo(function MeshStatusBadge({
  status,
  onlineCount,
  compact = false,
  relayActive = false,
}: MeshStatusBadgeProps) {
  const t = useT();
  /** Seed to current status so remount / first paint never fakes a mesh birth. */
  const prevStatus = useRef<MeshStatus>(status);
  const prevRelay = useRef(relayActive);
  const statusSeeded = useRef(false);
  const relaySeeded = useRef(false);
  const [birthing, setBirthing] = useState(false);
  /** When true, dots animate 0 → 0.8 (must start false on birth frame). */
  const [dotsLit, setDotsLit] = useState(true);
  const [relayFlash, setRelayFlash] = useState(false);

  useEffect(() => {
    if (!statusSeeded.current) {
      statusSeeded.current = true;
      prevStatus.current = status;
      return;
    }
    const prev = prevStatus.current;
    prevStatus.current = status;
    if (prev !== 'mesh' && status === 'mesh') {
      setBirthing(true);
      setDotsLit(false);
      haptic(HAPTIC_TAP);
      const raf = window.requestAnimationFrame(() => setDotsLit(true));
      const id = window.setTimeout(() => setBirthing(false), MESH_BIRTH.waveMs);
      return () => {
        window.cancelAnimationFrame(raf);
        window.clearTimeout(id);
      };
    }
  }, [status]);

  useEffect(() => {
    if (!relaySeeded.current) {
      relaySeeded.current = true;
      prevRelay.current = relayActive;
      return;
    }
    if (prevRelay.current === relayActive) return;
    prevRelay.current = relayActive;
    if (relayActive) {
      setRelayFlash(true);
      // Must match mesh-connected-flash (--dur-flash); reducedMs*2 was cutting mid-flash.
      const id = window.setTimeout(() => setRelayFlash(false), Math.round(DUR.flash * 1000));
      return () => window.clearTimeout(id);
    }
  }, [relayActive]);

  const label =
    status === 'connecting'
      ? t('meshConnecting')
      : status === 'alone'
        ? t('meshAlone')
        : status === 'syncing'
          ? t('meshSyncing')
          : t('meshConnected', { n: onlineCount });

  const tone = relayActive
    ? 'border-warn-border bg-warn-bg text-warn-ink relay-channel-tint'
    : status === 'mesh'
      ? 'border-ok-border bg-ok-bg text-ok-ink'
      : status === 'syncing'
        ? 'border-info-border bg-info-bg text-info-ink'
        : status === 'alone'
          ? 'border-warn-border bg-warn-bg text-warn-ink'
          : 'border-border bg-surface text-muted';

  const StatusIcon =
    status === 'mesh'
      ? Wifi
      : status === 'syncing'
        ? Loader2
        : status === 'alone'
          ? WifiOff
          : Loader2;

  const peerDots = Math.min(Math.max(onlineCount, 0), 5);
  const birthClass = birthing ? 'is-birthing' : '';
  const flashClass = birthing || relayFlash ? 'mesh-connected-flash' : '';

  const dotOpacity = (i: number) => {
    if (i >= peerDots) return 'opacity-0';
    if (birthing && !dotsLit) return 'opacity-0';
    return 'opacity-80';
  };

  if (compact) {
    return (
      <p
        className={`inline-flex h-7 min-w-[2.75rem] items-center justify-center gap-1 rounded-[var(--radius-ctrl)] border px-1.5 text-xs font-medium transition-colors duration-[var(--dur-medium)] ${tone} ${flashClass}`}
        role="status"
        aria-label={label}
        title={label}
      >
        <span className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden="true">
          {status === 'mesh' && !relayActive ? (
            <span className={`mesh-radar-dot ${birthClass}`}>
              <span />
            </span>
          ) : (
            <StatusIcon
              className={`h-3.5 w-3.5 ${status === 'syncing' || status === 'connecting' ? 'animate-spin' : ''}`}
              strokeWidth={1.75}
            />
          )}
        </span>
        <span className="inline-flex w-[2.25rem] items-center justify-start gap-0.5" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full bg-current transition-opacity duration-[var(--dur-birth)] ${dotOpacity(i)}`}
              style={
                birthing && dotsLit && i < peerDots
                  ? { transitionDelay: `${i * MESH_BIRTH.dotStaggerMs}ms` }
                  : undefined
              }
            />
          ))}
        </span>
      </p>
    );
  }

  return (
    <p
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-ctrl)] border px-2 py-1 text-xs font-medium transition-colors duration-[var(--dur-medium)] ${tone} ${flashClass}`}
      role="status"
      aria-label={label}
      title={label}
    >
      {status === 'mesh' && !relayActive ? (
        <span className={`mesh-radar-dot shrink-0 ${birthClass}`} aria-hidden="true">
          <span />
        </span>
      ) : (
        <span className="relative flex h-2 w-2 shrink-0">
          {status === 'syncing' && (
            <span
              className="absolute inline-flex h-full w-full rounded-full bg-info opacity-75 motion-safe:animate-ping"
              aria-hidden="true"
            />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full transition-colors duration-[var(--dur-medium)] ${
              relayActive
                ? 'bg-warn'
                : status === 'syncing'
                  ? 'bg-info'
                  : status === 'alone'
                    ? 'bg-warn'
                    : 'bg-faint'
            }`}
          />
        </span>
      )}
      <StatusIcon
        className={`h-3.5 w-3.5 shrink-0 ${
          status === 'mesh' && !relayActive && birthing ? 'wifi-arc-1 is-birthing' : ''
        } ${status === 'syncing' || status === 'connecting' ? 'animate-spin' : ''}`}
        aria-hidden="true"
        strokeWidth={1.75}
      />
      <span>{label}</span>
    </p>
  );
});
