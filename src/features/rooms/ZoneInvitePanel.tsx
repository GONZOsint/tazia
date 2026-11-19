import { useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';
import { buildInviteUrl } from '../../core/utils/inviteLink';
import { useT } from '../../i18n';
import { disclosure, SECRET_FRAME_MS } from '../../motion/tokens';
import { InviteQr } from '../../components/session/InviteQr';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/ToastHost';
import { InviteShareControls } from './InviteShareControls';

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
  const hasSecret = includePhrase && Boolean(phrase);

  return (
    <motion.div
      initial={disclosure.initial}
      animate={disclosure.animate}
      exit={disclosure.exit}
      transition={disclosure.transition}
      className="min-w-0 overflow-x-visible overflow-y-clip will-change-[opacity,transform]"
    >
      <div
        className={`invite-panel invite-panel--embedded min-w-0 ${hasSecret ? 'invite-panel--fire' : ''}`}
      >
        <p className="type-label text-ink">{t('roomsInviteTitle')}</p>

        <div className="mt-2.5">
          <InviteShareControls
            inviteUrl={inviteUrl}
            includePhrase={includePhrase}
            phraseAvailable={Boolean(phrase)}
            onRequestIncludePhrase={() => setConfirmOpen(true)}
            onExcludePhrase={() => setIncludePhrase(false)}
            compact
          />
        </div>

        <div className="invite-qr-slot mt-3 flex w-full min-w-0 justify-center">
          <InviteQr
            inviteUrl={inviteUrl}
            size={compact ? 152 : 172}
            includesSecret={hasSecret}
          />
        </div>
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
          // Let the QR fire ritual land before the toast competes for attention.
          window.setTimeout(() => {
            toast.push({
              message: t('phraseInLinkToast'),
              tone: 'warning',
              dedupeKey: 'phrase-in-link',
            });
          }, SECRET_FRAME_MS);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </motion.div>
  );
}
