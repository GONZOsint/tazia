/**
 * Fractal-noise burn front + particle layers (flames / smoke / sparks / ash).
 * Ported from the reference incineration demo for session BurnFireOverlay.
 */

export const FIRE_BUDGET = {
  flames: 120,
  smokes: 60,
  sparks: 70,
  ashes: 40,
  maxDpr: 1.75,
} as const;

/** Lucide-like filled flame path in 24×24 viewBox (for offscreen button snapshot). */
export const FLAME_PATH_D =
  'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z';

export class FractalNoise2D {
  private readonly s1: number;
  private readonly s2: number;
  private readonly s3: number;
  private readonly s4: number;
  private readonly octaves: Array<{ gw: number; gh: number; data: Float32Array }>;

  constructor(width: number, height: number, pixelRatio: number) {
    this.s1 = 34 * pixelRatio;
    this.s2 = 16 * pixelRatio;
    this.s3 = 7 * pixelRatio;
    this.s4 = 3 * pixelRatio;
    this.octaves = [
      this.createGrid(Math.ceil(width / this.s1) + 3, Math.ceil(height / this.s1) + 3),
      this.createGrid(Math.ceil(width / this.s2) + 3, Math.ceil(height / this.s2) + 3),
      this.createGrid(Math.ceil(width / this.s3) + 3, Math.ceil(height / this.s3) + 3),
      this.createGrid(Math.ceil(width / this.s4) + 3, Math.ceil(height / this.s4) + 3),
    ];
  }

  private createGrid(gw: number, gh: number) {
    const data = new Float32Array(gw * gh);
    for (let i = 0; i < data.length; i++) data[i] = Math.random();
    return { gw, gh, data };
  }

  private sampleGrid(
    grid: { gw: number; gh: number; data: Float32Array },
    x: number,
    y: number,
    scale: number
  ): number {
    const gx = x / scale;
    const gy = y / scale;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const sx = gx - x0;
    const sy = gy - y0;
    const u = sx * sx * (3 - 2 * sx);
    const v = sy * sy * (3 - 2 * sy);
    const idx00 = y0 * grid.gw + x0;
    const idx10 = y0 * grid.gw + x1;
    const idx01 = y1 * grid.gw + x0;
    const idx11 = y1 * grid.gw + x1;
    const n0 = grid.data[idx00]! * (1 - u) + grid.data[idx10]! * u;
    const n1 = grid.data[idx01]! * (1 - u) + grid.data[idx11]! * u;
    return n0 * (1 - v) + n1 * v;
  }

  getValue(x: number, y: number): number {
    return (
      this.sampleGrid(this.octaves[0]!, x, y, this.s1) * 0.5 +
      this.sampleGrid(this.octaves[1]!, x, y, this.s2) * 0.26 +
      this.sampleGrid(this.octaves[2]!, x, y, this.s3) * 0.15 +
      this.sampleGrid(this.octaves[3]!, x, y, this.s4) * 0.09
    );
  }
}

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

  const corners: Array<[number, number]> = [
    [0, 0],
    [pxW, 0],
    [0, pxH],
    [pxW, pxH],
  ];
  let maxDist = 1;
  for (const [cx, cy] of corners) {
    const d = Math.hypot(cx - igX, cy - igY);
    if (d > maxDist) maxDist = d;
  }

  let minVal = Infinity;
  let maxVal = -Infinity;

  for (let y = 0; y < pxH; y++) {
    for (let x = 0; x < pxW; x++) {
      const idx = y * pxW + x;
      const distNorm = Math.hypot(x - igX, y - igY) / maxDist;
      const n = noise.getValue(x, y);
      noiseCache[idx] = n;
      const val = Math.pow(distNorm, 0.85) * 0.72 + n * 0.28;
      burnMap[idx] = val;
      if (alphaMask[idx * 4 + 3]! > 10) {
        if (val < minVal) minVal = val;
        if (val > maxVal) maxVal = val;
      }
    }
  }

  const range = Math.max(0.001, maxVal - minVal);
  for (let i = 0; i < total; i++) {
    burnMap[i] = (burnMap[i]! - minVal) / range;
  }

  return { burnMap, noiseCache };
}

