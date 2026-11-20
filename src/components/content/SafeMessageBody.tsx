import { Fragment, memo } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useT } from '../../i18n';
import { CopyButton } from '../ui/CopyButton';

export interface SafeMessageBodyProps {
  text: string;
}

type LineSegment = { type: 'text'; value: string } | { type: 'url'; value: string };

function splitTrailingUrlPunctuation(raw: string): { url: string; trailing: string } {
  let url = raw;
  while (url.length > 0) {
    if (/[.,;:!?]$/.test(url)) {
      url = url.slice(0, -1);
      continue;
    }
    if (url.endsWith(')')) {
      const opens = (url.match(/\(/g) ?? []).length;
      const closes = (url.match(/\)/g) ?? []).length;
      if (closes > opens) {
        url = url.slice(0, -1);
        continue;
      }
    }
    if (url.endsWith(']')) {
      const opens = (url.match(/\[/g) ?? []).length;
      const closes = (url.match(/\]/g) ?? []).length;
      if (closes > opens) {
        url = url.slice(0, -1);
        continue;
      }
    }
    break;
  }
  return { url, trailing: raw.slice(url.length) };
}

function tokenizeLine(line: string): LineSegment[] {
  const segments: LineSegment[] = [];
  const re = /https?:\/\/[^\s<>"'`]+/gi;
  let lastIndex = 0;

  for (const match of line.matchAll(re)) {
    const start = match.index ?? 0;
    if (start > lastIndex) {
      segments.push({ type: 'text', value: line.slice(lastIndex, start) });
    }

    const raw = match[0];
    const { url, trailing } = splitTrailingUrlPunctuation(raw);

    if (/^https?:\/\/[^/]/i.test(url)) {
      segments.push({ type: 'url', value: url });
      if (trailing) {
        segments.push({ type: 'text', value: trailing });
      }
    } else {
      segments.push({ type: 'text', value: raw });
    }

    lastIndex = start + raw.length;
  }

  if (lastIndex < line.length) {
    segments.push({ type: 'text', value: line.slice(lastIndex) });
  }

  return segments;
}

export const SafeMessageBody = memo(function SafeMessageBody({ text }: SafeMessageBodyProps) {
  const t = useT();
  const disabledLinkTitle = t('linkDisabledTitle');
  const copyLabel = t('copyDefault');
  const copiedLabel = t('copiedDefault');

  const paragraphs = text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .filter((p) => p.length > 0);

  return (
    <div className="type-message space-y-3 text-ink">
      {paragraphs.map((paragraph, pIdx) => {
        const lines = paragraph.split('\n');
        return (
          <p key={pIdx} className="whitespace-pre-wrap break-words">
            {lines.map((line, lIdx) => (
              <Fragment key={lIdx}>
                {tokenizeLine(line).map((seg, idx) =>
                  seg.type === 'url' ? (
                    <span
                      key={idx}
                      className="type-caption mx-0.5 inline-flex max-w-full align-middle items-center gap-1.5 rounded-[calc(var(--radius-ctrl)-4px)] border border-warn-border bg-warn-bg/80 px-2 py-0.5 font-mono text-warn-ink"
                      title={disabledLinkTitle}
                    >
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-warn" aria-hidden="true" />
                      <span className="sr-only">{disabledLinkTitle}: </span>
                      <span
                        className="min-w-0 shrink max-w-[220px] truncate sm:max-w-[300px]"
                        title={seg.value}
                      >
                        {seg.value}
                      </span>
                      <CopyButton
                        text={seg.value}
                        label={copyLabel}
                        copiedLabel={copiedLabel}
                        className="type-caption min-h-[36px] rounded bg-surface-raised px-2 py-0.5 font-sans font-medium hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent"
                      />
                    </span>
                  ) : (
                    <Fragment key={idx}>{seg.value}</Fragment>
                  ),
                )}
                {lIdx < lines.length - 1 && <br />}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
});