/** Argon2id derive with Vite worker + main-thread fallback (Vitest / Worker failure). */

import { argon2id } from '@noble/hashes/argon2.js';
import { ARGON2_OWASP } from './argon2Params';
import type { Argon2WorkerRequest, Argon2WorkerResponse } from './argon2Worker';

const WORKER_TIMEOUT_MS = 10_000;

/** Test hook: increments on every real Argon2id invocation (worker or main). */
export let argon2InvokeCount = 0;

export function resetArgon2InvokeCount(): void {
  argon2InvokeCount = 0;
}

function argon2MainThread(password: string, salt: string): Uint8Array {
  argon2InvokeCount += 1;
  return argon2id(password, salt, { ...ARGON2_OWASP });
}

type Pending = {
  resolve: (v: Uint8Array) => void;
  reject: (e: Error) => void;
  password: string;
  salt: string;
  timer: number;
};

let worker: Worker | null = null;
let workerFailed = false;
let nextId = 1;
const pending = new Map<number, Pending>();

function settleMain(id: number): void {
  const slot = pending.get(id);
  if (!slot) return;
  pending.delete(id);
  clearTimeout(slot.timer);
  try {
    slot.resolve(argon2MainThread(slot.password, slot.salt));
  } catch (e) {
    slot.reject(e instanceof Error ? e : new Error(String(e)));
  }
}

function getWorker(): Worker | null {
  if (workerFailed) return null;
  if (worker) return worker;
  if (typeof Worker === 'undefined') {
    workerFailed = true;
    return null;
  }
  try {
    worker = new Worker(new URL('./argon2Worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (ev: MessageEvent<Argon2WorkerResponse>) => {
      const data = ev.data;
      const slot = pending.get(data.id);
      if (!slot) return;
      pending.delete(data.id);
      clearTimeout(slot.timer);
      if ('error' in data && data.error) {
        try {
          slot.resolve(argon2MainThread(slot.password, slot.salt));
        } catch (e) {
          slot.reject(e instanceof Error ? e : new Error(data.error));
        }
        return;
      }
      if ('master' in data) {
        argon2InvokeCount += 1;
        slot.resolve(data.master);
        return;
      }
      settleMain(data.id);
    };
    worker.onerror = () => {
      workerFailed = true;
      const ids = [...pending.keys()];
      for (const id of ids) {
        settleMain(id);
      }
      try {
        worker?.terminate();
      } catch {
        /* ignore */
      }
      worker = null;
    };
    return worker;
  } catch {
    workerFailed = true;
    worker = null;
    return null;
  }
}

/** Derive 32-byte master via Argon2id (OWASP m=19456,t=2,p=1). */
export async function argon2idDerive(password: string, salt: string): Promise<Uint8Array> {
  const w = getWorker();
  if (!w) {
    return argon2MainThread(password, salt);
  }
  const id = nextId++;
  return new Promise<Uint8Array>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!pending.has(id)) return;
      // Hung worker: fail over all in-flight, not just this id.
      workerFailed = true;
      const ids = [...pending.keys()];
      try {
        worker?.terminate();
      } catch {
        /* ignore */
      }
      worker = null;
      for (const pendingId of ids) {
        settleMain(pendingId);
      }
    }, WORKER_TIMEOUT_MS) as unknown as number;
    pending.set(id, { resolve, reject, password, salt, timer });
    const msg: Argon2WorkerRequest = { id, password, salt };
    try {
      w.postMessage(msg);
    } catch {
      pending.delete(id);
      clearTimeout(timer);
      workerFailed = true;
      try {
        resolve(argon2MainThread(password, salt));
      } catch (e) {
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    }
  });
}
