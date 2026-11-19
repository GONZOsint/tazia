import { lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { useToast } from '../../../components/ui/ToastHost';
import { cachedPeerVisual } from '../../../core/crypto/identity';
import { contentSwitch } from '../../../motion/tokens';
import { useT } from '../../../i18n';
import { TabSkeleton } from '../TabSkeleton';
import type { ActiveRoomView, RoomPanelActions } from '../useActiveRoomView';

const DmListView = lazy(() => import('../../../features/dms/DmListView'));
const DmConversationView = lazy(() => import('../../../features/dms/DmConversationView'));

type ToastApi = ReturnType<typeof useToast>;

export type DmChrome = {
  dmPeerId: string | null;
  setDmPeerId: (id: string | null) => void;
  dmsThreadOpen: boolean;
};

export function DmsTabPanel(props: {
  active: boolean;
  roomView: ActiveRoomView;
  dmChrome: DmChrome;
  actions: Pick<RoomPanelActions, 'sendDm' | 'clearDmUnread'>;
  selectTab: (tab: 'rooms') => void;
  toast: ToastApi;
}) {
  const t = useT();
  const { roomView: v, dmChrome, actions, toast } = props;
  const { dmPeerId, setDmPeerId, dmsThreadOpen } = dmChrome;

  return (
    <div
      className="tab-panel"
      data-active={props.active ? 'true' : 'false'}
      data-fill={dmsThreadOpen ? 'true' : undefined}
      aria-hidden={!props.active}
      inert={!props.active ? true : undefined}
    >
      <Suspense fallback={<TabSkeleton />}>
        <AnimatePresence mode="wait" initial={false}>
          {dmPeerId && v.selfUserId ? (
            <motion.div
              key={`dm-${dmPeerId}`}
              initial={contentSwitch.initial}
              animate={contentSwitch.animate}
              exit={contentSwitch.exit}
              transition={contentSwitch.transition}
              className="flex min-h-0 flex-1 flex-col"
            >
              <DmConversationView
                selfUserId={v.selfUserId}
                peerId={dmPeerId}
                peerAlias={
                  v.presence[dmPeerId]?.alias ||
                  cachedPeerVisual(dmPeerId)?.suggestedAlias ||
                  t('presenceNoAlias')
                }
                peerAvatarSeed={v.presence[dmPeerId]?.avatarSeed}
                trustStore={v.trustStore}
                messages={v.dmMessages[dmPeerId] ?? []}
                onSend={async (body) => {
                  const ok = await actions.sendDm(dmPeerId, body);
                  if (!ok) toast.push(t('toastDmFailed'), 'error');
                  return ok;
                }}
                onBack={() => {
                  actions.clearDmUnread(dmPeerId);
                  setDmPeerId(null);
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="dm-list"
              initial={contentSwitch.initial}
              animate={contentSwitch.animate}
              exit={contentSwitch.exit}
              transition={contentSwitch.transition}
              className="flex min-h-0 flex-1 flex-col"
            >
              <DmListView
                selfUserId={v.selfUserId}
                presence={v.presence}
                onlineUserIds={v.onlineUserIds}
                dmMessages={v.dmMessages}
                dmUnread={v.dmUnread}
                trustStore={v.trustStore}
                onGoToRooms={() => props.selectTab('rooms')}
                onSelectPeer={(peerId) => {
                  actions.clearDmUnread(peerId);
                  setDmPeerId(peerId);
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </Suspense>
    </div>
  );
}
