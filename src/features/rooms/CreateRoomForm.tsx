import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Dices, KeyRound, Link2, Loader2, Radio, ShieldAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { DUR, TAP, TAP_TRANSITION, disclosure } from '../../motion/tokens';
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

interface CreateRoomFormProps {
  isJoining: boolean;
  onJoinRoom: (params: RoomJoinParams) => Promise<void>;
}

export function CreateRoomForm({ isJoining, onJoinRoom }: CreateRoomFormProps) {
  const t = useT();
  const [createRoomId] = useState(() => generateRandomHex(8));
  const [createPhrase, setCreatePhrase] = useState(() => generateMemorablePassphrase(4));
  const [showCreatePhrase, setShowCreatePhrase] = useState(true);
  const [createAlias, setCreateAlias] = useState('');
  const [includePhraseInLink, setIncludePhraseInLink] = useState(false);
  const [diceSpinKey, setDiceSpinKey] = useState(0);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

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
        void onJoinRoom({
          roomId: createRoomId,
          secretPhrase: createPhrase,
          customAlias: createAlias,
        });
      }}
    >
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2 lg:items-start lg:gap-6">
        <div className="order-1 space-y-4 lg:order-1">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="create-phrase" className="text-xs font-semibold text-ink">
                {t('roomsPhraseLabel')}
              </label>
              <motion.button
                whileTap={TAP}
                transition={TAP_TRANSITION}
                type="button"
                onClick={() => {
                  setCreatePhrase(generateMemorablePassphrase(4));
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
            <div className="mt-2">
              <SecretPhraseInput
                id="create-phrase"
                value={createPhrase}
                onChange={setCreatePhrase}
                visible={showCreatePhrase}
                onToggleVisible={() => setShowCreatePhrase((v) => !v)}
              />
            </div>
            <PassphraseStrengthBar id={createStrength.id} score={createStrength.score} />
            <div className="mt-2">
              <CopyButton
                text={createPhrase}
                label={t('roomsCopyPhrase')}
                copiedLabel={t('copiedDefault')}
                icon={KeyRound}
                iconOnly
                className="min-h-[44px] min-w-[44px] rounded-[var(--radius-ctrl)] border border-border bg-bg px-3 py-1.5 text-xs font-medium text-ink focus-visible:outline-2 focus-visible:outline-accent"
              />
            </div>
          </div>

          <div>
            <button
              type="button"
              aria-expanded={customizeOpen}
              onClick={() => setCustomizeOpen((v) => !v)}
              className="flex min-h-[44px] items-center gap-1.5 text-xs font-semibold text-muted focus-visible:outline-2 focus-visible:outline-accent"
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
                  <div className="space-y-3 pt-2">
                    <div>
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
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-xs text-muted">
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
                    </label>
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
            className="btn-accent-sheen inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--radius-ctrl)] bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
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
          </motion.button>
        </div>

        <div className="order-2 rounded-[var(--radius-sheet)] border border-border bg-bg p-4 sm:p-5 lg:order-2">
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
            <InviteQr inviteUrl={inviteUrl} includesSecret={Boolean(phraseForLink)} />
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmOpen}
        title={t('confirmPhraseTitle')}
        body={t('confirmPhraseBody')}
        onConfirm={() => {
          setIncludePhraseInLink(true);
          setConfirmOpen(false);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </motion.form>
  );
}
