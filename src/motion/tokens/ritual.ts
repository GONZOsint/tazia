/** Lime/ash confetti — max 400ms; only create-zone + verify OK. */
export const CONFETTI = {
  ms: 400,
  count: 20,
} as const;

/**
 * Emoji verify handshake — readable pace (Material / Apple: ritual > 300ms).
 * Sweep + collapse + tick hold before dismiss.
 */
export const VERIFY = {
  enterStagger: 0.09,
  enterDur: 0.34,
  pulseDur: 0.34,
  pulseStagger: 0.08,
  collapseDur: 0.4,
  collapseStagger: 0.07,
  tickSpring: { type: 'spring' as const, visualDuration: 0.42, bounce: 0.22 },
  /** Time after tick appears before closing / calling onVerify. */
  tickHoldMs: 780,
  reducedHoldMs: 200,
} as const;

/** Mesh birth one-shot (not idle radar). */
export const MESH_BIRTH = {
  waveMs: 360,
  dotStaggerMs: 40,
  reducedMs: 120,
} as const;

/**
 * Toast auto-dismiss TTLs — keep in sync with ToastHost + CSS `--toast-ttl`.
 * Progress bar drains over the same window; hover must pause both.
 */
export const TOAST = {
  successMs: 2500,
  infoMs: 2500,
  warningMs: 4000,
  errorMs: 5000,
} as const;

/** QR secret outer-line ritual — mirror `--dur-secret-frame` / InviteQr. */
export const SECRET_FRAME_MS = 820;
