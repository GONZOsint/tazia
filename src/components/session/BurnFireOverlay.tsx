import { useEffect, useMemo, useState } from 'react';
import { Flame } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { BURN } from '../../motion/tokens';
import {
  applyBurnFront,
  burnFrontFromElapsed,
  clampDt,
  createBurnButtonSnapshot,
  createParticleBags,
  cssVar,
  drawEndVeil,
  drawParticleLayers,
  fireIntensityFrom,
  hasLiveParticles,
  maybeFeedBurnParticles,
  prepareBurnWorkTarget,
  refreshFirePalette,
  seedExtinguishBurst,
  seedSecondaryExtinguish,
  spawnFromEmberEdge,
  type BurnWorkTarget,
  type MidBurnFeedState,
} from '../../motion/fireBurnEngine';
import {
  collectOtherTargetRects,
  ghostBurnButton,
  setSessionBurnPhase,
} from './burn/domPhases';
import {
  abortBurnRun,
  resetBurnRunGuards,
  runReducedMotionPhases,
  useBurnOverlayLifecycle,
} from './burn/useBurnOverlayLifecycle';

interface BurnFireOverlayProps {
  /** When true, run combustion burst then call onComplete. */
  play: boolean;
  onComplete: () => void;
}

/**
 * Full-viewport canvas for “apagar llama” (session extinguish).
 * Cool douse front on the flame control + dark veil; smoke-heavy particles.
 */
