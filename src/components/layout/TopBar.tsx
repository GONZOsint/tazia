import { Flame } from 'lucide-react';
import { motion } from 'motion/react';
import { useT } from '../../i18n';
import { identiconMatrixFromHex } from '../../core/crypto/identity';
import type { MeshStatus } from '../../core/protocol';
import { countOtherPeers } from '../../hooks/useRoomManager';
import { DUR, EASE, TAP, TAP_TRANSITION } from '../../motion/tokens';
import { TaziaLogo } from '../brand/TaziaLogo';
import { Identicon } from '../content/Identicon';
import { MeshStatusBadge } from '../session/MeshStatusBadge';
import { LangToggle } from '../ui/LangToggle';
import { ThemeToggle } from '../ui/ThemeToggle';
import { DESKTOP_NAV_ITEMS, type ActiveTab } from './navItems';

export type { ActiveTab } from './navItems';

export interface ActiveZoneChip {
  roomId: string;
  meshStatus: MeshStatus;
  onlineUserIds: string[];
  selfUserId: string;
  relayActive?: boolean;
}

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  hasActiveRoom: boolean;
  onBurnSession: () => void;
  forumUnread?: number;
  dmUnread?: number;
  /** Open zone count — badge on Zonas when > 1. */
  roomsCount?: number;
  activeZone?: ActiveZoneChip | null;
  /** Visual ignition while burn choreography runs. */
  burnHeating?: boolean;
  /** Zone ignite glow on the active chip (inverse of burn). */
  igniting?: boolean;
  /** One-beat flash when switching active zone. */
  zoneSwitchPulse?: boolean;
}

