# ePrint abstracts

English · [Español](eprint-abstracts.es.md)

ePrint PDFs returned HTTP 403 from this environment. Abstracts are kept here as an implementation reference.

---

## 2026/584 — Analyzing the WebRTC Ecosystem and Breaking Authentication in DTLS-SRTP

DTLS-SRTP authentication can fail open in many media-server deployments.

**For TAZIA:** never treat DTLS as authorship. Keep Ed25519 app signatures and sealed Whispers.

## 2025/1598 — SAS + OOB Secure Message Transfer

UC model for short authentication strings; misbinding ε=2^{-t}.

**For TAZIA:** 6 emoji × 8 bits ≈ 48-bit SAS, bound to `roomId`.

## 2025/554 — Group Chat Encryption in MLS, Session, Signal, Matrix

Insufficient binding between symmetric encryption and signatures enables insider replay/reorder. The fix pattern is to bind group id / nonce / AD to signature and ciphertext.

**For TAZIA (TAZEP `tazep-v2`):** DM AAD = `tazep.dm.aad.v2:{roomId}|{from}|{to}|{msgId}`; fallback blob AAD = `tazep.fallback.aad.v3:{roomId}`.

## 2025/1619 — Anonymity Wrappers (CCS’25)

Metadata hiding — **not implemented** this cycle.
