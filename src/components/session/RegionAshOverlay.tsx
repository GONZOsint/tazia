import { useEffect } from 'react';
import { useReducedMotion } from 'motion/react';
import { EXTINGUISH, ZONE_ASH } from '../../motion/tokens';
import {
  applyBurnFront,
  burnFrontFromElapsed,
  clampDt,
  createParticleBags,
  createRegionBurnSnapshot,
  drawParticleLayers,
  fireIntensityFrom,
  hasLiveParticles,
  layerAlphaFromElapsed,
  maybeFeedBurnParticles,
  prepareBurnWorkTarget,
  refreshFirePalette,
  seedExtinguishBurst,
  seedIgnitionBurst,
  seedSecondaryExtinguish,
  spawnFlame,
  spawnFromEmberEdge,
  spawnSmoke,
  spawnSpark,
  type BurnFrontMode,
  type BurnWorkTarget,
  type MidBurnFeedState,
} from '../../motion/fireBurnEngine';
import { setRegionAshPhase } from './burn/domPhases';
import { queryBurnTargets, queryBurnTargetsWithRetry } from './burn/queryTargets';
import {
  abortBurnRun,
  resetBurnRunGuards,
  runReducedMotionPhases,
  useBurnOverlayLifecycle,
} from './burn/useBurnOverlayLifecycle';

export interface RegionAshOverlayProps {
  play: boolean;
  onComplete: () => void;
  /** CSS selectors for DOM regions to incinerate / extinguish (order = primary first). */
  selectors: string[];
  /** Optional per-selector max burn-map edge in device pixels. */
  maxEdgePx?: number[];
  canvasId?: string;
  /** burn = zone quema; extinguish = hoguera se apaga. */
  mode?: BurnFrontMode;
  /**
   * When false, keep the ghost box full-height until the parent unmounts
   * (zone leave). Avoids mid-burn height collapse fighting sibling layout.
   * Default true (hoguera / talk ash still collapses the slot).
   */
  collapseDom?: boolean;
}

type AshTarget = BurnWorkTarget & { el: HTMLElement };

function buildTarget(el: HTMLElement, dpr: number, maxEdgePx: number): AshTarget | null {
  const snap = createRegionBurnSnapshot(el, dpr, { maxEdgePx });
  if (!snap) return null;
  const igX = (snap.cssW / 2) * (snap.pxW / snap.cssW);
  const igY = (snap.cssH * 0.88) * (snap.pxH / snap.cssH);
  const rect = el.getBoundingClientRect();
  const work = prepareBurnWorkTarget({
    snap,
    screenRect: rect,
    igniteX: igX,
    igniteY: igY,
  });
  if (!work) return null;
  return { ...work, el };
}

/**
 * Scoped fractal front + particles — zone burn (mode=burn) or hoguera/session
 * extinguish (mode=extinguish). No full-app bg veil (session uses BurnFireOverlay).
 */
