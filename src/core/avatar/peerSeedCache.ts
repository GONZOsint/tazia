import { isValidAvatarSeed } from './avatarSeed';

/** Last-known flame seeds by peer userId (survives offline / left presence). */

const cache = new Map<string, string>();

export function rememberPeerAvatarSeed(userId: string, seed: string): void {
  if (!userId || !seed || !isValidAvatarSeed(seed)) return;
  cache.set(userId, seed);
}

export function rememberPeerAvatarSeeds(map: Record<string, string>): void {
  for (const [id, seed] of Object.entries(map)) {
    rememberPeerAvatarSeed(id, seed);
  }
}

export function peerAvatarSeed(userId: string): string | undefined {
  return cache.get(userId);
}

/** Prefer a valid live seed; otherwise fall back to cache. */
export function resolvePeerAvatarSeed(
  liveSeed: string | null | undefined,
  userId: string
): string | null {
  if (liveSeed && isValidAvatarSeed(liveSeed)) return liveSeed;
  const cached = peerAvatarSeed(userId);
  return cached && isValidAvatarSeed(cached) ? cached : null;
}

export function clearPeerAvatarSeeds(): void {
  cache.clear();
}
