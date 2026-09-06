import {
  assertLooksLikeAddress,
  normalizeAddress,
  parseAddressList,
} from "../config/allowlist.js";
import { MAX_RECIPIENTS } from "./rfc822.js";

export function collectAddresses(raw: string | string[] | undefined): string[] {
  const parts = Array.isArray(raw) ? raw : parseAddressList(raw);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of parts) {
    assertLooksLikeAddress(p);
    const n = normalizeAddress(p);
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

export function capRecipients(to: string[], cc: string[] = []): { to: string[]; cc: string[] } {
  const all = [...to, ...cc];
  if (all.length === 0) throw new Error("at least one recipient is required");
  if (all.length > MAX_RECIPIENTS) {
    throw new Error(`at most ${MAX_RECIPIENTS} recipients`);
  }
  return { to, cc };
}

export function replyTargets(opts: {
  self: string;
  from?: string;
  replyTo?: string;
  to?: string;
  cc?: string;
  replyAll: boolean;
}): { to: string[]; cc: string[] } {
  const self = normalizeAddress(opts.self);
  const primary = collectAddresses(opts.replyTo || opts.from);
  const to = primary.filter((a) => a !== self);
  if (to.length === 0) {
    throw new Error("cannot determine reply recipient from the original message");
  }
  if (!opts.replyAll) return capRecipients(to, []);
  const rest = collectAddresses([opts.to, opts.cc].filter(Boolean).join(",")).filter(
    (a) => a !== self && !to.includes(a),
  );
  return capRecipients(to, rest);
}