export function RegionAshOverlay({
  play,
  onComplete,
  selectors,
  maxEdgePx,
  canvasId = 'region-ash-fire-canvas',
  mode = 'burn',
  collapseDom = true,
}: RegionAshOverlayProps) {
  const life = useBurnOverlayLifecycle(onComplete);
  const reduceMotion = useReducedMotion();
  const selectorsKey = selectors.join('\0');
  const edgeKey = (maxEdgePx ?? []).join(',');
  const timing = mode === 'extinguish' ? EXTINGUISH : ZONE_ASH;
  const extinguish = mode === 'extinguish';

  useEffect(() => {
    if (!play) return;
    refreshFirePalette();
    resetBurnRunGuards(life);
    const timeouts: number[] = [];
    let trackedEls: HTMLElement[] = [];
    let retryCancel: (() => void) | null = null;

    // Keep ghost/collapse until parent unmounts — clearing here flashes the DOM.
    const finish = () => life.finish();

    if (reduceMotion || !life.canvasRef.current) {
      const els = queryBurnTargets(selectorsKey.split('\0').filter(Boolean));
      trackedEls = els;
      if (els.length) {
        runReducedMotionPhases(timeouts, {
          abortedRef: life.abortedRef,
          frontMs: Math.max(40, Math.floor(timing.reducedMs / 2)),
          collapseMs: timing.reducedMs,
          onFront: () => setRegionAshPhase(els, 'ghost'),
          onCollapse: () => {
            if (collapseDom) setRegionAshPhase(els, 'collapse');
          },
          onFinish: finish,
        });
      } else {
        timeouts.push(window.setTimeout(finish, timing.reducedMs));
      }
      return () => {
        abortBurnRun(life, timeouts);
        if (!life.doneRef.current) setRegionAshPhase(trackedEls, 'clear');
      };
    }

    const canvas = life.canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      finish();
      return;
    }

    const resize = life.bindResize(canvas, ctx);
    let dpr = resize.onResize();

    const edges = edgeKey
      ? edgeKey
          .split(',')
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n) && n > 0)
      : [];

    const runBurn = (els: HTMLElement[]) => {
      if (life.abortedRef.current || life.doneRef.current) return;
      trackedEls = els;
      const targets: AshTarget[] = [];
      for (let i = 0; i < els.length; i++) {
        const el = els[i]!;
        const edge = edges[i] ?? (i === 0 ? 460 : 280);
        const t = buildTarget(el, dpr, edge);
        if (t) targets.push(t);
      }

      if (!targets.length) {
        finish();
        return;
      }

      setRegionAshPhase(
        targets.map((t) => t.el),
        'ghost'
      );

      const bags = createParticleBags();
      const primary = targets[0]!;
      const startX = primary.glowX;
      const startY = primary.screenTop + primary.snap.cssH * 0.85;

      if (extinguish) {
        seedExtinguishBurst(bags, { x: startX, y: startY });
        seedSecondaryExtinguish(
          bags,
          targets.slice(1).map((t) => ({
            x: t.glowX + 6,
            y: t.screenTop + t.snap.cssH * 0.7,
          }))
        );
      } else {
        seedIgnitionBurst(bags, startX, startY);
        for (const target of targets.slice(1)) {
          spawnFlame(bags, target.glowX, target.screenTop + target.snap.cssH * 0.9, 0.75);
          spawnSpark(bags, target.glowX - 8, target.screenTop + target.snap.cssH * 0.8);
          spawnSmoke(bags, target.glowX + 6, target.screenTop + target.snap.cssH * 0.7);
        }
      }

      let lastTime = performance.now();
      let elapsedSec = 0;
      let collapsed = false;
      const feedState: MidBurnFeedState = { lastFeedMs: 0 };

      const tick = (now: number) => {
        if (life.abortedRef.current) return;
        dpr = resize.onResize();
        const dt = clampDt(now, lastTime);
        lastTime = now;
        elapsedSec += dt;
        const elapsedMs = elapsedSec * 1000;

        const { tNorm, front } = burnFrontFromElapsed(elapsedSec, timing.finishMs);

        let remainingPixels = 0;
        let activeEmberCount = 0;

        for (const target of targets) {
          if (tNorm >= 1) continue;

          const result = applyBurnFront({
            pxW: target.snap.pxW,
            pxH: target.snap.pxH,
            dpr: target.snapDpr,
            front,
            elapsed: elapsedSec,
            origPixels: target.snap.origPixels,
            workPixels: target.workImageData.data,
            burnMap: target.burnMap,
            noiseCache: target.noiseCache,
            screenLeft: target.screenLeft,
            screenTop: target.screenTop,
            mode,
          });
          remainingPixels += result.remainingPixels;
          activeEmberCount += result.activeEmberCount;
          target.workCtx.putImageData(target.workImageData, 0, 0);
          spawnFromEmberEdge(bags, result.emberPoints, {
            flameBudget: extinguish
              ? Math.min(2, Math.max(0, Math.ceil(result.emberPoints.length / 48)))
              : target === primary
                ? undefined
                : Math.min(4, Math.max(1, Math.ceil(result.emberPoints.length / 28))),
            spawnSparks: !extinguish,
          });
        }

        maybeFeedBurnParticles(bags, feedState, {
          elapsedMs,
          collapseAtMs: timing.collapseAtMs,
          intervalMs: 200,
          collapsed,
          mode,
          pickPoint: () => {
            if (!targets.length) return null;
            const target = targets[Math.floor(Math.random() * targets.length)]!;
            return {
              x: target.screenLeft + target.snap.cssW * (0.2 + Math.random() * 0.6),
              y: target.screenTop + target.snap.cssH * (0.55 + Math.random() * 0.35),
            };
          },
        });

        if (collapseDom && !collapsed && elapsedMs >= timing.collapseAtMs) {
          collapsed = true;
          setRegionAshPhase(
            targets.map((t) => t.el),
            'collapse'
          );
        }

        const w = window.innerWidth;
        const h = window.innerHeight;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = 1;
        ctx.clearRect(0, 0, w, h);

        const layerAlpha = layerAlphaFromElapsed(elapsedSec, timing.finishMs);
        const fireIntensity = fireIntensityFrom(bags, activeEmberCount, dpr);

        drawParticleLayers(ctx, bags, dt, elapsedSec, fireIntensity, {
          glowX: primary.glowX,
          glowY: primary.glowY,
          glowScale: extinguish ? 0.45 : 1,
          smokeFloor: extinguish ? 0.55 : 0,
          layerAlpha,
          flameAlpha: extinguish ? layerAlpha * 0.55 : layerAlpha,
          drawSparks: !extinguish,
          beforeFlames: () => {
            if (tNorm < 1 && remainingPixels > 0) {
              for (const target of targets) {
                ctx.drawImage(
                  target.workCanvas,
                  target.screenLeft,
                  target.screenTop,
                  target.snap.cssW,
                  target.snap.cssH
                );
              }
            }
          },
        });

        const stillBurningPixels = tNorm < 1 && remainingPixels > 0;
        if (stillBurningPixels || hasLiveParticles(bags) || elapsedMs < timing.finishMs) {
          life.rafRef.current = requestAnimationFrame(tick);
          return;
        }
        life.rafRef.current = null;
        finish();
      };

      life.scheduleWatchdog(timeouts, timing.finishMs);
      life.rafRef.current = requestAnimationFrame(tick);
    };

    const selList = selectorsKey.split('\0').filter(Boolean);
    const retry = queryBurnTargetsWithRetry(selList, {
      onFound: runBurn,
      onEmpty: finish,
      isCancelled: () => life.abortedRef.current || life.doneRef.current,
    });
    retryCancel = retry.cancel;

    return () => {
      retryCancel?.();
      abortBurnRun(life, timeouts, () => resize.detach());
      if (!life.doneRef.current) setRegionAshPhase(trackedEls, 'clear');
    };
  }, [
    play,
    reduceMotion,
    selectorsKey,
    edgeKey,
    mode,
    collapseDom,
    timing.finishMs,
    timing.reducedMs,
    timing.collapseAtMs,
    extinguish,
    life,
  ]);

  if (!play) return null;

  return (
    <canvas
      id={canvasId}
      ref={life.canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[55]"
    />
  );
}
