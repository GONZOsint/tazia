import { useMemo, useState } from 'react';
import { Link2, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { buildInviteUrl } from '../../core/utils/inviteLink';
import { useT } from '../../i18n';
import { DUR, EASE, disclosure } from '../../motion/tokens';
import { InviteQr } from '../../components/session/InviteQr';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { CopyButton } from '../../components/ui/CopyButton';
import { useToast } from '../../components/ui/ToastHost';

interface ZoneInvitePanelProps {
  roomId: string;
  phrase: string | null;
  /** Compact padding for inline card expansion. */
  compact?: boolean;
}

/** Local invite QR + copy link for an already-open zone. */
export function ZoneInvitePanel({ roomId, phrase, compact = false }: ZoneInvitePanelProps) {
  const t = useT();
  const toast = useToast();
  const [includePhrase, setIncludePhrase] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const inviteUrl = useMemo(
    () => buildInviteUrl(roomId, includePhrase && phrase ? phrase : undefined),
    [roomId, phrase, includePhrase]
  );

  return (
    <motion.div
      initial={disclosure.initial}
      animate={disclosure.animate}
      exit={disclosure.exit}
      transition={disclosure.transition}
      className="overflow-hidden"
    >
      <div className="invite-panel invite-panel--embedded">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-ink">{t('roomsInviteTitle')}</p>
          <CopyButton
            text={inviteUrl}
            label={t('roomsCopyLink')}
            copiedLabel={t('copiedDefault')}
            icon={Link2}
            iconOnly
            className="icon-action focus-visible:outline-2 focus-visible:outline-accent"
          />
        </div>

        <div className="mt-2 flex justify-center">
          <InviteQr
            inviteUrl={inviteUrl}
            size={compact ? 152 : 172}
            includesSecret={includePhrase && Boolean(phrase)}
          />
        </div>

        {phrase && (
          <motion.label
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: DUR.tab, ease: EASE.outExpo }}
            className="invite-opt mt-2.5 flex min-h-[44px] cursor-pointer items-center gap-3 text-xs text-muted"
          >
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
          </motion.label>
        )}
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={t('confirmPhraseTitle')}
        body={t('confirmPhraseBody')}
        confirmLabel={t('confirmPhraseAction')}
        icon={ShieldAlert}
        onConfirm={() => {
          setIncludePhrase(true);
          setConfirmOpen(false);
          toast.push({
            message: t('phraseInLinkToast'),
            tone: 'warning',
            dedupeKey: 'phrase-in-link',
          });
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </motion.div>
  );
}
