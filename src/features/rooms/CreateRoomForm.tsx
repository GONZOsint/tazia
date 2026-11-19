import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Dices, KeyRound, Loader2, Radio, ShieldAlert } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  EASE,
  IGNITE,
  SECRET_FRAME_MS,
  TAP,
  TAP_TRANSITION,
  disclosure,
  panelEnter,
} from '../../motion/tokens';
import { haptic, HAPTIC_TAP } from '../../motion/haptic';
import { generateRandomHex } from '../../core/crypto/identity';
import {
  evaluatePassphraseStrength,
  generateMemorablePassphrase,
} from '../../core/crypto/passphraseWords';
import { buildInviteUrl } from '../../core/utils/inviteLink';
import type { RoomJoinParams } from '../../hooks/useRoomManager';
import { useMdUp } from '../../hooks/useMdUp';
import { useT } from '../../i18n';
import { InviteQr } from '../../components/session/InviteQr';
import { CopyButton } from '../../components/ui/CopyButton';
import { PassphraseStrengthBar } from '../../components/ui/PassphraseStrengthBar';
import { SecretPhraseInput } from '../../components/ui/SecretPhraseInput';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/ToastHost';
import { InviteShareControls } from './InviteShareControls';

interface CreateRoomFormProps {
  isJoining: boolean;
  onJoinRoom: (params: RoomJoinParams) => Promise<void>;
  douseKey?: number;
  /** Force a single column (hub side panel). */
  stacked?: boolean;
}

