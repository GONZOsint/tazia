/**
 * QR card 3D pose math + DOM writers.
 * REST / TOUCH_REST must stay in sync with CSS defaults in index.css
 * (`.qr-surface-3d` desktop ~3069 and touch ~3101).
 */

export type QrPose = { rotX: number; rotY: number; z: number; scale: number };

/** Rest pose — soft desk-lamp angle; keep ≤~10° so the QR stays readable. */
export const REST = { rotX: 5.5, rotY: -4.5, z: 0, scale: 1 } as const;
/** Touch: steeper desk angle so depth reads without hover parallax. */
export const TOUCH_REST = { rotX: 9.5, rotY: -7.2, z: 2, scale: 1 } as const;
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
export const IDLE_BREATH = { rotX: 1.35, rotY: 1.1, z: 1.6 } as const;
export const IDLE_BREATH_MS = 4200;

export function targetFromPointer(
  stage: HTMLElement,
  clientX: number,
  clientY: number,
  rest: QrPose,
  tiltRange: number,
  liftZ: number,
  /** Touch drag stays engaged past the card edge; mouse uses soft falloff. */
  locked = false
): QrPose {
  // Measure against the flat perspective stage — never the tilting surface
  // (tilted getBoundingClientRect feeds back into the next frame and jitters).
  const r = stage.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  const nx = (clientX - cx) / (r.width * 0.5);
  const ny = (clientY - cy) / (r.height * 0.5);
  const dist = Math.hypot(nx, ny);

  if (!locked && dist > IDLE_DIST) return { ...rest };

  // Soft falloff past the card edge keeps continuous tracking without snaps.
  const falloff = locked
    ? 1
    : 1 / (1 + Math.max(0, dist - 0.95) * 1.15);
  const clamp = locked ? 1.15 : 1.05;
  const clampedX = Math.max(-clamp, Math.min(clamp, nx)) * falloff;
  const clampedY = Math.max(-clamp, Math.min(clamp, ny)) * falloff;
  const near = locked ? Math.min(1, 0.55 + (1 - Math.min(1, dist)) * 0.45) : Math.min(1, falloff);

  return {
    rotX: rest.rotX - clampedY * tiltRange,
    rotY: rest.rotY + clampedX * tiltRange,
    z: rest.z + liftZ * near,
    scale: 1 + (locked ? 0.02 : 0.012) * near,
  };
}

export function glareFromPointer(stage: HTMLElement, clientX: number, clientY: number) {
  const r = stage.getBoundingClientRect();
  const gx = ((clientX - r.left) / Math.max(1, r.width)) * 100;
  const gy = ((clientY - r.top) / Math.max(1, r.height)) * 100;
  return {
    gx: Math.max(6, Math.min(94, gx)),
    gy: Math.max(6, Math.min(94, gy)),
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

export function writePose(el: HTMLElement, p: QrPose, liftZ = LIFT_Z) {
  el.style.transform = `rotateX(${p.rotX.toFixed(3)}deg) rotateY(${p.rotY.toFixed(3)}deg) translateZ(${p.z.toFixed(2)}px) scale(${p.scale.toFixed(4)})`;
  // Shadow tracks tilt so lift reads as depth, not a sliding sticker.
  const scaleSpan = liftZ === TOUCH_LIFT_Z ? 0.02 : 0.012;
  const lift = Math.min(
    1,
    Math.max(0, (p.z / Math.max(1, liftZ)) * 0.85 + ((p.scale - 1) / scaleSpan) * 0.15)
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
