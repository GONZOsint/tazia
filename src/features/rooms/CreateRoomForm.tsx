import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Dices, KeyRound, Link2, Loader2, Radio, ShieldAlert } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  DUR,
  EASE,
  IGNITE,
  TAP,
  TAP_TRANSITION,
  contentSwitch,
  disclosure,
} from '../../motion/tokens';
import { haptic, HAPTIC_TAP } from '../../motion/haptic';
import { generateRandomHex } from '../../core/crypto/identity';
import {
  evaluatePassphraseStrength,
  generateMemorablePassphrase,
} from '../../core/crypto/passphraseWords';
import { buildInviteUrl } from '../../core/utils/inviteLink';
import type { RoomJoinParams } from '../../hooks/useRoomManager';
import { useT } from '../../i18n';
import { InviteQr } from '../../components/session/InviteQr';
import { CopyButton } from '../../components/ui/CopyButton';
import { PassphraseStrengthBar } from '../../components/ui/PassphraseStrengthBar';
import { SecretPhraseInput } from '../../components/ui/SecretPhraseInput';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { useToast } from '../../components/ui/ToastHost';

interface CreateRoomFormProps {
  isJoining: boolean;
  onJoinRoom: (params: RoomJoinParams) => Promise<void>;
  douseKey?: number;
}

export function CreateRoomForm({ isJoining, onJoinRoom, douseKey = 0 }: CreateRoomFormProps) {
  const t = useT();
  const toast = useToast();
  const reduceMotion = useReducedMotion();
  const [createRoomId] = useState(() => generateRandomHex(8));
  const [createPhrase, setCreatePhrase] = useState(() => generateMemorablePassphrase(6));
  const [showCreatePhrase, setShowCreatePhrase] = useState(true);
  const [createAlias, setCreateAlias] = useState('');
  const [includePhraseInLink, setIncludePhraseInLink] = useState(false);
  const [diceSpinKey, setDiceSpinKey] = useState(0);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [spark, setSpark] = useState(false);

  const createStrength = evaluatePassphraseStrength(createPhrase);
  const phraseForLink =
    includePhraseInLink && createPhrase.trim() ? createPhrase.trim() : undefined;
  const inviteUrl = useMemo(
    () => buildInviteUrl(createRoomId, phraseForLink),
    [createRoomId, phraseForLink]
  );

  useEffect(() => {
    if (includePhraseInLink && !createPhrase.trim()) {
      setIncludePhraseInLink(false);
    }
  }, [createPhrase, includePhraseInLink]);

  return (
    <motion.form
      key="create"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: DUR.tab }}
      className="mt-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (!createStrength.isAcceptable) return;
        setSpark(true);
        haptic(HAPTIC_TAP);
        // Keep ember mounted through join so layoutId can morph onto the zone card.
        window.setTimeout(() => setSpark(false), IGNITE.finishMs);
        void onJoinRoom({
          roomId: createRoomId,
          secretPhrase: createPhrase,
          customAlias: createAlias,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2 lg:items-start lg:gap-5">
        <div className="order-1 flex flex-col gap-3 lg:order-1">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="create-phrase" className="text-xs font-semibold text-ink">
                {t('roomsPhraseLabel')}
              </label>
              <div className="flex items-center gap-1.5">
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
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--radius-ctrl)] border border-border bg-bg px-3 py-2 text-xs font-medium text-muted hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <span key={diceSpinKey} className="dice-rolling">
                    <Dices className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.75} />
                  </span>
                  {t('roomsGeneratePhrase')}
                </motion.button>
              </div>
            </div>
            <div className="mt-2">
              <SecretPhraseInput
                id="create-phrase"
                value={createPhrase}
                onChange={setCreatePhrase}
                visible={showCreatePhrase}
                onToggleVisible={() => setShowCreatePhrase((v) => !v)}
              />
            </div>
            <PassphraseStrengthBar
              id={createStrength.id}
              score={createStrength.score}
              douseKey={douseKey}
            />
          </div>

          <div>
            <button
              type="button"
              aria-expanded={customizeOpen}
              onClick={() => setCustomizeOpen((v) => !v)}
              className="flex min-h-[40px] items-center gap-1.5 text-xs font-semibold text-muted focus-visible:outline-2 focus-visible:outline-accent"
            >
              <ChevronDown
                className={`chevron-spin h-3.5 w-3.5 ${customizeOpen ? 'is-open' : ''}`}
                aria-hidden="true"
              />
              {t('roomsCustomize')}
            </button>
            <AnimatePresence initial={false}>
              {customizeOpen && (
                <motion.div
                  initial={disclosure.initial}
                  animate={disclosure.animate}
                  exit={disclosure.exit}
                  transition={disclosure.transition}
                  className="overflow-hidden"
                >
                  <div className="pt-1.5">
                    <label htmlFor="create-alias" className="text-xs font-semibold text-ink">
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
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            whileTap={createStrength.isAcceptable && !isJoining ? TAP : undefined}
            transition={TAP_TRANSITION}
            type="submit"
            disabled={!createStrength.isAcceptable || isJoining}
            className={`btn-accent-sheen btn-ring-hover relative inline-flex min-h-[44px] w-full items-center justify-center gap-2 overflow-hidden rounded-[var(--radius-ctrl)] bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${spark ? 'cta-ignite-spark' : ''}`}
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

        <div className="invite-panel order-2 flex flex-col gap-3 lg:order-2">
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

          <div className="flex items-start justify-center">
            <InviteQr inviteUrl={inviteUrl} size={200} includesSecret={Boolean(phraseForLink)} />
          </div>

          <motion.label
            initial={contentSwitch.initial}
            animate={contentSwitch.animate}
            transition={{ ...contentSwitch.transition, delay: 0.12 }}
            className="invite-opt flex min-h-[44px] cursor-pointer items-center gap-3 text-xs text-muted"
          >
            <span className="relative inline-flex">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={includePhraseInLink}
                disabled={!createPhrase.trim()}
                onChange={(e) => {
                  if (e.target.checked) setConfirmOpen(true);
                  else setIncludePhraseInLink(false);
                }}
              />
              <span
                className="tazia-check peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:opacity-40"
                data-checked={includePhraseInLink}
                aria-hidden="true"
              >
                <svg className="h-3 w-3 text-on-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2">
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </span>
            <span className="flex-1">{t('roomsIncludePhrase')}</span>
            {includePhraseInLink && (
              <ShieldAlert className="h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
            )}
          </motion.label>
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
          toast.push({
            message: t('phraseInLinkToast'),
            tone: 'warning',
            dedupeKey: 'phrase-in-link',
          });
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </motion.form>
  );
}
