import { useMemo, useState } from 'react';
import { Link2, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { buildInviteUrl } from '../../core/utils/inviteLink';
import { useT } from '../../i18n';
import { InviteQr } from '../../components/session/InviteQr';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { CopyButton } from '../../components/ui/CopyButton';

interface ZoneInvitePanelProps {
  roomId: string;
  phrase: string | null;
  /** Compact padding for inline card expansion. */
  compact?: boolean;
}

/** Local invite QR + copy link for an already-open zone. */
export function ZoneInvitePanel({ roomId, phrase, compact = false }: ZoneInvitePanelProps) {
  const t = useT();
  const [includePhrase, setIncludePhrase] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const inviteUrl = useMemo(
    () => buildInviteUrl(roomId, includePhrase && phrase ? phrase : undefined),
    [roomId, phrase, includePhrase]
  );

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div
        className={`border-t border-border bg-bg/60 ${
          compact ? 'px-3 py-3 sm:px-3.5' : 'px-4 py-4'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-ink">{t('roomsInviteTitle')}</p>
          <CopyButton
            text={inviteUrl}
            label={t('roomsCopyLink')}
            copiedLabel={t('copiedDefault')}
            icon={Link2}
            iconOnly
            className="min-h-[44px] min-w-[44px] rounded-[var(--radius-ctrl)] border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink focus-visible:outline-2 focus-visible:outline-accent"
          />
        </div>

        <div className="mt-3 flex justify-center">
          <InviteQr inviteUrl={inviteUrl} includesSecret={includePhrase && Boolean(phrase)} />
        </div>

        {phrase && (
          <label className="mt-3 flex min-h-[44px] cursor-pointer items-center gap-3 text-xs text-muted">
            <span className="relative inline-flex">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={includePhrase}
                onChange={(e) => {
                  if (e.target.checked) setConfirmOpen(true);
                  else setIncludePhrase(false);
                }}
              />
              <span
                className="tazia-check peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent"
                data-checked={includePhrase}
                aria-hidden="true"
              >
                <svg className="h-3 w-3 text-on-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </span>
            <span className="flex-1">{t('roomsIncludePhrase')}</span>
            {includePhrase && <ShieldAlert className="h-4 w-4 shrink-0 text-warn" aria-hidden="true" />}
          </label>
        )}
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={t('confirmPhraseTitle')}
        body={t('confirmPhraseBody')}
        onConfirm={() => {
          setIncludePhrase(true);
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </motion.div>
  );
}
