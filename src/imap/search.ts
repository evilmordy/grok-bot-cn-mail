import type { SearchQuery } from "../mail/types.js";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseDay(value: string | undefined, field: string): Date | undefined {
  if (!value) return undefined;
  if (!DAY.test(value)) {
    throw new Error(`${field} must be YYYY-MM-DD`);
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) throw new Error(`${field} is not a valid date`);
  return d;
}

export function toImapSearch(query: SearchQuery): Record<string, unknown> {
  const q: Record<string, unknown> = {};
  if (query.from) q.from = query.from;
  if (query.to) q.to = query.to;
  if (query.subject) q.subject = query.subject;
  if (query.unseen) q.unseen = true;
  const since = parseDay(query.since, "since");
  const before = parseDay(query.before, "before");
  if (since) q.since = since;
  if (before) q.before = before;
  return q;
}

export function clampLimit(n: number | undefined, max = 25): number {
  const v = n ?? 10;
  if (!Number.isFinite(v) || v < 1) return 1;
  return Math.min(Math.floor(v), max);
}
