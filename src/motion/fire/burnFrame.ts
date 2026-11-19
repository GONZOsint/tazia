import { FIRE_BUDGET } from './budget';
import {
  drawAmbientGlow,
  type ParticleBags,
  updateAndDrawAshes,
  updateAndDrawFlames,
  updateAndDrawSmokes,
  updateAndDrawSparks,
} from './particles';

/**
 * Front progress uses 85% of finishMs so particles can linger after the
 * pixel front completes (~finishMs remaining as ember fade).
 */
export const BURN_FRONT_DURATION_RATIO = 0.85;

export function clampDt(now: number, lastTime: number): number {
  return Math.max(0.001, Math.min(0.033, (now - lastTime) / 1000));
}

/** Continuous ease — matches prior mid/end shape without the tNorm=0.5 jump. */
export function burnFrontProgress(tNorm: number): number {
  const t = Math.max(0, Math.min(1, tNorm));
  // Smoothstep into a slightly accelerated mid; continuous at all t.
  return t * t * (3 - 2 * t);
}

export function burnFrontFromElapsed(
  elapsedSec: number,
  finishMs: number
): { tNorm: number; easedProgress: number; front: number } {
  const burnDurationSec = finishMs / 1000;
  const tNorm = Math.min(
    1,
    elapsedSec / Math.max(0.01, burnDurationSec * BURN_FRONT_DURATION_RATIO)
  );
  const easedProgress = burnFrontProgress(tNorm);
  const front = 0.045 + easedProgress * 1.14;
  return { tNorm, easedProgress, front };
}

export function fireIntensityFrom(
  bags: ParticleBags,
  activeEmberCount: number,
  dpr: number
): number {
  return Math.min(1, bags.flames.length / 75 + activeEmberCount / (600 * dpr * dpr));
}

export function ensureFullscreenCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  maxDpr: number = FIRE_BUDGET.maxDpr
): number {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const w = Math.max(1, Math.round(window.innerWidth * dpr));
  const h = Math.max(1, Math.round(window.innerHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return dpr;
}

export function smoothstep01(raw: number): number {
  const t = Math.max(0, Math.min(1, raw));
  return t * t * (3 - 2 * t);
}

/** Session burn: opaque bg veil near the end. */
export function drawEndVeil(
  ctx: CanvasRenderingContext2D,
  bg: string,
  elapsedSec: number,
  finishMs: number
): void {
  const burnDurationSec = finishMs / 1000;
  const veilStart = burnDurationSec * 0.82;
  if (elapsedSec < veilStart) return;
  const raw = Math.min(1, (elapsedSec - veilStart) / (burnDurationSec * 0.18));
  ctx.globalAlpha = smoothstep01(raw) * 0.92;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.globalAlpha = 1;
}

/** Region ash: fade whole layer alpha near the end. */
export function layerAlphaFromElapsed(elapsedSec: number, finishMs: number): number {
  const burnDurationSec = finishMs / 1000;
  if (elapsedSec < burnDurationSec * 0.82) return 1;
  const raw = Math.min(
    1,
    (elapsedSec - burnDurationSec * 0.82) / (burnDurationSec * 0.18)
  );
  return 1 - smoothstep01(raw);
}

export type DrawParticleLayersOpts = {
  glowX?: number;
  glowY?: number;
  /** Multiplier on fireIntensity for ambient glow (extinguish ~0.4–0.45). */
  glowScale?: number;
  /** Floor applied to smoke intensity (extinguish ~0.55–0.6). */
  smokeFloor?: number;
  layerAlpha?: number;
  /** Flame layer alpha (extinguish ~0.55 * layerAlpha). */
  flameAlpha?: number;
  /** Skip spark draw (extinguish / session douse). Default true. */
  drawSparks?: boolean;
  /** Called after ashes + before flame composite (e.g. draw bitmap targets). */
  beforeFlames?: () => void;
  /** Called after sparks restore (e.g. drawEndVeil). */
  afterLayers?: () => void;
};

export function drawParticleLayers(
  ctx: CanvasRenderingContext2D,
  bags: ParticleBags,
  dt: number,
  elapsedSec: number,
  fireIntensity: number,
  opts?: DrawParticleLayersOpts
): void {
  const layerAlpha = opts?.layerAlpha ?? 1;
  const glowScale = opts?.glowScale ?? 1;
  const smokeFloor = opts?.smokeFloor ?? 0;
  const flameAlpha = opts?.flameAlpha ?? layerAlpha;
  const drawSparks = opts?.drawSparks !== false;

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = layerAlpha;

  if (opts?.glowX != null && opts.glowY != null) {
    drawAmbientGlow(ctx, opts.glowX, opts.glowY, fireIntensity * glowScale, elapsedSec);
  }

  updateAndDrawSmokes(
    ctx,
    bags,
    dt,
    elapsedSec,
    Math.max(fireIntensity, smokeFloor)
  );

  opts?.beforeFlames?.();

  updateAndDrawAshes(ctx, bags, dt, elapsedSec);

  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = flameAlpha;
  updateAndDrawFlames(ctx, bags, dt, elapsedSec);
  if (drawSparks) updateAndDrawSparks(ctx, bags, dt, elapsedSec);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  opts?.afterLayers?.();
}

export function scheduleBurnWatchdog(
  timeouts: number[],
  finishMs: number,
  finish: () => void,
  guards: { doneRef: { current: boolean }; abortedRef: { current: boolean } }
): void {
  timeouts.push(
    window.setTimeout(() => {
      if (guards.abortedRef.current || guards.doneRef.current) return;
      finish();
    }, finishMs + 400)
  );
}
