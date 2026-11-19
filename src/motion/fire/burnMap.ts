import type { FractalNoise2D } from './noise';

export function buildBurnMap(
  pxW: number,
  pxH: number,
  igX: number,
  igY: number,
  noise: FractalNoise2D,
  alphaMask: Uint8ClampedArray
): { burnMap: Float32Array; noiseCache: Float32Array } {
  const total = pxW * pxH;
  const burnMap = new Float32Array(total);
  const noiseCache = new Float32Array(total);

  // Inclusive last-pixel corners (avoid maxDist bias past the bitmap).
  const maxX = Math.max(0, pxW - 1);
  const maxY = Math.max(0, pxH - 1);
  const corners: Array<[number, number]> = [
    [0, 0],
    [maxX, 0],
    [0, maxY],
    [maxX, maxY],
  ];
  let maxDist = 1;
  for (const [cx, cy] of corners) {
    const d = Math.hypot(cx - igX, cy - igY);
    if (d > maxDist) maxDist = d;
  }

  let minVal = Infinity;
  let maxVal = -Infinity;
  let opaqueSamples = 0;

  for (let y = 0; y < pxH; y++) {
    for (let x = 0; x < pxW; x++) {
      const idx = y * pxW + x;
      const distNorm = Math.hypot(x - igX, y - igY) / maxDist;
      const n = noise.getValue(x, y);
      noiseCache[idx] = n;
      const val = Math.pow(distNorm, 0.85) * 0.72 + n * 0.28;
      burnMap[idx] = val;
      if (alphaMask[idx * 4 + 3]! > 10) {
        opaqueSamples++;
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
    }
  }

  // No opaque mask samples → skip normalize (avoids Infinity/NaN washout).
  if (opaqueSamples === 0 || !Number.isFinite(minVal) || !Number.isFinite(maxVal)) {
    return { burnMap, noiseCache };
  }

  const range = Math.max(0.001, maxVal - minVal);
  for (let i = 0; i < total; i++) {
    burnMap[i] = (burnMap[i]! - minVal) / range;
  }

  return { burnMap, noiseCache };
}
