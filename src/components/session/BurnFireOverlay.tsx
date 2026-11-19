import { useEffect, useMemo, useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { BURN } from '../../motion/tokens';

type ParticleKind = 'flame' | 'spark' | 'ash' | 'ember';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  decay: number;
  wobble: number;
  wobbleSpeed: number;
  stretch: number;
  heat: number;
  /** Shared tongue id so siblings sway together. */
  tongue: number;
  type: ParticleKind;
}

interface FirePalette {
  core: string;
  mid: string;
  edge: string;
  accent: string;
  bg: string;
}

interface BurnFireOverlayProps {
  /** When true, run combustion burst then call onComplete. */
  play: boolean;
  onComplete: () => void;
}

const MAX_PARTICLES = 110;
const FIELD_SCALE = 0.5;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function cssColor(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function readFirePalette(): FirePalette {
  return {
    core: cssColor('--fire-core', '#e8b84a'),
    mid: cssColor('--fire-mid', '#d97706'),
    edge: cssColor('--fire-edge', '#b45309'),
    accent: cssColor('--color-accent', '#ccff66'),
    bg: cssColor('--color-bg', '#0b0d09'),
  };
}

/** Parse #rgb / #rrggbb into rgb channels. */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.trim();
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw);
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return `rgba(217, 119, 6, ${alpha})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/** Linear mix of two hex colors (t = 0 → a, 1 → b). */
function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return a;
  const k = Math.max(0, Math.min(1, t));
  const r = Math.round(ca.r + (cb.r - ca.r) * k);
  const g = Math.round(ca.g + (cb.g - ca.g) * k);
  const bl = Math.round(ca.b + (cb.b - ca.b) * k);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

function markTargets(phase: 'front' | 'collapse' | 'clear') {
  const nodes = document.querySelectorAll('.session-burn-target');
  for (const el of nodes) {
    if (phase === 'clear') {
      el.classList.remove('burning-front', 'incinerated-collapse');
    } else if (phase === 'front') {
      // Burn control already has .is-heating glow — avoid stacking burn-front-pulse.
      if (!el.classList.contains('burn-heat')) {
        el.classList.add('burning-front');
      }
    } else {
      el.classList.add('incinerated-collapse');
    }
  }
}

function collectTargetRects(): DOMRect[] {
  const targets = document.querySelectorAll('.session-burn-target');
  if (targets.length) {
    return Array.from(targets, (el) => el.getBoundingClientRect());
  }
  return [
    new DOMRect(window.innerWidth * 0.2, window.innerHeight * 0.25, window.innerWidth * 0.6, 120),
  ];
}

type BurstMode = 'seed' | 'peak' | 'ember' | 'feed';

/**
 * Full-viewport canvas fire for burn-session choreography.
 * Density field + multi-pass blur fuses tongue blobs into one volume;
 * sparks/embers remain discrete accents on top.
 */
export function BurnFireOverlay({ play, onComplete }: BurnFireOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const abortedRef = useRef(false);
  const reduceMotion = useReducedMotion();
  /** Destination layoutId must exist on first paint (same commit as TopBar drops source). */
  const morphOrigin = useMemo(() => {
    if (!play || reduceMotion) return null;
    // Prefer the burn control so the shared flame morphs in place (not to the zone chip).
    const burnBtn = document.querySelector('.burn-heat.session-burn-target');
    const r = burnBtn?.getBoundingClientRect() ?? collectTargetRects()[0];
    if (!r) return null;
    return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.55 };
  }, [play, reduceMotion]);
  const [morphGone, setMorphGone] = useState(false);

  useEffect(() => {
    if (!play) {
      setMorphGone(false);
      return;
    }
    const morphMs = Math.round(BURN.layoutSpring.visualDuration * 1000);
    const hide = window.setTimeout(() => setMorphGone(true), Math.max(BURN.peakAtMs, morphMs));
    return () => window.clearTimeout(hide);
  }, [play]);

  useEffect(() => {
    if (!play) return;
    doneRef.current = false;
    abortedRef.current = false;
    const timeouts: number[] = [];
    const canvas = canvasRef.current;
    if (!canvas) {
      onComplete();
      return;
    }

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      onComplete();
      return;
    }

    const field = document.createElement('canvas');
    const fieldCtx = field.getContext('2d', { alpha: true });
    if (!fieldCtx) {
      onComplete();
      return;
    }

    const palette = readFirePalette();
    const tipHot = mixHex(palette.core, '#fff6e0', 0.62);
    const sparkHot = mixHex(palette.core, palette.accent, 0.28);
    const ambientAccent = mixHex(palette.mid, palette.accent, 0.22);
    const ashMid = mixHex(palette.edge, palette.bg, 0.55);
    const ashOuter = mixHex(palette.edge, palette.bg, 0.82);
    const veilMid = mixHex(palette.edge, palette.bg, 0.65);
    const veilOuter = mixHex(palette.edge, palette.bg, 0.88);
    const startedAt = performance.now();
    let phase: BurstMode = 'seed';
    let heat = 0;
    let veil = 0;
    let lastFeed = 0;
    let wind = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      field.width = Math.max(1, Math.floor(w * FIELD_SCALE * dpr));
      field.height = Math.max(1, Math.floor(h * FIELD_SCALE * dpr));
      fieldCtx.setTransform(FIELD_SCALE * dpr, 0, 0, FIELD_SCALE * dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const holdVeil = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.filter = 'none';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = palette.bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const finish = () => {
      if (doneRef.current || abortedRef.current) return;
      doneRef.current = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      particlesRef.current = [];
      holdVeil();
      window.removeEventListener('resize', resize);
      onComplete();
    };

    if (prefersReducedMotion()) {
      markTargets('front');
      timeouts.push(
        window.setTimeout(() => {
          if (abortedRef.current) return;
          markTargets('collapse');
          timeouts.push(window.setTimeout(finish, BURN.reducedCollapseMs));
        }, BURN.reducedFrontMs)
      );
      return () => {
        abortedRef.current = true;
        for (const id of timeouts) window.clearTimeout(id);
        window.removeEventListener('resize', resize);
        if (!doneRef.current) markTargets('clear');
      };
    }

    const pushParticle = (partial: Omit<Particle, 'life'>) => {
      const list = particlesRef.current;
      if (list.length >= MAX_PARTICLES) {
        // Drop oldest ash/spark first so the flame volume stays intact.
        const dropAt = list.findIndex((p) => p.type !== 'flame');
        list.splice(dropAt >= 0 ? dropAt : 0, 1);
      }
      list.push({ ...partial, life: 1 });
    };

    const spawnBurst = (rect: DOMRect, count: number, mode: BurstMode) => {
      const tongueCount = mode === 'peak' ? 5 : mode === 'ember' ? 3 : 4;
      for (let i = 0; i < count; i++) {
        const roll = Math.random();
        let type: ParticleKind;
        if (mode === 'ember') {
          type = roll > 0.55 ? 'ember' : roll > 0.32 ? 'spark' : roll > 0.12 ? 'ash' : 'flame';
        } else if (mode === 'peak') {
          // Peak is volume-first; sparks are accents, not the silhouette.
          type = roll > 0.78 ? 'spark' : roll > 0.14 ? 'flame' : 'ash';
        } else if (mode === 'feed') {
          type = roll > 0.82 ? 'spark' : roll > 0.18 ? 'flame' : 'ember';
        } else {
          type = roll > 0.7 ? 'spark' : roll > 0.08 ? 'flame' : 'ember';
        }

        const tongue = Math.floor(Math.random() * tongueCount);
        const column = (tongue + 0.5) / tongueCount;
        // Edge tongues run cooler/smaller so the mass reads as one plume.
        const edgeBias = 1 - Math.abs(column - 0.5) * 1.15;
        const along =
          type === 'flame'
            ? column + (Math.random() - 0.5) * 0.08
            : 0.08 + Math.random() * 0.84;
        const fromBottom =
          type === 'flame'
            ? mode === 'peak'
              ? 0.5 + Math.random() * 0.42
              : 0.62 + Math.random() * 0.34
            : mode === 'seed'
              ? 0.55 + Math.random() * 0.4
              : mode === 'peak'
                ? 0.3 + Math.random() * 0.58
                : 0.48 + Math.random() * 0.46;

        const sparkish = type === 'spark' || type === 'ember';
        const ashy = type === 'ash';
        const lift =
          type === 'spark'
            ? 1.4 + Math.random() * 2.2
            : type === 'ember'
              ? 1.0 + Math.random() * 1.55
              : ashy
                ? 0.3 + Math.random() * 0.8
                : 0.7 + Math.random() * 1.15;

        pushParticle({
          x: rect.left + rect.width * Math.max(0.03, Math.min(0.97, along)),
          y: rect.top + rect.height * fromBottom,
          vx: (Math.random() - 0.5) * (sparkish ? 1.4 : ashy ? 0.7 : 0.28),
          vy: -lift,
          size: sparkish
            ? 1.0 + Math.random() * (type === 'ember' ? 2.0 : 1.55)
            : ashy
              ? 3 + Math.random() * 4.5
              : (12 + Math.random() * 12) * (0.72 + edgeBias * 0.35),
          decay: sparkish
            ? 0.009 + Math.random() * 0.013
            : ashy
              ? 0.004 + Math.random() * 0.007
              : 0.01 + Math.random() * 0.012,
          wobble: tongue * 1.55 + Math.random() * 0.45,
          wobbleSpeed: 0.04 + Math.random() * (sparkish ? 0.1 : 0.04),
          stretch: sparkish
            ? 1.02 + Math.random() * 0.25
            : ashy
              ? 1.1 + Math.random() * 0.3
              : 1.85 + Math.random() * 0.75,
          heat: 0.78 + Math.random() * 0.22,
          tongue,
          type,
        });
      }
    };

    const ensureLoop = () => {
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick);
    };

    /** Continuous hearth under each target — roots the plume so tongues share a base. */
    const stampFireBed = (rect: DOMRect, intensity: number, t: number) => {
      if (intensity < 0.04) return;
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.88;
      const pulse = 0.92 + Math.sin(t * 0.0055) * 0.08;
      const rx = Math.max(rect.width * 0.58, 56) * pulse;
      const ry = Math.max(rect.height * 0.55, 36) * pulse;

      fieldCtx.save();
      fieldCtx.globalCompositeOperation = 'lighter';

      const bed = fieldCtx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
      bed.addColorStop(0, rgba(tipHot, 0.5 * intensity));
      bed.addColorStop(0.28, rgba(palette.core, 0.42 * intensity));
      bed.addColorStop(0.55, rgba(palette.mid, 0.28 * intensity));
      bed.addColorStop(0.82, rgba(palette.edge, 0.12 * intensity));
      bed.addColorStop(1, rgba(palette.edge, 0));
      fieldCtx.fillStyle = bed;
      fieldCtx.beginPath();
      fieldCtx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      fieldCtx.fill();

      // Low connecting bar so adjacent tongues fuse at the root.
      const bar = fieldCtx.createLinearGradient(cx - rx, cy, cx + rx, cy);
      bar.addColorStop(0, rgba(palette.edge, 0));
      bar.addColorStop(0.2, rgba(palette.mid, 0.22 * intensity));
      bar.addColorStop(0.5, rgba(palette.core, 0.34 * intensity));
      bar.addColorStop(0.8, rgba(palette.mid, 0.22 * intensity));
      bar.addColorStop(1, rgba(palette.edge, 0));
      fieldCtx.fillStyle = bar;
      fieldCtx.fillRect(cx - rx, cy - ry * 0.22, rx * 2, ry * 0.45);

      fieldCtx.restore();
    };

    const drawAmbient = (rects: DOMRect[], intensity: number) => {
      if (intensity <= 0.01) return;
      ctx.save();
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'lighter';
      for (const rect of rects) {
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.8;
        const rx = Math.max(rect.width * 0.82, 92);
        const ry = Math.max(rect.height * 1.55, 108);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
        g.addColorStop(0, rgba(palette.core, 0.14 * intensity));
        g.addColorStop(0.32, rgba(ambientAccent, 0.07 * intensity));
        g.addColorStop(0.6, rgba(palette.mid, 0.09 * intensity));
        g.addColorStop(0.85, rgba(palette.edge, 0.035 * intensity));
        g.addColorStop(1, rgba(palette.edge, 0));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const drawHeatVeil = (w: number, h: number, intensity: number, cover: number) => {
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
      const remain = Math.max(0, 1 - cover);
      const g = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
      g.addColorStop(0, rgba(palette.mid, 0.03 * intensity * remain));
      g.addColorStop(0.45, rgba(veilMid, 0.12 * intensity * remain));
      g.addColorStop(1, rgba(veilOuter, 0.3 * intensity * remain + cover * 0.28));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      if (cover > 0.01) {
        ctx.globalAlpha = cover;
        ctx.fillStyle = palette.bg;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    };

    /** Soft density blob — blur fuses neighbors into continuous tongues. */
    const stampFlameBlob = (p: Particle, t: number) => {
      const a = p.life * p.heat;
      if (a < 0.04) return;
      const s = p.size * Math.max(0.25, p.life);
      const tongueSway = Math.sin(t * 0.0038 + p.tongue * 1.4) * 0.18;
      const localSway = Math.sin(p.wobble) * 0.08;
      const lean = tongueSway + localSway + wind * 0.1;

      fieldCtx.save();
      fieldCtx.translate(p.x, p.y);
      fieldCtx.rotate(lean);
      fieldCtx.globalCompositeOperation = 'lighter';

      const rx = s * 0.68;
      const ry = s * p.stretch * 1.08;
      const cy = -ry * 0.32;

      const outer = fieldCtx.createRadialGradient(0, cy * 0.35, 0, 0, cy * 0.1, Math.max(rx, ry) * 1.2);
      outer.addColorStop(0, rgba(palette.mid, a * 0.48));
      outer.addColorStop(0.5, rgba(palette.edge, a * 0.26));
      outer.addColorStop(1, rgba(palette.edge, 0));
      fieldCtx.fillStyle = outer;
      fieldCtx.beginPath();
      fieldCtx.ellipse(0, cy * 0.15, rx * 1.2, ry * 1.12, 0, 0, Math.PI * 2);
      fieldCtx.fill();

      const mid = fieldCtx.createRadialGradient(0, cy, 0, 0, cy * 0.45, Math.max(rx, ry) * 0.8);
      mid.addColorStop(0, rgba(palette.core, a * 0.7));
      mid.addColorStop(0.55, rgba(palette.mid, a * 0.38));
      mid.addColorStop(1, rgba(palette.mid, 0));
      fieldCtx.fillStyle = mid;
      fieldCtx.beginPath();
      fieldCtx.ellipse(0, cy * 0.5, rx * 0.7, ry * 0.88, 0, 0, Math.PI * 2);
      fieldCtx.fill();

      const core = fieldCtx.createRadialGradient(0, cy * 1.2, 0, 0, cy * 0.9, s * 0.36);
      core.addColorStop(0, rgba(tipHot, a * 0.9));
      core.addColorStop(0.4, rgba(palette.core, a * 0.55));
      core.addColorStop(1, rgba(palette.core, 0));
      fieldCtx.fillStyle = core;
      fieldCtx.beginPath();
      fieldCtx.ellipse(0, cy * 1.08, rx * 0.28, ry * 0.46, 0, 0, Math.PI * 2);
      fieldCtx.fill();

      fieldCtx.restore();
    };

    const drawSpark = (p: Particle) => {
      const a = p.life;
      const speed = Math.hypot(p.vx, p.vy) || 1;
      const trail = Math.min(10, 2.2 + speed * 1.05);
      const angle = Math.atan2(p.vy, p.vx);
      const hex =
        p.type === 'ember'
          ? p.life > 0.5
            ? palette.core
            : palette.mid
          : p.life > 0.65
            ? sparkHot
            : p.life > 0.35
              ? palette.core
              : palette.mid;
      const r = p.size * Math.max(0.2, p.life);

      ctx.save();
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);
      const streak = ctx.createLinearGradient(-trail, 0, r, 0);
      streak.addColorStop(0, rgba(hex, 0));
      streak.addColorStop(0.55, rgba(hex, a * 0.38));
      streak.addColorStop(1, rgba(hex, a * 0.82));
      ctx.fillStyle = streak;
      ctx.beginPath();
      ctx.ellipse(-trail * 0.25, 0, trail * 0.55, r * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(hex, a * 0.88);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      if (p.type === 'ember' && p.life > 0.35) {
        ctx.fillStyle = rgba(tipHot, a * 0.4);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const drawAsh = (p: Particle) => {
      const a = p.life;
      const s = p.size * Math.max(0.2, p.life);
      ctx.save();
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-over';
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
      grad.addColorStop(0, rgba(palette.edge, a * 0.22));
      grad.addColorStop(0.5, rgba(ashMid, a * 0.12));
      grad.addColorStop(1, rgba(ashOuter, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, s * 0.85, s * 1.15, Math.sin(p.wobble) * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    /** Heavy blur = fused volume; mid = body; light = hot ridges. */
    const blitFireField = (w: number, h: number, intensity: number) => {
      if (intensity <= 0.02) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      ctx.filter = 'blur(16px) saturate(1.2)';
      ctx.globalAlpha = 0.68 * intensity;
      ctx.drawImage(field, 0, 0, w, h);

      ctx.filter = 'blur(6px) saturate(1.3)';
      ctx.globalAlpha = 0.88 * intensity;
      ctx.drawImage(field, 0, 0, w, h);

      ctx.filter = 'blur(1.5px) contrast(1.05)';
      ctx.globalAlpha = 0.5 * intensity;
      ctx.drawImage(field, 0, 0, w, h);

      ctx.filter = 'none';
      ctx.globalAlpha = 1;
      ctx.restore();
    };

    const rects = collectTargetRects();

    const tick = (now: number) => {
      if (abortedRef.current) return;
      const elapsed = now - startedAt;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      wind = Math.sin(elapsed * 0.0028) * 0.48 + Math.sin(elapsed * 0.0064) * 0.2;

      const rise = Math.min(1, elapsed / 260);
      const hold =
        elapsed < BURN.collapseAtMs + 80
          ? 1
          : Math.max(0.28, 1 - (elapsed - BURN.collapseAtMs - 80) / 380);
      heat = rise * hold;
      const veilStart = BURN.finishMs - 280;
      veil = elapsed >= veilStart ? Math.min(1, (elapsed - veilStart) / 260) : 0;

      if (elapsed - lastFeed > (phase === 'peak' ? 105 : 135) && elapsed < BURN.collapseAtMs + 40) {
        lastFeed = elapsed;
        const feedCount = phase === 'peak' ? 4 : phase === 'ember' ? 2 : 3;
        for (const r of rects) spawnBurst(r, feedCount, phase === 'ember' ? 'ember' : 'feed');
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.filter = 'none';
      ctx.clearRect(0, 0, w, h);

      fieldCtx.setTransform(FIELD_SCALE * dpr, 0, 0, FIELD_SCALE * dpr, 0, 0);
      fieldCtx.globalCompositeOperation = 'source-over';
      fieldCtx.globalAlpha = 1;
      fieldCtx.filter = 'none';
      fieldCtx.clearRect(0, 0, w, h);

      drawAmbient(rects, heat);
      drawHeatVeil(w, h, heat, veil);

      const bedHeat = heat * (phase === 'ember' ? 0.55 : 1);
      for (const r of rects) stampFireBed(r, bedHeat, elapsed);

      const list = particlesRef.current;
      const sparks: Particle[] = [];
      const ashes: Particle[] = [];

      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i]!;
        p.wobble += p.wobbleSpeed;

        if (p.type === 'flame') {
          const shared =
            Math.sin(elapsed * 0.0038 + p.tongue * 1.4) * 0.48 +
            Math.sin(p.wobble) * 0.18 +
            wind * 0.28;
          p.vx *= 0.96;
          p.x += p.vx * 0.28 + shared;
          p.vy += 0.012;
          p.y += p.vy;
        } else {
          const sway =
            Math.sin(p.wobble) *
            (p.type === 'spark' ? 0.55 : p.type === 'ember' ? 0.45 : 0.8);
          p.vx *= 0.994;
          p.x += p.vx + sway + wind * (p.type === 'ash' ? 0.4 : 0.18);
          p.vy += p.type === 'spark' ? 0.008 : p.type === 'ember' ? 0.011 : 0.002;
          p.y += p.vy;
        }

        p.life -= p.decay;
        if (p.life <= 0) {
          list.splice(i, 1);
          continue;
        }

        if (p.type === 'flame') stampFlameBlob(p, elapsed);
        else if (p.type === 'ash') ashes.push(p);
        else sparks.push(p);
      }

      blitFireField(w, h, heat);

      for (const p of ashes) drawAsh(p);
      for (const p of sparks) drawSpark(p);

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.filter = 'none';

      if (!doneRef.current && !abortedRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    markTargets('front');
    for (const r of rects) spawnBurst(r, 20, 'seed');
    ensureLoop();

    timeouts.push(
      window.setTimeout(() => {
        if (abortedRef.current) return;
        phase = 'peak';
        for (const r of rects) spawnBurst(r, 24, 'peak');
        ensureLoop();
      }, BURN.peakAtMs)
    );

    timeouts.push(
      window.setTimeout(() => {
        if (abortedRef.current) return;
        phase = 'ember';
        for (const r of rects) spawnBurst(r, 16, 'ember');
        markTargets('collapse');
        ensureLoop();
      }, BURN.collapseAtMs)
    );

    timeouts.push(window.setTimeout(finish, BURN.finishMs));

    return () => {
      abortedRef.current = true;
      for (const id of timeouts) window.clearTimeout(id);
      window.removeEventListener('resize', resize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (!doneRef.current) markTargets('clear');
    };
  }, [play, onComplete]);

  if (!play) return null;

  const showMorph = Boolean(morphOrigin) && !morphGone;

  return (
    <>
      <canvas id="burn-fire-canvas" ref={canvasRef} aria-hidden="true" />
      {showMorph && morphOrigin && (
        <motion.span
          layoutId={BURN.layoutId}
          className="pointer-events-none fixed z-[9600] inline-flex text-[var(--fire-core)]"
          style={{
            left: morphOrigin.x,
            top: morphOrigin.y,
            translate: '-50% -50%',
          }}
          initial={false}
          animate={{ scale: 1.75, opacity: 0 }}
          transition={{ type: 'spring', visualDuration: 0.36, bounce: 0.08 }}
          aria-hidden="true"
        >
          <Flame className="h-5 w-5 drop-shadow-[0_0_10px_var(--fire-mid)]" />
        </motion.span>
      )}
    </>
  );
}
