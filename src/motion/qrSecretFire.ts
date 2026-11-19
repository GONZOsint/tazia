/**
 * Subtle perimeter fire line for the invite QR when the phrase is in the link.
 * Ported from the invite/QR reference demo (symmetric ignite + micro embers).
 */

import { getFirePalette, refreshFirePalette, rgbaFire } from './fireBurnEngine';

export const QR_SECRET_FIRE = {
  maxFlames: 28,
  maxSparks: 14,
  maxDpr: 2,
  pad: 32,
  /** Keep particles outside the QR face so they never look like modules escaping. */
  innerCull: 4,
} as const;

export type PerimeterPoint = {
  x: number;
  y: number;
  nx: number;
  ny: number;
};

type Flame = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  phase: number;
};

type Spark = {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
};

export type QrSecretFireGeom = {
  /** CSS pixel size of the square canvas. */
  canvasSize: number;
  /** Top-left of the rounded rect in canvas CSS coords. */
  lineOffset: number;
  /** Width/height of the rounded rect. */
  lineSize: number;
  /** Corner radius matching the QR card. */
  lineRadius: number;
};

/** t=0 starts at top-center for a symmetric ignite. */
export function getPerimeterPoint(
  t: number,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): PerimeterPoint {
  t = ((t % 1) + 1) % 1;
  const sw = w - 2 * r;
  const sh = h - 2 * r;
  const halfSw = sw / 2;
  const arc = (Math.PI / 2) * r;
  const total = 2 * sw + 2 * sh + 4 * arc;
  let d = t * total;

  if (d <= halfSw) return { x: x + w / 2 + d, y, nx: 0, ny: -1 };
  d -= halfSw;

  if (d <= arc) {
    const a = -Math.PI / 2 + d / r;
    return {
      x: x + w - r + Math.cos(a) * r,
      y: y + r + Math.sin(a) * r,
      nx: Math.cos(a),
      ny: Math.sin(a),
    };
  }
  d -= arc;

  if (d <= sh) return { x: x + w, y: y + r + d, nx: 1, ny: 0 };
  d -= sh;

  if (d <= arc) {
    const a = d / r;
    return {
      x: x + w - r + Math.cos(a) * r,
      y: y + h - r + Math.sin(a) * r,
      nx: Math.cos(a),
      ny: Math.sin(a),
    };
  }
  d -= arc;

  if (d <= sw) return { x: x + w - r - d, y: y + h, nx: 0, ny: 1 };
  d -= sw;

  if (d <= arc) {
    const a = Math.PI / 2 + d / r;
    return {
      x: x + r + Math.cos(a) * r,
      y: y + h - r + Math.sin(a) * r,
      nx: Math.cos(a),
      ny: Math.sin(a),
    };
  }
  d -= arc;

  if (d <= sh) return { x, y: y + h - r - d, nx: -1, ny: 0 };
  d -= sh;

  if (d <= arc) {
    const a = Math.PI + d / r;
    return {
      x: x + r + Math.cos(a) * r,
      y: y + r + Math.sin(a) * r,
      nx: Math.cos(a),
      ny: Math.sin(a),
    };
  }
  d -= arc;

  return { x: x + r + d, y, nx: 0, ny: -1 };
}

export function geomForQrSurface(surfaceCss: number, radiusCss = 10): QrSecretFireGeom {
  const pad = QR_SECRET_FIRE.pad;
  return {
    canvasSize: surfaceCss + pad * 2,
    lineOffset: pad,
    lineSize: surfaceCss,
    lineRadius: radiusCss,
  };
}

export class QrSecretFireController {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private geom: QrSecretFireGeom;
  private fireOn = false;
  private firePower = 0;
  private igniteSweep = 0;
  private flames: Flame[] = [];
  private sparks: Spark[] = [];
  private raf = 0;
  private lastTs = 0;
  private elapsed = 0;
  private disposed = false;

