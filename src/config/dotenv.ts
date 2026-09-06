import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { logInfo } from "../log.js";

const KEY = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Secrets and connection facts only. Policy (mode/allowlist) lives in .grok-bot-cn-mail.json. */
const SECRET_OR_CONN =
  /^(MAIL_[A-Z0-9_]+|QQCONNECT_(USER|AUTH_CODE|ACCOUNTS|HOST|SMTP_HOST|SMTP_PORT|IMAP_ID))$/;

/** Apply KEY=VALUE lines. Does not override non-empty existing env (Grok `-e` wins). */
export function applyDotEnvText(text: string, env: NodeJS.ProcessEnv = process.env): string[] {
  const applied: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7).trim();
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    if (!KEY.test(key) || !SECRET_OR_CONN.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    const current = env[key];
    if (current !== undefined && current !== "") continue;
    env[key] = value;
    applied.push(key);
  }
  return applied;
}

export function envFileCandidates(fromModuleUrl: string = import.meta.url): string[] {
  const dir = dirname(fileURLToPath(fromModuleUrl));
  return [join(dir, "..", "..", ".env"), join(process.cwd(), ".env")];
}

/** Load repo `.env` if present. Safe to call more than once. */
export function loadDotEnv(): string | undefined {
  const seen = new Set<string>();
  for (const file of envFileCandidates()) {
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    const applied = applyDotEnvText(readFileSync(file, "utf8"));
    logInfo("env.dotenv", { file, appliedKeys: applied.length });
    return file;
  }
  return undefined;
}
