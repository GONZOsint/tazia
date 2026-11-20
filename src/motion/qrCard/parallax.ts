/**
 * QR card 3D pose math + DOM writers.
 * REST / TOUCH_REST must stay in sync with CSS defaults in styles/qr.css
 * (`.qr-surface-3d` desktop rest and touch static pose).
 */

export type QrPose = { rotX: number; rotY: number; z: number; scale: number };

/** Rest pose — soft desk-lamp angle; keep ≤~10° so the QR stays readable. */
export const REST = { rotX: 5.5, rotY: -4.5, z: 0, scale: 1 } as const satisfies QrPose;
/** Touch: steeper desk angle so depth reads without hover parallax. */
export const TOUCH_REST = { rotX: 9.5, rotY: -7.2, z: 2, scale: 1 } as const satisfies QrPose;
/** Max extra degrees from rest when the pointer is near. */
export const TILT_RANGE = 7;
export const TOUCH_TILT_RANGE = 11;
/** Lift (px) at full nearness — used for shadow/glare normalization. */
export const LIFT_Z = 8;
export const TOUCH_LIFT_Z = 14;
/** Lerp factor per frame @60fps — lower = silkier follow. */
export const FOLLOW = 0.12;
export const TOUCH_FOLLOW = 0.18;
/** Idle return when the pointer is far from the card. */
export const RETURN = 0.065;
export const TOUCH_RETURN = 0.09;
/** Beyond this normalized distance, ease back toward rest. */
export const IDLE_DIST = 2.35;
/** Soft breathing amplitude (deg / px) while a finger isn't on the card. */
export const IDLE_BREATH = { rotX: 1.35, rotY: 1.1, z: 1.6, scale: 0 } as const;
/** Desktop idle — much lighter so the QR stays scannable at rest. */
export const DESKTOP_IDLE_BREATH = { rotX: 0.38, rotY: 0.3, z: 0.45, scale: 0.005 } as const;
export const IDLE_BREATH_MS = 5200;

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function targetFromPointer(
  stage: HTMLElement,
  clientX: number,
  clientY: number,
  rest: QrPose,
  tiltRange: number,
  liftZ: number,
  /** Touch drag stays engaged past the card edge; mouse uses soft falloff. */
  locked = false,
): QrPose {
  // Measure against the flat perspective stage — never the tilting surface
  // (tilted getBoundingClientRect feeds back into the next frame and jitters).
  const r = stage.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return { ...rest };

  const cx = r.left + r.width * 0.5;
  const cy = r.top + r.height * 0.5;
  const nx = (clientX - cx) / (r.width * 0.5);
  const ny = (clientY - cy) / (r.height * 0.5);
  const dist = Math.hypot(nx, ny);

  if (!locked && dist > IDLE_DIST) return { ...rest };

  // Soft falloff past the card edge keeps continuous tracking without snaps.
  const falloff = locked ? 1 : 1 / (1 + Math.max(0, dist - 0.95) * 1.15);
  const limit = locked ? 1.15 : 1.05;
  const clampedX = clamp(nx, -limit, limit) * falloff;
  const clampedY = clamp(ny, -limit, limit) * falloff;
  const near = locked
    ? Math.min(1, 0.55 + (1 - Math.min(1, dist)) * 0.45)
    : Math.min(1, falloff);

  return {
    rotX: rest.rotX - clampedY * tiltRange,
    rotY: rest.rotY + clampedX * tiltRange,
    z: rest.z + liftZ * near,
    scale: rest.scale + (locked ? 0.02 : 0.012) * near,
  };
}

export function glareFromPointer(stage: HTMLElement, clientX: number, clientY: number) {
  const r = stage.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) {
    return { gx: 50, gy: 50 };
  }
  const gx = ((clientX - r.left) / r.width) * 100;
  const gy = ((clientY - r.top) / r.height) * 100;
  return {
    gx: clamp(gx, 6, 94),
    gy: clamp(gy, 6, 94),
  };
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function poseNearlyEqual(a: QrPose, b: QrPose) {
  return (
    Math.abs(a.rotX - b.rotX) < 0.02 &&
    Math.abs(a.rotY - b.rotY) < 0.02 &&
    Math.abs(a.z - b.z) < 0.05 &&
    Math.abs(a.scale - b.scale) < 0.0004
  );
}

export function writePose(
  el: HTMLElement,
  p: QrPose,
  liftZ = LIFT_Z,
  scaleSpan = liftZ === TOUCH_LIFT_Z ? 0.02 : 0.012,
) {
  el.style.transform = `rotateX(${p.rotX.toFixed(3)}deg) rotateY(${p.rotY.toFixed(3)}deg) translateZ(${p.z.toFixed(2)}px) scale(${p.scale.toFixed(4)})`;
  // Shadow tracks tilt so lift reads as depth, not a sliding sticker.
  const lift = clamp(
    (p.z / Math.max(1, liftZ)) * 0.85 + ((p.scale - 1) / Math.max(0.0001, scaleSpan)) * 0.15,
    0,
    1,
  );
  const shadowX = (-p.rotY * 0.55).toFixed(2);
  const shadowY = (10 + p.rotX * 0.65 + lift * 6).toFixed(2);
  el.style.setProperty('--qr-shadow-x', `${shadowX}px`);
  el.style.setProperty('--qr-shadow-y', `${shadowY}px`);
  el.style.setProperty('--qr-lift', lift.toFixed(3));
}

export function writeGlare(el: HTMLElement, gx: number, gy: number) {
  el.style.setProperty('--qr-gx', `${gx.toFixed(1)}%`);
  el.style.setProperty('--qr-gy', `${gy.toFixed(1)}%`);
}