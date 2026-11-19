import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActiveTab } from '../../components/layout/TopBar';
import { consumeInviteFromLocation } from './inviteFromLocation';

export type RoomNavContext = {
  activeRoomId: string | null;
  clearForumUnread: (roomId?: string | null) => void;
  clearDmUnread: (peerId: string) => void;
};

type ApplyTabOpts = {
  /** Focus #main-content after switch (user nav / swipe). */
  focusMain?: boolean;
  /** Skip no-op when already on tab (hash invite force-remount path). */
  force?: boolean;
};

/**
 * Tab model + focus refs for useRoomManager unread policy.
 * `roomCtxRef` is assigned each render from App after the manager exists.
 */
export function useAppNavigation() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('rooms');
  const [mountedTabs, setMountedTabs] = useState<ReadonlySet<ActiveTab>>(
    () => new Set<ActiveTab>(['rooms'])
  );
  const [initialInvite, setInitialInvite] = useState(consumeInviteFromLocation);
  const [inviteNonce, setInviteNonce] = useState(0);
  const [dmPeerId, setDmPeerId] = useState<string | null>(null);

  const forumTabFocusedRef = useRef(false);
  const dmsTabFocusedRef = useRef(false);
  const activeDmPeerIdRef = useRef<string | null>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<ActiveTab>(activeTab);
  activeTabRef.current = activeTab;

  /** Filled by App each render with live manager clears + activeRoomId. */
  const roomCtxRef = useRef<RoomNavContext>({
    activeRoomId: null,
    clearForumUnread: () => {},
    clearDmUnread: () => {},
  });

  useEffect(() => {
    activeDmPeerIdRef.current = dmPeerId;
  }, [dmPeerId]);

  const ensureMounted = useCallback((tab: ActiveTab) => {
    setMountedTabs((prev) => {
      if (prev.has(tab)) return prev;
      const next = new Set(prev);
      next.add(tab);
      return next;
    });
  }, []);

  const syncFocusRefs = useCallback((tab: ActiveTab) => {
    forumTabFocusedRef.current = tab === 'forum';
    dmsTabFocusedRef.current = tab === 'dms';
  }, []);

  const applyTab = useCallback(
    (tab: ActiveTab, opts: ApplyTabOpts = {}) => {
      const { focusMain = true, force = false } = opts;
      if (!force && tab === activeTabRef.current) {
        ensureMounted(tab);
        return;
      }

      syncFocusRefs(tab);

      const { activeRoomId, clearForumUnread, clearDmUnread } = roomCtxRef.current;
      if (tab === 'forum' && activeRoomId) clearForumUnread(activeRoomId);
      // DM unread clear needs an open peer — use current dmPeerId state via ref.
      if (tab === 'dms' && activeDmPeerIdRef.current) {
        clearDmUnread(activeDmPeerIdRef.current);
      }

      // Mobile-messenger pattern: leave thread when leaving Susurros.
      if (tab !== 'dms') setDmPeerId(null);

      ensureMounted(tab);
      setActiveTab(tab);

      if (focusMain) {
        window.requestAnimationFrame(() => {
          mainContentRef.current?.focus({ preventScroll: true });
        });
      }
    },
    [ensureMounted, syncFocusRefs]
  );

  const selectTab = useCallback(
    (tab: ActiveTab) => applyTab(tab, { focusMain: true }),
    [applyTab]
  );

  /** Stable for useRoomManager — manager path mounts tab + clears dm peer. */
  const onNavigateTab = useCallback(
    (tab: 'forum' | 'rooms' | 'presence') => {
      applyTab(tab as ActiveTab, { focusMain: false });
    },
    [applyTab]
  );

  // Same-tab / PWA: opening #room~phrase only fires hashchange.
  useEffect(() => {
    const onHashChange = () => {
      const next = consumeInviteFromLocation();
      if (!next?.roomId) return;
      setInitialInvite(next);
      setInviteNonce((n) => n + 1);
      applyTab('rooms', { focusMain: false, force: true });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [applyTab]);

  // Warm lazy tab chunks after first paint.
  useEffect(() => {
    const warm = () => {
      void import('../../features/forum/ForumWorkspace');
      void import('../../features/presence/PresenceView');
      void import('../../features/dms/DmListView');
      void import('../../features/dms/DmConversationView');
      void import('../../features/how/HowItWorksView');
    };
    const w = window as Window &
      typeof globalThis & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
      };
    if (typeof w.requestIdleCallback === 'function') {
      const id = w.requestIdleCallback(warm, { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(warm, 400);
    return () => window.clearTimeout(timer);
  }, []);

  return {
    activeTab,
    mountedTabs,
    initialInvite,
    inviteNonce,
    dmPeerId,
    setDmPeerId,
    forumTabFocusedRef,
    dmsTabFocusedRef,
    activeDmPeerIdRef,
    mainContentRef,
    roomCtxRef,
    selectTab,
    onNavigateTab,
    applyTab,
  };
}
