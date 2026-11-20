import { type ReactNode, useRef } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { BottomNav } from '../../components/layout/BottomNav';
import { TopBar, type ActiveTab, type ActiveZoneChip } from '../../components/layout/TopBar';
import { AppSplash } from '../../components/brand/AppSplash';
import { AlertBanner } from '../../components/ui/AlertBanner';
import { IgniteLanding } from '../../features/session/IgniteLanding';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';
import { useT } from '../../i18n';
import { bannerEnter } from '../../motion/tokens';
import { ALL_TABS } from './constants';

type AppShellLayoutProps = {
  splashShort: boolean;
  sessionLit: boolean;
  onIgnite: () => void;
  onHelpFromIgnite: () => void;
  burnNotice: boolean;
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
  onHelpFromIgnite,
  burnNotice,
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
  const t = useT();
  const mainRef = useRef<HTMLDivElement>(null);

  useSwipeTabs(mainRef, {
    tabs: ALL_TABS,
    activeTab,
    onSwipe: (tab) => selectTab(tab),
    disabled: swipeDisabled || !sessionLit,
  });

  const burnNoticeBanner = (
    <AnimatePresence initial={false}>
      {burnNotice && (
        <motion.div
          initial={bannerEnter.initial}
          animate={bannerEnter.animate}
          exit={bannerEnter.exit}
          transition={bannerEnter.transition}
          className="w-full"
        >
          <AlertBanner tone="success" role="status" className="w-full">
            {t('burnNotice')}
          </AlertBanner>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <MotionConfig reducedMotion="user">
      <AppSplash short={splashShort} />
      {!sessionLit ? (
        <IgniteLanding
          onIgnite={onIgnite}
          onHelp={onHelpFromIgnite}
          notice={burnNotice ? burnNoticeBanner : undefined}
        />
      ) : (
        <div
          ref={mainRef}
          className="flex h-dvh flex-col overflow-hidden bg-bg text-ink pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] md:pb-0"
        >
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
          />

          {overlays}

          {panels}

          <BottomNav
            activeTab={activeTab}
            onSelectTab={selectTab}
            forumUnread={totalForumUnread}
            dmUnread={totalDmUnread}
          />
        </div>
      )}
    </MotionConfig>
  );
}
