import { useEffect, useRef } from 'react';
import { BURN } from '../../motion/tokens';

type ParticleKind = 'flame' | 'spark' | 'ash';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  decay: number;
  wobble: number;
  stretch: number;
  type: ParticleKind;
}

interface FirePalette {
  core: string;
  mid: string;
  edge: string;
  accent: string;
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

function markTargets(phase: 'front' | 'collapse' | 'clear') {
  const nodes = document.querySelectorAll('.session-burn-target');
  for (const el of nodes) {
    if (phase === 'clear') {
      el.classList.remove('burning-front', 'incinerated-collapse');
    } else if (phase === 'front') {
      el.classList.add('burning-front');
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

type BurstMode = 'seed' | 'peak' | 'ember';

/**
 * Full-viewport canvas fire for burn-session choreography.
 * Phases: seed ignition → peak crest → ember collapse.
 * Blends motion-guide radial flames with CodePen-style rising sparks.
 */
export function BurnFireOverlay({ play, onComplete }: BurnFireOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const abortedRef = useRef(false);

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

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      onComplete();
      return;
    }

    const palette = readFirePalette();

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const finish = () => {
      if (doneRef.current || abortedRef.current) return;
      doneRef.current = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      particlesRef.current = [];
      ctx.clearRect(0, 0, canvas.width, canvas.height);
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
        markTargets('clear');
      };
    }

    const spawnBurst = (rect: DOMRect, count: number, mode: BurstMode) => {
      for (let i = 0; i < count; i++) {
        const roll = Math.random();
        let type: ParticleKind;
        if (mode === 'ember') {
          type = roll > 0.55 ? 'spark' : roll > 0.22 ? 'ash' : 'flame';
        } else if (mode === 'peak') {
          type = roll > 0.58 ? 'spark' : roll > 0.12 ? 'flame' : 'ash';
        } else {
          type = roll > 0.5 ? 'spark' : 'flame';
        }

        const along = 0.08 + Math.random() * 0.84;
        const fromBottom =
          mode === 'seed'
            ? 0.62 + Math.random() * 0.34
            : mode === 'peak'
              ? 0.35 + Math.random() * 0.55
              : 0.5 + Math.random() * 0.45;

        const sparkish = type === 'spark';
        const ashy = type === 'ash';

        particlesRef.current.push({
          x: rect.left + rect.width * along,
          y: rect.top + rect.height * fromBottom,
          vx: (Math.random() - 0.5) * (sparkish ? 2.4 : ashy ? 1.1 : 1.35),
          vy: -(
            (sparkish ? 2.2 : ashy ? 0.7 : 1.55) +
            Math.random() * (sparkish ? 3.6 : ashy ? 1.4 : 2.4)
          ),
          size: sparkish
            ? 1.4 + Math.random() * 2.2
            : ashy
              ? 3 + Math.random() * 5
              : 6 + Math.random() * 11,
          life: 1,
          decay: sparkish
            ? 0.011 + Math.random() * 0.016
            : ashy
              ? 0.008 + Math.random() * 0.012
              : 0.016 + Math.random() * 0.02,
          wobble: Math.random() * Math.PI * 2,
          stretch: sparkish ? 1.05 : ashy ? 1.2 + Math.random() * 0.4 : 1.55 + Math.random() * 0.9,
          type,
        });
      }
    };

    const ensureLoop = () => {
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick);
    };

    const drawFlame = (p: Particle, fill: string | CanvasGradient) => {
      const s = p.size * Math.max(0.15, p.life);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.sin(p.wobble) * 0.18);
      ctx.scale(1, p.stretch);
      ctx.fillStyle = fill;
      ctx.beginPath();
      // Teardrop: wide base, pointed tip upward (CodePen rise feel + guide teardrop).
      ctx.moveTo(0, -s);
      ctx.bezierCurveTo(s * 0.7, -s * 0.35, s * 0.65, s * 0.55, 0, s * 0.75);
      ctx.bezierCurveTo(-s * 0.65, s * 0.55, -s * 0.7, -s * 0.35, 0, -s);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    const tick = () => {
      if (abortedRef.current) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'lighter';
      const list = particlesRef.current;

      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i]!;
        p.wobble += p.type === 'spark' ? 0.16 : 0.11;
        const sway = Math.sin(p.wobble) * (p.type === 'spark' ? 0.72 : p.type === 'ash' ? 0.95 : 0.42);
        p.x += p.vx + sway;
        // Sparks keep lift; flames drag; ash drifts and slows.
        p.vy += p.type === 'spark' ? 0.012 : p.type === 'ash' ? 0.004 : 0.028;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) {
          list.splice(i, 1);
          continue;
        }

        const a = p.life;
        if (p.type === 'flame') {
          const s = p.size * p.life;
          const grad = ctx.createRadialGradient(p.x, p.y + s * 0.15, 0, p.x, p.y, s * 1.25);
          grad.addColorStop(0, rgba(palette.core, a * 0.95));
          grad.addColorStop(0.4, rgba(palette.mid, a * 0.78));
          grad.addColorStop(1, rgba(palette.edge, 0));
          drawFlame(p, grad);
        } else if (p.type === 'spark') {
          const sparkHex = p.life > 0.55 ? palette.accent : p.life > 0.28 ? palette.core : palette.mid;
          const r = p.size * p.life;
          ctx.fillStyle = rgba(sparkHex, a * 0.95);
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Soft ash / smoke — lower alpha, no hard edge.
          const s = p.size * p.life;
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, s);
          grad.addColorStop(0, rgba(palette.edge, a * 0.28));
          grad.addColorStop(0.55, rgba(palette.mid, a * 0.12));
          grad.addColorStop(1, rgba(palette.edge, 0));
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalCompositeOperation = 'source-over';
      if (list.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    const rects = collectTargetRects();

    // Phase 1 — ignition front + seed burst
    markTargets('front');
    for (const r of rects) spawnBurst(r, 42, 'seed');
    ensureLoop();

    // Phase 2 — peak crest
    timeouts.push(
      window.setTimeout(() => {
        if (abortedRef.current) return;
        for (const r of rects) spawnBurst(r, 58, 'peak');
        ensureLoop();
      }, BURN.peakAtMs)
    );

    // Phase 3 — collapse + residual embers
    timeouts.push(
      window.setTimeout(() => {
        if (abortedRef.current) return;
        for (const r of rects) spawnBurst(r, 36, 'ember');
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
      markTargets('clear');
    };
  }, [play, onComplete]);

  if (!play) return null;

  return <canvas id="burn-fire-canvas" ref={canvasRef} aria-hidden="true" />;
}
