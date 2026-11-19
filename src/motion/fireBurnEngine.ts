/**
 * Fractal-noise burn front + particle layers (flames / smoke / sparks / ash).
 * Compatibility barrel — implementation lives under `./fire/`.
 */

export { FIRE_BUDGET, FLAME_PATH_D } from './fire/budget';
export { FractalNoise2D } from './fire/noise';
export { buildBurnMap } from './fire/burnMap';
export {
  applyBurnFront,
  type BurnFrontMode,
  type BurnFrontResult,
} from './fire/burnFront';
export {
  cssVar,
  getFirePalette,
  refreshFirePalette,
  rgbaFire,
  type FirePalette,
  type FireRgb,
} from './fire/palette';
export {
  createBurnButtonSnapshot,
  createRegionBurnSnapshot,
  type BurnSnapshot,
  type ButtonSnapshot,
} from './fire/snapshots';
export {
  createParticleBags,
  drawAmbientGlow,
  hasLiveParticles,
  seedIgnitionBurst,
  spawnAsh,
  spawnFlame,
  spawnFromEmberEdge,
  spawnSmoke,
  spawnSpark,
  updateAndDrawAshes,
  updateAndDrawFlames,
  updateAndDrawSmokes,
  updateAndDrawSparks,
  type AshParticle,
  type FlameParticle,
  type ParticleBags,
  type SmokeParticle,
  type SparkParticle,
} from './fire/particles';
export {
  BURN_FRONT_DURATION_RATIO,
  burnFrontFromElapsed,
  burnFrontProgress,
  clampDt,
  drawEndVeil,
  drawParticleLayers,
  ensureFullscreenCanvas,
  fireIntensityFrom,
  layerAlphaFromElapsed,
  scheduleBurnWatchdog,
  smoothstep01,
  type DrawParticleLayersOpts,
} from './fire/burnFrame';
export {
  prepareBurnWorkTarget,
  type BurnWorkTarget,
  type PrepareBurnWorkTargetInput,
} from './fire/burnTargetSetup';
export {
  seedExtinguishBurst,
  seedSecondaryExtinguish,
  type ParticleOrigin,
} from './fire/extinguishSeeds';
export {
  maybeFeedBurnParticles,
  type MidBurnFeedOpts,
  type MidBurnFeedState,
} from './fire/midBurnFeed';