export interface FlameParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  phase: number;
  freq: number;
}

export interface SmokeParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  maxSize: number;
  life: number;
  maxLife: number;
  alpha: number;
  phase: number;
}

export interface SparkParticle {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  flicker: number;
}

export interface AshParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vRot: number;
  life: number;
  maxLife: number;
  hasEmber: boolean;
}

export interface ParticleBags {
  flames: FlameParticle[];
  smokes: SmokeParticle[];
  sparks: SparkParticle[];
  ashes: AshParticle[];
}

export function createParticleBags(): ParticleBags {
  return { flames: [], smokes: [], sparks: [], ashes: [] };
}

export function spawnFlame(bags: ParticleBags, x: number, y: number, intensity = 1): void {
  if (bags.flames.length >= FIRE_BUDGET.flames) return;
  bags.flames.push({
    x: x + (Math.random() - 0.5) * 6,
    y: y + (Math.random() - 0.5) * 4,
    vx: (Math.random() - 0.5) * 28,
    vy: -(50 + Math.random() * 100) * intensity,
    size: (8 + Math.random() * 14) * intensity,
    life: 0,
    maxLife: 0.35 + Math.random() * 0.45,
    phase: Math.random() * Math.PI * 2,
    freq: 6 + Math.random() * 6,
  });
}

export function spawnSmoke(bags: ParticleBags, x: number, y: number): void {
  if (bags.smokes.length >= FIRE_BUDGET.smokes) return;
  bags.smokes.push({
    x: x + (Math.random() - 0.5) * 10,
    y: y - 4,
    vx: (Math.random() - 0.5) * 18,
    vy: -(24 + Math.random() * 38),
    size: 12 + Math.random() * 16,
    maxSize: 44 + Math.random() * 54,
    life: 0,
    maxLife: 1.4 + Math.random() * 1.4,
    alpha: 0.16 + Math.random() * 0.14,
    phase: Math.random() * Math.PI * 2,
  });
}

export function spawnSpark(bags: ParticleBags, x: number, y: number): void {
  if (bags.sparks.length >= FIRE_BUDGET.sparks) return;
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.45;
  const speed = 75 + Math.random() * 165;
  bags.sparks.push({
    x,
    y,
    prevX: x,
    prevY: y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    size: 1 + Math.random() * 1.6,
    life: 0,
    maxLife: 0.38 + Math.random() * 0.68,
    flicker: Math.random() * 10,
  });
}

export function spawnAsh(bags: ParticleBags, x: number, y: number): void {
  if (bags.ashes.length >= FIRE_BUDGET.ashes) return;
  bags.ashes.push({
    x,
    y,
    vx: (Math.random() - 0.5) * 28,
    vy: -(16 + Math.random() * 32),
    w: 2.5 + Math.random() * 4,
    h: 1.5 + Math.random() * 2.8,
    rot: Math.random() * Math.PI * 2,
    vRot: (Math.random() - 0.5) * 6,
    life: 0,
    maxLife: 1.4 + Math.random() * 1.2,
    hasEmber: Math.random() < 0.3,
  });
}

export function spawnFromEmberEdge(
  bags: ParticleBags,
  emberPoints: number[],
  opts?: { flameBudget?: number }
): void {
  const count = emberPoints.length / 2;
  if (count <= 0) return;
  const flameBudget =
    opts?.flameBudget ?? Math.min(8, Math.max(2, Math.ceil(count / 14)));
  for (let k = 0; k < flameBudget; k++) {
    const pick = Math.floor(Math.random() * count) * 2;
    spawnFlame(
      bags,
      emberPoints[pick]!,
      emberPoints[pick + 1]!,
      0.82 + Math.random() * 0.45
    );
  }
  if (Math.random() < 0.75) {
    const pick = Math.floor(Math.random() * count) * 2;
    spawnSmoke(bags, emberPoints[pick]!, emberPoints[pick + 1]!);
  }
  if (Math.random() < 0.8) {
    const pick = Math.floor(Math.random() * count) * 2;
    spawnSpark(bags, emberPoints[pick]!, emberPoints[pick + 1]!);
  }
  if (Math.random() < 0.45) {
    const pick = Math.floor(Math.random() * count) * 2;
    spawnAsh(bags, emberPoints[pick]!, emberPoints[pick + 1]!);
  }
}

