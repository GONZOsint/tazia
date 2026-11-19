import {
  spawnAsh,
  spawnFlame,
  spawnSmoke,
  spawnSpark,
  type ParticleBags,
} from './particles';
import type { BurnFrontMode } from './burnFront';

export type MidBurnFeedState = {
  lastFeedMs: number;
};

export type MidBurnFeedOpts = {
  elapsedMs: number;
  collapseAtMs: number;
  /** Min ms between feeds (Region ~200, Burn ~220). */
  intervalMs: number;
  collapsed: boolean;
  mode: BurnFrontMode;
  pickPoint: () => { x: number; y: number } | null;
};

/**
 * Occasional mid-animation particle feed before DOM collapse.
 * Mutates `state.lastFeedMs` when a feed fires.
 */
export function maybeFeedBurnParticles(
  bags: ParticleBags,
  state: MidBurnFeedState,
  opts: MidBurnFeedOpts
): void {
  if (opts.collapsed) return;
  if (opts.elapsedMs - state.lastFeedMs <= opts.intervalMs) return;
  if (opts.elapsedMs >= opts.collapseAtMs + 80) return;

  const point = opts.pickPoint();
  if (!point) return;

  state.lastFeedMs = opts.elapsedMs;
  const { x, y } = point;

  if (opts.mode === 'extinguish') {
    spawnSmoke(bags, x, y);
    if (Math.random() < 0.35) spawnAsh(bags, x, y);
    if (Math.random() < 0.2) spawnFlame(bags, x, y, 0.3);
    return;
  }

  spawnFlame(bags, x, y, 0.55 + Math.random() * 0.35);
  if (Math.random() < 0.5) spawnSmoke(bags, x, y);
  if (Math.random() < 0.6) spawnSpark(bags, x, y);
  if (Math.random() < 0.35) spawnAsh(bags, x, y);
}
