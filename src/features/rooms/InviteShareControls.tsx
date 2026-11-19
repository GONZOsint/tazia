import { Link2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useT } from '../../i18n';
import { contentSwitch } from '../../motion/tokens';
import { CopyButton } from '../../components/ui/CopyButton';

interface InviteShareControlsProps {
  inviteUrl: string;
  includePhrase: boolean;
  /** When false, phrase toggle is hidden (no phrase available). */
  phraseAvailable: boolean;
  phraseDisabled?: boolean;
  onRequestIncludePhrase: () => void;
  onExcludePhrase: () => void;
  /** Dense layout for embedded zone card. */
  compact?: boolean;
}

/** Shared copy-row + phrase toggle for create hub and zone invite. */
export function InviteShareControls({
  inviteUrl,
  includePhrase,
  phraseAvailable,
  phraseDisabled = false,
  onRequestIncludePhrase,
  onExcludePhrase,
  compact = false,
}: InviteShareControlsProps) {
  const t = useT();

  return (
    <div className={`invite-controls ${compact ? 'invite-controls--compact' : ''}`}>
      <div className="invite-copy-row">
        <div className="invite-copy-info min-w-0">
          <p className="invite-copy-label">{t('roomsCopyLink')}</p>
          <p className="invite-link-preview" title={inviteUrl}>
            {inviteUrl}
          </p>
        </div>
        <CopyButton
          text={inviteUrl}
          label={t('roomsCopyLink')}
          copiedLabel={t('copiedDefault')}
          icon={Link2}
          className="invite-copy-btn"
        />
      </div>

      {phraseAvailable && (
        <motion.label
          initial={contentSwitch.initial}
          animate={contentSwitch.animate}
          transition={contentSwitch.transition}
          className={`invite-phrase-toggle ${includePhrase ? 'is-active' : ''} ${
            phraseDisabled ? 'is-disabled' : ''
          }`}
        >
          <span className="invite-phrase-left">
            <span className="relative inline-flex">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={includePhrase}
                disabled={phraseDisabled}
                onChange={(e) => {
                  if (e.target.checked) onRequestIncludePhrase();
                  else onExcludePhrase();
                }}
              />
              <span
                className="tazia-check peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-disabled:opacity-40"
                data-checked={includePhrase}
                aria-hidden="true"
              >
                <svg
                  className="h-3 w-3 text-on-accent"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3.2"
                >
                  <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </span>
            <span className="invite-phrase-text">{t('roomsIncludePhrase')}</span>
          </span>
          <span className={`invite-phrase-badge ${includePhrase ? 'is-ember' : ''}`}>
            <span className="invite-phrase-badge__dot" aria-hidden="true" />
            {includePhrase ? t('phraseBadgeActive') : t('phraseBadgeOff')}
          </span>
        </motion.label>
      )}
    </div>
  );
}
