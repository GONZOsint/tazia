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
 * Phases: seed ignition → peak crest → ember collapse → opaque veil.
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
    // Let the layout spring finish fading before unmount (visualDuration ~360ms).
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

    const palette = readFirePalette();
    const tipHot = mixHex(palette.core, palette.accent, 0.32);
    const sparkHot = mixHex(palette.core, palette.accent, 0.36);
    const ambientAccent = mixHex(palette.mid, palette.accent, 0.28);
    const ashMid = mixHex(palette.edge, palette.bg, 0.55);
    const ashOuter = mixHex(palette.edge, palette.bg, 0.82);
    const veilMid = mixHex(palette.edge, palette.bg, 0.65);
    const veilOuter = mixHex(palette.edge, palette.bg, 0.88);
    const startedAt = performance.now();
    let phase: BurstMode = 'seed';
    let heat = 0;
    let veil = 0;
    let lastFeed = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const holdVeil = () => {
      // Opaque page-bg veil so leave()/reload never flash session chrome.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
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
        // Only snap targets back if burn was cancelled mid-flight.
        if (!doneRef.current) markTargets('clear');
      };
    }

    const pushParticle = (partial: Omit<Particle, 'life'>) => {
      particlesRef.current.push({ ...partial, life: 1 });
    };

    const spawnBurst = (rect: DOMRect, count: number, mode: BurstMode) => {
      for (let i = 0; i < count; i++) {
        const roll = Math.random();
        let type: ParticleKind;
        if (mode === 'ember') {
          type = roll > 0.62 ? 'ember' : roll > 0.38 ? 'spark' : roll > 0.16 ? 'ash' : 'flame';
        } else if (mode === 'peak') {
          type = roll > 0.55 ? 'spark' : roll > 0.1 ? 'flame' : 'ash';
        } else if (mode === 'feed') {
          type = roll > 0.72 ? 'spark' : roll > 0.18 ? 'flame' : 'ember';
        } else {
          type = roll > 0.48 ? 'spark' : roll > 0.08 ? 'flame' : 'ember';
        }

        const along = 0.04 + Math.random() * 0.92;
        const fromBottom =
          mode === 'seed'
            ? 0.58 + Math.random() * 0.38
            : mode === 'peak'
              ? 0.28 + Math.random() * 0.62
              : mode === 'feed'
                ? 0.45 + Math.random() * 0.5
                : 0.48 + Math.random() * 0.48;

        const sparkish = type === 'spark' || type === 'ember';
        const ashy = type === 'ash';
        // ~35% lower lift than the previous climax for a softer plume.
        const lift =
          type === 'spark'
            ? 1.7 + Math.random() * 2.7
            : type === 'ember'
              ? 1.15 + Math.random() * 1.85
              : ashy
                ? 0.35 + Math.random() * 0.9
                : 1.1 + Math.random() * 1.85;

        pushParticle({
          x: rect.left + rect.width * along + (Math.random() - 0.5) * 8,
          y: rect.top + rect.height * fromBottom,
          vx: (Math.random() - 0.5) * (sparkish ? 1.8 : ashy ? 0.85 : 1.05),
          vy: -lift,
          size: sparkish
            ? 1.1 + Math.random() * (type === 'ember' ? 2.4 : 1.8)
            : ashy
              ? 3.5 + Math.random() * 5.5
              : 5.5 + Math.random() * 8.5,
          decay: sparkish
            ? 0.008 + Math.random() * 0.012
            : ashy
              ? 0.004 + Math.random() * 0.007
              : 0.009 + Math.random() * 0.012,
          wobble: Math.random() * Math.PI * 2,
          wobbleSpeed: 0.055 + Math.random() * (sparkish ? 0.12 : 0.08),
          stretch: sparkish
            ? 1.02 + Math.random() * 0.28
            : ashy
              ? 1.1 + Math.random() * 0.35
              : 1.45 + Math.random() * 0.65,
          heat: 0.6 + Math.random() * 0.35,
          type,
        });
      }
    };

    const ensureLoop = () => {
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick);
    };

    const drawAmbient = (rects: DOMRect[], intensity: number) => {
      if (intensity <= 0.01) return;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const rect of rects) {
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.72;
        const rx = Math.max(rect.width * 0.72, 80);
        const ry = Math.max(rect.height * 1.35, 90);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
        g.addColorStop(0, rgba(palette.core, 0.16 * intensity));
        g.addColorStop(0.28, rgba(ambientAccent, 0.08 * intensity));
        g.addColorStop(0.55, rgba(palette.mid, 0.1 * intensity));
        g.addColorStop(0.8, rgba(palette.edge, 0.04 * intensity));
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
      const remain = Math.max(0, 1 - cover);
      const g = ctx.createRadialGradient(w * 0.5, h * 0.42, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.78);
      g.addColorStop(0, rgba(palette.mid, 0.035 * intensity * remain));
      g.addColorStop(0.45, rgba(veilMid, 0.14 * intensity * remain));
      g.addColorStop(1, rgba(veilOuter, 0.32 * intensity * remain + cover * 0.28));
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

    const drawFlame = (p: Particle) => {
      const a = p.life;
      const s = p.size * Math.max(0.18, p.life);
      const tip = -s * p.stretch;
      const base = s * 0.72;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.sin(p.wobble) * 0.16);
      ctx.globalCompositeOperation = 'lighter';

      const bloom = ctx.createRadialGradient(0, tip * 0.15, 0, 0, 0, s * 1.55);
      bloom.addColorStop(0, rgba(tipHot, a * 0.42 * p.heat));
      bloom.addColorStop(0.4, rgba(palette.core, a * 0.38 * p.heat));
      bloom.addColorStop(0.7, rgba(palette.mid, a * 0.2 * p.heat));
      bloom.addColorStop(1, rgba(palette.edge, 0));
      ctx.fillStyle = bloom;
      ctx.beginPath();
      ctx.ellipse(0, tip * 0.2, s * 0.8, s * p.stretch * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();

      const body = ctx.createLinearGradient(0, tip, 0, base);
      body.addColorStop(0, rgba(tipHot, a * 0.88));
      body.addColorStop(0.35, rgba(palette.core, a * 0.9));
      body.addColorStop(0.7, rgba(palette.mid, a * 0.7));
      body.addColorStop(1, rgba(palette.edge, a * 0.12));
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.moveTo(0, tip);
      ctx.bezierCurveTo(s * 0.68, tip * 0.35, s * 0.66, base * 0.55, 0, base);
      ctx.bezierCurveTo(-s * 0.66, base * 0.55, -s * 0.68, tip * 0.35, 0, tip);
      ctx.closePath();
      ctx.fill();

      const core = ctx.createRadialGradient(0, tip * 0.35, 0, 0, tip * 0.1, s * 0.42);
      core.addColorStop(0, rgba(tipHot, a * 0.72 * p.heat));
      core.addColorStop(0.55, rgba(palette.core, a * 0.48));
      core.addColorStop(1, rgba(palette.core, 0));
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.ellipse(0, tip * 0.28, s * 0.26, s * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const drawSpark = (p: Particle) => {
      const a = p.life;
      const speed = Math.hypot(p.vx, p.vy) || 1;
      const trail = Math.min(11, 2.5 + speed * 1.15);
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
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(p.x, p.y);
      ctx.rotate(angle);
      const streak = ctx.createLinearGradient(-trail, 0, r, 0);
      streak.addColorStop(0, rgba(hex, 0));
      streak.addColorStop(0.55, rgba(hex, a * 0.42));
      streak.addColorStop(1, rgba(hex, a * 0.85));
      ctx.fillStyle = streak;
      ctx.beginPath();
      ctx.ellipse(-trail * 0.25, 0, trail * 0.6, r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = rgba(hex, a * 0.9);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      if (p.type === 'ember' && p.life > 0.35) {
        ctx.fillStyle = rgba(tipHot, a * 0.45);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    const drawAsh = (p: Particle) => {
      const a = p.life;
      const s = p.size * Math.max(0.2, p.life);
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
      grad.addColorStop(0, rgba(palette.edge, a * 0.26));
      grad.addColorStop(0.5, rgba(ashMid, a * 0.14));
      grad.addColorStop(1, rgba(ashOuter, 0));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, s * 0.85, s * 1.15, Math.sin(p.wobble) * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    };

    const rects = collectTargetRects();

    const tick = (now: number) => {
      if (abortedRef.current) return;
      const elapsed = now - startedAt;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Heat envelope: slower rise, longer hold, softer fade into veil.
      const rise = Math.min(1, elapsed / 280);
      const hold =
        elapsed < BURN.collapseAtMs + 100
          ? 1
          : Math.max(0.3, 1 - (elapsed - BURN.collapseAtMs - 100) / 360);
      heat = rise * hold;
      const veilStart = BURN.finishMs - 280;
      veil = elapsed >= veilStart ? Math.min(1, (elapsed - veilStart) / 260) : 0;

      if (elapsed - lastFeed > (phase === 'peak' ? 95 : 120) && elapsed < BURN.collapseAtMs + 60) {
        lastFeed = elapsed;
        const feedCount = phase === 'peak' ? 5 : phase === 'ember' ? 3 : 4;
        for (const r of rects) spawnBurst(r, feedCount, phase === 'ember' ? 'ember' : 'feed');
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, w, h);

      drawAmbient(rects, heat);
      drawHeatVeil(w, h, heat, veil);

      const list = particlesRef.current;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i]!;
        p.wobble += p.wobbleSpeed;
        const sway =
          Math.sin(p.wobble) *
          (p.type === 'spark' ? 0.6 : p.type === 'ember' ? 0.5 : p.type === 'ash' ? 0.85 : 0.35);
        const turbulence = Math.sin(p.wobble * 1.5 + p.x * 0.02) * (p.type === 'flame' ? 0.16 : 0.09);
        p.vx *= 0.994;
        p.x += p.vx + sway + turbulence;
        p.vy += p.type === 'spark' ? 0.008 : p.type === 'ember' ? 0.011 : p.type === 'ash' ? 0.002 : 0.018;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) {
          list.splice(i, 1);
          continue;
        }

        if (p.type === 'flame') drawFlame(p);
        else if (p.type === 'ash') drawAsh(p);
        else drawSpark(p);
      }

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      if (!doneRef.current && !abortedRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    // Phase 1 — ignition front + seed burst
    markTargets('front');
    for (const r of rects) spawnBurst(r, 28, 'seed');
    ensureLoop();

    // Phase 2 — peak crest (near ignition-bar end)
    timeouts.push(
      window.setTimeout(() => {
        if (abortedRef.current) return;
        phase = 'peak';
        for (const r of rects) spawnBurst(r, 36, 'peak');
        ensureLoop();
      }, BURN.peakAtMs)
    );

    // Phase 3 — collapse + residual embers
    timeouts.push(
      window.setTimeout(() => {
        if (abortedRef.current) return;
        phase = 'ember';
        for (const r of rects) spawnBurst(r, 22, 'ember');
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
      // Keep incinerated-collapse through successful finish → reload.
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
