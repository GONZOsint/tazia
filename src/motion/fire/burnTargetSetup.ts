import { buildBurnMap } from './burnMap';
import { FractalNoise2D } from './noise';
import type { BurnSnapshot } from './snapshots';

export type BurnWorkTarget = {
  snap: BurnSnapshot;
  burnMap: Float32Array;
  noiseCache: Float32Array;
  workImageData: ImageData;
  workCanvas: HTMLCanvasElement;
  workCtx: CanvasRenderingContext2D;
  snapDpr: number;
  /** Frozen at ignition — DOM collapse must not move the canvas draw. */
  screenLeft: number;
  screenTop: number;
  glowX: number;
  glowY: number;
};

export type PrepareBurnWorkTargetInput = {
  snap: BurnSnapshot;
  /** Element/button rect at ignition (CSS pixels). */
  screenRect: { left: number; top: number; width: number; height: number };
  /** Ignition point in snapshot pixel space. */
  igniteX: number;
  igniteY: number;
  /** Glow center offset from rect mid (default -12). */
  glowYOffset?: number;
};

/**
 * Shared work-canvas + burn-map freeze for RegionAsh and BurnFire overlays.
 */
export function prepareBurnWorkTarget(
  input: PrepareBurnWorkTargetInput
): BurnWorkTarget | null {
  const { snap, screenRect, igniteX, igniteY, glowYOffset = -12 } = input;
  const snapDpr = snap.pxW / snap.cssW;
  const noise = new FractalNoise2D(snap.pxW, snap.pxH, snapDpr);
  const built = buildBurnMap(snap.pxW, snap.pxH, igniteX, igniteY, noise, snap.origPixels);
  const workCanvas = document.createElement('canvas');
  workCanvas.width = snap.pxW;
  workCanvas.height = snap.pxH;
  const workCtx = workCanvas.getContext('2d');
  if (!workCtx) return null;
  return {
    snap,
    burnMap: built.burnMap,
    noiseCache: built.noiseCache,
    workImageData: workCtx.createImageData(snap.pxW, snap.pxH),
    workCanvas,
    workCtx,
    snapDpr,
    screenLeft: screenRect.left - snap.pad,
    screenTop: screenRect.top - snap.pad,
    glowX: screenRect.left + screenRect.width / 2,
    glowY: screenRect.top + screenRect.height / 2 + glowYOffset,
  };
}