  constructor(canvas: HTMLCanvasElement, geom: QrSecretFireGeom) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2d context unavailable');
    this.canvas = canvas;
    this.ctx = ctx;
    this.geom = geom;
    refreshFirePalette();
    this.resize();
  }

  setGeom(geom: QrSecretFireGeom) {
    this.geom = geom;
    this.resize();
  }

  setFireOn(on: boolean) {
    this.fireOn = on;
    if (on) refreshFirePalette();
    if (on || this.firePower > 0.01 || this.flames.length || this.sparks.length) {
      this.ensureLoop();
    }
  }

  dispose() {
    this.disposed = true;
    this.fireOn = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.flames.length = 0;
    this.sparks.length = 0;
    this.ctx.clearRect(0, 0, this.geom.canvasSize, this.geom.canvasSize);
  }

  private resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, QR_SECRET_FIRE.maxDpr);
    const css = this.geom.canvasSize;
    this.canvas.width = Math.round(css * dpr);
    this.canvas.height = Math.round(css * dpr);
    this.canvas.style.width = `${css}px`;
    this.canvas.style.height = `${css}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private ensureLoop() {
    if (this.disposed || this.raf) return;
    this.lastTs = performance.now();
    this.raf = requestAnimationFrame((t) => this.tick(t));
  }

  /** True when a point sits over the QR card interior (not the outer fire rim). */
  private isInsideCard(x: number, y: number): boolean {
    const { lineOffset: ox, lineSize: s } = this.geom;
    const pad = QR_SECRET_FIRE.innerCull;
    return x > ox + pad && x < ox + s - pad && y > ox + pad && y < ox + s - pad;
  }

  private spawnEmber(pt: PerimeterPoint, power: number) {
    // Spawn outside the rim; velocity is outward-only so bits never drift over modules.
    const outward = 10 + Math.random() * 14;
    const tangent = (Math.random() - 0.5) * 5;
    this.flames.push({
      x: pt.x + pt.nx * 2.4,
      y: pt.y + pt.ny * 2.4,
      vx: pt.nx * outward - pt.ny * tangent,
      vy: pt.ny * outward + pt.nx * tangent,
      size: (1.6 + Math.random() * 2.2) * (0.65 + 0.35 * power),
      life: 0,
      maxLife: 0.18 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
    });
  }

  private spawnSpark(pt: PerimeterPoint) {
    const outward = 16 + Math.random() * 22;
    const tangent = (Math.random() - 0.5) * 8;
    const x = pt.x + pt.nx * 1.6;
    const y = pt.y + pt.ny * 1.6;
    this.sparks.push({
      x,
      y,
      prevX: x,
      prevY: y,
      vx: pt.nx * outward - pt.ny * tangent,
      vy: pt.ny * outward + pt.nx * tangent,
      size: 0.6 + Math.random() * 0.55,
      life: 0,
      maxLife: 0.18 + Math.random() * 0.22,
    });
  }

  private drawFireSegment(tStart: number, tEnd: number, segmentsCount: number, power: number, time: number) {
    const { lineOffset: ox, lineSize: s, lineRadius: r } = this.geom;
    const ctx = this.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const pts: Array<{ x: number; y: number; heat: number }> = [];
    for (let i = 0; i <= segmentsCount; i++) {
      const u = i / segmentsCount;
      const t = tStart + (tEnd - tStart) * u;
      const pt = getPerimeterPoint(t, ox, ox, s, s, r);
      // Wave only outward so the filament never dips into QR modules.
      const microWave =
        Math.abs(Math.sin(t * Math.PI * 24 - time * 11) * 0.4) +
        Math.abs(Math.cos(t * Math.PI * 38 + time * 15) * 0.2);
      const offset = microWave * 0.45 * power;
      const heat =
        0.55 +
        0.45 *
          Math.sin(t * Math.PI * 12 - time * 6.5) *
          Math.cos(t * Math.PI * 18 + time * 4.2);
      pts.push({
        x: pt.x + pt.nx * offset,
        y: pt.y + pt.ny * offset,
        heat,
      });
    }

    const trace = () => {
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]!;
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
    };

    const { tip, mid, edge } = getFirePalette();

    trace();
    ctx.strokeStyle = rgbaFire(edge, 0.2 * power);
    ctx.lineWidth = 3.6;
    ctx.shadowColor = rgbaFire(mid, 0.4);
    ctx.shadowBlur = 6;
    ctx.stroke();

    trace();
    ctx.shadowBlur = 2;
    ctx.strokeStyle = rgbaFire(mid, 0.5 * power);
    ctx.lineWidth = 1.55;
    ctx.stroke();

    ctx.shadowBlur = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!;
      const b = pts[i + 1]!;
      const h = (a.heat + b.heat) * 0.5;
      if (h < 0.25) continue;
      ctx.strokeStyle = rgbaFire(tip, h * 0.68 * power);
      ctx.lineWidth = 0.85;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  private tick(now: number) {
    if (this.disposed) {
      this.raf = 0;
      return;
    }

    const dt = Math.max(0.001, Math.min(0.033, (now - this.lastTs) / 1000));
    this.lastTs = now;
    this.elapsed += dt;

    if (this.fireOn) {
      this.firePower = Math.min(1, this.firePower + dt * 3.0);
      this.igniteSweep = Math.min(1, this.igniteSweep + dt * 2.3);
    } else {
      this.firePower = Math.max(0, this.firePower - dt * 2.6);
      if (this.firePower <= 0.01) this.igniteSweep = 0;
    }

    const { canvasSize, lineOffset: ox, lineSize: s, lineRadius: r } = this.geom;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    if (this.firePower > 0.01) {
      if (this.igniteSweep < 0.999) {
        const half = 0.5 * this.igniteSweep;
        const steps = Math.max(8, Math.floor(85 * this.igniteSweep));
        this.drawFireSegment(0, half, steps, this.firePower, this.elapsed);
        this.drawFireSegment(0, -half, steps, this.firePower, this.elapsed);

        for (const tip of [
          getPerimeterPoint(half, ox, ox, s, s, r),
          getPerimeterPoint(-half, ox, ox, s, s, r),
        ]) {
          const { tip: tipColor, mid } = getFirePalette();
          const g = ctx.createRadialGradient(tip.x, tip.y, 0, tip.x, tip.y, 5);
          g.addColorStop(0, rgbaFire(tipColor, 0.9 * this.firePower));
          g.addColorStop(0.5, rgbaFire(mid, 0.45 * this.firePower));
          g.addColorStop(1, 'rgba(0, 0, 0, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(tip.x, tip.y, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        this.drawFireSegment(0, 1, 160, this.firePower, this.elapsed);
      }

      if (
        this.flames.length < QR_SECRET_FIRE.maxFlames &&
        Math.random() < 0.45 * this.firePower * this.igniteSweep
      ) {
        const t = (Math.random() - 0.5) * this.igniteSweep;
        this.spawnEmber(getPerimeterPoint(t, ox, ox, s, s, r), this.firePower);
      }
      if (
        this.sparks.length < QR_SECRET_FIRE.maxSparks &&
        Math.random() < 0.18 * this.firePower * this.igniteSweep
      ) {
        const t = (Math.random() - 0.5) * this.igniteSweep;
        this.spawnSpark(getPerimeterPoint(t, ox, ox, s, s, r));
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    for (let i = this.flames.length - 1; i >= 0; i--) {
      const f = this.flames[i]!;
      f.life += dt;
      if (f.life >= f.maxLife) {
        this.flames.splice(i, 1);
        continue;
      }
      const p = f.life / f.maxLife;
      // Tangential wobble only — no upward bias that pulls particles across the face.
      f.vx += Math.sin(this.elapsed * 10 + f.phase) * 8 * dt;
      f.vy += Math.cos(this.elapsed * 9 + f.phase) * 8 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;

      if (this.isInsideCard(f.x, f.y)) {
        this.flames.splice(i, 1);
        continue;
      }

      const radius = f.size * (1 - p * 0.55);
      const alpha = Math.sin(Math.min(1, p * 4) * (Math.PI / 2)) * (1 - p) * 0.48;
      const { tip, mid, edge } = getFirePalette();
      const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, radius);
      grad.addColorStop(0, p < 0.35 ? rgbaFire(tip, alpha) : rgbaFire(mid, alpha * 0.85));
      grad.addColorStop(0.55, rgbaFire(edge, alpha * 0.4));
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(f.x, f.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const sp = this.sparks[i]!;
      sp.life += dt;
      if (sp.life >= sp.maxLife) {
        this.sparks.splice(i, 1);
        continue;
      }
      const p = sp.life / sp.maxLife;
      sp.prevX = sp.x;
      sp.prevY = sp.y;
      sp.vx *= 0.96;
      sp.vy *= 0.96;
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;

      if (this.isInsideCard(sp.x, sp.y)) {
        this.sparks.splice(i, 1);
        continue;
      }

      const { tip } = getFirePalette();
      ctx.strokeStyle = rgbaFire(tip, (1 - p) * 0.55);
      ctx.lineWidth = sp.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sp.prevX, sp.prevY);
      ctx.lineTo(sp.x, sp.y);
      ctx.stroke();
    }

    ctx.restore();

    const needsFire =
      this.fireOn || this.firePower > 0.01 || this.flames.length > 0 || this.sparks.length > 0;
    if (needsFire) {
      this.raf = requestAnimationFrame((t) => this.tick(t));
    } else {
      this.raf = 0;
      ctx.clearRect(0, 0, canvasSize, canvasSize);
    }
  }
}
