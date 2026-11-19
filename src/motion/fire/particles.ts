import { FIRE_BUDGET } from './budget';
import { getFirePalette, rgbaFire } from './palette';

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
  opts?: { flameBudget?: number; spawnSparks?: boolean }
): void {
  const count = emberPoints.length / 2;
  if (count <= 0) return;
  const flameBudget =
    opts?.flameBudget ?? Math.min(8, Math.max(2, Math.ceil(count / 14)));
  const spawnSparks = opts?.spawnSparks !== false;
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
  if (spawnSparks && Math.random() < 0.8) {
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
      const { mid } = getFirePalette();
      ctx.fillStyle = rgbaFire(mid, (1 - p / 0.45) * 0.9);
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

    const { tip, core, mid, edge } = getFirePalette();
    let c0: string;
    let c1: string;
    if (p < 0.3) {
      c0 = rgbaFire(tip, alpha * 0.92);
      c1 = rgbaFire(core, alpha * 0.68);
    } else if (p < 0.65) {
      c0 = rgbaFire(mid, alpha * 0.78);
      c1 = rgbaFire(edge, alpha * 0.48);
    } else {
      c0 = rgbaFire(edge, alpha * 0.58);
      c1 = rgbaFire(edge, alpha * 0.25);
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
    const { tip, mid } = getFirePalette();
    ctx.strokeStyle = p < 0.4 ? rgbaFire(tip, alpha) : rgbaFire(mid, alpha);
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
  const { mid, edge } = getFirePalette();
  const ambient = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, glowRadius);
  ambient.addColorStop(0, rgbaFire(mid, 0.28 * fireIntensity * flickerGlow));
  ambient.addColorStop(0.45, rgbaFire(edge, 0.12 * fireIntensity * flickerGlow));
  ambient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = ambient;
  ctx.fillRect(centerX - glowRadius, centerY - glowRadius, glowRadius * 2, glowRadius * 2);
}
