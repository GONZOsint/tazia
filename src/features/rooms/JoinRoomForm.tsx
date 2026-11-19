import { lazy, Suspense, useState } from 'react';
import { ChevronDown, KeyRound, Loader2, QrCode } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { evaluatePassphraseStrength } from '../../core/crypto/passphraseWords';
import { buildInviteUrl, parseInviteInput } from '../../core/utils/inviteLink';
import type { RoomJoinParams } from '../../hooks/useRoomManager';
import { useT } from '../../i18n';
import { DUR, EASE, IGNITE, TAP, TAP_TRANSITION, disclosure, panelEnter } from '../../motion/tokens';
import { haptic, HAPTIC_TAP } from '../../motion/haptic';
import { PassphraseStrengthBar } from '../../components/ui/PassphraseStrengthBar';
import { SecretPhraseInput } from '../../components/ui/SecretPhraseInput';

const QrScannerModal = lazy(() => import('../../components/ui/QrScannerModal'));

interface JoinRoomFormProps {
  initialRoomId?: string;
  initialPhrase?: string | null;
  isJoining: boolean;
  onJoinRoom: (params: RoomJoinParams) => Promise<void>;
  douseKey?: number;
}

export function JoinRoomForm({
  initialRoomId = '',
  initialPhrase = null,
  isJoining,
  onJoinRoom,
  douseKey = 0,
}: JoinRoomFormProps) {
  const t = useT();
  const reduceMotion = useReducedMotion();
  const [joinInviteInput, setJoinInviteInput] = useState(
    initialRoomId
      ? buildInviteUrl(initialRoomId, initialPhrase ?? undefined)
      : ''
  );
  const [joinRoomId, setJoinRoomId] = useState(initialRoomId);
  const [joinPhrase, setJoinPhrase] = useState(initialPhrase ?? '');
  const [showJoinPhrase, setShowJoinPhrase] = useState(Boolean(initialPhrase));
  const [joinAlias, setJoinAlias] = useState('');
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(Boolean(initialRoomId));
  const [scannerOpen, setScannerOpen] = useState(false);
  const [spark, setSpark] = useState(false);

  const handlePasteInviteInput = (raw: string) => {
    setJoinInviteInput(raw);
    const parsed = parseInviteInput(raw);
    if (parsed) {
      setJoinRoomId(parsed.roomId);
      setJoinPhrase(parsed.phrase ?? '');
      setShowJoinPhrase(Boolean(parsed.phrase));
    }
  };

  const joinStrength = evaluatePassphraseStrength(joinPhrase);
  const canJoin =
    Boolean(joinRoomId.trim() && joinPhrase.trim()) && joinStrength.isAcceptable;
  const phraseNeeded = !!joinRoomId && !joinPhrase.trim();
  const showStrength = !!joinPhrase;

  return (
    <motion.form
      key="join"
      initial={panelEnter.initial}
      animate={panelEnter.animate}
      exit={panelEnter.exit}
      transition={panelEnter.transition}
      className="mt-1 space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!canJoin) return;
        setSpark(true);
        haptic(HAPTIC_TAP);
        window.setTimeout(() => setSpark(false), IGNITE.finishMs);
        void onJoinRoom({
          roomId: joinRoomId.trim(),
          secretPhrase: joinPhrase.trim(),
          customAlias: joinAlias,
        });
      }}
    >
      <motion.button
        whileTap={TAP}
        transition={TAP_TRANSITION}
        type="button"
        onClick={() => setScannerOpen(true)}
        className={
          canJoin
            ? 'inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[var(--radius-ctrl)] border border-border bg-surface-raised px-5 py-3 text-sm font-semibold text-ink hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
            : 'btn-accent-sheen inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-[var(--radius-ctrl)] bg-accent px-5 py-3 text-sm font-semibold text-on-accent hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
        }
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
            className={`chevron-spin h-3.5 w-3.5 ${pasteOpen ? 'is-open' : ''}`}
            aria-hidden="true"
          />
          {t('roomsInvitePaste')}
        </button>
        <AnimatePresence initial={false}>
          {pasteOpen && (
            <motion.div
              initial={disclosure.initial}
              animate={disclosure.animate}
              exit={disclosure.exit}
              transition={disclosure.transition}
              className="overflow-hidden"
            >
              <div className="pt-2">
                <input
                  id="join-invite"
                  value={joinInviteInput}
                  onChange={(e) => handlePasteInviteInput(e.target.value)}
                  className="input-base"
                  placeholder={t('roomsInvitePaste')}
                  aria-label={t('roomsInvitePaste')}
                />
                {joinRoomId && (
                  <p className="type-caption mt-1.5 font-mono">
                    {t('roomsRoomIdLabel')}: {joinRoomId}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence initial={false}>
        {(phraseNeeded || joinPhrase || joinRoomId) && (
          <motion.div
            key="join-phrase-block"
            initial={disclosure.initial}
            animate={disclosure.animate}
            exit={disclosure.exit}
            transition={disclosure.transition}
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
              <PassphraseStrengthBar
                id={joinStrength.id}
                score={joinStrength.score}
                douseKey={douseKey}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {joinRoomId && joinPhrase && (
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
                <div className="pt-2">
                  <label htmlFor="join-alias" className="text-xs font-semibold text-ink">
                    {t('roomsAliasLabel')}
                  </label>
                  <input
                    id="join-alias"
                    value={joinAlias}
                    onChange={(e) => setJoinAlias(e.target.value)}
                    className="input-base mt-2"
                    placeholder={t('roomsAliasPlaceholder')}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <motion.button
        whileTap={canJoin && !isJoining ? TAP : undefined}
        transition={TAP_TRANSITION}
        type="submit"
        disabled={!canJoin || isJoining}
        className={`${
          canJoin
            ? 'btn-accent-sheen relative inline-flex min-h-[44px] w-full items-center justify-center gap-2 overflow-hidden rounded-[var(--radius-ctrl)] bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
            : 'relative inline-flex min-h-[44px] w-full items-center justify-center gap-2 overflow-hidden rounded-[var(--radius-ctrl)] border border-border bg-surface-raised px-5 py-2.5 text-sm font-semibold text-ink hover:bg-bg disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
        } ${spark ? 'cta-ignite-spark' : ''}`}
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
              <KeyRound className="h-4 w-4" aria-hidden="true" />
              {t('roomsJoinCta')}
            </>
          )}
        </span>
      </motion.button>

      {scannerOpen && (
        <Suspense fallback={null}>
          <QrScannerModal
            open={scannerOpen}
            onClose={() => setScannerOpen(false)}
            onScan={(parsed) => {
              setJoinRoomId(parsed.roomId);
              setJoinInviteInput(buildInviteUrl(parsed.roomId, parsed.phrase ?? undefined));
              setJoinPhrase(parsed.phrase ?? '');
              setShowJoinPhrase(Boolean(parsed.phrase));
              setPasteOpen(true);
              setScannerOpen(false);
            }}
          />
        </Suspense>
      )}
    </motion.form>
  );
}
