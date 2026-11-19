import {
  spawnAsh,
  spawnFlame,
  spawnSmoke,
  type ParticleBags,
} from './particles';

export type ParticleOrigin = { x: number; y: number };

/**
 * Smoke-first douse burst at the primary origin (session / region extinguish).
 */
export function seedExtinguishBurst(
  bags: ParticleBags,
  origin: ParticleOrigin,
  opts?: { smokeCount?: number; smokeSpreadX?: number; smokeSpreadY?: number; flameLife?: number }
): void {
  const smokeCount = opts?.smokeCount ?? 10;
  const spreadX = opts?.smokeSpreadX ?? 28;
  const spreadY = opts?.smokeSpreadY ?? 0;
  for (let i = 0; i < smokeCount; i++) {
    spawnSmoke(
      bags,
      origin.x + (Math.random() - 0.5) * spreadX,
      origin.y + (Math.random() - 0.5) * spreadY
    );
  }
  spawnFlame(bags, origin.x, origin.y, opts?.flameLife ?? 0.45);
  spawnAsh(bags, origin.x, origin.y);
}

/** Light secondary smoke/ash at extra targets (other session cards / regions). */
export function seedSecondaryExtinguish(
  bags: ParticleBags,
  points: ParticleOrigin[],
  opts?: { ashChance?: number }
): void {
  const ashChance = opts?.ashChance ?? 1;
  for (const p of points) {
    spawnSmoke(bags, p.x, p.y);
    if (ashChance >= 1 || Math.random() < ashChance) {
      spawnAsh(bags, p.x - 4, p.y + 8);
    }
  }
}
