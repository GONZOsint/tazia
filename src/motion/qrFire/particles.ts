import { getFirePalette, rgbaFire } from '../fire/palette';
import { QR_SECRET_FIRE } from './budget';
import type { PerimeterPoint, QrSecretFireGeom } from './perimeter';

export type Flame = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  maxLife: number;
  phase: number;
};

export type Spark = {
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

/** True when a point sits over the QR card interior (not the outer fire rim). */
export function isInsideCard(geom: QrSecretFireGeom, x: number, y: number): boolean {
  const { lineOffset: ox, lineSize: s } = geom;
  const pad = QR_SECRET_FIRE.innerCull;
  return x > ox + pad && x < ox + s - pad && y > ox + pad && y < ox + s - pad;
}

export function spawnEmber(flames: Flame[], pt: PerimeterPoint, power: number) {
  // Spawn outside the rim; velocity is outward-only so bits never drift over modules.
  const outward = 10 + Math.random() * 14;
  const tangent = (Math.random() - 0.5) * 5;
  flames.push({
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

export function spawnSpark(sparks: Spark[], pt: PerimeterPoint) {
  const outward = 16 + Math.random() * 22;
  const tangent = (Math.random() - 0.5) * 8;
  const x = pt.x + pt.nx * 1.6;
  const y = pt.y + pt.ny * 1.6;
  sparks.push({
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

export function updateAndDrawFlames(
  ctx: CanvasRenderingContext2D,
  flames: Flame[],
  geom: QrSecretFireGeom,
  dt: number,
  elapsed: number
) {
  for (let i = flames.length - 1; i >= 0; i--) {
    const f = flames[i]!;
    f.life += dt;
    if (f.life >= f.maxLife) {
      flames.splice(i, 1);
      continue;
    }
    const p = f.life / f.maxLife;
    // Tangential wobble only — no upward bias that pulls particles across the face.
    f.vx += Math.sin(elapsed * 10 + f.phase) * 8 * dt;
    f.vy += Math.cos(elapsed * 9 + f.phase) * 8 * dt;
    f.x += f.vx * dt;
    f.y += f.vy * dt;

    if (isInsideCard(geom, f.x, f.y)) {
      flames.splice(i, 1);
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
}

export function updateAndDrawSparks(
  ctx: CanvasRenderingContext2D,
  sparks: Spark[],
  geom: QrSecretFireGeom,
  dt: number
) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const sp = sparks[i]!;
    sp.life += dt;
    if (sp.life >= sp.maxLife) {
      sparks.splice(i, 1);
      continue;
    }
    const p = sp.life / sp.maxLife;
    sp.prevX = sp.x;
    sp.prevY = sp.y;
    sp.vx *= 0.96;
    sp.vy *= 0.96;
    sp.x += sp.vx * dt;
    sp.y += sp.vy * dt;

    if (isInsideCard(geom, sp.x, sp.y)) {
      sparks.splice(i, 1);
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
}
