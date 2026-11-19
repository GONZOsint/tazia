import { FIRE_BTN_FS, FIRE_BTN_VS } from './shaders';

export interface FireButtonConfig {
  /** 1 = circular base arc; 0 = flat pill base. */
  arch: number;
  freqX: number;
  swayScale: number;
  maxWisps: number;
}

export interface FireButtonHandle {
  setLit: (lit: boolean, originX?: number) => void;
  setConfig: (next: Partial<FireButtonConfig>) => void;
  destroy: () => void;
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

function stepSpring(
  pos: number,
  vel: number,
  target: number,
  stiffness: number,
  damping: number,
  dt: number
): [number, number] {
  const acc = stiffness * (target - pos) - damping * vel;
  vel += acc * dt;
  pos += vel * dt;
  return [pos, vel];
}

function parseBtnRgb(btn: HTMLElement): [number, number, number] {
  const rgb = getComputedStyle(btn).backgroundColor.match(/\d+(\.\d+)?/g);
  if (!rgb) return [0.8, 1, 0.4];
  return [Number(rgb[0]) / 255, Number(rgb[1]) / 255, Number(rgb[2]) / 255];
}

/**
 * Mount WebGL flame crown on a fire button. Lit state is driven by the host
 * (session alive → lit; burn choreography → extinguish) — click does not toggle.
 */
export function mountFireButton(
  btn: HTMLElement,
  canvas: HTMLCanvasElement,
  initial: FireButtonConfig
): FireButtonHandle | null {
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true });
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
  let windImpulse = 0;
  let upDraft = 0;
  let upDraftVel = 0;
  let upImpulse = 0;
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

  const resize = () => {
    if (destroyed) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w <= 0 || h <= 0) return;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const drawFrame = () => {
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (intensity <= 0.002 && wispIntensity <= 0.002) return;

    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    const [r, g, b] = parseBtnRgb(btn);

    gl.uniform1f(uniforms.time, reducedMotion.matches ? 1.5 : flameTime);
    gl.uniform1f(uniforms.aspect, aspect);
    gl.uniform1f(uniforms.intensity, Math.max(0, intensity));
    gl.uniform1f(uniforms.wispIntensity, Math.max(0, wispIntensity));
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
    gl.uniform3f(uniforms.color, r, g, b);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const ensureLoop = () => {
    if (destroyed || rafId !== null || reducedMotion.matches) return;
    lastNow = performance.now();
    rafId = requestAnimationFrame(render);
  };

  const setLit = (nextLit: boolean, originX = 0.5) => {
    if (destroyed) return;
    if (isLit === nextLit) return;
    isLit = nextLit;
    clickX = Math.max(0, Math.min(1, originX));
    btn.classList.toggle('is-lit', isLit);
    btn.setAttribute('aria-pressed', String(isLit));

    if (reducedMotion.matches) {
      intensity = isLit ? 1 : 0;
      wispIntensity = isLit ? 1 : 0;
      intensityVel = 0;
      wispVel = 0;
      igniteTime = isLit ? -10 : 1e6;
      extinguishTime = isLit ? 1e6 : -10;
      drawFrame();
      return;
    }

    if (isLit) {
      if (intensity < 0.35) igniteTime = flameTime;
      extinguishTime = 1e6;
    } else {
      extinguishTime = flameTime;
    }
    ensureLoop();
  };

  const render = (now: number) => {
    if (destroyed) return;
    const frameDt = Math.min(0.033, Math.max(0.001, (now - lastNow) / 1000));
    lastNow = now;
    const subSteps = 2;
    const dt = frameDt / subSteps;
    const target = isLit ? 1 : 0;

    for (let i = 0; i < subSteps; i++) {
      const kMain = isLit ? 32 : 38;
      const dMain = isLit ? 11.3 : 12.3;
      [intensity, intensityVel] = stepSpring(intensity, intensityVel, target, kMain, dMain, dt);

      const kWisp = isLit ? 26 : 24;
      const dWisp = isLit ? 10.2 : 9.8;
      [wispIntensity, wispVel] = stepSpring(wispIntensity, wispVel, target, kWisp, dWisp, dt);

      [wind, windVel] = stepSpring(wind, windVel, windImpulse, 55, 11.5, dt);
      windImpulse *= Math.exp(-8.5 * dt);

      [upDraft, upDraftVel] = stepSpring(upDraft, upDraftVel, upImpulse, 48, 11.0, dt);
      upImpulse *= Math.exp(-7.5 * dt);

      [press, pressVel] = stepSpring(press, pressVel, pressTarget, 320, 24, dt);
    }

    proximity += (proximityTarget - proximity) * Math.min(1, frameDt * 7.5);
    mouseX += (targetMouseX - mouseX) * Math.min(1, frameDt * 9);

    if (intensity < 0) {
      intensity = 0;
      intensityVel = 0;
    }
    if (wispIntensity < 0) {
      wispIntensity = 0;
      wispVel = 0;
    }

    const hoverPace = 1 + proximity * 0.14;
    flameTime += frameDt * (0.42 + 0.58 * Math.min(1, intensity)) * hoverPace;
    drawFrame();

    if (!isLit && intensity <= 0.003 && wispIntensity <= 0.003) {
      intensity = 0;
      wispIntensity = 0;
      intensityVel = 0;
      wispVel = 0;
      drawFrame();
      rafId = null;
      return;
    }

    rafId = requestAnimationFrame(render);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (destroyed) return;
    const rect = btn.getBoundingClientRect();
    if (rect.width <= 0) return;

    const dxOut = Math.max(0, rect.left - e.clientX, e.clientX - rect.right);
    const dyOut = Math.max(0, rect.top - 58 - e.clientY, e.clientY - rect.bottom);
    const dist = Math.hypot(dxOut, dyOut);
    const radius = 80;
    const prox = Math.exp(-(dist * dist) / (radius * radius));
    proximityTarget = prox;

    const nx = (e.clientX - rect.left) / rect.width;
    targetMouseX = Math.max(-0.25, Math.min(1.25, nx));
    const clampedCss = Math.max(0, Math.min(1, nx));
    btn.style.setProperty('--mx', `${(clampedCss * 100).toFixed(1)}%`);

    if (lastPointerX !== null && !reducedMotion.matches && prox > 0.03) {
      const dx = e.clientX - lastPointerX;
      const dy = e.clientY - lastPointerY!;
      windImpulse = Math.max(-1.25, Math.min(1.25, windImpulse + dx * 0.036 * prox));
      upImpulse = Math.max(-0.6, Math.min(1.1, upImpulse - dy * 0.024 * prox));
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
    if (!document.hidden) lastNow = performance.now();
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerleave', resetPointer);
  window.addEventListener('blur', resetPointer);
  btn.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  document.addEventListener('visibilitychange', onVisibility);

  return {
    setLit,
    setConfig(next) {
      config = { ...config, ...next };
      if (isLit) ensureLoop();
    },
    destroy() {
      destroyed = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
      ro.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', resetPointer);
      window.removeEventListener('blur', resetPointer);
      btn.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      document.removeEventListener('visibilitychange', onVisibility);
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
};

export const FIRE_BTN_PILL: FireButtonConfig = {
  arch: 0,
  freqX: 1,
  swayScale: 1,
  maxWisps: 5,
};
