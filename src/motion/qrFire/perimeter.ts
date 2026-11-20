import { QR_SECRET_FIRE } from './budget';

export type QrSecretFireGeom = {
  /** CSS pixel size of the square canvas. */
  canvasSize: number;
  /** Top-left of the rounded rect in canvas CSS coords. */
  lineOffset: number;
  /** Width/height of the rounded rect. */
  lineSize: number;
  /** Corner radius matching the outer QR card. */
  lineRadius: number;
};

/**
 * Fire line around the outer QR card frame (outside the box).
 * `faceInset` kept for callers; use 0 to hug the card chrome.
 */
export function geomForQrSurface(
  surfaceCss: number,
  radiusCss = 10,
  faceInset = 0
): QrSecretFireGeom {
  const pad = QR_SECRET_FIRE.pad;
  const safeSurface = Number.isFinite(surfaceCss) && surfaceCss > 0 ? surfaceCss : 0;
  const inset = Math.max(0, Math.min(faceInset, safeSurface * 0.45));
  const boxSize = Math.max(0, safeSurface - inset * 2);
  const boxRadius = Number.isFinite(radiusCss)
    ? Math.max(0, Math.min(radiusCss, boxSize * 0.5))
    : 0;

  return {
    canvasSize: safeSurface + pad * 2,
    lineOffset: pad + inset,
    lineSize: boxSize,
    lineRadius: boxRadius,
  };
}
