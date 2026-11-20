/**
 * Analytic damped harmonic spring (mockup 7).
 * More stable than Euler stepSpring for flame intensity.
 */
export function exactSpring(
  pos: number,
  vel: number,
  target: number,
  omega0: number,
  zeta: number,
  dt: number
): [number, number] {
  const y0 = pos - target;
  const v0 = vel;
  let y: number;
  let v: number;

  if (zeta < 0.9999) {
    const wd = omega0 * Math.sqrt(1 - zeta * zeta);
    const decay = Math.exp(-zeta * omega0 * dt);
    const c2 = (v0 + zeta * omega0 * y0) / wd;
    const cosT = Math.cos(wd * dt);
    const sinT = Math.sin(wd * dt);
    y = decay * (y0 * cosT + c2 * sinT);
    v =
      decay *
      ((-zeta * omega0 * y0 + wd * c2) * cosT - (zeta * omega0 * c2 + wd * y0) * sinT);
  } else if (zeta > 1.0001) {
    const g = omega0 * Math.sqrt(zeta * zeta - 1);
    const decay = Math.exp(-zeta * omega0 * dt);
    const c2 = (v0 + zeta * omega0 * y0) / g;
    const ch = Math.cosh(g * dt);
    const sh = Math.sinh(g * dt);
    y = decay * (y0 * ch + c2 * sh);
    v =
      decay *
      ((-zeta * omega0 * y0 + g * c2) * ch + (-zeta * omega0 * c2 + g * y0) * sh);
  } else {
    const decay = Math.exp(-omega0 * dt);
    y = decay * (y0 + (v0 + omega0 * y0) * dt);
    v = decay * (v0 - omega0 * (v0 + omega0 * y0) * dt);
  }

  return [target + y, v];
}

export type SpringParams = { omega0: number; zeta: number };

export const FIRE_IGNITE_SPRING: SpringParams = { omega0: 6.8, zeta: 1.0 };
export const FIRE_EXTINGUISH_SPRING: SpringParams = { omega0: 6.2, zeta: 1.08 };
