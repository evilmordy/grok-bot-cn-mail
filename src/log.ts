const SECRET_KEYS = /auth.?code|password|pass\b|secret|token|authorization/i;

function redactValue(key: string, value: unknown): unknown {
  if (SECRET_KEYS.test(key)) return "[redacted]";
  return value;
}

export function logInfo(event: string, fields: Record<string, unknown> = {}): void {
  const body: Record<string, unknown> = { level: "info", event, ts: new Date().toISOString() };
  for (const [k, v] of Object.entries(fields)) body[k] = redactValue(k, v);
  process.stderr.write(`${JSON.stringify(body)}\n`);
}

export function logWarn(event: string, fields: Record<string, unknown> = {}): void {
  const body: Record<string, unknown> = { level: "warn", event, ts: new Date().toISOString() };
  for (const [k, v] of Object.entries(fields)) body[k] = redactValue(k, v);
  process.stderr.write(`${JSON.stringify(body)}\n`);
}

export function logError(event: string, err: unknown, fields: Record<string, unknown> = {}): void {
  const message = err instanceof Error ? err.message : String(err);
  const safe = message.replace(/(pass(word)?|authcode|secret|token)\s*[:=]\s*\S+/gi, "$1=[redacted]");
  const body: Record<string, unknown> = {
    level: "error",
    event,
    message: safe,
    ts: new Date().toISOString(),
  };
  for (const [k, v] of Object.entries(fields)) body[k] = redactValue(k, v);
  process.stderr.write(`${JSON.stringify(body)}\n`);
}
