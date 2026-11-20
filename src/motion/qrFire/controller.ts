import { exactSpring } from '../fireButton/exactSpring';
import { QR_SECRET_FIRE } from './budget';
import type { QrSecretFireGeom } from './perimeter';
import { QR_FIRE_FS, QR_FIRE_VS } from './shaders';

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
let cachedAccent: [number, number, number] | null = null;
let cachedAccentRaw = '';

function accentRgb(): [number, number, number] {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--color-accent').trim();
    if (cachedAccent && raw === cachedAccentRaw) return cachedAccent;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return FALLBACK_ACCENT;
    ctx.fillStyle = raw || '#dcfd79';
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    cachedAccentRaw = raw;
    cachedAccent = [r / 255, g / 255, b / 255];
    return cachedAccent;
  } catch {
    return FALLBACK_ACCENT;
  }
}

type Uniforms = {
  time: WebGLUniformLocation;
  aspect: WebGLUniformLocation;
  intensity: WebGLUniformLocation;
  sweep: WebGLUniformLocation;
  rectMin: WebGLUniformLocation;
  rectMax: WebGLUniformLocation;
  radius: WebGLUniformLocation;
  color: WebGLUniformLocation;
};

/**
 * WebGL perimeter fire for secret invite QR (replaces Canvas2D qrFire particles).
 */
export class QrSecretFireController {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private vs: WebGLShader;
  private fs: WebGLShader;
  private buf: WebGLBuffer;
  private uniforms: Uniforms;
  private geom: QrSecretFireGeom;
  private fireOn = false;
  private intensity = 0;
  private intensityVel = 0;
  private sweep = 0;
  private sweepVel = 0;
  private flameTime = 1;
  private raf = 0;
  private lastTs = 0;
  private disposed = false;
  private lastCssSize = -1;
  private lastDpr = -1;
  private color: [number, number, number] = [0.863, 0.992, 0.475];
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  private readonly onFrame = (ts: number) => this.tick(ts);
  private readonly onVisibility = () => {
    if (document.hidden) {
      if (this.raf) {
        cancelAnimationFrame(this.raf);
        this.raf = 0;
      }
      return;
    }
    if (this.fireOn || this.intensity > 0.01) this.ensureLoop();
  };

