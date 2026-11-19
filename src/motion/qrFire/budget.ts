export const QR_SECRET_FIRE = {
  maxFlames: 28,
  maxSparks: 14,
  maxDpr: 2,
  pad: 32,
  /** Keep particles outside the QR face so they never look like modules escaping. */
  innerCull: 4,
} as const;
