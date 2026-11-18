/** Scrub invite phrase from location.hash before the app bundle runs (CSP: script-src 'self'). */
(function scrubInvitePhrase() {
  try {
    var hash = location.hash.replace(/^#/, '');
    if (!hash) return;
    var tilde = hash.indexOf('~');
    if (tilde < 0) return;
    var roomRaw = hash.slice(0, tilde);
    var roomId;
    try {
      roomId = decodeURIComponent(roomRaw).trim();
    } catch (e) {
      roomId = roomRaw.trim();
    }
    if (!roomId || roomId.length < 4) return;
    history.replaceState(
      null,
      '',
      location.pathname + location.search + '#' + encodeURIComponent(roomId)
    );
  } catch (e) {
    /* ignore */
  }
})();
