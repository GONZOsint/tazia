import { lazy, Suspense } from 'react';
import { Radio } from 'lucide-react';
import { EmptyZoneCta } from '../../../components/ui/AccentButton';
import type { useToast } from '../../../components/ui/ToastHost';
import { useT } from '../../../i18n';
import { createForumPublishHandlers } from '../forumPublishHandlers';
import { TabSkeleton } from '../TabSkeleton';
import type { ActiveRoomView, RoomPanelActions } from '../useActiveRoomView';

const ForumWorkspace = lazy(() => import('../../../features/forum/ForumWorkspace'));

type ToastApi = ReturnType<typeof useToast>;

export function ForumTabPanel(props: {
  active: boolean;
  roomView: ActiveRoomView;
  actions: Pick<RoomPanelActions, 'publish' | 'syncNow' | 'dismissRoomError'>;
  selectTab: (tab: 'rooms') => void;
  toast: ToastApi;
}) {
  const t = useT();
  const { roomView: v, actions, toast } = props;
  const forumHandlers = createForumPublishHandlers(actions.publish, toast, t);

  return (
    <div
      className="tab-panel"
      data-active={props.active ? 'true' : 'false'}
      data-fill={props.active && v.isInRoom ? 'true' : undefined}
      aria-hidden={!props.active}
      inert={!props.active ? true : undefined}
    >
      <Suspense fallback={<TabSkeleton />}>
        {v.isInRoom && v.roomId && v.profile && v.selfUserId ? (
          <div className="flex h-full min-h-0 flex-1 flex-col">
            <ForumWorkspace
              roomId={v.roomId}
              phrase={v.phrase}
              profile={v.profile}
              selfUserId={v.selfUserId}
              messages={v.messages}
              presenceAliases={v.presenceAliases}
              presenceAvatarSeeds={v.presenceAvatarSeeds}
              onlineUserIds={v.onlineUserIds}
              onlineCount={v.peerOnlineCount}
              meshStatus={v.meshStatus}
              relayActive={v.relayActive}
              isPublishing={v.isPublishing}
              isSyncing={v.isSyncing}
              roomError={v.roomErrorMsg}
              roomErrorTone="error"
              onDismissRoomError={actions.dismissRoomError}
              onSyncNow={async () => {
                await actions.syncNow();
              }}
              {...forumHandlers}
            />
          </div>
        ) : (
          <EmptyZoneCta
            icon={<Radio className="h-12 w-12 text-faint" aria-hidden="true" strokeWidth={1.5} />}
            title={t('forumEmptyTitle')}
            body={t('forumEmptyBody')}
            actionLabel={t('forumEmptyCta')}
            onAction={() => props.selectTab('rooms')}
          />
        )}
      </Suspense>
    </div>
  );
}