export function CreateRoomForm({
  isJoining,
  onJoinRoom,
  douseKey = 0,
  stacked = false,
}: CreateRoomFormProps) {
  const t = useT();
  const toast = useToast();
  const reduceMotion = useReducedMotion();
  const mdUp = useMdUp();
  const [createRoomId] = useState(() => generateRandomHex(8));
  const [createPhrase, setCreatePhrase] = useState(() => generateMemorablePassphrase(6));
  const [showCreatePhrase, setShowCreatePhrase] = useState(true);
  const [createAlias, setCreateAlias] = useState('');
  const [includePhraseInLink, setIncludePhraseInLink] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [diceSpinKey, setDiceSpinKey] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [spark, setSpark] = useState(false);

  // Keep ember mounted through join so layoutId can morph onto the zone card; clear on unmount.
  useEffect(() => {
    if (!spark) return;
    const timer = window.setTimeout(() => setSpark(false), IGNITE.finishMs);
    return () => window.clearTimeout(timer);
  }, [spark]);

  const createStrength = evaluatePassphraseStrength(createPhrase);
  const phraseForLink =
    includePhraseInLink && createPhrase.trim() ? createPhrase.trim() : undefined;
  const inviteUrl = useMemo(
    () => buildInviteUrl(createRoomId, phraseForLink),
    [createRoomId, phraseForLink]
  );
  const inviteExpanded = mdUp || inviteOpen;

  useEffect(() => {
    if (includePhraseInLink && !createPhrase.trim()) {
      setIncludePhraseInLink(false);
    }
  }, [createPhrase, includePhraseInLink]);

  const inviteBody = (
    <div className="flex w-full min-w-0 max-w-full flex-col gap-3 sm:flex-row sm:items-start sm:gap-4 md:flex-col md:gap-3">
      <div className="min-w-0 w-full flex-1">
        <InviteShareControls
          inviteUrl={inviteUrl}
          includePhrase={includePhraseInLink}
          phraseAvailable
          phraseDisabled={!createPhrase.trim()}
          onRequestIncludePhrase={() => setConfirmOpen(true)}
          onExcludePhrase={() => setIncludePhraseInLink(false)}
        />
      </div>

      <div className="invite-qr-slot flex w-full min-w-0 shrink-0 items-start justify-center self-center sm:w-auto sm:self-start md:w-full md:self-center">
        <InviteQr
          inviteUrl={inviteUrl}
          size={mdUp ? 160 : 136}
          includesSecret={Boolean(phraseForLink)}
        />
      </div>
    </div>
  );

  return (
    <motion.form
      key="create"
      initial={panelEnter.initial}
      animate={panelEnter.animate}
      exit={panelEnter.exit}
      transition={panelEnter.transition}
      className="mt-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (!createStrength.isAcceptable) return;
        setSpark(true);
        haptic(HAPTIC_TAP);
        void onJoinRoom({
          roomId: createRoomId,
          secretPhrase: createPhrase,
          customAlias: createAlias,
        });
      }}
    >
      <div
        className={
          stacked
            ? 'grid grid-cols-1 gap-4'
            : 'grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start md:gap-6'
        }
      >
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="create-phrase" className="type-label text-ink">
              {t('roomsPhraseLabel')}
            </label>
            <SecretPhraseInput
              id="create-phrase"
              value={createPhrase}
              onChange={setCreatePhrase}
              visible={showCreatePhrase}
              onToggleVisible={() => setShowCreatePhrase((v) => !v)}
            />
            <PassphraseStrengthBar
              id={createStrength.id}
              score={createStrength.score}
              douseKey={douseKey}
              className="mt-0"
            />
            <div className="flex flex-wrap items-center gap-1.5">
              <CopyButton
                text={createPhrase}
                label={t('roomsCopyPhrase')}
                copiedLabel={t('copiedDefault')}
                icon={KeyRound}
                iconOnly
                className="min-h-[44px] min-w-[44px] rounded-[var(--radius-ctrl)] border border-border bg-bg px-3 py-1.5 text-xs font-medium text-ink focus-visible:outline-2 focus-visible:outline-accent"
              />
              <motion.button
                whileTap={TAP}
                transition={TAP_TRANSITION}
                type="button"
                onClick={() => {
                  setCreatePhrase(generateMemorablePassphrase(6));
                  setShowCreatePhrase(true);
                  setDiceSpinKey((k) => k + 1);
                }}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-ctrl)] border border-border bg-bg px-3 py-2 type-ui font-medium text-muted hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span key={diceSpinKey} className="dice-rolling">
                  <Dices className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.75} />
                </span>
                {t('roomsGeneratePhrase')}
              </motion.button>
            </div>
          </div>

          <div>
            <label htmlFor="create-alias" className="type-label text-ink">
              {t('roomsAliasLabel')}
            </label>
            <input
              id="create-alias"
              value={createAlias}
              onChange={(e) => setCreateAlias(e.target.value)}
              className="input-base mt-2"
              placeholder={t('roomsAliasPlaceholder')}
            />
          </div>

          <motion.button
            whileTap={createStrength.isAcceptable && !isJoining ? TAP : undefined}
            transition={TAP_TRANSITION}
            type="submit"
            disabled={!createStrength.isAcceptable || isJoining}
            className={`btn-accent-sheen btn-ring-hover relative inline-flex min-h-[48px] w-full items-center justify-center gap-2 overflow-hidden rounded-[var(--radius-ctrl)] bg-accent px-5 py-2.5 type-ui font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${spark ? 'cta-ignite-spark' : ''}`}
          >
            {spark && !reduceMotion && (
              <motion.span
                layoutId={IGNITE.layoutId}
                className="pointer-events-none absolute inset-0 rounded-[inherit] bg-accent"
                transition={EASE.ritualSpring}
                aria-hidden="true"
              />
            )}
            <span className="relative z-[1] inline-flex items-center gap-2">
              {isJoining ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {t('roomsConnecting')}
                </>
              ) : (
                <>
                  <Radio className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
                  {t('roomsOpen')}
                </>
              )}
            </span>
          </motion.button>
        </div>

        {/* Mobile: collapsible under CTA. Desktop: always-open side column. */}
        <div
          className={`invite-panel invite-panel--collapse md:min-h-0 ${
            phraseForLink ? 'invite-panel--fire' : ''
          }`}
        >
          <button
            type="button"
            aria-expanded={inviteExpanded}
            disabled={mdUp}
            onClick={() => {
              if (mdUp) return;
              haptic(HAPTIC_TAP);
              setInviteOpen((v) => !v);
            }}
            className="flex w-full min-h-[44px] items-center justify-between gap-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default"
          >
            <span className="min-w-0">
              <span className="type-label block text-ink">{t('roomsInviteTitle')}</span>
              <span className="type-caption mt-0.5 block">{t('roomsInviteHint')}</span>
            </span>
            {!mdUp && (
              <ChevronDown
                className={`chevron-spin h-4 w-4 shrink-0 text-muted ${inviteOpen ? 'is-open' : ''}`}
                aria-hidden="true"
              />
            )}
          </button>

          <AnimatePresence initial={false}>
            {inviteExpanded && (
              <motion.div
                key="create-invite"
                initial={mdUp ? false : disclosure.initial}
                animate={disclosure.animate}
                exit={mdUp ? undefined : disclosure.exit}
                transition={mdUp ? { duration: 0 } : disclosure.transition}
                className="min-w-0 overflow-x-visible overflow-y-clip"
              >
                <div className="min-w-0 border-t border-border pt-3">{inviteBody}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={t('confirmPhraseTitle')}
        body={t('confirmPhraseBody')}
        confirmLabel={t('confirmPhraseAction')}
        icon={ShieldAlert}
        onConfirm={() => {
          setIncludePhraseInLink(true);
          setConfirmOpen(false);
          // Let the QR outer-line ritual land before the toast competes for attention.
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
    </motion.form>
  );
}
