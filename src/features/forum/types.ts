import type { ForumMessage } from '../../core/protocol';

export interface ThreadGroup {
  threadId: string;
  title: string;
  rootPost: ForumMessage;
  replies: ForumMessage[];
  lastActivityMs: number;
}