export function TopBar({
  activeTab,
  onSelectTab,
  hasActiveRoom,
  onBurnSession,
  forumUnread = 0,
  dmUnread = 0,
  roomsCount = 0,
  activeZone = null,
  burnHeating = false,
  igniting = false,
  zoneSwitchPulse = false,
}: TopBarProps) {
  const t = useT();
  const shortId = activeZone
    ? activeZone.roomId.length > 8
      ? `${activeZone.roomId.slice(0, 6)}…`
      : activeZone.roomId
    : '';

  return (
    <header
      className="z-30 shrink-0 border-b border-border bg-surface-raised/95 backdrop-blur-sm"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/*
        3-column grid keeps the center nav fixed when left/right chrome
        grows (zone chip, burn button, unread badges) — avoids justify-between shift.
      */}
      <div className="mx-auto grid h-12 max-w-[1280px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-4 sm:h-14 sm:gap-4 sm:px-8">
        <div className="col-start-1 flex min-w-0 items-center justify-start gap-2 sm:gap-3">
          <motion.button
            whileTap={TAP}
            transition={TAP_TRANSITION}
            type="button"
            onClick={() => onSelectTab('rooms')}
            className="flex shrink-0 items-center gap-2 rounded-[var(--radius-ctrl)] py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label={t('navRooms')}
          >
            <TaziaLogo size={36} />
            <span className="hidden min-w-0 sm:block">
              <span className="font-display text-xl font-bold tracking-tight text-ink">
                {t('brand')}
              </span>
            </span>
          </motion.button>

          {activeZone && (
            <motion.button
              whileTap={TAP}
              transition={TAP_TRANSITION}
              type="button"
              onClick={() => onSelectTab(roomsCount > 1 ? 'rooms' : 'forum')}
              title={
                roomsCount > 1
                  ? `${activeZone.roomId} · ${roomsCount}`
                  : activeZone.roomId
              }
              aria-label={
                roomsCount > 1
                  ? `${t('roomsActiveLabel')}: ${activeZone.roomId} — ${t('navRooms')} (${roomsCount})`
                  : `${t('roomsActiveLabel')}: ${activeZone.roomId}`
              }
              data-zone-id={activeZone.roomId}
              className={`session-burn-target session-ignite-target flex h-9 min-w-0 max-w-[min(42vw,11rem)] shrink items-center gap-1.5 rounded-[var(--radius-ctrl)] border border-accent/40 bg-accent-soft px-1.5 hover:border-accent/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:max-w-[220px] sm:gap-2 sm:px-2 ${
                igniting || zoneSwitchPulse ? 'igniting-front' : ''
              }`}
            >
              <Identicon
                matrix={identiconMatrixFromHex(activeZone.roomId)}
                size={22}
                label={activeZone.roomId}
              />
              <span className="hidden min-w-0 truncate font-mono text-[11px] font-medium text-ink sm:inline">
                {shortId}
              </span>
              {roomsCount > 1 && (
                <span className="inline-flex h-4 min-w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-[9px] font-bold tabular-nums text-on-accent">
                  {roomsCount}
                </span>
              )}
              <span className="shrink-0">
                <MeshStatusBadge
                  status={activeZone.meshStatus}
                  onlineCount={countOtherPeers(activeZone.onlineUserIds, activeZone.selfUserId)}
                  compact
                  relayActive={activeZone.relayActive}
                />
              </span>
            </motion.button>
          )}
        </div>

        <nav
          aria-label={t('navAria')}
          className="no-scrollbar col-start-2 hidden h-full items-stretch gap-5 overflow-x-auto text-sm font-medium md:flex sm:gap-7"
        >
          {DESKTOP_NAV_ITEMS.map(({ id, labelKey, Icon }) => {
            const isActive = activeTab === id;
            const badge = id === 'forum' ? forumUnread : id === 'dms' ? dmUnread : 0;
            return (
              <motion.button
                key={id}
                whileTap={TAP}
                transition={TAP_TRANSITION}
                type="button"
                aria-current={isActive ? 'page' : undefined}
                aria-label={
                  badge > 0
                    ? `${t(labelKey)} — ${t('navUnreadAria', { n: badge })}`
                    : undefined
                }
                onClick={() => onSelectTab(id)}
                className={`relative inline-flex h-full items-center gap-1.5 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
                  isActive ? 'text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${isActive ? 'text-ink' : 'text-faint'}`}
                  aria-hidden="true"
                  strokeWidth={1.75}
                />
                {/* Same weight always — active is color + underline only (no width jump). */}
                <span>{t(labelKey)}</span>
                {badge > 0 && (
                  <motion.span
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: DUR.micro }}
                    className="absolute -right-2 top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold tabular-nums text-on-accent"
                  >
                    {badge > 9 ? '9+' : badge}
                  </motion.span>
                )}
                {isActive && (
                  <motion.span
                    layoutId="topbar-active-underline"
                    transition={{ duration: DUR.tab, ease: EASE.outExpo }}
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-[2px] bg-accent"
                  />
                )}
              </motion.button>
            );
          })}
        </nav>

        <div className="col-start-3 flex h-11 min-w-0 items-center justify-end gap-1.5 sm:gap-2">
          <ThemeToggle />
          {/* Keep lang toggle in layout on sm+; only collapse on narrow + zone to free space */}
          <span className={activeZone ? 'hidden sm:inline-flex' : 'inline-flex'}>
            <LangToggle />
          </span>
          {hasActiveRoom ? (
            <motion.button
              whileTap={burnHeating ? undefined : TAP}
              transition={TAP_TRANSITION}
              type="button"
              onClick={onBurnSession}
              disabled={burnHeating}
              aria-label={t('leaveTab')}
              title={t('leaveTab')}
              className={`burn-heat inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-ctrl)] border border-danger-border bg-danger-bg text-xs font-semibold text-danger-ink whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-80 sm:w-[9.75rem] sm:px-3 ${
                burnHeating ? 'is-heating' : ''
              }`}
            >
              <span
                className="burn-ignition-bar"
                style={
                  burnHeating
                    ? { transform: 'scaleX(1)', transition: 'transform var(--dur-burn-ignition) linear' }
                    : undefined
                }
                aria-hidden="true"
              />
              <span className="burn-embers" aria-hidden="true">
                <span /><span /><span /><span /><span /><span />
                <span /><span /><span /><span /><span /><span />
              </span>
              <Flame className="burn-flame-icon relative z-10 h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="relative z-10 hidden truncate sm:inline">{t('leaveTab')}</span>
            </motion.button>
          ) : null}
        </div>
      </div>
    </header>
  );
}