export function seedIgnitionBurst(bags: ParticleBags, x: number, y: number): void {
  for (let i = 0; i < 18; i++) spawnFlame(bags, x, y, 0.95);
  for (let i = 0; i < 14; i++) spawnSpark(bags, x, y);
  for (let i = 0; i < 5; i++) spawnSmoke(bags, x, y);
}

export function hasLiveParticles(bags: ParticleBags): boolean {
  return (
    bags.flames.length > 0 ||
    bags.smokes.length > 0 ||
    bags.sparks.length > 0 ||
    bags.ashes.length > 0
  );
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.min(r, w / 2, h / 2);
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + w - radius, y);
  context.quadraticCurveTo(x + w, y, x + w, y + radius);
  context.lineTo(x + w, y + h - radius);
  context.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  context.lineTo(x + radius, y + h);
  context.quadraticCurveTo(x, y + h, x, y + h - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export interface ButtonSnapshot {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  pxW: number;
  pxH: number;
  cssW: number;
  cssH: number;
  pad: number;
  radius: number;
  origPixels: Uint8ClampedArray;
}

/** Paint a danger/fire burn-control lookalike for pixel incineration. */
export function createBurnButtonSnapshot(
  rect: DOMRect,
  dpr: number,
  labelText?: string | null
): ButtonSnapshot | null {
  const pad = 4;
  const cssW = rect.width + pad * 2;
  const cssH = rect.height + pad * 2;
  if (cssW < 8 || cssH < 8) return null;

  const pxW = Math.max(1, Math.round(cssW * dpr));
  const pxH = Math.max(1, Math.round(cssH * dpr));
  const off = document.createElement('canvas');
  off.width = pxW;
  off.height = pxH;
  const octx = off.getContext('2d');
  if (!octx) return null;
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const bx = pad;
  const by = pad;
  const bw = rect.width;
  const bh = rect.height;
  const radius = 10; // --radius-ctrl

  const dangerBg = cssVar('--color-danger-bg', '#3a1810');
  const dangerBorder = cssVar('--color-danger-border', '#a84a2e');
  const fireMid = cssVar('--fire-mid', '#c9780a');
  const fireEdge = cssVar('--fire-edge', '#9a4f0a');
  const fireCore = cssVar('--fire-core', '#e8b84a');
  const dangerInk = cssVar('--color-danger-ink', '#ffd4c4');

  const grad = octx.createLinearGradient(bx, by, bx + bw, by + bh);
  grad.addColorStop(0, dangerBg);
  grad.addColorStop(0.45, fireEdge);
  grad.addColorStop(1, fireMid);

  roundedRectPath(octx, bx, by, bw, bh, radius);
  octx.fillStyle = grad;
  octx.fill();

  octx.lineWidth = 1.25;
  octx.strokeStyle = dangerBorder;
  roundedRectPath(octx, bx, by, bw, bh, radius);
  octx.stroke();

  // Flame icon (left / centered when icon-only)
  const iconSize = 16;
  const hasLabel = Boolean(labelText && labelText.trim() && bw > 56);
  const iconX = hasLabel ? bx + 12 : bx + (bw - iconSize) / 2;
  const iconY = by + (bh - iconSize) / 2;
  if (typeof Path2D !== 'undefined') {
    const path = new Path2D(FLAME_PATH_D);
    octx.save();
    octx.translate(iconX, iconY);
    octx.scale(iconSize / 24, iconSize / 24);
    octx.fillStyle = fireCore;
    octx.fill(path);
    octx.restore();
  }

  if (hasLabel) {
    octx.fillStyle = dangerInk;
    octx.font = '600 12px "IBM Plex Sans", system-ui, sans-serif';
    octx.textAlign = 'left';
    octx.textBaseline = 'middle';
    octx.fillText(labelText!.trim(), iconX + iconSize + 8, by + bh / 2 + 0.5);
  }

  const imageData = octx.getImageData(0, 0, pxW, pxH);
  return {
    canvas: off,
    ctx: octx,
    pxW,
    pxH,
    cssW,
    cssH,
    pad,
    radius,
    origPixels: new Uint8ClampedArray(imageData.data),
  };
}

export interface BurnFrontResult {
  remainingButtonPixels: number;
  activeEmberCount: number;
  emberPoints: number[];
}

/** Advance the incineration front one frame into workPixels. */
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
  } = opts;

  let remainingButtonPixels = 0;
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
        remainingButtonPixels++;
      } else if (diff < -0.025) {
        const scorch = (diff + 0.17) / 0.145;
        const inv = 1 - scorch;
        workPixels[p] = origPixels[p]! * inv + 52 * scorch * inv + 18 * scorch;
        workPixels[p + 1] = origPixels[p + 1]! * inv * 0.78 + 26 * scorch * inv + 12 * scorch;
        workPixels[p + 2] = origPixels[p + 2]! * inv * 0.35 + 8 * scorch;
        workPixels[p + 3] = origA;
        remainingButtonPixels++;
      } else if (diff < 0.006) {
        workPixels[p] = 16;
        workPixels[p + 1] = 11;
        workPixels[p + 2] = 9;
        workPixels[p + 3] = origA;
        remainingButtonPixels++;
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
        activeEmberCount++;
        remainingButtonPixels++;

        if (emberPoints.length < 180 || Math.random() < 0.05) {
          emberPoints.push(screenLeft + x / dpr, screenTop + y / dpr);
        }
      } else {
        workPixels[p + 3] = 0;
      }
    }
  }

  return { remainingButtonPixels, activeEmberCount, emberPoints };
}

