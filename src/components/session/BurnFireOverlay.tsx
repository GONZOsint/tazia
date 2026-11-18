import { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  decay: number;
  wobble: number;
  type: 'spark' | 'flame';
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
 * Targets elements with `.session-burn-target` for collapse styling.
 */
export function BurnFireOverlay({ play, onComplete }: BurnFireOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!play) return;
    doneRef.current = false;
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

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const finish = () => {
      if (doneRef.current) return;
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
      window.setTimeout(() => {
        markTargets('collapse');
        window.setTimeout(finish, 160);
      }, 80);
      return () => {
        window.removeEventListener('resize', resize);
        markTargets('clear');
      };
    }

    const spawnBurst = (rect: DOMRect, count: number) => {
      for (let i = 0; i < count; i++) {
        const isSpark = Math.random() > 0.62;
        particlesRef.current.push({
          x: rect.left + Math.random() * rect.width,
          y: rect.top + rect.height * (0.25 + Math.random() * 0.75),
          vx: (Math.random() - 0.5) * (isSpark ? 3.2 : 1.4),
          vy: -(1.8 + Math.random() * (isSpark ? 4.8 : 2.8)),
          size: isSpark ? 1.8 + Math.random() * 2.5 : 8 + Math.random() * 14,
          life: 1,
          decay: 0.014 + Math.random() * 0.022,
          wobble: Math.random() * Math.PI * 2,
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
    for (const r of rects) spawnBurst(r, 70);

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const list = particlesRef.current;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i]!;
        p.wobble += 0.14;
        p.x += p.vx + Math.sin(p.wobble) * 0.65;
        p.y += p.vy;
        p.life -= p.decay;
        if (p.life <= 0) {
          list.splice(i, 1);
          continue;
        }
        ctx.save();
        if (p.type === 'flame') {
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * p.life);
          grad.addColorStop(0, `rgba(250, 204, 21, ${p.life * 0.9})`);
          grad.addColorStop(0.45, `rgba(249, 115, 22, ${p.life * 0.75})`);
          grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle =
            p.life > 0.5 ? `rgba(254, 240, 138, ${p.life})` : `rgba(249, 115, 22, ${p.life})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (list.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    const t1 = window.setTimeout(() => {
      for (const r of rects) spawnBurst(r, 40);
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick);
      markTargets('collapse');
    }, 180);

    const t2 = window.setTimeout(finish, 820);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener('resize', resize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      markTargets('clear');
    };
  }, [play, onComplete]);

  if (!play) return null;

  return <canvas id="burn-fire-canvas" ref={canvasRef} aria-hidden="true" />;
}
