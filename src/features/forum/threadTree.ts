import type { ForumMessage } from '../../core/protocol';

export type TreeNode = {
  message: ForumMessage;
  children: TreeNode[];
};

export const MAX_DEPTH = 4;
export const INDENT_PX = 18;

export function buildTree(root: ForumMessage, replies: ForumMessage[]): TreeNode {
  const byParent = new Map<string, ForumMessage[]>();
  for (const r of replies) {
    const pid = r.parentMsgId || root.msgId;
    const list = byParent.get(pid) ?? [];
    list.push(r);
    byParent.set(pid, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.createdAtMs - b.createdAtMs);
  }

  const walk = (msg: ForumMessage, depth: number): TreeNode => {
    const kids = byParent.get(msg.msgId) ?? [];
    if (depth >= MAX_DEPTH) {
      const flat: ForumMessage[] = [];
      const collect = (id: string) => {
        for (const c of byParent.get(id) ?? []) {
          flat.push(c);
          collect(c.msgId);
        }
      };
      collect(msg.msgId);
      flat.sort((a, b) => a.createdAtMs - b.createdAtMs);
      return {
        message: msg,
        children: flat.map((m) => ({ message: m, children: [] })),
      };
    }
    return {
      message: msg,
      children: kids.map((c) => walk(c, depth + 1)),
    };
  };

  return walk(root, 0);
}

export function snippetOf(text: string, max = 56): string {
  const one = text.replace(/\s+/g, ' ').trim();
  if (one.length <= max) return one;
  return `${one.slice(0, max - 1)}…`;
}
