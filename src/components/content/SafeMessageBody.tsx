import { ShieldAlert } from 'lucide-react';
import { useT } from '../../i18n';
import { CopyButton } from '../ui/CopyButton';

interface SafeMessageBodyProps {
  text: string;
}

const URL_REGEX = /(https?:\/\/[^\s<>"'`]+)/gi;

export function SafeMessageBody({ text }: SafeMessageBodyProps) {
  const t = useT();
  const paragraphs = text.split(/\n{2,}/);

  return (
    <div className="space-y-3 text-[15px] leading-relaxed text-ink">
      {paragraphs.map((paragraph, pIdx) => {
        const lines = paragraph.split('\n');
        return (
          <p key={pIdx} className="whitespace-pre-wrap break-words">
            {lines.map((line, lIdx) => {
              const parts = line.split(URL_REGEX);
              return (
                <span key={lIdx}>
                  {parts.map((part, idx) => {
                    if (/^https?:\/\//i.test(part)) {
                      return (
                        <span
                          key={idx}
                          className="mx-0.5 inline-flex max-w-full align-middle items-center gap-1.5 rounded-md border border-warn-border bg-warn-bg/80 px-2 py-0.5 font-mono text-[12px] text-warn-ink"
                          title={t('linkDisabledTitle')}
                        >
                          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-warn" aria-hidden="true" />
                          <span className="max-w-[220px] truncate sm:max-w-[300px]">{part}</span>
                          <CopyButton
                            text={part}
                            label={t('copyDefault')}
                            copiedLabel={t('copiedDefault')}
                            className="min-h-[36px] rounded bg-surface-raised px-2 py-0.5 font-sans text-[11px] font-medium text-muted hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent"
                          />
                        </span>
                      );
                    }
                    return <span key={idx}>{part}</span>;
                  })}
                  {lIdx < lines.length - 1 && <br />}
                </span>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}
