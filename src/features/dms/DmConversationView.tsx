import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Loader2, Send } from 'lucide-react';
import type { DirectMessage, PresenceState } from '../../core/protocol';
import { useLocale, useT } from '../../i18n';
import { formatClockTime } from '../../core/utils/inviteLink';

interface DmConversationViewProps {
  selfUserId: string;
  peerId: string;
  peerAlias: string;
  messages: DirectMessage[];
  onSend: (body: string) => Promise<void>;
  onBack: () => void;
}

export function DmConversationView({
  selfUserId,
  peerId,
  peerAlias,
  messages,
  onSend,
  onBack,
}: DmConversationViewProps) {
  const t = useT();
  const { locale } = useLocale();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      await onSend(body.trim());
      setBody('');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="mx-auto flex max-w-[720px] flex-col px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted focus-visible:outline-2 focus-visible:outline-accent"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="truncate font-display text-lg font-semibold text-ink">{peerAlias}</h1>
      </div>

      <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
        {messages.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">{t('dmsEmpty')}</p>
        )}
        {messages.map((msg) => {
          const isSelf = msg.fromUserId === selfUserId;
          return (
            <div
              key={msg.msgId}
              className={`flex ${isSelf ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  isSelf
                    ? 'bg-accent text-on-accent'
                    : 'bg-surface-raised border border-border text-ink'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                <p
                  className={`mt-1 text-[10px] ${
                    isSelf ? 'text-on-accent/60' : 'text-muted'
                  }`}
                >
                  {formatClockTime(msg.createdAtMs, locale)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="mt-4 flex gap-2 border-t border-border pt-4"
      >
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={t('dmsSend')}
          className="flex-1 min-h-[44px] rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-[16px] text-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-accent/30"
        />
        <button
          type="submit"
          disabled={!body.trim() || sending}
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-accent text-on-accent hover:bg-accent-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-accent"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </form>
    </main>
  );
}

export default DmConversationView;
