import { randomBytes } from "node:crypto";

const TTL_MS = 15 * 60 * 1000;
const MAX_PENDING = 8;

export type SendPreview = { to: string[]; cc: string[]; subject: string; body: string };

type Entry<T> = { expiresAt: number; preview: SendPreview; run: () => Promise<T> };

const bag = new Map<string, Entry<unknown>>();

function prune(now = Date.now()): void {
  for (const [k, v] of bag) {
    if (v.expiresAt <= now) bag.delete(k);
  }
}

export function createPendingSend<T>(preview: SendPreview, run: () => Promise<T>): string {
  prune();
  if (bag.size >= MAX_PENDING) {
    throw new Error("too many pending sends; confirm one or wait for expiry");
  }
  const token = randomBytes(16).toString("hex");
  bag.set(token, { expiresAt: Date.now() + TTL_MS, preview, run: run as () => Promise<unknown> });
  return token;
}

export function takePendingSend<T>(token: string): { preview: SendPreview; run: () => Promise<T> } {
  prune();
  const entry = bag.get(token);
  if (!entry) throw new Error("confirm_token invalid, expired, or already used");
  bag.delete(token);
  return entry as { preview: SendPreview; run: () => Promise<T> };
}

export function resetPendingSendsForTest(): void {
  bag.clear();
}
