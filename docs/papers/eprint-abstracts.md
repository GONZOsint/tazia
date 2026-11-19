# ePrint abstracts (PDFs blocked by CDN 403 from this environment)

Local PDF download of ePrint returned HTTP 403. Abstracts captured for implementation reference.

## 2026/584 — Analyzing the WebRTC Ecosystem and Breaking Authentication in DTLS-SRTP

DTLS-SRTP authentication can fail open in many media-server deployments. Implication for TAZIA: **never treat DTLS as authorship**; keep Ed25519 app signatures + sealed Susurros.

## 2025/1598 — SAS + OOB Secure Message Transfer

UC model for short authentication strings; misbinding ε=2^{-t}. TAZIA: 6 emoji × 8 bits ≈ 48-bit SAS, bound to `roomId`.

## 2025/554 — Group Chat Encryption in MLS, Session, Signal, Matrix

Insufficient binding between symmetric encryption and signatures enables insider replay/reorder. Fix pattern: bind group id / nonce / AD to signature and ciphertext. TAZIA v2: DM AAD = `roomId‖from‖to‖msgId`; fallback blob AAD = roomId.

## 2025/1619 — Anonymity Wrappers (CCS’25)

Metadata hiding — **not implemented** this cycle (roadmap).
