import { useState } from 'react';
import { FileText, Loader2, Send, X } from 'lucide-react';
import { motion } from 'motion/react';
import type { LocalProfile } from '../../core/crypto/identity';
import { useT } from '../../i18n';
import { MAX_BODY_CHARS, MAX_TITLE_CHARS } from '../../core/protocol';

interface ThreadComposerProps {
  identity: LocalProfile;
  isBusy: boolean;
  onCancel: () => void;
  onSubmitThread: (title: string, body: string) => Promise<boolean>;
}

export function ThreadComposer({
  identity,
  isBusy,
  onCancel,
  onSubmitThread,
}: ThreadComposerProps) {
  const t = useT();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [planeKey, setPlaneKey] = useState(0);

  const overLimit =
    title.length > MAX_TITLE_CHARS || body.length > MAX_BODY_CHARS || !title.trim() || !body.trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (overLimit || isBusy) return;
    setPlaneKey((k) => k + 1);
    const ok = await onSubmitThread(title.trim(), body.trim());
    if (ok) {
      setTitle('');
      setBody('');
      onCancel();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-surface-raised p-6 sm:p-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h2 className="inline-flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <FileText className="h-4 w-4 text-muted" aria-hidden="true" />
            {t('composerTitle')}
          </h2>
          <p className="mt-1 text-xs text-muted">{t('composerAs', { alias: identity.alias })}</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-[44px] items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted focus-visible:outline-2 focus-visible:outline-accent"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          {t('composerCancel')}
        </button>
      </div>

      <form className="mt-5 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
        <div>
          <label htmlFor="thread-title" className="text-xs font-semibold text-ink">
            {t('composerTitleLabel')}
          </label>
          <input
            id="thread-title"
            value={title}
            maxLength={MAX_TITLE_CHARS}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('composerTitlePlaceholder')}
            className="mt-2 w-full min-h-[44px] rounded-[var(--radius-ctrl)] border border-border bg-surface-raised px-3 py-2.5 text-[16px] text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
            required
          />
        </div>
        <div>
          <label htmlFor="thread-body" className="text-xs font-semibold text-ink">
            {t('composerBodyLabel')}
          </label>
          <textarea
            id="thread-body"
            value={body}
            maxLength={MAX_BODY_CHARS}
            onChange={(e) => setBody(e.target.value)}
            rows={6}
            placeholder={t('composerBodyPlaceholder')}
            className="mt-2 w-full rounded-[var(--radius-ctrl)] border border-border bg-surface-raised px-3 py-2.5 text-[16px] text-ink focus:border-ink focus:outline-none focus:ring-2 focus:ring-accent/30"
            required
          />
        </div>
        <button
          type="submit"
          disabled={overLimit || isBusy}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--radius-ctrl)] bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent hover:bg-accent-hover active:scale-[0.97] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {isBusy ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <span key={planeKey} className={planeKey > 0 ? 'plane-launching' : 'inline-flex'}>
              <Send className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
          {isBusy ? t('composerPublishing') : t('composerPublish')}
        </button>
      </form>
    </motion.div>
  );
}
