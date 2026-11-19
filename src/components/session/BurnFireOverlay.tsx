import { useEffect, useMemo, useRef, useState } from 'react';
import { Flame } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { BURN } from '../../motion/tokens';
import {
  FIRE_BUDGET,
  FractalNoise2D,
  applyBurnFront,
  buildBurnMap,
  createBurnButtonSnapshot,
  createParticleBags,
  drawAmbientGlow,
  hasLiveParticles,
  seedIgnitionBurst,
  spawnAsh,
  spawnFlame,
  spawnFromEmberEdge,
  spawnSmoke,
  spawnSpark,
  updateAndDrawAshes,
  updateAndDrawFlames,
  updateAndDrawSmokes,
  updateAndDrawSparks,
  type ButtonSnapshot,
} from '../../motion/fireBurnEngine';

interface BurnFireOverlayProps {
  /** When true, run combustion burst then call onComplete. */
  play: boolean;
  onComplete: () => void;
}

function cssColor(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function markTargets(phase: 'front' | 'collapse' | 'clear') {
  const nodes = document.querySelectorAll('.session-burn-target');
  for (const el of nodes) {
    if (phase === 'clear') {
      el.classList.remove('burning-front', 'incinerated-collapse', 'burn-heat--ghost');
    } else if (phase === 'front') {
      if (!el.classList.contains('burn-heat')) {
        el.classList.add('burning-front');
      }
    } else {
      if (!el.classList.contains('burn-heat')) {
        el.classList.add('incinerated-collapse');
      }
    }
  }
}

function collectOtherTargetRects(burnEl: Element | null): DOMRect[] {
  const targets = document.querySelectorAll('.session-burn-target');
  const rects: DOMRect[] = [];
  for (const el of targets) {
    if (burnEl && el === burnEl) continue;
    if (el.classList.contains('burn-heat')) continue;
    rects.push(el.getBoundingClientRect());
  }
  return rects;
}

function ghostBurnButton(on: boolean) {
  const btn = document.querySelector('.burn-heat.session-burn-target');
  if (!btn) return;
  btn.classList.toggle('burn-heat--ghost', on);
}

/**
 * Full-viewport canvas fire for burn-session choreography.
 * Pixel-incinerates the Quemar control via fractal burn map (reference technique);
 * other session targets keep CSS front/collapse + ambient particle feeds.
 */
export function BurnFireOverlay({ play, onComplete }: BurnFireOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);
  const abortedRef = useRef(false);
  const reduceMotion = useReducedMotion();
  const morphOrigin = useMemo(() => {
    if (!play || reduceMotion) return null;
    const burnBtn = document.querySelector('.burn-heat.session-burn-target');
    const r = burnBtn?.getBoundingClientRect();
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

    const bg = cssColor('--color-bg', '#0b0d09');
    const burnEl = document.querySelector('.burn-heat.session-burn-target');
    const burnRect = burnEl?.getBoundingClientRect() ?? null;
    const labelEl = burnEl?.querySelector('span.relative.z-10.hidden, span.truncate');
    const labelText =
      labelEl?.textContent?.trim() ||
      (burnEl instanceof HTMLElement ? burnEl.getAttribute('aria-label') : null);

    const finish = (clearCanvas = true) => {
      if (doneRef.current || abortedRef.current) return;
      doneRef.current = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      ghostBurnButton(false);
      if (clearCanvas) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      onComplete();
    };

    if (reduceMotion) {
      markTargets('front');
      timeouts.push(
        window.setTimeout(() => {
          if (abortedRef.current) return;
          markTargets('collapse');
          timeouts.push(window.setTimeout(() => finish(false), BURN.reducedCollapseMs));
        }, BURN.reducedFrontMs)
      );
      return () => {
        abortedRef.current = true;
        for (const id of timeouts) window.clearTimeout(id);
        ghostBurnButton(false);
        if (!doneRef.current) markTargets('clear');
      };
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

    let snap: ButtonSnapshot | null = null;
    let burnMap: Float32Array | null = null;
    let noiseCache: Float32Array | null = null;
    let workImageData: ImageData | null = null;
    let burnWorkCanvas: HTMLCanvasElement | null = null;
    let burnWorkCtx: CanvasRenderingContext2D | null = null;
    let liveRect = burnRect;

    if (burnRect && burnRect.width > 0) {
      snap = createBurnButtonSnapshot(burnRect, dpr, labelText);
      if (snap) {
        const igX = (burnRect.width / 2 + snap.pad) * dpr;
        const igY = (burnRect.height - 6 + snap.pad) * dpr;
        const noise = new FractalNoise2D(snap.pxW, snap.pxH, dpr);
        const built = buildBurnMap(snap.pxW, snap.pxH, igX, igY, noise, snap.origPixels);
        burnMap = built.burnMap;
        noiseCache = built.noiseCache;
        burnWorkCanvas = document.createElement('canvas');
        burnWorkCanvas.width = snap.pxW;
        burnWorkCanvas.height = snap.pxH;
        burnWorkCtx = burnWorkCanvas.getContext('2d');
        if (burnWorkCtx) {
          workImageData = burnWorkCtx.createImageData(snap.pxW, snap.pxH);
        }
        ghostBurnButton(true);
      }
    }

    const bags = createParticleBags();
    const otherRects = collectOtherTargetRects(burnEl);
    const startX = burnRect
      ? burnRect.left + burnRect.width * 0.5
      : window.innerWidth * 0.5;
    const startY = burnRect
      ? burnRect.top + burnRect.height * 0.85
      : window.innerHeight * 0.4;

    seedIgnitionBurst(bags, startX, startY);
    for (const r of otherRects.slice(0, 6)) {
      spawnFlame(bags, r.left + r.width * 0.5, r.top + r.height * 0.9, 0.7);
      spawnSpark(bags, r.left + r.width * 0.4, r.top + r.height * 0.8);
    }

    markTargets('front');

    let lastTime = performance.now();
    let elapsedSec = 0;
    const burnDurationSec = BURN.finishMs / 1000;
    let collapsed = false;
    let lastOtherFeed = 0;

    const tick = (now: number) => {
      if (abortedRef.current) return;
      ensureCanvasSize();
      const dt = Math.max(0.001, Math.min(0.033, (now - lastTime) / 1000));
      lastTime = now;
      elapsedSec += dt;
      const elapsedMs = elapsedSec * 1000;

      // Keep snapshot anchored if layout shifts slightly during burn.
      if (burnEl) {
        liveRect = burnEl.getBoundingClientRect();
      }

      const tNorm = Math.min(1, elapsedSec / Math.max(0.01, burnDurationSec * 0.85));
      const easedProgress =
        tNorm < 0.5 ? 1.7 * tNorm * tNorm : 1 - Math.pow(-2 * tNorm + 2, 2) / 2;
      const front = 0.045 + easedProgress * 1.14;

      let remainingButtonPixels = 0;
      let activeEmberCount = 0;
      let emberPoints: number[] = [];

      if (snap && burnMap && noiseCache && workImageData && burnWorkCtx && liveRect && tNorm < 1) {
        const screenLeft = liveRect.left - snap.pad;
        const screenTop = liveRect.top - snap.pad;
        const result = applyBurnFront({
          pxW: snap.pxW,
          pxH: snap.pxH,
          dpr,
          front,
          elapsed: elapsedSec,
          origPixels: snap.origPixels,
          workPixels: workImageData.data,
          burnMap,
          noiseCache,
          screenLeft,
          screenTop,
        });
        remainingButtonPixels = result.remainingButtonPixels;
        activeEmberCount = result.activeEmberCount;
        emberPoints = result.emberPoints;
        burnWorkCtx.putImageData(workImageData, 0, 0);
        spawnFromEmberEdge(bags, emberPoints);
      }

      if (
        elapsedMs - lastOtherFeed > 220 &&
        elapsedMs < BURN.collapseAtMs + 80 &&
        otherRects.length
      ) {
        lastOtherFeed = elapsedMs;
        const r = otherRects[Math.floor(Math.random() * otherRects.length)]!;
        const x = r.left + r.width * (0.2 + Math.random() * 0.6);
        const y = r.top + r.height * (0.55 + Math.random() * 0.35);
        spawnFlame(bags, x, y, 0.55 + Math.random() * 0.35);
        if (Math.random() < 0.5) spawnSmoke(bags, x, y);
        if (Math.random() < 0.6) spawnSpark(bags, x, y);
        if (Math.random() < 0.35) spawnAsh(bags, x, y);
      }

      if (!collapsed && elapsedMs >= BURN.collapseAtMs) {
        collapsed = true;
        markTargets('collapse');
      }

      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, w, h);

      const fireIntensity = Math.min(
        1,
        bags.flames.length / 75 + activeEmberCount / (600 * dpr * dpr)
      );
      const glowCx = liveRect ? liveRect.left + liveRect.width / 2 : startX;
      const glowCy = liveRect ? liveRect.top + liveRect.height / 2 - 12 : startY;
      drawAmbientGlow(ctx, glowCx, glowCy, fireIntensity, elapsedSec);

      ctx.globalCompositeOperation = 'source-over';
      updateAndDrawSmokes(ctx, bags, dt, elapsedSec, fireIntensity);

      if (
        snap &&
        burnWorkCanvas &&
        liveRect &&
        tNorm < 1 &&
        remainingButtonPixels > 0
      ) {
        ctx.drawImage(
          burnWorkCanvas,
          liveRect.left - snap.pad,
          liveRect.top - snap.pad,
          snap.cssW,
          snap.cssH
        );
      }

      updateAndDrawAshes(ctx, bags, dt, elapsedSec);

      ctx.globalCompositeOperation = 'lighter';
      updateAndDrawFlames(ctx, bags, dt, elapsedSec);
      updateAndDrawSparks(ctx, bags, dt, elapsedSec);
      ctx.globalCompositeOperation = 'source-over';

      // Soft veil into solid bg near the end so teardown doesn't flash.
      const veilStart = burnDurationSec * 0.82;
      if (elapsedSec >= veilStart) {
        const raw = Math.min(1, (elapsedSec - veilStart) / (burnDurationSec * 0.18));
        const eased = raw * raw * (3 - 2 * raw);
        ctx.globalAlpha = eased * 0.92;
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
        ctx.globalAlpha = 1;
      }

      const stillBurningPixels = tNorm < 1 && remainingButtonPixels > 0;
      if (stillBurningPixels || hasLiveParticles(bags) || elapsedMs < BURN.finishMs) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        finish(true);
      }
    };

    timeouts.push(
      window.setTimeout(() => {
        if (abortedRef.current || doneRef.current) return;
        finish(true);
      }, BURN.finishMs + 400)
    );

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      abortedRef.current = true;
      for (const id of timeouts) window.clearTimeout(id);
      window.removeEventListener('resize', ensureCanvasSize);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      ghostBurnButton(false);
      if (!doneRef.current) markTargets('clear');
    };
  }, [play, onComplete, reduceMotion]);

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
          animate={{ scale: 1.16, opacity: 0 }}
          transition={BURN.layoutSpring}
          aria-hidden="true"
        >
          <Flame className="h-5 w-5 opacity-90 drop-shadow-[0_0_5px_var(--fire-mid)]" />
        </motion.span>
      )}
    </>
  );
}