  constructor(canvas: HTMLCanvasElement, geom: QrSecretFireGeom) {
    const gl = canvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
    });
    if (!gl) throw new Error('webgl unavailable');

    const vs = compile(gl, gl.VERTEX_SHADER, QR_FIRE_VS);
    const fs = compile(gl, gl.FRAGMENT_SHADER, QR_FIRE_FS);
    if (!vs || !fs) throw new Error('qr fire shader compile failed');

    const program = gl.createProgram();
    if (!program) throw new Error('qr fire program failed');
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('qr fire link failed');
    }

    gl.useProgram(program);
    const buf = gl.createBuffer();
    if (!buf) throw new Error('qr fire buffer failed');
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    this.canvas = canvas;
    this.gl = gl;
    this.program = program;
    this.vs = vs;
    this.fs = fs;
    this.buf = buf;
    this.geom = geom;
    this.uniforms = {
      time: gl.getUniformLocation(program, 'uTime')!,
      aspect: gl.getUniformLocation(program, 'uAspect')!,
      intensity: gl.getUniformLocation(program, 'uIntensity')!,
      sweep: gl.getUniformLocation(program, 'uSweep')!,
      rectMin: gl.getUniformLocation(program, 'uRectMin')!,
      rectMax: gl.getUniformLocation(program, 'uRectMax')!,
      radius: gl.getUniformLocation(program, 'uRadius')!,
      color: gl.getUniformLocation(program, 'uColor')!,
    };
    this.color = accentRgb();
    this.syncCanvasSize();
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  setGeom(geom: QrSecretFireGeom) {
    if (this.disposed) return;
    this.geom = geom;
    this.syncCanvasSize();
  }

  setFireOn(on: boolean) {
    if (this.disposed) return;
    this.fireOn = on;
    if (on) this.color = accentRgb();
    if (this.reducedMotion.matches) {
      this.intensity = on ? 1 : 0;
      this.sweep = on ? 0.5 : 0;
      this.intensityVel = 0;
      this.sweepVel = 0;
      this.draw();
      return;
    }
    if (on || this.intensity > 0.01) this.ensureLoop();
  }

  dispose() {
    this.disposed = true;
    this.fireOn = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    document.removeEventListener('visibilitychange', this.onVisibility);
    const { gl } = this;
    gl.deleteProgram(this.program);
    gl.deleteShader(this.vs);
    gl.deleteShader(this.fs);
    gl.deleteBuffer(this.buf);
    this.canvas.width = 0;
    this.canvas.height = 0;
  }

  private syncCanvasSize() {
    const dpr = Math.min(window.devicePixelRatio || 1, QR_SECRET_FIRE.maxDpr);
    const css = Math.max(0, this.geom.canvasSize);
    if (css === this.lastCssSize && dpr === this.lastDpr) return;
    this.lastCssSize = css;
    this.lastDpr = dpr;
    const px = Math.round(css * dpr);
    this.canvas.width = px;
    this.canvas.height = px;
    this.canvas.style.width = `${css}px`;
    this.canvas.style.height = `${css}px`;
    this.gl.viewport(0, 0, px, px);
  }

  private ensureLoop() {
    if (this.disposed || this.raf || document.hidden) return;
    this.lastTs = performance.now();
    this.raf = requestAnimationFrame(this.onFrame);
  }

  private draw() {
    const { gl, geom } = this;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (this.intensity <= 0.002) return;

    const css = Math.max(1, geom.canvasSize);
    const min = geom.lineOffset / css;
    const max = (geom.lineOffset + geom.lineSize) / css;
    const radius = geom.lineRadius / css;

    gl.useProgram(this.program);
    gl.uniform1f(this.uniforms.time, this.reducedMotion.matches ? 1.5 : this.flameTime);
    gl.uniform1f(this.uniforms.aspect, 1);
    gl.uniform1f(this.uniforms.intensity, Math.max(0, this.intensity));
    gl.uniform1f(this.uniforms.sweep, Math.max(0, Math.min(0.5, this.sweep)));
    gl.uniform2f(this.uniforms.rectMin, min, min);
    gl.uniform2f(this.uniforms.rectMax, max, max);
    gl.uniform1f(this.uniforms.radius, radius);
    gl.uniform3f(this.uniforms.color, this.color[0], this.color[1], this.color[2]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  private tick(now: number) {
    if (this.disposed) {
      this.raf = 0;
      return;
    }
    if (document.hidden) {
      this.raf = 0;
      return;
    }

    this.syncCanvasSize();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTs) / 1000));
    this.lastTs = now;

    const target = this.fireOn ? 1 : 0;
    [this.intensity, this.intensityVel] = exactSpring(
      this.intensity,
      this.intensityVel,
      target,
      this.fireOn ? 7.2 : 5.6,
      1.02,
      dt
    );
    // 0.52 clears the bottom of the perimeter (arc max ≈ 0.5).
    [this.sweep, this.sweepVel] = exactSpring(
      this.sweep,
      this.sweepVel,
      this.fireOn ? 0.52 : 0,
      5.0,
      0.95,
      dt
    );

    if (this.intensity < 0) {
      this.intensity = 0;
      this.intensityVel = 0;
    }
    if (this.sweep < 0) {
      this.sweep = 0;
      this.sweepVel = 0;
    }

    this.flameTime += dt * (0.82 + 1.05 * Math.min(1, this.intensity));
    this.draw();

    const needs =
      this.fireOn || this.intensity > 0.003 || Math.abs(this.intensityVel) > 0.01;
    if (needs) {
      this.raf = requestAnimationFrame(this.onFrame);
    } else {
      this.raf = 0;
      this.intensity = 0;
      this.sweep = 0;
      this.draw();
    }
  }
}
