/** Scrub invite phrase from location.hash before the app bundle runs (CSP: script-src 'self').
 *  Stashes phrase in sessionStorage so React can autofill Join without leaving secrets in the URL.
 *  Only scrubs after a successful stash — otherwise React still sees #room~phrase.
 *  Caps must stay in sync with MAX_ROOM_ID_CHARS / MAX_INVITE_PHRASE_CHARS in inviteLink.ts. */
(function scrubInvitePhrase() {
  var MAX_ROOM_ID_CHARS = 128;
  var MAX_INVITE_PHRASE_CHARS = 512;
  try {
    var hash = location.hash.replace(/^#/, '');
    if (!hash) return;
    var tilde = hash.indexOf('~');
    if (tilde < 0) return;
    var roomRaw = hash.slice(0, tilde);
    var phraseRaw = hash.slice(tilde + 1);
    var roomId;
    var phrase;
    try {
      roomId = decodeURIComponent(roomRaw).trim();
    } catch (e) {
      roomId = roomRaw.trim();
    }
    try {
      phrase = decodeURIComponent(phraseRaw).trim();
    } catch (e) {
      phrase = phraseRaw.trim();
    }
    if (!roomId || roomId.length < 4 || roomId.length > MAX_ROOM_ID_CHARS) return;
    if (!phrase || phrase.length > MAX_INVITE_PHRASE_CHARS) return;
    try {
      sessionStorage.setItem(
        'tazia-invite-boot',
        JSON.stringify({ roomId: roomId, phrase: phrase })
      );
    } catch (e) {
      /* quota / private mode: leave hash intact for React */
      return;
    }
    history.replaceState(
      null,
      '',
      location.pathname + location.search + '#' + encodeURIComponent(roomId)
    );
  } catch (e) {
    /* ignore */
  }
})();
