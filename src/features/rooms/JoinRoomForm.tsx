import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { buildInviteUrl, parseInviteInput } from '../../core/utils/inviteLink';
import type { RoomJoinParams } from '../../hooks/useTaziaSession';
import { useT } from '../../i18n';
import { SecretPhraseInput } from '../../components/ui/SecretPhraseInput';

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

  const handlePasteInviteInput = (raw: string) => {
    setJoinInviteInput(raw);
    const parsed = parseInviteInput(raw);
    if (parsed) {
      setJoinRoomId(parsed.roomId);
      if (parsed.phrase) setJoinPhrase(parsed.phrase);
    }
  };

  return (
    <motion.form
      key="join"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
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
      <div>
        <label htmlFor="join-invite" className="text-xs font-semibold text-ink">
          {t('roomsInvitePaste')}
        </label>
        <input
          id="join-invite"
          value={joinInviteInput}
          onChange={(e) => handlePasteInviteInput(e.target.value)}
          className="mt-2 w-full min-h-[44px] rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-ink"
        />
        {joinRoomId && (
          <p className="mt-1.5 font-mono text-[11px] text-muted">
            {t('roomsRoomIdLabel')}: {joinRoomId}
          </p>
        )}
      </div>
      <div>
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
      </div>
      <div>
        <label htmlFor="join-alias" className="text-xs font-semibold text-ink">
          {t('roomsAliasLabel')}
        </label>
        <input
          id="join-alias"
          value={joinAlias}
          onChange={(e) => setJoinAlias(e.target.value)}
          className="mt-2 w-full min-h-[44px] rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-ink"
        />
      </div>
      <button
        type="submit"
        disabled={!joinRoomId.trim() || !joinPhrase.trim() || isJoining}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent disabled:opacity-50"
      >
        {isJoining ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {t('roomsConnecting')}
          </>
        ) : (
          t('roomsJoinCta')
        )}
      </button>
    </motion.form>
  );
}
