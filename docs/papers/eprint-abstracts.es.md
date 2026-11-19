# Abstracts ePrint (PDF bloqueados por CDN 403 desde este entorno)

Español · [English](eprint-abstracts.md)

La descarga local de PDF de ePrint devolvió HTTP 403. Abstracts capturados como referencia de implementación.

## 2026/584 — Analyzing the WebRTC Ecosystem and Breaking Authentication in DTLS-SRTP

La autenticación DTLS-SRTP puede fallar abierta en muchos despliegues de media-server. Implicación para TAZIA: **nunca tratar DTLS como autoría**; mantener firmas Ed25519 de app + Susurros sellados.

## 2025/1598 — SAS + OOB Secure Message Transfer

Modelo UC para cadenas cortas de autenticación; misbinding ε=2^{-t}. TAZIA: 6 emoji × 8 bits ≈ SAS de 48 bits, ligado a `roomId`.

## 2025/554 — Group Chat Encryption in MLS, Session, Signal, Matrix

Un binding insuficiente entre cifrado simétrico y firmas permite replay/reorden por insiders. Patrón de arreglo: ligar group id / nonce / AD a firma y ciphertext. TAZEP (`tazep-v2`): AAD de DM = `tazep.dm.aad.v2:{roomId}|{from}|{to}|{msgId}`; AAD del blob de fallback = `tazep.fallback.aad.v3:{roomId}`.

## 2025/1619 — Anonymity Wrappers (CCS’25)

Ocultación de metadata — **no implementado** en este ciclo (roadmap).
