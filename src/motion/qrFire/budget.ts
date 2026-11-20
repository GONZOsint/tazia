export interface QrSecretFireBudget {
  readonly maxDpr: number;
  /** Extra CSS padding so the perimeter flame line can draw outside the QR face. */
  readonly pad: number;
}

export const QR_SECRET_FIRE = Object.freeze({
  maxDpr: 2,
  /** Room for taller outward tongues + rising wisps around the card frame. */
  pad: 40,
} as const satisfies QrSecretFireBudget);
