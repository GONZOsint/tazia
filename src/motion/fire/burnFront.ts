const EMBER_POINTS_CAP = 180;

export type BurnFrontMode = 'burn' | 'extinguish';

export interface BurnFrontResult {
  /** Visible stage pixels still on-screen (unburned / scorched / ember). */
  remainingPixels: number;
  /** @deprecated Prefer remainingPixels — kept for existing call sites. */
  remainingButtonPixels: number;
  activeEmberCount: number;
  emberPoints: number[];
}

/** Advance the incineration / extinguish front one frame into workPixels. */
export function applyBurnFront(opts: {
  pxW: number;
  pxH: number;
  dpr: number;
  front: number;
  elapsed: number;
  origPixels: Uint8ClampedArray;
  workPixels: Uint8ClampedArray;
  burnMap: Float32Array;
  noiseCache: Float32Array;
  screenLeft: number;
  screenTop: number;
  /** burn = hot consume; extinguish = cool fade / douse. */
  mode?: BurnFrontMode;
}): BurnFrontResult {
  const {
    pxW,
    pxH,
    dpr,
    front,
    elapsed,
    origPixels,
    workPixels,
    burnMap,
    noiseCache,
    screenLeft,
    screenTop,
    mode = 'burn',
  } = opts;
  const extinguish = mode === 'extinguish';

  let remainingPixels = 0;
  let activeEmberCount = 0;
  const emberPoints: number[] = [];

  for (let y = 0; y < pxH; y++) {
    for (let x = 0; x < pxW; x++) {
      const i = y * pxW + x;
      const p = i * 4;
      const origA = origPixels[p + 3]!;

      if (origA === 0) {
        workPixels[p + 3] = 0;
        continue;
      }

      const diff = front - burnMap[i]!;

      if (diff < -0.17) {
        workPixels[p] = origPixels[p]!;
        workPixels[p + 1] = origPixels[p + 1]!;
        workPixels[p + 2] = origPixels[p + 2]!;
        workPixels[p + 3] = origA;
        remainingPixels++;
      } else if (diff < -0.025) {
        const scorch = (diff + 0.17) / 0.145;
        const inv = 1 - scorch;
        if (extinguish) {
          // Cool grey / blue ash — douse, not orange scorch.
          workPixels[p] = origPixels[p]! * inv + 38 * scorch * inv + 22 * scorch;
          workPixels[p + 1] = origPixels[p + 1]! * inv * 0.82 + 42 * scorch * inv + 28 * scorch;
          workPixels[p + 2] = origPixels[p + 2]! * inv * 0.9 + 58 * scorch * inv + 40 * scorch;
          workPixels[p + 3] = origA * (1 - scorch * 0.35);
        } else {
          workPixels[p] = origPixels[p]! * inv + 52 * scorch * inv + 18 * scorch;
          workPixels[p + 1] = origPixels[p + 1]! * inv * 0.78 + 26 * scorch * inv + 12 * scorch;
          workPixels[p + 2] = origPixels[p + 2]! * inv * 0.35 + 8 * scorch;
          workPixels[p + 3] = origA;
        }
        remainingPixels++;
      } else if (diff < 0.006) {
        if (extinguish) {
          workPixels[p] = 28;
          workPixels[p + 1] = 30;
          workPixels[p + 2] = 36;
          workPixels[p + 3] = origA * 0.55;
        } else {
          workPixels[p] = 16;
          workPixels[p + 1] = 11;
          workPixels[p + 2] = 9;
          workPixels[p + 3] = origA;
        }
        remainingPixels++;
      } else if (diff < 0.056) {
        const heat = 1 - (diff - 0.006) / 0.05;
        const flicker =
          0.75 +
          0.25 * Math.sin(elapsed * 22 + (x / dpr) * 0.35 + (y / dpr) * 0.25) +
          (noiseCache[i]! - 0.5) * 0.3;
        const hVal = Math.max(0, Math.min(1, heat * flicker));

        let r: number;
        let g: number;
        let b: number;
        if (extinguish) {
          // Dying ember — desaturated amber → cool smoke grey.
          if (hVal > 0.55) {
            r = 160 + (hVal - 0.55) * 80;
            g = 120 + (hVal - 0.55) * 40;
            b = 70 + (hVal - 0.55) * 60;
          } else {
            r = 70 + (hVal / 0.55) * 70;
            g = 68 + (hVal / 0.55) * 40;
            b = 72 + (hVal / 0.55) * 20;
          }
          workPixels[p] = Math.min(255, r);
          workPixels[p + 1] = Math.min(255, g);
          workPixels[p + 2] = Math.min(255, b);
          workPixels[p + 3] = origA * Math.min(0.85, heat * 0.9);
        } else {
          if (hVal > 0.72) {
            r = 255;
            g = 225 + (hVal - 0.72) * 110;
            b = 120 + (hVal - 0.72) * 480;
          } else if (hVal > 0.35) {
            r = 255;
            g = 62 + ((hVal - 0.35) / 0.37) * 163;
            b = 10;
          } else {
            r = 92 + (hVal / 0.35) * 163;
            g = 12 + (hVal / 0.35) * 50;
            b = 4;
          }
          workPixels[p] = Math.min(255, r);
          workPixels[p + 1] = Math.min(255, g);
          workPixels[p + 2] = Math.min(255, b);
          workPixels[p + 3] = origA * Math.min(1, heat * 1.4);
        }
        activeEmberCount++;
        remainingPixels++;

        // Hard cap — never grow unbounded across frames.
        if (emberPoints.length < EMBER_POINTS_CAP) {
          emberPoints.push(screenLeft + x / dpr, screenTop + y / dpr);
        }
      } else {
        workPixels[p + 3] = 0;
      }
    }
  }

  return {
    remainingPixels,
    remainingButtonPixels: remainingPixels,
    activeEmberCount,
    emberPoints,
  };
}
