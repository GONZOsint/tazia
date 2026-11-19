# Abstracts ePrint

Español · [English](eprint-abstracts.md)

Los PDF de ePrint devolvieron HTTP 403 desde este entorno. Aquí quedan los abstracts como referencia de implementación.

---

## 2026/584 — Analyzing the WebRTC Ecosystem and Breaking Authentication in DTLS-SRTP

La autenticación DTLS-SRTP puede fallar abierta en muchos despliegues de media-server.

**Para TAZIA:** nunca tratar DTLS como autoría. Mantener firmas Ed25519 de app y Susurros sellados.

## 2025/1598 — SAS + OOB Secure Message Transfer

Modelo UC para cadenas cortas de autenticación; misbinding ε=2^{-t}.

**Para TAZIA:** 6 emoji × 8 bits ≈ SAS de 48 bits, ligado a `roomId`.

## 2025/554 — Group Chat Encryption in MLS, Session, Signal, Matrix

Un binding insuficiente entre cifrado simétrico y firmas permite replay/reorden por insiders. El patrón de arreglo es ligar group id / nonce / AD a firma y ciphertext.

**Para TAZIA (TAZEP `tazep-v2`):** AAD de DM = `tazep.dm.aad.v2:{roomId}|{from}|{to}|{msgId}`; AAD del blob de fallback = `tazep.fallback.aad.v3:{roomId}`.

## 2025/1619 — Anonymity Wrappers (CCS’25)

Ocultación de metadata — **no implementado** en este ciclo.
