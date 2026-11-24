/** Shared Argon2id OWASP minimum (m=19 MiB, t=2, p=1). */
export const ARGON2_OWASP = {
  t: 2,
  m: 19_456,
  p: 1,
  dkLen: 32,
  maxmem: 64 * 1024 * 1024,
} as const;
