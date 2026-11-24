/**
 * Vite module worker: Argon2id stretch for Nostr fallback session material.
 * Main thread posts { id, password, salt }; replies { id, master } or { id, error }.
 */
import { argon2id } from '@noble/hashes/argon2.js';
import { ARGON2_OWASP } from './argon2Params';

export type Argon2WorkerRequest = {
  id: number;
  password: string;
  salt: string;
};

export type Argon2WorkerResponse =
  | { id: number; master: Uint8Array }
  | { id: number; error: string };

self.onmessage = (ev: MessageEvent<Argon2WorkerRequest>) => {
  const { id, password, salt } = ev.data;
  try {
    const master = argon2id(password, salt, { ...ARGON2_OWASP });
    const out: Argon2WorkerResponse = { id, master };
    self.postMessage(out);
  } catch (err) {
    const out: Argon2WorkerResponse = {
      id,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(out);
  }
};
