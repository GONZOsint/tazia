import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../../i18n';
import { identiconVisualFromHex } from '../../core/crypto/identity';
import type { MeshStatus } from '../../core/protocol';
import { countOtherPeers } from '../../hooks/useRoomManager';
import { NAV_INDICATOR, TAP, TAP_TRANSITION, badgeMelt } from '../../motion/tokens';
import { TaziaLogo } from '../brand/TaziaLogo';
import { Identicon } from '../content/Identicon';
import { FireBurnButton } from '../session/FireBurnButton';
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
  /** App session flame — shows extinguish control (not zone membership). */
  sessionLit?: boolean;
  hasActiveRoom: boolean;
  onBurnSession: () => void;
  forumUnread?: number;
  dmUnread?: number;
  /** Open zone count — badge on Zonas when > 1. */
  roomsCount?: number;
  activeZone?: ActiveZoneChip | null;
  /** Visual dying flame while session extinguish choreography runs. */
  burnHeating?: boolean;
  /** Zone ignite glow on the active chip (inverse of burn). */
  igniting?: boolean;
  /** One-beat flash when switching active zone. */
  zoneSwitchPulse?: boolean;
}

export function TopBar({
  activeTab,
  onSelectTab,
  sessionLit = false,
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
  const zoneIcon = activeZone ? identiconVisualFromHex(activeZone.roomId) : null;
  const showFire = sessionLit || hasActiveRoom;

  return (
    <header
      className={`relative z-30 shrink-0 overflow-visible border-b border-border topbar-safe ${
        showFire ? 'topbar--fire-clearance' : ''
      }`}
    >
      {/*
        Backdrop on a sibling underlay — backdrop-filter on the header itself
        clips overflow (WebGL flame crown) in Chromium.
      */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-surface-raised/95 backdrop-blur-sm"
        aria-hidden="true"
      />
      {/*
        3-column grid keeps the center nav fixed when left/right chrome
        grows (zone chip, burn button, unread badges) — avoids justify-between shift.
        overflow-visible so the burn goo plume can rise past the bar.
      */}
      <div className="relative mx-auto grid h-12 max-w-[1280px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 overflow-visible px-4 sm:h-14 sm:gap-4 sm:px-8">
        <div className="col-start-1 flex min-w-0 items-center justify-start gap-2 sm:gap-3">
          <motion.button
            whileTap={TAP}
            transition={TAP_TRANSITION}
            type="button"
            onClick={() => onSelectTab('rooms')}
            className="flex shrink-0 items-center gap-2 rounded-[var(--radius-ctrl)] py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label={t('navRooms')}
          >
            {/* sharedMark stays on TopBar only — hero no longer shares layoutId (stage-exit flicker). */}
            <TaziaLogo size={36} sharedMark={hasActiveRoom} />
            <span className="hidden min-w-0 sm:block">
              <span className="type-title text-ink">
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
              {zoneIcon && (
                <Identicon
                  matrix={zoneIcon.identiconMatrix}
                  size={22}
                  label={activeZone.roomId}
                  fg={zoneIcon.fg}
                  bg={zoneIcon.bg}
                />
              )}
              <span className="type-caption hidden min-w-0 truncate font-mono font-medium text-ink sm:inline">
                {shortId}
              </span>
              {roomsCount > 1 && (
                <span className="type-badge inline-flex h-4 min-w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-on-accent">
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
          className="no-scrollbar col-start-2 hidden h-full items-stretch gap-5 overflow-x-auto text-sm font-medium tracking-[0.01em] md:flex sm:gap-7"
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
                <AnimatePresence>
                  {badge > 0 && (
                    <motion.span
                      key={`badge-${id}`}
                      initial={badgeMelt.initial}
                      animate={badgeMelt.animate}
                      exit={badgeMelt.exit}
                      transition={badgeMelt.transition}
                      className="type-badge absolute -right-2 top-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-on-accent"
                    >
                      {badge > 9 ? '9+' : badge}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isActive && (
                  <motion.span
                    layoutId="topbar-active-underline"
                    transition={NAV_INDICATOR}
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-[2px] bg-accent"
                  />
                )}
              </motion.button>
            );
          })}
        </nav>

        <div className="col-start-3 flex h-11 min-w-0 items-center justify-end gap-1.5 overflow-visible sm:gap-2">
          <ThemeToggle />
          {/* Always reserve LangToggle width — never `hidden` on zone join (horizontal reflow). */}
          <span className="inline-flex shrink-0">
            <LangToggle />
          </span>
          {/* Fixed burn slot so Theme/Lang do not shift when the flame appears. */}
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-end overflow-visible sm:w-[9.75rem]">
            {showFire ? (
              <FireBurnButton
                mode="extinguish"
                label={t('leaveTab')}
                onClick={onBurnSession}
                dying={burnHeating}
              />
            ) : null}
          </span>
        </div>
      </div>
    </header>
  );
}
