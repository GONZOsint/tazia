import {
  exactSpring,
  FIRE_EXTINGUISH_SPRING,
  FIRE_IGNITE_SPRING,
  type SpringParams,
} from './exactSpring';
import { FIRE_BTN_FS, FIRE_BTN_VS } from './shaders';

export interface FireButtonConfig {
  /** 1 = circular base arc; 0 = flat pill base. */
  arch: number;
  freqX: number;
  swayScale: number;
  maxWisps: number;
  /**
   * Horizontal fade inset (UV). Smaller → flames hug the left/right rim.
   * Circle defaults wider; title rim wants a tight inset.
   */
  edgeInset: number;
}

export type FireLitSpeed = 'normal' | 'instant';

export interface FireButtonMountOptions {
  igniteParams?: SpringParams;
  extinguishParams?: SpringParams;
  /** When false, pointer proximity/wind are ignored. */
  isActiveZone?: () => boolean;
  /**
   * When false, freezes the lit crown (one draw) instead of spinning rAF.
   * Use for off-screen / inert tab panels (e.g. plaza title rim).
   */
  shouldRun?: () => boolean;
  /**
   * Multiplies uploaded intensity / wisp (plaza title wants a denser crown).
   * Shader still clamps; keep ≤ ~1.35 for a readable boost.
   */
  intensityGain?: number;
}

export interface FireButtonHandle {
  setLit: (lit: boolean, originX?: number, speedMode?: FireLitSpeed) => void;
  setConfig: (next: Partial<FireButtonConfig>) => void;
  /** Re-check shouldRun / visibility and start or freeze the loop. */
  syncLoop: () => void;
  destroy: () => void;
}

type PointerSink = (e: PointerEvent) => void;
const pointerSinks = new Set<PointerSink>();
let pointerFanInAttached = false;

function dispatchSharedPointer(e: PointerEvent): void {
  for (const sink of pointerSinks) sink(e);
}

function addPointerSink(sink: PointerSink): void {
  pointerSinks.add(sink);
  if (!pointerFanInAttached) {
    window.addEventListener('pointermove', dispatchSharedPointer, { passive: true });
    pointerFanInAttached = true;
  }
}

function removePointerSink(sink: PointerSink): void {
  pointerSinks.delete(sink);
  if (pointerSinks.size === 0 && pointerFanInAttached) {
    window.removeEventListener('pointermove', dispatchSharedPointer);
    pointerFanInAttached = false;
  }
}

type Uniforms = {
  time: WebGLUniformLocation;
  aspect: WebGLUniformLocation;
  intensity: WebGLUniformLocation;
  wispIntensity: WebGLUniformLocation;
  igniteTime: WebGLUniformLocation;
  extinguishTime: WebGLUniformLocation;
  mouseX: WebGLUniformLocation;
  hover: WebGLUniformLocation;
  wind: WebGLUniformLocation;
  upDraft: WebGLUniformLocation;
  press: WebGLUniformLocation;
  clickX: WebGLUniformLocation;
  arch: WebGLUniformLocation;
  freqX: WebGLUniformLocation;
  swayScale: WebGLUniformLocation;
  maxWisps: WebGLUniformLocation;
  edgeInset: WebGLUniformLocation;
  color: WebGLUniformLocation;
};

function compile(gl: WebGLRenderingContext, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    gl.deleteShader(s);
    return null;
  }
  return s;
}

const FALLBACK_ACCENT: [number, number, number] = [0.863, 0.992, 0.475];

function parseCssRgb(raw: string): [number, number, number] | null {
  const m = raw.match(/\d+(\.\d+)?/g);
  if (!m || m.length < 3) return null;
  const r = Number(m[0]);
  const g = Number(m[1]);
  const b = Number(m[2]);
  const a = m.length >= 4 ? Number(m[3]) : 1;
  // Transparent btn (circle) — ignore; color comes from .fire-btn__plate / --color-accent.
  if (!(a > 0.05)) return null;
  return [r / 255, g / 255, b / 255];
}

function parseBtnRgb(btn: HTMLElement): [number, number, number] {
  const plate = btn.querySelector('.fire-btn__plate') as HTMLElement | null;
  if (plate) {
    const fromPlate = parseCssRgb(getComputedStyle(plate).backgroundColor);
    if (fromPlate) return fromPlate;
  }
  const fromBtn = parseCssRgb(getComputedStyle(btn).backgroundColor);
  if (fromBtn) return fromBtn;
  try {
    const accent = getComputedStyle(document.documentElement)
      .getPropertyValue('--color-accent')
      .trim();
    if (accent) {
      const probe = document.createElement('span');
      probe.style.color = accent;
      probe.style.display = 'none';
      document.body.appendChild(probe);
      const parsed = parseCssRgb(getComputedStyle(probe).color);
      probe.remove();
      if (parsed) return parsed;
    }
  } catch {
    /* ignore */
  }
  return FALLBACK_ACCENT;
}

