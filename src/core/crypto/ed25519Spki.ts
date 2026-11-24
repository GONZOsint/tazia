/** RFC 8410 SPKI prefix for a raw 32-byte Ed25519 public key. */

export const ED25519_SPKI_PREFIX = Uint8Array.from([
  0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00,
]);

export function rawToSpki(raw: Uint8Array): Uint8Array {
  if (raw.length !== 32) throw new Error('Ed25519 public key must be 32 bytes');
  const spki = new Uint8Array(ED25519_SPKI_PREFIX.length + raw.length);
  spki.set(ED25519_SPKI_PREFIX, 0);
  spki.set(raw, ED25519_SPKI_PREFIX.length);
  return spki;
}

/** Strict SPKI → raw. Rejects bare 32-byte keys (legacy peers). */
export function spkiToRaw(spki: Uint8Array): Uint8Array {
  const expected = ED25519_SPKI_PREFIX.length + 32;
  if (spki.length !== expected) {
    throw new Error('Unrecognized Ed25519 SPKI encoding');
  }
  for (let i = 0; i < ED25519_SPKI_PREFIX.length; i++) {
    if (spki[i] !== ED25519_SPKI_PREFIX[i]) {
      throw new Error('Unrecognized Ed25519 SPKI encoding');
    }
  }
  return spki.subarray(ED25519_SPKI_PREFIX.length);
}

/** True when bytes are a well-formed Ed25519 SPKI (44 bytes with RFC 8410 prefix). */
export function isEd25519Spki(bytes: Uint8Array): boolean {
  const expected = ED25519_SPKI_PREFIX.length + 32;
  if (bytes.length !== expected) return false;
  for (let i = 0; i < ED25519_SPKI_PREFIX.length; i++) {
    if (bytes[i] !== ED25519_SPKI_PREFIX[i]) return false;
  }
  return true;
}
