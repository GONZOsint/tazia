import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import { TALK_ASH } from '../../motion/tokens';
import {
  FIRE_BUDGET,
  createParticleBags,
  drawAmbientGlow,
  hasLiveParticles,
  seedIgnitionBurst,
  spawnAsh,
  spawnFlame,
  spawnSmoke,
  spawnSpark,
  updateAndDrawAshes,
  updateAndDrawFlames,
  updateAndDrawSmokes,
  updateAndDrawSparks,
} from '../../motion/fireBurnEngine';

interface TalkAshOverlayProps {
  /** When true, incinerate plaza talk / topic ash targets then call onComplete. */
  play: boolean;
  onComplete: () => void;
}

function readRect(sel: string): DOMRect | null {
  const el = document.querySelector(sel);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 4 || r.height < 4) return null;
  return r;
}

function feedRect(bags: ReturnType<typeof createParticleBags>, r: DOMRect, intensity: number) {
  const x = r.left + r.width * (0.12 + Math.random() * 0.76);
  const y = r.top + r.height * (0.55 + Math.random() * 0.4);
  spawnFlame(bags, x, y, 0.55 + intensity * 0.45);
  if (Math.random() < 0.55) spawnSmoke(bags, x, y);
  if (Math.random() < 0.7) spawnSpark(bags, x, y);
  if (Math.random() < 0.4) spawnAsh(bags, x, y);
}

/**
 * Scoped canvas fire for unanimous talk delete — shared ritual for every peer.
 * Anchors to `.plaza-talk-ash-target` (reader) and `.plaza-topic-ash-target` (sidebar).
 */
export function TalkAshOverlay({ play, onComplete }: TalkAshOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const abortedRef = useRef(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!play) return;
    doneRef.current = false;
    abortedRef.current = false;
    const timeouts: number[] = [];
    const canvas = canvasRef.current;

    const finish = () => {
      if (doneRef.current || abortedRef.current) return;
      doneRef.current = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      onComplete();
    };

    if (reduceMotion || !canvas) {
      timeouts.push(window.setTimeout(finish, TALK_ASH.reducedMs));
      return () => {
        abortedRef.current = true;
        for (const id of timeouts) window.clearTimeout(id);
      };
    }

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      finish();
      return;
    }

    let dpr = Math.min(window.devicePixelRatio || 1, FIRE_BUDGET.maxDpr);
    const ensureCanvasSize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, FIRE_BUDGET.maxDpr);
      const w = Math.max(1, Math.round(window.innerWidth * dpr));
      const h = Math.max(1, Math.round(window.innerHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    ensureCanvasSize();
    window.addEventListener('resize', ensureCanvasSize);

    const talkRect = readRect('.plaza-talk-ash-target');
    const topicRect = readRect('.plaza-topic-ash-target');
    const bags = createParticleBags();

    const ignite = talkRect ?? topicRect;
    if (ignite) {
      const sx = ignite.left + ignite.width * 0.5;
      const sy = ignite.top + ignite.height * 0.82;
      seedIgnitionBurst(bags, sx, sy);
      for (let i = 0; i < 10; i++) {
        feedRect(bags, ignite, 0.85);
      }
    } else {
      seedIgnitionBurst(bags, window.innerWidth * 0.5, window.innerHeight * 0.45);
    }
    if (topicRect && talkRect) {
      for (let i = 0; i < 4; i++) feedRect(bags, topicRect, 0.55);
    }

    let lastTime = performance.now();
    let elapsedSec = 0;
    let lastFeed = 0;
    const durationSec = TALK_ASH.durationMs / 1000;

    const tick = (now: number) => {
      if (abortedRef.current) return;
      ensureCanvasSize();
      const dt = Math.max(0.001, Math.min(0.033, (now - lastTime) / 1000));
      lastTime = now;
      elapsedSec += dt;
      const elapsedMs = elapsedSec * 1000;

      const liveTalk = readRect('.plaza-talk-ash-target') ?? talkRect;
      const liveTopic = readRect('.plaza-topic-ash-target') ?? topicRect;

      if (elapsedMs - lastFeed > 90 && elapsedMs < TALK_ASH.durationMs * 0.72) {
        lastFeed = elapsedMs;
        const intensity = 1 - elapsedMs / (TALK_ASH.durationMs * 0.9);
        if (liveTalk) feedRect(bags, liveTalk, intensity);
        if (liveTopic && Math.random() < 0.55) feedRect(bags, liveTopic, intensity * 0.7);
      }

      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, w, h);

      let layerAlpha = 1;
      if (elapsedSec >= durationSec * 0.78) {
        const raw = Math.min(1, (elapsedSec - durationSec * 0.78) / (durationSec * 0.22));
        layerAlpha = 1 - raw * raw * (3 - 2 * raw);
      }
      ctx.globalAlpha = layerAlpha;

      const glowTarget = liveTalk ?? liveTopic;
      const fireIntensity = Math.min(1, bags.flames.length / 55);
      if (glowTarget) {
        drawAmbientGlow(
          ctx,
          glowTarget.left + glowTarget.width * 0.5,
          glowTarget.top + glowTarget.height * 0.55,
          fireIntensity * 0.85,
          elapsedSec
        );
      }

      updateAndDrawSmokes(ctx, bags, dt, elapsedSec, fireIntensity);
      updateAndDrawAshes(ctx, bags, dt, elapsedSec);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = layerAlpha;
      updateAndDrawFlames(ctx, bags, dt, elapsedSec);
      updateAndDrawSparks(ctx, bags, dt, elapsedSec);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      if (elapsedMs < TALK_ASH.durationMs + 280 && (elapsedMs < TALK_ASH.durationMs || hasLiveParticles(bags))) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      rafRef.current = null;
      finish();
    };

    timeouts.push(
      window.setTimeout(() => {
        if (abortedRef.current || doneRef.current) return;
        finish();
      }, TALK_ASH.durationMs + 360)
    );

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      abortedRef.current = true;
      for (const id of timeouts) window.clearTimeout(id);
      window.removeEventListener('resize', ensureCanvasSize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [play, onComplete, reduceMotion]);

  if (!play) return null;

  return (
    <canvas
      id="talk-ash-fire-canvas"
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[55]"
    />
  );
}
