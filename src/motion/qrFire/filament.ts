import { getFirePalette, rgbaFire } from '../fire/palette';
import { getPerimeterPoint } from './perimeter';

/** Draw a glowing fire filament along a perimeter t-range. */
export function drawFireSegment(
  ctx: CanvasRenderingContext2D,
  ox: number,
  s: number,
  r: number,
  tStart: number,
  tEnd: number,
  segmentsCount: number,
  power: number,
  time: number
) {
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
