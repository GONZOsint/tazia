export class PeerRateLimiter {
  private readonly hits = new Map<string, number[]>();

  allow(peerId: string, maxPerMinute: number, now = Date.now()): boolean {
    const windowStart = now - 60_000;
    const prev = (this.hits.get(peerId) ?? []).filter((t) => t >= windowStart);
    if (prev.length >= maxPerMinute) {
      this.hits.set(peerId, prev);
      return false;
    }
    prev.push(now);
    this.hits.set(peerId, prev);
    return true;
  }

  /** Remove peers with no hits in the last `staleMs` (default 5 min). */
  pruneStale(staleMs = 5 * 60_000, now = Date.now()): void {
    const cutoff = now - staleMs;
    for (const [peerId, timestamps] of this.hits) {
      const latest = timestamps[timestamps.length - 1];
      if (latest === undefined || latest < cutoff) {
        this.hits.delete(peerId);
      }
    }
  }

  clear(): void {
    this.hits.clear();
  }
}
