import { type ReactNode, useRef } from 'react';
import { MotionConfig } from 'motion/react';
import { BottomNav } from '../../components/layout/BottomNav';
import { TopBar, type ActiveTab, type ActiveZoneChip } from '../../components/layout/TopBar';
import { AppSplash } from '../../components/brand/AppSplash';
import { useSwipeTabs } from '../../hooks/useSwipeTabs';
import { ALL_TABS } from './constants';

type AppShellLayoutProps = {
  splashShort: boolean;
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

  useSwipeTabs(mainRef, {
    tabs: ALL_TABS,
    activeTab,
    onSwipe: (tab) => selectTab(tab),
    disabled: swipeDisabled,
  });

  return (
    <MotionConfig reducedMotion="user">
      <AppSplash short={splashShort} />
      <div
        ref={mainRef}
        className="flex h-dvh flex-col overflow-hidden bg-bg text-ink pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom))] md:pb-0"
      >
        <TopBar
          activeTab={activeTab}
          onSelectTab={selectTab}
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
    </MotionConfig>
  );
}
