/** Last-known flame seeds by peer userId (survives offline / left presence). */

const cache = new Map<string, string>();

export function rememberPeerAvatarSeed(userId: string, seed: string): void {
  if (!userId || !seed) return;
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

export function clearPeerAvatarSeeds(): void {
  cache.clear();
}
