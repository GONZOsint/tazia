import { clampDt } from '../fire/burnFrame';
import { getFirePalette, refreshFirePalette, rgbaFire } from '../fire/palette';
import { QR_SECRET_FIRE } from './budget';
import { drawFireSegment } from './filament';
import {
  spawnEmber,
  spawnSpark,
  updateAndDrawFlames,
  updateAndDrawSparks,
  type Flame,
  type Spark,
} from './particles';
import { getPerimeterPoint, type QrSecretFireGeom } from './perimeter';

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
    if (this.disposed) return;
    this.geom = geom;
    this.resize();
  }

  setFireOn(on: boolean) {
    if (this.disposed) return;
    this.fireOn = on;
    if (on) refreshFirePalette();
    if (on || this.firePower > 0.01 || this.flames.length || this.sparks.length) {
      this.ensureLoop();
    }
  }

  dispose() {
    this.disposed = true;
    this.fireOn = false;
    this.firePower = 0;
    this.igniteSweep = 0;
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

  private tick(now: number) {
    if (this.disposed) {
      this.raf = 0;
      this.ctx.clearRect(0, 0, this.geom.canvasSize, this.geom.canvasSize);
      return;
    }

    const dt = clampDt(now, this.lastTs);
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
        drawFireSegment(ctx, ox, s, r, 0, half, steps, this.firePower, this.elapsed);
        drawFireSegment(ctx, ox, s, r, 0, -half, steps, this.firePower, this.elapsed);

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
        drawFireSegment(ctx, ox, s, r, 0, 1, 160, this.firePower, this.elapsed);
      }

      if (
        this.flames.length < QR_SECRET_FIRE.maxFlames &&
        Math.random() < 0.45 * this.firePower * this.igniteSweep
      ) {
        const t = (Math.random() - 0.5) * this.igniteSweep;
        spawnEmber(this.flames, getPerimeterPoint(t, ox, ox, s, s, r), this.firePower);
      }
      if (
        this.sparks.length < QR_SECRET_FIRE.maxSparks &&
        Math.random() < 0.18 * this.firePower * this.igniteSweep
      ) {
        const t = (Math.random() - 0.5) * this.igniteSweep;
        spawnSpark(this.sparks, getPerimeterPoint(t, ox, ox, s, s, r));
      }
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    updateAndDrawFlames(ctx, this.flames, this.geom, dt, this.elapsed);
    updateAndDrawSparks(ctx, this.sparks, this.geom, dt);
    ctx.restore();

    if (this.disposed) {
      this.raf = 0;
      ctx.clearRect(0, 0, canvasSize, canvasSize);
      return;
    }

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
