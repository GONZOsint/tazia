import { MessageSquarePlus, RefreshCw, Search, X } from 'lucide-react';
import type { LocalProfile } from '../../core/crypto/identity';
import { useT } from '../../i18n';
import type { ForumMessage, MeshStatus } from '../../core/protocol';
import { buildInviteUrl } from '../../core/utils/inviteLink';
import { Identicon } from '../../components/content/Identicon';
import { CopyButton } from '../../components/ui/CopyButton';
import { MeshStatusBadge } from '../../components/session/MeshStatusBadge';

export interface ThreadGroup {
  threadId: string;
  title: string;
  rootPost: ForumMessage;
  replies: ForumMessage[];
  lastActivityMs: number;
}

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
  isSyncing: boolean;
  isBusy: boolean;
  onSyncNow: () => void;
  /** Mobile sheet mode */
  mobileSheet?: boolean;
  onCloseSheet?: () => void;
}

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
  isSyncing,
  isBusy,
  onSyncNow,
  mobileSheet = false,
  onCloseSheet,
}: RoomSidebarProps) {
  const t = useT();
  const invite = buildInviteUrl(roomId);

  return (
    <aside className={`space-y-4 ${mobileSheet ? '' : ''}`}>
      {mobileSheet && (
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold text-ink">{t('sidebarTopics')}</h2>
          {onCloseSheet && (
            <button
              type="button"
              onClick={onCloseSheet}
              className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-border"
              aria-label={t('sidebarCloseTopics')}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface-raised p-5">
        <div className="flex items-center gap-3">
          <Identicon matrix={profile.identiconMatrix} size={36} label={profile.alias} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{profile.alias}</p>
            <p className="truncate font-mono text-[10px] text-muted md:block hidden">{selfUserId}</p>
          </div>
        </div>
        <div className="mt-3">
          <MeshStatusBadge status={meshStatus} onlineCount={onlineCount} compact />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyButton
            text={invite}
            label={t('roomsCopyLink')}
            copiedLabel={t('copiedDefault')}
            iconOnly
            className="min-h-[44px] min-w-[44px] rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-medium text-ink"
          />
          {phrase && (
            <CopyButton
              text={phrase}
              label={t('roomsCopyPhrase')}
              copiedLabel={t('copiedDefault')}
              iconOnly
              className="min-h-[44px] min-w-[44px] rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-medium text-ink"
            />
          )}
          <button
            type="button"
            onClick={onSyncNow}
            disabled={isSyncing || isBusy}
            aria-label={t('sidebarRefresh')}
            title={t('sidebarRefresh')}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-surface-raised p-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-faint"
            aria-hidden="true"
          />
          <input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('sidebarSearch')}
            className="w-full min-h-[44px] rounded-lg border border-border bg-bg py-2 pr-8 pl-9 text-[16px] focus:border-ink focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute top-1/2 right-2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-full text-faint hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
              aria-label="Clear"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onStartCompose}
          disabled={isBusy}
          className="btn-accent-sheen mt-3 inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-[var(--radius-ctrl)] bg-accent px-3 py-2 text-xs font-semibold text-on-accent hover:bg-accent-hover active:scale-[0.97] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden="true" />
          {t('sidebarNewThread')}
        </button>
        <ul className="mt-3 max-h-[50vh] space-y-1 overflow-y-auto lg:max-h-[420px]">
          {!hasAnyThreads && (
            <li className="px-2 py-6 text-center text-xs text-muted">{t('sidebarNoThreads')}</li>
          )}
          {threads.map((thread) => {
            const active = !isComposingThread && thread.threadId === activeThreadId;
            const replyLabel =
              thread.replies.length === 1
                ? t('sidebarReplies', { n: thread.replies.length })
                : t('sidebarRepliesPlural', { n: thread.replies.length });
            return (
              <li key={thread.threadId}>
                <button
                  type="button"
                  onClick={() => onSelectThread(thread.threadId)}
                  className={`w-full min-h-[44px] rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                    active ? 'bg-accent text-on-accent' : 'text-ink hover:bg-bg'
                  }`}
                >
                  <span className="line-clamp-2 font-medium">{thread.title}</span>
                  <span
                    className={`mt-1 block text-[11px] ${active ? 'text-on-accent/70' : 'text-muted'}`}
                  >
                    {replyLabel}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
