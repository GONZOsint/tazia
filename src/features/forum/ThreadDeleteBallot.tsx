import { Flame } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { ThreadDeleteBallot as Ballot } from '../../core/forum/threadDelete';
import { useT } from '../../i18n';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { TAP, TAP_TRANSITION, disclosure } from '../../motion/tokens';

type ThreadDeleteBallotProps = {
  deleteBallot: Ballot | null;
  waitingNames: string;
  selfIsElector: boolean;
  selfHasVoted: boolean;
  isBusy: boolean;
  deleteBusy: boolean;
  deleteConfirmOpen: boolean;
  onCancelConfirm: () => void;
  onProposeDelete: () => void;
  onVoteDelete: () => void;
};

export function ThreadDeleteBallotBar({
  deleteBallot,
  waitingNames,
  selfIsElector,
  selfHasVoted,
  isBusy,
  deleteBusy,
  deleteConfirmOpen,
  onCancelConfirm,
  onProposeDelete,
  onVoteDelete,
}: ThreadDeleteBallotProps) {
  const t = useT();

  return (
    <>
      <AnimatePresence initial={false}>
        {deleteBallot && (
          <motion.div
            key={deleteBallot.proposalMsgId}
            initial={disclosure.initial}
            animate={disclosure.animate}
            exit={disclosure.exit}
            transition={disclosure.transition}
            className="plaza-delete-ballot shrink-0 overflow-hidden"
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-2.5">
              <Flame
                className="plaza-delete-ballot__icon mt-0.5 h-4 w-4 shrink-0"
                aria-hidden="true"
                strokeWidth={2}
              />
              <div className="min-w-0 flex-1">
                <p className="plaza-delete-ballot__title text-sm font-semibold">
                  {t('readerDeleteVoteProgress', {
                    have: deleteBallot.votes.length,
                    need: deleteBallot.electorate.length,
                  })}
                </p>
                {waitingNames ? (
                  <p className="plaza-delete-ballot__meta type-caption mt-1">
                    {t('readerDeleteVoteWaiting', { names: waitingNames })}
                  </p>
                ) : null}
                {!selfIsElector ? (
                  <p className="plaza-delete-ballot__meta type-caption mt-1.5">
                    {t('readerDeleteVoteObserver')}
                  </p>
                ) : selfHasVoted ? (
                  <p className="plaza-delete-ballot__meta type-caption mt-1.5">
                    {t('readerDeleteVoteYouVoted')}
                  </p>
                ) : (
                  <motion.button
                    whileTap={TAP}
                    transition={TAP_TRANSITION}
                    type="button"
                    onClick={onVoteDelete}
                    disabled={isBusy || deleteBusy}
                    className="plaza-delete-ballot__aye type-ui pressable disabled:opacity-50"
                  >
                    <Flame className="h-4 w-4" aria-hidden="true" strokeWidth={2} />
                    {t('readerDeleteVoteAye')}
                  </motion.button>
                )}
                <div className="plaza-delete-ballot__track" aria-hidden="true">
                  <div
                    className="plaza-delete-ballot__fill"
                    style={{
                      width: `${Math.round(
                        (deleteBallot.votes.length /
                          Math.max(1, deleteBallot.electorate.length)) *
                          100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        open={deleteConfirmOpen}
        title={t('readerDeleteProposeTitle')}
        body={t('readerDeleteProposeBody')}
        confirmLabel={t('readerDeleteProposeAction')}
        danger
        icon={Flame}
        onCancel={onCancelConfirm}
        onConfirm={onProposeDelete}
      />
    </>
  );
}
