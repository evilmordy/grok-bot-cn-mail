import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSendAllowlist } from "./allowlist.js";

export type ConnectMode = "read" | "draft" | "send";

export type Settings = {
  mode: ConnectMode;
  send_allowlist: string[];
  allow_sensitive: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  mode: "read",
  send_allowlist: [],
  allow_sensitive: false,
};

let testOverride: Settings | null = null;
let cache: { file: string; mtimeMs: number; value: Settings } | null = null;

export function overrideSettingsForTest(value: Settings | null): void {
  testOverride = value;
  cache = null;
}

export function settingsFileCandidates(fromModuleUrl: string = import.meta.url): string[] {
  const explicit = process.env.QQCONNECT_CONFIG?.trim();
  if (explicit) return [explicit];
  const dir = dirname(fileURLToPath(fromModuleUrl));
  return [join(dir, "..", "..", ".qqconnect.json"), join(process.cwd(), ".qqconnect.json")];
}

export function settingsPath(): string {
  return settingsFileCandidates()[0] ?? join(process.cwd(), ".qqconnect.json");
}

function parseSettings(raw: unknown): Settings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS };
  const rec = raw as Record<string, unknown>;
  const mode = rec.mode === "draft" || rec.mode === "send" || rec.mode === "read" ? rec.mode : "read";
  const list = Array.isArray(rec.send_allowlist)
    ? rec.send_allowlist.map((x) => String(x).trim().toLowerCase()).filter(Boolean)
    : parseSendAllowlist(typeof rec.send_allowlist === "string" ? rec.send_allowlist : undefined);
  return {
    mode,
    send_allowlist: list,
    allow_sensitive: rec.allow_sensitive === true,
  };
}

export function getSettings(): Settings {
  if (testOverride) return testOverride;
  const file = settingsPath();
  if (!existsSync(file)) {
    cache = null;
    return { ...DEFAULT_SETTINGS };
  }
  const mtimeMs = statSync(file).mtimeMs;
  if (cache && cache.file === file && cache.mtimeMs === mtimeMs) return cache.value;
  let parsed: unknown = {};
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    parsed = {};
  }
  const value = parseSettings(parsed);
  cache = { file, mtimeMs, value };
  return value;
}

function normalize(next: Settings): Settings {
  const value: Settings = {
    mode: next.mode,
    send_allowlist: [...next.send_allowlist],
    allow_sensitive: next.allow_sensitive,
  };
  if (value.mode === "send" && value.send_allowlist.length === 0) {
    throw new Error("mode send requires a non-empty send_allowlist");
  }
  return value;
}

export function saveSettings(next: Settings): Settings {
  const value = normalize(next);
  const file = settingsPath();
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  cache = { file, mtimeMs: existsSync(file) ? statSync(file).mtimeMs : Date.now(), value };
  testOverride = null;
  return value;
}

export function patchSettings(patch: Partial<Settings>): Settings {
  const value = normalize({ ...getSettings(), ...patch });
  if (testOverride) {
    testOverride = value;
    return value;
  }
  return saveSettings(value);
}

export function canDraft(settings: Settings = getSettings()): boolean {
  return settings.mode === "draft" || settings.mode === "send";
}

export function canSend(settings: Settings = getSettings()): boolean {
  return settings.mode === "send";
}

export function modeHint(need: "draft" | "send"): string {
  const s = getSettings();
  if (need === "draft") {
    return `当前是「${s.mode}」档，不能写草稿。请先问用户是否打开草稿，用户同意后调用 set_settings，mode=draft。不要询问授权码。`;
  }
  return `当前是「${s.mode}」档，不能发信。请先问用户发送白名单（例如只给自己），用户同意后再 set_settings mode=send 并带上 send_allowlist。不要询问授权码。若客户端没有确认卡片，不要强行打开 send。`;
}

export function settingsGuide(settings: Settings = getSettings()): string {
  if (settings.mode === "read") {
    return "请先用一句话请用户选择档位：①只读（默认，只搜和看）②草稿（推荐要写信时，进草稿箱，网页里自己发送）③发送（SMTP 真发，必须用户指定白名单，且会弹出确认）。用户选定后立刻 set_settings。不要问授权码或网页密码。用户若明确只要看信，可直接搜索。";
  }
  if (settings.mode === "draft") {
    return "当前是草稿档：可以 save_draft / save_reply_draft。真发信需用户再要求打开发送并给出白名单。";
  }
  return "当前是发送档：SMTP 仍须确认卡片；收件人必须在 send_allowlist 内。此设置对账号下所有 Bot 生效。";
}
