import { useEffect, useRef } from 'react';
import { BURN } from '../../motion/tokens';

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
  type: 'spark' | 'flame';
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

/**
 * Full-viewport canvas fire burst for burn-session choreography.
 * Subtle teardrop flames + lime sparks; targets `.session-burn-target`.
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

    const spawnBurst = (rect: DOMRect, count: number) => {
      for (let i = 0; i < count; i++) {
        const isSpark = Math.random() > 0.55;
        particlesRef.current.push({
          x: rect.left + rect.width * (0.15 + Math.random() * 0.7),
          y: rect.top + rect.height * (0.45 + Math.random() * 0.5),
          vx: (Math.random() - 0.5) * (isSpark ? 1.4 : 0.7),
          vy: -(0.9 + Math.random() * (isSpark ? 2.4 : 1.8)),
          size: isSpark ? 1.2 + Math.random() * 1.8 : 5 + Math.random() * 8,
          life: 1,
          decay: 0.018 + Math.random() * 0.02,
          wobble: Math.random() * Math.PI * 2,
          stretch: isSpark ? 1.2 : 1.6 + Math.random() * 0.9,
          type: isSpark ? 'spark' : 'flame',
        });
      }
    };

    const targets = document.querySelectorAll('.session-burn-target');
    const rects: DOMRect[] = [];
    if (targets.length) {
      for (const el of targets) rects.push(el.getBoundingClientRect());
    } else {
      rects.push(
        new DOMRect(window.innerWidth * 0.2, window.innerHeight * 0.25, window.innerWidth * 0.6, 120)
      );
    }

    markTargets('front');
    for (const r of rects) spawnBurst(r, 28);

    const drawTeardrop = (p: Particle, fill: string | CanvasGradient) => {
      const s = p.size * p.life;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.sin(p.wobble) * 0.12);
      ctx.scale(1, p.stretch);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(0, 0, s * 0.55, s, 0, 0, Math.PI * 2);
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
        p.wobble += 0.08;
        p.x += p.vx + Math.sin(p.wobble) * 0.35;
        p.vy += 0.018;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) {
          list.splice(i, 1);
          continue;
        }
        const a = p.life * 0.55;
        if (p.type === 'flame') {
          const s = p.size * p.life;
          const grad = ctx.createRadialGradient(p.x, p.y + s * 0.2, 0, p.x, p.y, s * 1.15);
          grad.addColorStop(0, rgba(palette.core, a * 0.95));
          grad.addColorStop(0.45, rgba(palette.mid, a * 0.7));
          grad.addColorStop(1, rgba(palette.edge, 0));
          drawTeardrop(p, grad);
        } else {
          const sparkHex = p.life > 0.45 ? palette.accent : palette.core;
          drawTeardrop(p, rgba(sparkHex, a * 0.85));
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      if (list.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    timeouts.push(
      window.setTimeout(() => {
        if (abortedRef.current) return;
        for (const r of rects) spawnBurst(r, 16);
        if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick);
        markTargets('collapse');
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
