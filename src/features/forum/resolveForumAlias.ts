import type { LocalProfile, PeerVisual } from '../../core/crypto/identity';

export function resolveForumAlias(
  userId: string,
  opts: {
    presenceAliases: Record<string, string>;
    selfUserId: string;
    identity: LocalProfile;
    authorVisuals: Record<string, PeerVisual>;
    fallback: string;
  }
): string {
  return (
    opts.presenceAliases[userId] ||
    (userId === opts.selfUserId ? opts.identity.alias : undefined) ||
    opts.authorVisuals[userId]?.suggestedAlias ||
    opts.fallback
  );
}