export function updateAndDrawSmokes(
  ctx: CanvasRenderingContext2D,
  bags: ParticleBags,
  dt: number,
  elapsed: number,
  fireIntensity: number
): void {
  for (let i = bags.smokes.length - 1; i >= 0; i--) {
    const s = bags.smokes[i]!;
    s.life += dt;
    if (s.life >= s.maxLife) {
      bags.smokes.splice(i, 1);
      continue;
    }
    const p = s.life / s.maxLife;
    s.vx += Math.sin(elapsed * 3 + s.phase) * 14 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vy *= 0.992;

    const curSize = s.size + (s.maxSize - s.size) * Math.pow(p, 0.7);
    const fadeIn = Math.min(1, p * 5);
    const fadeOut = Math.pow(1 - p, 1.5);
    const alpha = s.alpha * fadeIn * fadeOut;
    const warmth = Math.max(0, 1 - p * 3.5) * fireIntensity;
    const r = Math.round(36 + warmth * 95);
    const g = Math.round(34 + warmth * 35);
    const b = 38;

    const grad = ctx.createRadialGradient(s.x, s.y, curSize * 0.1, s.x, s.y, curSize);
    grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
    grad.addColorStop(0.6, `rgba(26, 26, 30, ${alpha * 0.5})`);
    grad.addColorStop(1, 'rgba(20, 20, 24, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(s.x, s.y, curSize, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function updateAndDrawAshes(
  ctx: CanvasRenderingContext2D,
  bags: ParticleBags,
  dt: number,
  elapsed: number
): void {
  for (let i = bags.ashes.length - 1; i >= 0; i--) {
    const a = bags.ashes[i]!;
    a.life += dt;
    if (a.life >= a.maxLife) {
      bags.ashes.splice(i, 1);
      continue;
    }
    const p = a.life / a.maxLife;
    a.vy += (p > 0.45 ? 42 : -12) * dt;
    a.vx += Math.sin(elapsed * 5 + a.rot) * 25 * dt;
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.rot += a.vRot * dt;

    const alpha = (1 - Math.pow(p, 2)) * 0.85;
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.rot);
    ctx.fillStyle = `rgba(38, 36, 36, ${alpha})`;
    ctx.fillRect(-a.w / 2, -a.h / 2, a.w, a.h);
    if (a.hasEmber && p < 0.45) {
      ctx.fillStyle = `rgba(255, 95, 20, ${(1 - p / 0.45) * 0.9})`;
      ctx.fillRect(-a.w / 2, -a.h / 2, a.w * 0.5, a.h);
    }
    ctx.restore();
  }
}

export function updateAndDrawFlames(
  ctx: CanvasRenderingContext2D,
  bags: ParticleBags,
  dt: number,
  elapsed: number
): void {
  for (let i = bags.flames.length - 1; i >= 0; i--) {
    const f = bags.flames[i]!;
    f.life += dt;
    if (f.life >= f.maxLife) {
      bags.flames.splice(i, 1);
      continue;
    }
    const p = f.life / f.maxLife;
    f.vx += Math.sin(elapsed * f.freq + f.phase) * 90 * dt;
    f.vx *= 0.96;
    f.vy -= 45 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;

    const scale = 1 - p * 0.65;
    const radius = f.size * scale;
    const alpha = Math.sin(Math.min(1, p * 4) * (Math.PI / 2)) * (1 - p);

    let c0: string;
    let c1: string;
    if (p < 0.3) {
      c0 = `rgba(255, 250, 200, ${alpha * 0.92})`;
      c1 = `rgba(255, 165, 30, ${alpha * 0.68})`;
    } else if (p < 0.65) {
      c0 = `rgba(255, 140, 20, ${alpha * 0.78})`;
      c1 = `rgba(255, 55, 0, ${alpha * 0.48})`;
    } else {
      c0 = `rgba(230, 45, 0, ${alpha * 0.58})`;
      c1 = `rgba(140, 15, 0, ${alpha * 0.25})`;
    }

    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(Math.atan2(f.vx, -f.vy) * 0.45);
    ctx.scale(0.72, 1.45);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
    grad.addColorStop(0, c0);
    grad.addColorStop(0.5, c1);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export function updateAndDrawSparks(
  ctx: CanvasRenderingContext2D,
  bags: ParticleBags,
  dt: number,
  elapsed: number
): void {
  for (let i = bags.sparks.length - 1; i >= 0; i--) {
    const sp = bags.sparks[i]!;
    sp.life += dt;
    if (sp.life >= sp.maxLife) {
      bags.sparks.splice(i, 1);
      continue;
    }
    const p = sp.life / sp.maxLife;
    sp.prevX = sp.x;
    sp.prevY = sp.y;
    sp.vx += (Math.random() - 0.5) * 180 * dt;
    sp.vy += 85 * dt;
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;

    const twinkle = 0.6 + 0.4 * Math.sin(elapsed * 45 + sp.flicker);
    const alpha = (1 - p) * twinkle;
    ctx.strokeStyle =
      p < 0.4 ? `rgba(255, 225, 140, ${alpha})` : `rgba(255, 95, 15, ${alpha})`;
    ctx.lineWidth = sp.size;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sp.prevX, sp.prevY);
    ctx.lineTo(sp.x, sp.y);
    ctx.stroke();
  }
}

export function drawAmbientGlow(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  fireIntensity: number,
  elapsed: number
): void {
  if (fireIntensity <= 0.01) return;
  const flickerGlow = 0.85 + 0.15 * Math.sin(elapsed * 19) * Math.cos(elapsed * 11);
  const glowRadius = 250 * (0.7 + 0.3 * fireIntensity);
  const ambient = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, glowRadius);
  ambient.addColorStop(0, `rgba(255, 115, 25, ${0.28 * fireIntensity * flickerGlow})`);
  ambient.addColorStop(0.45, `rgba(220, 52, 8, ${0.12 * fireIntensity * flickerGlow})`);
  ambient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = ambient;
  ctx.fillRect(centerX - glowRadius, centerY - glowRadius, glowRadius * 2, glowRadius * 2);
}