/** Cap canvas backing-store DPR — 3× phones burn fillrate for little gain. */
function cappedDpr(): number {
  return Math.min(window.devicePixelRatio || 1, 2);
}

/**
 * Mount WebGL flame crown on a fire button. Lit state is driven by the host
 * (session alive → lit; burn choreography → extinguish) — click does not toggle.
 */
export function mountFireButton(
  btn: HTMLElement,
  canvas: HTMLCanvasElement,
  initial: FireButtonConfig,
  options: FireButtonMountOptions = {}
): FireButtonHandle | null {
  const igniteParams = options.igniteParams ?? FIRE_IGNITE_SPRING;
  const extinguishParams = options.extinguishParams ?? FIRE_EXTINGUISH_SPRING;
  const isActiveZone = options.isActiveZone ?? (() => true);
  const shouldRun = options.shouldRun ?? (() => true);
  const intensityGain = Math.max(0.5, Math.min(1.6, options.intensityGain ?? 1));

  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
  });
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, FIRE_BTN_VS);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FIRE_BTN_FS);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;

  gl.useProgram(program);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(program, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uniforms: Uniforms = {
    time: gl.getUniformLocation(program, 'uTime')!,
    aspect: gl.getUniformLocation(program, 'uAspect')!,
    intensity: gl.getUniformLocation(program, 'uIntensity')!,
    wispIntensity: gl.getUniformLocation(program, 'uWispIntensity')!,
    igniteTime: gl.getUniformLocation(program, 'uIgniteTime')!,
    extinguishTime: gl.getUniformLocation(program, 'uExtinguishTime')!,
    mouseX: gl.getUniformLocation(program, 'uMouseX')!,
    hover: gl.getUniformLocation(program, 'uHover')!,
    wind: gl.getUniformLocation(program, 'uWind')!,
    upDraft: gl.getUniformLocation(program, 'uUpDraft')!,
    press: gl.getUniformLocation(program, 'uPress')!,
    clickX: gl.getUniformLocation(program, 'uClickX')!,
    arch: gl.getUniformLocation(program, 'uArch')!,
    freqX: gl.getUniformLocation(program, 'uFreqX')!,
    swayScale: gl.getUniformLocation(program, 'uSwayScale')!,
    maxWisps: gl.getUniformLocation(program, 'uMaxWisps')!,
    edgeInset: gl.getUniformLocation(program, 'uEdgeInset')!,
    color: gl.getUniformLocation(program, 'uColor')!,
  };

  let config: FireButtonConfig = { ...initial };
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let isLit = false;
  let intensity = 0;
  let intensityVel = 0;
  let wispIntensity = 0;
  let wispVel = 0;
  let mouseX = 0.5;
  let targetMouseX = 0.5;
  let proximity = 0;
  let proximityTarget = 0;
  let wind = 0;
  let windVel = 0;
  let upDraft = 0;
  let upDraftVel = 0;
  let press = 0;
  let pressVel = 0;
  let pressTarget = 0;
  let clickX = 0.5;
  let lastPointerX: number | null = null;
  let lastPointerY: number | null = null;
  let flameTime = 1.0 + config.arch * 3.7;
  let igniteTime = 1e6;
  let extinguishTime = -1e6;
  let lastNow = performance.now();
  let rafId: number | null = null;
  let destroyed = false;
  let cachedRgb: [number, number, number] | null = null;
  let rgbDirty = true;
  let lastDrawMs = 0;
  let idleSkipParity = 0;

  const invalidateRgb = () => {
    rgbDirty = true;
  };

  const animationAllowed = () =>
    !destroyed && !document.hidden && !reducedMotion.matches && shouldRun();

  const resolveRgb = (): [number, number, number] => {
    if (!rgbDirty && cachedRgb) return cachedRgb;
    cachedRgb = parseBtnRgb(btn);
    rgbDirty = false;
    return cachedRgb;
  };

  const drawFrame = () => {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (intensity <= 0.002 && wispIntensity <= 0.002) return;

    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const [r, g, b] = resolveRgb();

    gl.uniform1f(uniforms.time, reducedMotion.matches ? 1.5 : flameTime);
    gl.uniform1f(uniforms.aspect, aspect);
    gl.uniform1f(uniforms.intensity, Math.max(0, intensity) * intensityGain);
    gl.uniform1f(uniforms.wispIntensity, Math.max(0, wispIntensity) * intensityGain);
    gl.uniform1f(uniforms.igniteTime, igniteTime);
    gl.uniform1f(uniforms.extinguishTime, extinguishTime);
    gl.uniform1f(uniforms.mouseX, mouseX);
    gl.uniform1f(uniforms.hover, proximity);
    gl.uniform1f(uniforms.wind, wind);
    gl.uniform1f(uniforms.upDraft, upDraft);
    gl.uniform1f(uniforms.press, press);
    gl.uniform1f(uniforms.clickX, clickX);
    gl.uniform1f(uniforms.arch, config.arch);
    gl.uniform1f(uniforms.freqX, config.freqX);
    gl.uniform1f(uniforms.swayScale, config.swayScale);
    gl.uniform1f(uniforms.maxWisps, config.maxWisps);
    gl.uniform1f(uniforms.edgeInset, Math.max(0.01, Math.min(0.22, config.edgeInset)));
    gl.uniform3f(uniforms.color, r, g, b);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const resize = () => {
    if (destroyed) return;
    const dpr = cappedDpr();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w <= 0 || h <= 0) return;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    invalidateRgb();
    drawFrame();
  };

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const freezeLoop = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    drawFrame();
  };

  const ensureLoop = () => {
    if (!animationAllowed() || rafId !== null) return;
    lastNow = performance.now();
    rafId = requestAnimationFrame(render);
  };

  const syncLoop = () => {
    if (destroyed) return;
    if (!animationAllowed()) {
      freezeLoop();
      return;
    }
    if (isLit || intensity > 0.01) ensureLoop();
  };

  const triggerShine = () => {
    btn.classList.remove('is-igniting');
    void btn.offsetWidth;
    btn.classList.add('is-igniting');
  };

  const setLit = (nextLit: boolean, originX = 0.5, speedMode: FireLitSpeed = 'normal') => {
    if (destroyed) return;
    if (isLit === nextLit && speedMode !== 'instant') return;
    isLit = nextLit;
    clickX = Math.max(0, Math.min(1, originX));
    btn.classList.toggle('is-lit', isLit);
    btn.setAttribute('aria-pressed', String(isLit));

    if (isLit && speedMode !== 'instant' && !reducedMotion.matches) {
      triggerShine();
    } else if (!isLit) {
      btn.classList.remove('is-igniting');
    }

    if (reducedMotion.matches || speedMode === 'instant') {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      intensity = isLit ? 1 : 0;
      wispIntensity = isLit ? 1 : 0;
      intensityVel = 0;
      wispVel = 0;
      wind = 0;
      windVel = 0;
      upDraft = 0;
      upDraftVel = 0;
      igniteTime = isLit ? -10 : 1e6;
      extinguishTime = isLit ? 1e6 : -10;
      drawFrame();
      return;
    }

    if (isLit) {
      if (intensity < 0.35) {
        igniteTime = flameTime;
      } else if (extinguishTime < 1e5) {
        igniteTime = Math.max(igniteTime, extinguishTime);
      }
      extinguishTime = 1e6;
    } else {
      extinguishTime = flameTime;
    }
    ensureLoop();
  };

  const render = (now: number) => {
    if (destroyed) return;
    if (!animationAllowed()) {
      rafId = null;
      freezeLoop();
      return;
    }
    const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
    lastNow = now;
    const target = isLit ? 1 : 0;
    const sp = isLit ? igniteParams : extinguishParams;

    [intensity, intensityVel] = exactSpring(intensity, intensityVel, target, sp.omega0, sp.zeta, dt);
    [wispIntensity, wispVel] = exactSpring(
      wispIntensity,
      wispVel,
      target,
      isLit ? sp.omega0 * 0.9 : 4.8,
      isLit ? 1.04 : 1.06,
      dt
    );
    [wind, windVel] = exactSpring(wind, windVel, 0, 7.2, 0.72, dt);
    [upDraft, upDraftVel] = exactSpring(upDraft, upDraftVel, 0, 6.8, 0.76, dt);
    [press, pressVel] = exactSpring(press, pressVel, pressTarget, 18.0, 0.68, dt);

    proximity += (proximityTarget - proximity) * (1 - Math.exp(-7.5 * dt));
    mouseX += (targetMouseX - mouseX) * (1 - Math.exp(-9.0 * dt));

    if (intensity < 0) {
      intensity = 0;
      intensityVel = 0;
    }
    if (wispIntensity < 0) {
      wispIntensity = 0;
      wispVel = 0;
    }

    flameTime += dt * (0.42 + 0.58 * Math.min(1, intensity)) * (1 + proximity * 0.14);

    // Idle lit crowns (~TopBar): ~30fps draw when nothing is interacting.
    const idle =
      isLit &&
      proximity < 0.05 &&
      press < 0.05 &&
      Math.abs(wind) < 0.04 &&
      Math.abs(upDraft) < 0.04;
    if (idle) {
      idleSkipParity ^= 1;
      if (idleSkipParity && now - lastDrawMs < 28) {
        rafId = requestAnimationFrame(render);
        return;
      }
    } else {
      idleSkipParity = 0;
    }
    lastDrawMs = now;
    drawFrame();

    if (!isLit && intensity <= 0.003 && wispIntensity <= 0.003) {
      intensity = 0;
      wispIntensity = 0;
      intensityVel = 0;
      wispVel = 0;
      wind = 0;
      windVel = 0;
      upDraft = 0;
      upDraftVel = 0;
      drawFrame();
      rafId = null;
      return;
    }

    rafId = requestAnimationFrame(render);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (destroyed) return;
    if (!isActiveZone()) {
      proximityTarget = 0;
      lastPointerX = null;
      lastPointerY = null;
      return;
    }
    const rect = btn.getBoundingClientRect();
    if (rect.width <= 0) return;

    const dxOut = Math.max(0, rect.left - e.clientX, e.clientX - rect.right);
    const dyOut = Math.max(0, rect.top - 58 - e.clientY, e.clientY - rect.bottom);
    const dist = Math.hypot(dxOut, dyOut);
    const prox = Math.exp(-(dist * dist) / (80 * 80));
    proximityTarget = prox;

    const nx = (e.clientX - rect.left) / rect.width;
    targetMouseX = Math.max(-0.25, Math.min(1.25, nx));
    btn.style.setProperty('--mx', `${(Math.max(0, Math.min(1, nx)) * 100).toFixed(1)}%`);

    if (lastPointerX !== null && !reducedMotion.matches && prox > 0.03) {
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY!;
      windVel = Math.max(-8.0, Math.min(8.0, windVel + dx * 0.16 * prox));
      upDraftVel = Math.max(-5.0, Math.min(6.5, upDraftVel - dy * 0.11 * prox));
    }

    lastPointerX = e.clientX;
    lastPointerY = e.clientY;
    if (isLit || intensity > 0.01) ensureLoop();
  };

  const resetPointer = () => {
    proximityTarget = 0;
    pressTarget = 0;
    lastPointerX = null;
    lastPointerY = null;
  };

  const onPointerDown = () => {
    pressTarget = 1;
    if (isLit) ensureLoop();
  };
  const onPointerUp = () => {
    pressTarget = 0;
  };
  const onVisibility = () => {
    if (document.hidden) {
      freezeLoop();
      return;
    }
    lastNow = performance.now();
    syncLoop();
  };
  const onReducedChange = () => {
    if (reducedMotion.matches && isLit) setLit(true, clickX, 'instant');
  };

  // Theme / accent swaps rarely — observe once instead of probing CSS every frame.
  const themeMo = new MutationObserver(invalidateRgb);
  themeMo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-theme', 'style'],
  });

  addPointerSink(onPointerMove);
  document.addEventListener('pointerleave', resetPointer);
  window.addEventListener('blur', resetPointer);
  btn.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  document.addEventListener('visibilitychange', onVisibility);
  reducedMotion.addEventListener('change', onReducedChange);

  return {
    setLit,
    setConfig(next) {
      config = { ...config, ...next };
      invalidateRgb();
      if (isLit) ensureLoop();
    },
    syncLoop,
    destroy() {
      destroyed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      ro.disconnect();
      themeMo.disconnect();
      removePointerSink(onPointerMove);
      document.removeEventListener('pointerleave', resetPointer);
      window.removeEventListener('blur', resetPointer);
      btn.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      document.removeEventListener('visibilitychange', onVisibility);
      reducedMotion.removeEventListener('change', onReducedChange);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (buf) gl.deleteBuffer(buf);
    },
  };
}

export const FIRE_BTN_CIRCLE: FireButtonConfig = {
  arch: 1,
  freqX: 1.48,
  swayScale: 1.6,
  maxWisps: 3,
  edgeInset: 0.14,
};

export const FIRE_BTN_PILL: FireButtonConfig = {
  arch: 0,
  freqX: 1,
  swayScale: 1,
  maxWisps: 5,
  edgeInset: 0.072,
};

/** Wide plaza title rim — soft, sparse tongues that hug the side edges. */
export const FIRE_BTN_TITLE_RIM: FireButtonConfig = {
  arch: 0,
  freqX: 0.88,
  swayScale: 0.9,
  maxWisps: 1,
  edgeInset: 0.022,
};
