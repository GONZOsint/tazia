import { useState } from 'react';
import { Flame, KeyRound, Link2, MessageSquarePlus, QrCode, RefreshCw, Search, X } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import type { LocalProfile } from '../../core/crypto/identity';
import { useT } from '../../i18n';
import type { MeshStatus } from '../../core/protocol';
import { buildInviteUrl } from '../../core/utils/inviteLink';
import { PeerAvatar } from '../../components/content/PeerAvatar';
import { CopyButton } from '../../components/ui/CopyButton';
import { MeshStatusBadge } from '../../components/session/MeshStatusBadge';
import { ZoneInvitePanel } from '../rooms/ZoneInvitePanel';
import type { ThreadGroup } from './types';

export type { ThreadGroup } from './types';

interface RoomSidebarProps {
  roomId: string;
  phrase: string | null;
  profile: LocalProfile;
  selfUserId: string;
  threads: ThreadGroup[];
  hasAnyThreads: boolean;
  activeThreadId: string | null;
  isComposingThread: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectThread: (threadId: string) => void;
  onStartCompose: () => void;
  onlineCount: number;
  meshStatus: MeshStatus;
  relayActive?: boolean;
  isSyncing: boolean;
  isBusy: boolean;
  onSyncNow: () => void;
  /** Thread ids with an open unanimous-delete ballot. */
  pendingDeleteIds?: Set<string>;
  /** Mobile sheet mode */
  mobileSheet?: boolean;
  onCloseSheet?: () => void;
}

const ICON_ACTION =
  'icon-action text-ink focus-visible:outline-2 focus-visible:outline-accent';
const ICON_ACTION_PRESS =
  `${ICON_ACTION} pressable`;

export function RoomSidebar({
  roomId,
  phrase,
  profile,
  selfUserId,
  threads,
  hasAnyThreads,
  activeThreadId,
  isComposingThread,
  searchQuery,
  onSearchChange,
  onSelectThread,
  onStartCompose,
  onlineCount,
  meshStatus,
  relayActive = false,
  isSyncing,
  isBusy,
  onSyncNow,
  pendingDeleteIds,
  mobileSheet = false,
  onCloseSheet,
}: RoomSidebarProps) {
  const t = useT();
  const invite = buildInviteUrl(roomId);
  const [showQr, setShowQr] = useState(false);

  return (
    <aside className="space-y-3">
      {mobileSheet && (
        <div className="flex items-center justify-between gap-2">
          <h2 className="type-title text-ink">{t('sidebarTopics')}</h2>
          {onCloseSheet && (
            <button
              type="button"
              onClick={onCloseSheet}
              className={ICON_ACTION_PRESS}
              aria-label={t('sidebarCloseTopics')}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <div className="panel-surface panel-pad--dense">
        <div className="flex items-start gap-3">
          <PeerAvatar
            avatarSeed={profile.avatarSeed}
            matrix={profile.identiconMatrix}
            size={56}
            label={profile.alias}
            fg={profile.fg}
            bg={profile.bg}
            animated={false}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="type-ui truncate font-semibold text-ink">{profile.alias}</p>
              <MeshStatusBadge
                status={meshStatus}
                onlineCount={onlineCount}
                compact
                relayActive={relayActive}
              />
            </div>
            <p className="type-caption mt-0.5 truncate font-mono md:block hidden">
              {selfUserId}
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <CopyButton
            text={invite}
            label={t('roomsCopyLink')}
            copiedLabel={t('copiedDefault')}
            icon={Link2}
            iconOnly
            className={ICON_ACTION}
          />
          {phrase && (
            <CopyButton
              text={phrase}
              label={t('roomsCopyPhrase')}
              copiedLabel={t('copiedDefault')}
              icon={KeyRound}
              iconOnly
              className={ICON_ACTION}
            />
          )}
          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            aria-pressed={showQr}
            aria-label={showQr ? t('roomsHideQr') : t('roomsShowQr')}
            title={showQr ? t('roomsHideQr') : t('roomsShowQr')}
            className={`${ICON_ACTION_PRESS} ${showQr ? 'is-active' : ''}`}
          >
            <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onSyncNow}
            disabled={isSyncing || isBusy}
            aria-label={t('sidebarRefresh')}
            title={t('sidebarRefresh')}
            className={`${ICON_ACTION_PRESS} disabled:opacity-50`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </div>
        <AnimatePresence initial={false}>
          {showQr && <ZoneInvitePanel roomId={roomId} phrase={phrase} />}
        </AnimatePresence>
      </div>

      <div className="panel-surface panel-pad--dense">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-faint"
            aria-hidden="true"
          />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('sidebarSearch')}
            className="input-base bg-bg py-2 pr-8 pl-9"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="icon-action icon-action--ghost icon-action--dense pressable absolute top-1/2 right-1.5 -translate-y-1/2 text-faint focus-visible:outline-2 focus-visible:outline-accent"
              aria-label={t('sidebarClearSearch')}
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onStartCompose}
          disabled={isBusy}
          className="btn-accent-sheen pressable mt-2.5 inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-ctrl)] bg-accent px-3 py-2 type-ui font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
          {t('sidebarNewThread')}
        </button>
        <ul className="mt-2.5 max-h-[50vh] space-y-1 overflow-y-auto lg:max-h-[420px]">
          {!hasAnyThreads && (
            <li className="type-caption px-2 py-6 text-center">{t('sidebarNoThreads')}</li>
          )}
          {threads.map((thread) => {
            const active = !isComposingThread && thread.threadId === activeThreadId;
            const replyCount = thread.replies.length;
            const pendingDelete = pendingDeleteIds?.has(thread.threadId) ?? false;
            return (
              <li key={thread.threadId}>
                <button
                  type="button"
                  onClick={() => onSelectThread(thread.threadId)}
                  disabled={isBusy}
                  className={`pressable type-ui flex w-full min-h-[44px] items-start gap-2 rounded-[var(--radius-ctrl)] px-2.5 py-2 text-left ${
                    pendingDelete
                      ? 'plaza-topic-pending border font-semibold text-ink'
                      : active
                        ? 'border border-accent/40 bg-accent-soft font-semibold text-ink'
                        : 'border border-transparent text-ink hover:bg-bg'
                  }`}
                >
                  <span className="min-w-0 flex-1 line-clamp-2">{thread.title}</span>
                  {pendingDelete && (
                    <Flame
                      className="plaza-topic-pending__ember mt-0.5 h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                      strokeWidth={2}
                    />
                  )}
                  {replyCount > 0 && !pendingDelete && (
                    <span
                      className={`type-badge mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 ${
                        active ? 'bg-accent text-on-accent' : 'bg-surface text-muted'
                      }`}
                      title={
                        replyCount === 1
                          ? t('sidebarReplies', { n: replyCount })
                          : t('sidebarRepliesPlural', { n: replyCount })
                      }
                    >
                      {replyCount > 99 ? '99+' : replyCount}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
