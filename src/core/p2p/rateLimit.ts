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

  clear(): void {
    this.hits.clear();
  }
}
