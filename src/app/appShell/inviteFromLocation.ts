import {
  parseInviteInput,
  scrubPhraseFromLocationHash,
  takeBootstrappedInvitePhrase,
} from '../../core/utils/inviteLink';

/** Parse #room[~phrase], prefer live hash phrase, else early-boot stash; scrub secret from URL. */
export function consumeInviteFromLocation() {
  const parsed = parseInviteInput(window.location.hash);
  if (!parsed) return null;
  if (parsed.phrase) {
    scrubPhraseFromLocationHash(parsed.roomId);
    return parsed;
  }
  const bootPhrase = takeBootstrappedInvitePhrase(parsed.roomId);
  if (bootPhrase) return { roomId: parsed.roomId, phrase: bootPhrase };
  return parsed;
}
