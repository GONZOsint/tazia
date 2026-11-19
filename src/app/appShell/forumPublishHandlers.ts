import { DELETE_VOTE_AYE, encodeElectorate } from '../../core/forum/threadDelete';
import type { ForumMessageType } from '../../core/protocol';
import type { useToast } from '../../components/ui/ToastHost';
import type { useT } from '../../i18n';

type PublishFn = (input: {
  type: ForumMessageType;
  threadId: string;
  parentMsgId: string | null;
  title: string;
  body: string;
}) => Promise<boolean>;

type ToastApi = ReturnType<typeof useToast>;
type TFn = ReturnType<typeof useT>;

export function createForumPublishHandlers(
  publish: PublishFn,
  toast: ToastApi,
  t: TFn
) {
  const fail = () => {
    toast.push(t('toastPublishFailed'), 'error');
  };

  return {
    onCreateThread: async (title: string, body: string) => {
      const ok = await publish({
        type: 'NEW_THREAD',
        threadId: crypto.randomUUID(),
        parentMsgId: null,
        title,
        body,
      });
      if (!ok) fail();
      return ok;
    },
    onReplyThread: async (threadId: string, parentMsgId: string, body: string) => {
      const ok = await publish({
        type: 'REPLY',
        threadId,
        parentMsgId,
        title: '',
        body,
      });
      if (!ok) fail();
      return ok;
    },
    onProposeDeleteThread: async (threadId: string, electorate: string[]) => {
      const body = encodeElectorate(electorate);
      if (!body) {
        fail();
        return false;
      }
      const ok = await publish({
        type: 'DELETE_PROPOSE',
        threadId,
        parentMsgId: null,
        title: '',
        body,
      });
      if (!ok) fail();
      return ok;
    },
    onVoteDeleteThread: async (threadId: string, proposalMsgId: string) => {
      const ok = await publish({
        type: 'DELETE_VOTE',
        threadId,
        parentMsgId: proposalMsgId,
        title: '',
        body: DELETE_VOTE_AYE,
      });
      if (!ok) fail();
      return ok;
    },
  };
}
