import { IGNITE_BURN_FS, IGNITE_BURN_VS } from './shaders';

export const IGNITE_BURN_DURATION_MS = 2150;
export const IGNITE_BURN_START_MS = 280;
/** Button fade starts with `starting` (Motion); this marks burn-btn class + shell reveal. */
/** Shell + extinguish control reveal — keep early so TopBar fire isn't waiting on burn end. */
export const IGNITE_BURN_BTN_FADE_MS = 280;
export const IGNITE_BURN_BRAND_FADE_MS = 560;
export const IGNITE_REDUCED_MS = 220;

export interface IgniteBurnGeometry {
  ox: number;
  oy: number;
  halfW: number;
  halfH: number;
  radius: number;
  aspect: number;
  startFront: number;
  endFront: number;
}

export interface IgniteBurnHandle {
  drawIdle: () => void;
  start: (opts?: { onComplete?: () => void }) => void;
  destroy: () => void;
}

type BurnUniforms = {
  time: WebGLUniformLocation;
  aspect: WebGLUniformLocation;
  progress: WebGLUniformLocation;
  front: WebGLUniformLocation;
  origin: WebGLUniformLocation;
  btnHalf: WebGLUniformLocation;
  btnRadius: WebGLUniformLocation;
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

function quinticEase(p: number): number {
  return p * p * p * (p * (p * 6 - 15) + 10);
}

function measureGeometry(
  frameEl: HTMLElement,
  btnEl: HTMLElement,
  btnRadiusPx = 16
): IgniteBurnGeometry {
  const frameRect = frameEl.getBoundingClientRect();
  const btnRect = btnEl.getBoundingClientRect();
  const fw = Math.max(1, frameRect.width);
  const fh = Math.max(1, frameRect.height);
  const aspect = fw / fh;

  const ox = (btnRect.left + btnRect.width * 0.5 - frameRect.left) / fw;
  const oy = 1 - (btnRect.top + btnRect.height * 0.5 - frameRect.top) / fh;
  const halfW = (btnRect.width * 0.5) / fh;
  const halfH = (btnRect.height * 0.5) / fh;
  const radius = btnRadiusPx / fh;

  let maxDist = 0;
  for (const [cx, cy] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ] as const) {
    const dx = (cx - ox) * aspect;
    const dy = cy - oy;
    const dyW = dy > 0 ? dy * 0.62 : dy * 1.24;
    const qx = Math.abs(dx) - (halfW - radius);
    const qy = Math.abs(dyW) - (halfH - radius);
    const d =
      Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
    maxDist = Math.max(maxDist, d);
  }

  return {
    ox,
    oy,
    halfW,
    halfH,
    radius,
    aspect,
    startFront: -halfH * 0.5,
    endFront: maxDist + 0.3,
  };
}

export type MountIgniteBurnOpts = {
  getFrameEl: () => HTMLElement | null;
  getOriginBtn: () => HTMLElement | null;
  /** Accent lime — matches --color-accent. */
  color?: [number, number, number];
};

/**
 * Full-viewport WebGL burn that eats the black intro from the CTA pill outward.
 */
export function mountIgniteBurn(
  canvas: HTMLCanvasElement,
  opts: MountIgniteBurnOpts
): IgniteBurnHandle | null {
  const color = opts.color ?? ([0.863, 0.992, 0.475] as [number, number, number]);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const gl = canvas.getContext('webgl', {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
  });
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, IGNITE_BURN_VS);
  const fs = compile(gl, gl.FRAGMENT_SHADER, IGNITE_BURN_FS);
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

  const uniforms: BurnUniforms = {
    time: gl.getUniformLocation(program, 'uTime')!,
    aspect: gl.getUniformLocation(program, 'uAspect')!,
    progress: gl.getUniformLocation(program, 'uBurnProgress')!,
    front: gl.getUniformLocation(program, 'uFront')!,
    origin: gl.getUniformLocation(program, 'uOrigin')!,
    btnHalf: gl.getUniformLocation(program, 'uBtnHalf')!,
    btnRadius: gl.getUniformLocation(program, 'uBtnRadius')!,
    color: gl.getUniformLocation(program, 'uColor')!,
  };

  let destroyed = false;
  let burnState: 'idle' | 'burning' | 'done' = 'idle';
  let burnStart = 0;
  let burnRaf: number | null = null;
  let lastProgress = 0;
  let lastFront = -0.05;
  let lastTime = 1.0;
  let geo: IgniteBurnGeometry = {
    ox: 0.5,
    oy: 0.25,
    halfW: 0.12,
    halfH: 0.03,
    radius: 0.02,
    aspect: 1,
    startFront: -0.02,
    endFront: 1.2,
  };

  const refreshGeo = () => {
    const frame = opts.getFrameEl();
    const btn = opts.getOriginBtn();
    if (frame && btn) geo = measureGeometry(frame, btn);
  };

  const drawBurn = (progress: number, front: number, time: number) => {
    lastProgress = progress;
    lastFront = front;
    lastTime = time;
    if (destroyed) return;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(uniforms.time, time);
    gl.uniform1f(uniforms.aspect, geo.aspect);
    gl.uniform1f(uniforms.progress, progress);
    gl.uniform1f(uniforms.front, front);
    gl.uniform2f(uniforms.origin, geo.ox, geo.oy);
    gl.uniform2f(uniforms.btnHalf, geo.halfW, geo.halfH);
    gl.uniform1f(uniforms.btnRadius, geo.radius);
    gl.uniform3f(uniforms.color, color[0], color[1], color[2]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const resize = () => {
    if (destroyed) return;
    // Cap DPR — full-viewport burn at 3× is fillrate-heavy on mobile.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w <= 0 || h <= 0) return;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (burnState !== 'done') {
      refreshGeo();
      drawBurn(lastProgress, lastFront, lastTime);
    }
  };

  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const drawIdle = () => {
    refreshGeo();
    burnState = 'idle';
    drawBurn(0, geo.startFront, 1.0);
  };

  drawIdle();

  const animateBurn = (now: number) => {
    if (destroyed) return;
    const elapsed = (now - burnStart) / 1000;
    const duration = IGNITE_BURN_DURATION_MS / 1000;
    const p = Math.min(1, elapsed / duration);
    const eased = quinticEase(p);
    const front = geo.startFront + eased * (geo.endFront - geo.startFront);
    drawBurn(p, front, 1.0 + elapsed);

    if (p < 1) {
      burnRaf = requestAnimationFrame(animateBurn);
    } else {
      burnState = 'done';
      burnRaf = null;
      onCompleteRef?.();
      onCompleteRef = null;
    }
  };

  let onCompleteRef: (() => void) | null = null;
  let reducedTimer: number | null = null;

  return {
    drawIdle,
    start({ onComplete } = {}) {
      if (burnState !== 'idle') return;
      burnState = 'burning';
      onCompleteRef = onComplete ?? null;
      refreshGeo();

      if (reducedMotion.matches || !gl) {
        burnState = 'done';
        reducedTimer = window.setTimeout(() => {
          reducedTimer = null;
          onCompleteRef?.();
          onCompleteRef = null;
        }, IGNITE_REDUCED_MS);
        return;
      }

      burnStart = performance.now();
      burnRaf = requestAnimationFrame(animateBurn);
    },
    destroy() {
      destroyed = true;
      if (burnRaf !== null) cancelAnimationFrame(burnRaf);
      burnRaf = null;
      if (reducedTimer !== null) {
        window.clearTimeout(reducedTimer);
        reducedTimer = null;
      }
      onCompleteRef = null;
      ro.disconnect();
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (buf) gl.deleteBuffer(buf);
    },
  };
}
