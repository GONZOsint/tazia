import { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useT } from '../../i18n';
import { identiconVisualFromHex } from '../../core/crypto/identity';
import type { MeshStatus } from '../../core/protocol';
import { countOtherPeers } from '../../hooks/useRoomManager';
import {
  EASE,
  NAV_INDICATOR,
  TAP,
  TAP_TRANSITION,
  badgeMelt,
} from '../../motion/tokens';
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
  /** Open zone count — badge on the active zone chip when > 1. */
  roomsCount?: number;
  activeZone?: ActiveZoneChip | null;
  /** Visual dying flame while session extinguish choreography runs. */
  burnHeating?: boolean;
  /** Zone ignite glow on the active chip (inverse of burn). */
  igniting?: boolean;
  /** One-beat flash when switching active zone. */
  zoneSwitchPulse?: boolean;
  /**
   * Keep crown clearance + fire-slot width during ignite overlay so the
   * extinguish control can fade in without shoving Theme/Lang or dropping the bar.
   */
  reserveFire?: boolean;
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
  reserveFire = false,
}: TopBarProps) {
  const t = useT();
  const activeRoomId = activeZone?.roomId ?? null;
  const shortId = activeRoomId
    ? activeRoomId.length > 8
      ? `${activeRoomId.slice(0, 6)}…`
      : activeRoomId
    : '';
  const zoneIcon = useMemo(
    () => (activeRoomId ? identiconVisualFromHex(activeRoomId) : null),
    [activeRoomId],
  );
  const showFire = sessionLit || hasActiveRoom;
  const fireClearance = showFire || reserveFire;
  const fireVisible = showFire;

  return (
    <header
      className={`relative z-30 shrink-0 overflow-visible border-b border-border topbar-safe ${
        fireClearance ? 'topbar--fire-clearance' : ''
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
        Flex on <md (where center nav is hidden) so left/right don't lose width
        to an empty middle track; 3-column grid on md+ keeps center nav fixed.
        overflow-visible so the burn goo plume can rise past the bar.
      */}
      <div className="relative mx-auto flex h-12 max-w-[1280px] items-center justify-between gap-2 overflow-visible px-4 sm:h-14 sm:gap-4 sm:px-8 md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="col-start-1 flex min-w-0 items-center justify-start gap-2 sm:gap-3">
          <motion.button
            whileTap={TAP}
            transition={TAP_TRANSITION}
            type="button"
            onClick={() => onSelectTab('rooms')}
            className="flex shrink-0 cursor-pointer select-none items-center gap-2 rounded-[var(--radius-ctrl)] py-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-label={t('navRooms')}
          >
            {/* sharedMark stays on TopBar only — hero no longer shares layoutId (stage-exit flicker). */}
            <TaziaLogo size={36} sharedMark={hasActiveRoom} />
            <span className="hidden min-w-0 sm:block">
              <span className="type-title text-ink">{t('brand')}</span>
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
              className={`session-burn-target session-ignite-target flex h-9 min-w-0 max-w-[min(42vw,11rem)] shrink cursor-pointer select-none items-center gap-1.5 rounded-[var(--radius-ctrl)] border border-accent/40 bg-accent-soft px-1.5 transition-colors hover:border-accent/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:max-w-[220px] sm:gap-2 sm:px-2 ${
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
                <span
                  aria-hidden="true"
                  className="type-badge inline-flex h-4 min-w-[1.125rem] shrink-0 items-center justify-center rounded-full bg-accent px-1.5 text-on-accent"
                >
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
          className="col-start-2 hidden h-full items-stretch gap-5 overflow-visible text-sm font-medium tracking-[0.01em] md:flex md:gap-7"
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
                className={`relative inline-flex h-full shrink-0 cursor-pointer select-none items-center gap-1.5 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
                  isActive ? 'text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 transition-colors ${isActive ? 'text-ink' : 'text-faint'}`}
                  aria-hidden="true"
                  strokeWidth={1.75}
                />
                {/* Same weight always — active is color + underline only (no width jump). */}
                <span>{t(labelKey)}</span>
                <AnimatePresence initial={false}>
                  {badge > 0 && (
                    <motion.span
                      key={`badge-${id}`}
                      aria-hidden="true"
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
          {/*
            Round flame + text — slot width reserved while igniting so toggles
            don’t jump when the extinguish control fades in after the ritual.
          */}
          <span
            className={`inline-flex h-11 shrink-0 items-center justify-end gap-1.5 overflow-visible ${
              fireClearance ? 'min-w-[11.75rem]' : ''
            }`}
          >
            <AnimatePresence initial={false}>
              {fireVisible ? (
                <motion.span
                  key="topbar-fire"
                  className="inline-flex items-center gap-1.5 overflow-visible"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1, ease: EASE.outExpo }}
                >
                  <FireBurnButton
                    mode="extinguish"
                    forceCircle
                    label={t('leaveTab')}
                    onClick={onBurnSession}
                    dying={burnHeating}
                  />
                  <button
                    type="button"
                    onClick={() => onBurnSession()}
                    disabled={burnHeating}
                    className="type-caption inline-flex max-w-[9.5rem] cursor-pointer select-none items-center truncate rounded-[var(--radius-ctrl)] border border-accent/40 bg-accent-soft px-2.5 py-1.5 font-semibold text-ink transition-colors hover:border-accent/60 hover:bg-accent/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-50"
                  >
                    {t('leaveTab')}
                  </button>
                </motion.span>
              ) : null}
            </AnimatePresence>
          </span>
        </div>
      </div>
    </header>
  );
}