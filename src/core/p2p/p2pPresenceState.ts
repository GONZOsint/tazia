import type { EncryptionIdentity } from '../crypto/dmCrypto';
import type { SigningIdentity } from '../crypto/messageSigning';
import { normalizePresenceAlias } from '../presenceAlias';
import type { PresenceState } from '../protocol';

export { normalizePresenceAlias } from '../presenceAlias';

/** Sentinel for makeUserState before the first real profile publish. */
export function emptyPresence(): PresenceState {
  return { alias: '', signPubKeySpkiB64: '', encPubKeyRawB64: '', avatarSeed: '' };
}

export function buildPresenceState(
  alias: string,
  avatarSeed: string,
  signing: SigningIdentity,
  encIdentity: EncryptionIdentity
): PresenceState {
  const normalized = normalizePresenceAlias(alias);
  return {
    alias: normalized ?? '',
    signPubKeySpkiB64: signing.publicKeySpkiB64,
    encPubKeyRawB64: encIdentity.publicKeyRawB64,
    avatarSeed,
  };
}
