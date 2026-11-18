import { lazy, Suspense, useState } from 'react';
import { ChevronDown, KeyRound, Loader2, QrCode } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { evaluatePassphraseStrength } from '../../core/crypto/passphraseWords';
import { buildInviteUrl, parseInviteInput } from '../../core/utils/inviteLink';
import type { RoomJoinParams } from '../../hooks/useRoomManager';
import { useT } from '../../i18n';
import { PassphraseStrengthBar } from '../../components/ui/PassphraseStrengthBar';
import { SecretPhraseInput } from '../../components/ui/SecretPhraseInput';

const QrScannerModal = lazy(() => import('../../components/ui/QrScannerModal'));

interface JoinRoomFormProps {
  initialRoomId?: string;
  initialPhrase?: string | null;
  isJoining: boolean;
  onJoinRoom: (params: RoomJoinParams) => Promise<void>;
}

export function JoinRoomForm({
  initialRoomId = '',
  initialPhrase = null,
  isJoining,
  onJoinRoom,
}: JoinRoomFormProps) {
  const t = useT();
  const [joinInviteInput, setJoinInviteInput] = useState(
    initialRoomId ? buildInviteUrl(initialRoomId) : ''
  );
  const [joinRoomId, setJoinRoomId] = useState(initialRoomId);
  const [joinPhrase, setJoinPhrase] = useState(initialPhrase ?? '');
  const [showJoinPhrase, setShowJoinPhrase] = useState(false);
  const [joinAlias, setJoinAlias] = useState('');
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(Boolean(initialRoomId));
  const [scannerOpen, setScannerOpen] = useState(false);

  const handlePasteInviteInput = (raw: string) => {
    setJoinInviteInput(raw);
    const parsed = parseInviteInput(raw);
    if (parsed) {
      setJoinRoomId(parsed.roomId);
      if (parsed.phrase) setJoinPhrase(parsed.phrase);
    }
  };

  const phraseNeeded = !!joinRoomId && !joinPhrase.trim();
  const joinStrength = evaluatePassphraseStrength(joinPhrase);
  const showStrength =
    !!joinPhrase &&
    (joinStrength.id === 'weak' ||
      joinStrength.id === 'short' ||
      joinStrength.id === 'empty' ||
      joinStrength.id === 'ok' ||
      joinStrength.id === 'good' ||
      joinStrength.id === 'strong');

  return (
    <motion.form
      key="join"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.12 }}
      className="mt-6 space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!joinRoomId.trim() || !joinPhrase.trim()) return;
        void onJoinRoom({
          roomId: joinRoomId.trim(),
          secretPhrase: joinPhrase.trim(),
          customAlias: joinAlias,
        });
      }}
    >
      <motion.button
        whileTap={{ scale: 0.97 }}
        type="button"
        onClick={() => setScannerOpen(true)}
        className="btn-accent-sheen inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[var(--radius-ctrl)] bg-accent px-5 py-3 text-sm font-semibold text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <QrCode className="h-5 w-5" aria-hidden="true" />
        {t('qrScanTitle')}
      </motion.button>

      <div>
        <button
          type="button"
          aria-expanded={pasteOpen}
          onClick={() => setPasteOpen((v) => !v)}
          className="flex min-h-[44px] w-full items-center gap-1.5 text-xs font-semibold text-muted focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${pasteOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
          {t('roomsInvitePaste')}
        </button>
        <AnimatePresence>
          {pasteOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-2">
                <input
                  id="join-invite"
                  value={joinInviteInput}
                  onChange={(e) => handlePasteInviteInput(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-[16px] text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-accent/30"
                  placeholder={t('roomsInvitePaste')}
                  aria-label={t('roomsInvitePaste')}
                />
                {joinRoomId && (
                  <p className="mt-1.5 font-mono text-[11px] text-muted">
                    {t('roomsRoomIdLabel')}: {joinRoomId}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {(phraseNeeded || joinPhrase || joinRoomId) && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="overflow-hidden"
        >
          <label htmlFor="join-phrase" className="text-xs font-semibold text-ink">
            {t('roomsPhraseLabel')}
          </label>
          <div className="mt-2">
            <SecretPhraseInput
              id="join-phrase"
              value={joinPhrase}
              onChange={setJoinPhrase}
              visible={showJoinPhrase}
              onToggleVisible={() => setShowJoinPhrase((v) => !v)}
            />
          </div>
          {showStrength && (
            <PassphraseStrengthBar id={joinStrength.id} score={joinStrength.score} />
          )}
        </motion.div>
      )}

      {joinRoomId && joinPhrase && (
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
                  <label htmlFor="join-alias" className="text-xs font-semibold text-ink">
                    {t('roomsAliasLabel')}
                  </label>
                  <input
                    id="join-alias"
                    value={joinAlias}
                    onChange={(e) => setJoinAlias(e.target.value)}
                    className="mt-2 w-full min-h-[44px] rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-[16px] text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-accent/30"
                    placeholder={t('roomsAliasPlaceholder')}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <motion.button
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.12 }}
        type="submit"
        disabled={!joinRoomId.trim() || !joinPhrase.trim() || isJoining}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[var(--radius-ctrl)] border border-border bg-surface-raised px-5 py-2.5 text-sm font-semibold text-ink hover:bg-bg disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {isJoining ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t('roomsConnecting')}
          </>
        ) : (
          <>
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            {t('roomsJoinCta')}
          </>
        )}
      </motion.button>

      {scannerOpen && (
        <Suspense fallback={null}>
          <QrScannerModal
            open={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onScan={(parsed) => {
              setJoinRoomId(parsed.roomId);
              setJoinInviteInput(buildInviteUrl(parsed.roomId, parsed.phrase ?? undefined));
              if (parsed.phrase) setJoinPhrase(parsed.phrase);
              setPasteOpen(true);
              setScannerOpen(false);
            }}
          />
        </Suspense>
      )}
    </motion.form>
  );
}