export function BurnFireOverlay({ play, onComplete }: BurnFireOverlayProps) {
  const life = useBurnOverlayLifecycle(onComplete);
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
    resetBurnRunGuards(life);
    const timeouts: number[] = [];
    const bg = cssVar('--color-bg', '#0b0d09');
    refreshFirePalette();

    const finish = (clearCanvas = true) => {
      ghostBurnButton(false);
      life.finish({ clearCanvas, fillBg: clearCanvas ? bg : undefined });
    };

    const runReduced = () => {
      runReducedMotionPhases(timeouts, {
        abortedRef: life.abortedRef,
        frontMs: BURN.reducedFrontMs,
        collapseMs: BURN.reducedCollapseMs,
        onFront: () => setSessionBurnPhase('front'),
        onCollapse: () => setSessionBurnPhase('collapse'),
        onFinish: () => finish(false),
      });
    };

    const canvas = life.canvasRef.current;
    if (!canvas) {
      // Mirror Region: still run DOM phases when canvas is missing.
      runReduced();
      return () => {
        abortBurnRun(life, timeouts);
        ghostBurnButton(false);
        if (!life.doneRef.current) setSessionBurnPhase('clear');
      };
    }

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      runReduced();
      return () => {
        abortBurnRun(life, timeouts);
        ghostBurnButton(false);
        if (!life.doneRef.current) setSessionBurnPhase('clear');
      };
    }

    if (reduceMotion) {
      runReduced();
      return () => {
        abortBurnRun(life, timeouts);
        ghostBurnButton(false);
        if (!life.doneRef.current) setSessionBurnPhase('clear');
      };
    }

    const burnEl = document.querySelector('.burn-heat.session-burn-target');
    const burnRect = burnEl?.getBoundingClientRect() ?? null;
    const labelEl = burnEl?.querySelector('span.relative.z-10.hidden, span.truncate');
    const labelText =
      labelEl?.textContent?.trim() ||
      (burnEl instanceof HTMLElement ? burnEl.getAttribute('aria-label') : null);

    const resize = life.bindResize(canvas, ctx);
    let dpr = resize.onResize();

    let work: BurnWorkTarget | null = null;

    if (burnRect && burnRect.width > 0) {
      const snap = createBurnButtonSnapshot(burnRect, dpr, labelText);
      if (snap) {
        const snapDpr = snap.pxW / snap.cssW;
        const igX = (burnRect.width / 2 + snap.pad) * snapDpr;
        const igY = (burnRect.height - 6 + snap.pad) * snapDpr;
        work = prepareBurnWorkTarget({
          snap,
          screenRect: burnRect,
          igniteX: igX,
          igniteY: igY,
        });
        if (work) ghostBurnButton(true);
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

    seedExtinguishBurst(bags, { x: startX, y: startY }, {
      smokeCount: 14,
      smokeSpreadX: 36,
      smokeSpreadY: 12,
      flameLife: 0.4,
    });
    seedSecondaryExtinguish(
      bags,
      otherRects.slice(0, 6).map((r) => ({
        x: r.left + r.width * 0.5,
        y: r.top + r.height * 0.7,
      })),
      { ashChance: 0.4 }
    );

    setSessionBurnPhase('front');

    let lastTime = performance.now();
    let elapsedSec = 0;
    let collapsed = false;
    const feedState: MidBurnFeedState = { lastFeedMs: 0 };
    const glowCx = work?.glowX ?? window.innerWidth * 0.5;
    const glowCy = work?.glowY ?? window.innerHeight * 0.4;

    const tick = (now: number) => {
      if (life.abortedRef.current) return;
      dpr = resize.onResize();
      const dt = clampDt(now, lastTime);
      lastTime = now;
      elapsedSec += dt;
      const elapsedMs = elapsedSec * 1000;

      const { tNorm, front } = burnFrontFromElapsed(elapsedSec, BURN.finishMs);

      let remainingPixels = 0;
      let activeEmberCount = 0;

      if (work && tNorm < 1) {
        const result = applyBurnFront({
          pxW: work.snap.pxW,
          pxH: work.snap.pxH,
          dpr: work.snapDpr,
          front,
          elapsed: elapsedSec,
          origPixels: work.snap.origPixels,
          workPixels: work.workImageData.data,
          burnMap: work.burnMap,
          noiseCache: work.noiseCache,
          screenLeft: work.screenLeft,
          screenTop: work.screenTop,
          mode: 'extinguish',
        });
        remainingPixels = result.remainingPixels;
        activeEmberCount = result.activeEmberCount;
        work.workCtx.putImageData(work.workImageData, 0, 0);
        spawnFromEmberEdge(bags, result.emberPoints, {
          flameBudget: Math.min(2, Math.max(0, Math.ceil(result.emberPoints.length / 48))),
          spawnSparks: false,
        });
      }

      maybeFeedBurnParticles(bags, feedState, {
        elapsedMs,
        collapseAtMs: BURN.collapseAtMs,
        intervalMs: 220,
        collapsed,
        mode: 'extinguish',
        pickPoint: () => {
          if (!otherRects.length) return null;
          const r = otherRects[Math.floor(Math.random() * otherRects.length)]!;
          return {
            x: r.left + r.width * (0.2 + Math.random() * 0.6),
            y: r.top + r.height * (0.55 + Math.random() * 0.35),
          };
        },
      });

      if (!collapsed && elapsedMs >= BURN.collapseAtMs) {
        collapsed = true;
        setSessionBurnPhase('collapse');
      }

      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, w, h);

      const fireIntensity = fireIntensityFrom(bags, activeEmberCount, dpr);
      const activeWork = work;

      drawParticleLayers(ctx, bags, dt, elapsedSec, fireIntensity, {
        glowX: glowCx,
        glowY: glowCy,
        glowScale: 0.4,
        smokeFloor: 0.6,
        layerAlpha: 1,
        flameAlpha: 0.55,
        drawSparks: false,
        beforeFlames: () => {
          if (activeWork && tNorm < 1 && remainingPixels > 0) {
            ctx.drawImage(
              activeWork.workCanvas,
              activeWork.screenLeft,
              activeWork.screenTop,
              activeWork.snap.cssW,
              activeWork.snap.cssH
            );
          }
        },
        afterLayers: () => drawEndVeil(ctx, bg, elapsedSec, BURN.finishMs),
      });

      const stillBurningPixels = tNorm < 1 && remainingPixels > 0;
      if (stillBurningPixels || hasLiveParticles(bags) || elapsedMs < BURN.finishMs) {
        life.rafRef.current = requestAnimationFrame(tick);
      } else {
        life.rafRef.current = null;
        finish(true);
      }
    };

    life.scheduleWatchdog(timeouts, BURN.finishMs, () => finish(true));
    life.rafRef.current = requestAnimationFrame(tick);

    return () => {
      abortBurnRun(life, timeouts, () => resize.detach());
      ghostBurnButton(false);
      if (!life.doneRef.current) setSessionBurnPhase('clear');
    };
  }, [play, reduceMotion, life]);

  if (!play) return null;

  const showMorph = Boolean(morphOrigin) && !morphGone;

  return (
    <>
      <canvas id="burn-fire-canvas" ref={life.canvasRef} aria-hidden="true" />
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
          animate={{ scale: 0.35, opacity: 0 }}
          transition={BURN.layoutSpring}
          aria-hidden="true"
        >
          <Flame className="h-5 w-5 opacity-70 drop-shadow-[0_0_4px_var(--fire-edge)]" />
        </motion.span>
      )}
    </>
  );
}
