import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { BottomNav } from '../../components/layout/BottomNav';
import { TopBar, type ActiveTab, type ActiveZoneChip } from '../../components/layout/TopBar';
import { AppSplash } from '../../components/brand/AppSplash';
import { IgniteLanding } from '../../features/session/IgniteLanding';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';
import { ALL_TABS } from './constants';

type AppShellLayoutProps = {
  splashShort: boolean;
  sessionLit: boolean;
  onIgnite: () => void;
  activeTab: ActiveTab;
  selectTab: (tab: ActiveTab) => void;
  isInRoom: boolean;
  totalForumUnread: number;
  totalDmUnread: number;
  roomsCount: number;
  activeZone: ActiveZoneChip | null;
  burnHeating: boolean;
  igniting: boolean;
  zoneSwitchPulse: boolean;
  onBurnSession: () => void;
  swipeDisabled: boolean;
  overlays: ReactNode;
  panels: ReactNode;
};

export function AppShellLayout({
  splashShort,
  sessionLit,
  onIgnite,
  activeTab,
  selectTab,
  isInRoom,
  totalForumUnread,
  totalDmUnread,
  roomsCount,
  activeZone,
  burnHeating,
  igniting,
  zoneSwitchPulse,
  onBurnSession,
  swipeDisabled,
  overlays,
  panels,
}: AppShellLayoutProps) {
  const mainRef = useRef<HTMLDivElement>(null);
  const [shellRevealed, setShellRevealed] = useState(sessionLit);
  /** Keep burn overlay up until ritual finishes — independent of sessionLit. */
  const [landingOpen, setLandingOpen] = useState(!sessionLit);
  const [splashActive, setSplashActive] = useState(false);

  useEffect(() => {
    if (sessionLit) setShellRevealed(true);
  }, [sessionLit]);

  useSwipeTabs(mainRef, {
    tabs: ALL_TABS,
    activeTab,
    onSwipe: (tab) => selectTab(tab),
    disabled: swipeDisabled || !sessionLit,
  });

  // Light session as the veil lifts so TopBar extinguish is already mounted.
  const onReveal = useCallback(() => {
    setShellRevealed(true);
    onIgnite();
  }, [onIgnite]);

  const handleIgniteComplete = useCallback(() => {
    setShellRevealed(true);
    onIgnite();
    setLandingOpen(false);
  }, [onIgnite]);

  const showOverlay = landingOpen;
  const shellClass = [
    'app-shell relative flex h-dvh flex-col overflow-hidden bg-bg text-ink pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] md:pb-0',
    showOverlay ? 'app-shell--prelit' : '',
    showOverlay && shellRevealed ? 'is-revealed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <MotionConfig reducedMotion="user">
      <AppSplash short={splashShort} onActiveChange={setSplashActive} />
      <div
        className="relative h-dvh overflow-hidden"
        aria-hidden={splashActive || undefined}
        inert={splashActive || undefined}
      >
        <div ref={mainRef} className={shellClass}>
          <div className="reveal-item reveal-header shrink-0">
            <TopBar
              activeTab={activeTab}
              onSelectTab={selectTab}
              sessionLit={sessionLit}
              hasActiveRoom={isInRoom}
              forumUnread={totalForumUnread}
              dmUnread={totalDmUnread}
              roomsCount={roomsCount}
              activeZone={activeZone}
              burnHeating={burnHeating}
              igniting={igniting}
              zoneSwitchPulse={zoneSwitchPulse}
              onBurnSession={onBurnSession}
              reserveFire={showOverlay}
            />
          </div>

          {/* Always mount overlays so IP consent / burn confirm stay reachable. */}
          {overlays}

          <div className="reveal-item reveal-main relative flex min-h-0 flex-1 flex-col">
            {panels}
          </div>

          <div className="reveal-item reveal-footer shrink-0">
            <BottomNav
              activeTab={activeTab}
              onSelectTab={selectTab}
              forumUnread={totalForumUnread}
              dmUnread={totalDmUnread}
            />
          </div>
        </div>

        <AnimatePresence initial={false}>
          {showOverlay ? (
            <motion.div
              key="ignite-landing"
              className="absolute inset-0 z-40"
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              <IgniteLanding onIgnite={handleIgniteComplete} onReveal={onReveal} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}
