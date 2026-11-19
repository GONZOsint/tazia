import { QR_SECRET_FIRE } from './budget';

export type PerimeterPoint = {
  x: number;
  y: number;
  nx: number;
  ny: number;
};

export type QrSecretFireGeom = {
  /** CSS pixel size of the square canvas. */
  canvasSize: number;
  /** Top-left of the rounded rect in canvas CSS coords. */
  lineOffset: number;
  /** Width/height of the rounded rect. */
  lineSize: number;
  /** Corner radius matching the QR card. */
  lineRadius: number;
};

/**
 * Point + outward normal along a rounded-rect perimeter.
 * t=0 starts at top-center for a symmetric ignite.
 * r is clamped to [0, min(w,h)/2]; r===0 is a sharp rectangle (no arc / r).
 */
export function getPerimeterPoint(
  t: number,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): PerimeterPoint {
  t = ((t % 1) + 1) % 1;
  const maxR = Math.min(w, h) / 2;
  r = Math.max(0, Math.min(r, maxR));

  const sw = w - 2 * r;
  const sh = h - 2 * r;
  const halfSw = sw / 2;

  if (r === 0) {
    const total = 2 * w + 2 * h;
    let d = t * total;

    if (d <= halfSw) return { x: x + w / 2 + d, y, nx: 0, ny: -1 };
    d -= halfSw;
    if (d <= h) return { x: x + w, y: y + d, nx: 1, ny: 0 };
    d -= h;
    if (d <= w) return { x: x + w - d, y: y + h, nx: 0, ny: 1 };
    d -= w;
    if (d <= h) return { x, y: y + h - d, nx: -1, ny: 0 };
    d -= h;
    return { x: x + d, y, nx: 0, ny: -1 };
  }

  const arc = (Math.PI / 2) * r;
  const total = 2 * sw + 2 * sh + 4 * arc;
  let d = t * total;

  if (d <= halfSw) return { x: x + w / 2 + d, y, nx: 0, ny: -1 };
  d -= halfSw;

  if (d <= arc) {
    const a = -Math.PI / 2 + d / r;
    return {
      x: x + w - r + Math.cos(a) * r,
      y: y + r + Math.sin(a) * r,
      nx: Math.cos(a),
      ny: Math.sin(a),
    };
  }
  d -= arc;

  if (d <= sh) return { x: x + w, y: y + r + d, nx: 1, ny: 0 };
  d -= sh;

  if (d <= arc) {
    const a = d / r;
    return {
      x: x + w - r + Math.cos(a) * r,
      y: y + h - r + Math.sin(a) * r,
      nx: Math.cos(a),
      ny: Math.sin(a),
    };
  }
  d -= arc;

  if (d <= sw) return { x: x + w - r - d, y: y + h, nx: 0, ny: 1 };
  d -= sw;

  if (d <= arc) {
    const a = Math.PI / 2 + d / r;
    return {
      x: x + r + Math.cos(a) * r,
      y: y + h - r + Math.sin(a) * r,
      nx: Math.cos(a),
      ny: Math.sin(a),
    };
  }
  d -= arc;

  if (d <= sh) return { x, y: y + h - r - d, nx: -1, ny: 0 };
  d -= sh;

  if (d <= arc) {
    const a = Math.PI + d / r;
    return {
      x: x + r + Math.cos(a) * r,
      y: y + r + Math.sin(a) * r,
      nx: Math.cos(a),
      ny: Math.sin(a),
    };
  }
  d -= arc;

  return { x: x + r + d, y, nx: 0, ny: -1 };
}

export function geomForQrSurface(surfaceCss: number, radiusCss = 10): QrSecretFireGeom {
  const pad = QR_SECRET_FIRE.pad;
  return {
    canvasSize: surfaceCss + pad * 2,
    lineOffset: pad,
    lineSize: surfaceCss,
    lineRadius: radiusCss,
  };
}
