import { useMemo, useState } from 'react';
import { ChevronDown, Dices, Loader2, Radio, ShieldAlert } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { generateRandomHex } from '../../core/crypto/identity';
import {
  evaluatePassphraseStrength,
  generateMemorablePassphrase,
  type PassphraseStrengthId,
} from '../../core/crypto/passphraseWords';
import { buildInviteUrl } from '../../core/utils/inviteLink';
import type { RoomJoinParams } from '../../hooks/useTaziaSession';
import { useT, type MessageKey } from '../../i18n';
import { InviteQr } from '../../components/session/InviteQr';
import { CopyButton } from '../../components/ui/CopyButton';
import { SecretPhraseInput } from '../../components/ui/SecretPhraseInput';
import { ConfirmModal } from '../../components/ui/ConfirmModal';

const STRENGTH_KEYS: Record<PassphraseStrengthId, { label: MessageKey; hint: MessageKey }> = {
  empty: { label: 'strengthEmpty', hint: 'strengthEmptyHint' },
  weak: { label: 'strengthWeak', hint: 'strengthWeakHint' },
  short: { label: 'strengthShort', hint: 'strengthShortHint' },
  strong: { label: 'strengthStrong', hint: 'strengthStrongHint' },
  good: { label: 'strengthGood', hint: 'strengthGoodHint' },
  ok: { label: 'strengthOk', hint: 'strengthOkHint' },
};

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
  const [diceRotation, setDiceRotation] = useState(0);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const createStrength = evaluatePassphraseStrength(createPhrase);
  const strengthCopy = STRENGTH_KEYS[createStrength.id];
  const showStrength = createStrength.id === 'empty' || createStrength.id === 'weak' || createStrength.id === 'short' || createStrength.id === 'ok';
  const inviteUrl = useMemo(
    () =>
      buildInviteUrl(
        createRoomId,
        includePhraseInLink && createPhrase.trim() ? createPhrase.trim() : undefined
      ),
    [createRoomId, createPhrase, includePhraseInLink]
  );

  return (
    <motion.form
      key="create"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.16 }}
      className="mt-6"
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <div className="order-2 space-y-5 lg:order-1">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label htmlFor="create-phrase" className="text-xs font-semibold text-ink">
                {t('roomsPhraseLabel')}
              </label>
              <button
                type="button"
                onClick={() => {
                  setCreatePhrase(generateMemorablePassphrase(4));
                  setShowCreatePhrase(true);
                  setDiceRotation((deg) => deg + 180);
                }}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-border bg-bg px-3 py-2 text-xs font-medium text-muted focus-visible:outline-2 focus-visible:outline-accent"
              >
                <motion.span animate={{ rotate: diceRotation }}>
                  <Dices className="h-3.5 w-3.5" aria-hidden="true" />
                </motion.span>
                {t('roomsGeneratePhrase')}
              </button>
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
            {showStrength && (
              <p className="mt-1.5 text-xs text-muted">
                <span className="font-medium text-ink">{t(strengthCopy.label)}:</span>{' '}
                {t(strengthCopy.hint)}
              </p>
            )}
            <div className="mt-2">
              <CopyButton
                text={createPhrase}
                label={t('roomsCopyPhrase')}
                copiedLabel={t('copiedDefault')}
                className="min-h-[40px] rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-medium text-ink focus-visible:outline-2 focus-visible:outline-accent"
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
                className={`h-3.5 w-3.5 transition-transform ${customizeOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
              {t('roomsCustomize')}
            </button>
            <AnimatePresence>
              {customizeOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-2">
                    <label htmlFor="create-alias" className="text-xs font-semibold text-ink">
                      {t('roomsAliasLabel')}
                    </label>
                    <input
                      id="create-alias"
                      value={createAlias}
                      onChange={(e) => setCreateAlias(e.target.value)}
                      className="mt-2 w-full min-h-[44px] rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-[16px] text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-accent/30"
                      placeholder={t('roomsAliasPlaceholder')}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={!createStrength.isAcceptable || isJoining}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {isJoining ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {t('roomsConnecting')}
              </>
            ) : (
              <>
                <Radio className="h-4 w-4" aria-hidden="true" />
                {t('roomsOpen')}
              </>
            )}
          </motion.button>
        </div>

        <div className="order-1 rounded-xl border border-border bg-bg p-4 sm:p-5 lg:order-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-ink">{t('roomsInviteTitle')}</p>
            <CopyButton
              text={inviteUrl}
              label={t('roomsCopyLink')}
              copiedLabel={t('copiedDefault')}
              className="min-h-[44px] rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-xs font-medium text-ink focus-visible:outline-2 focus-visible:outline-accent"
            />
          </div>

          <div className="mt-4 flex justify-center">
            <InviteQr inviteUrl={inviteUrl} includesSecret={includePhraseInLink} />
          </div>

          <p className="mt-3 break-all font-mono text-[11px] text-faint">{inviteUrl}</p>

          <label className="mt-3 flex min-h-[44px] items-center gap-3 text-xs text-muted">
            <input
              type="checkbox"
              className="h-5 w-5 rounded accent-accent"
              checked={includePhraseInLink}
              onChange={(e) => {
                if (e.target.checked) {
                  setConfirmOpen(true);
                } else {
                  setIncludePhraseInLink(false);
                }
              }}
            />
            <span className="flex-1">{t('roomsIncludePhrase')}</span>
            {includePhraseInLink && (
              <ShieldAlert className="h-4 w-4 shrink-0 text-warn" aria-hidden="true" />
            )}
          </label>
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
