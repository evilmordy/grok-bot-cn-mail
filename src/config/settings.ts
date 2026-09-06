import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { logError } from "../log.js";
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

const SETTINGS_NAMES = [".grok-bot-cn-mail.json", ".qqconnect.json"];

function settingsFileCandidates(fromModuleUrl: string = import.meta.url): string[] {
  const explicit = process.env.QQCONNECT_CONFIG?.trim();
  if (explicit) return [explicit];
  const dir = dirname(fileURLToPath(fromModuleUrl));
  const roots = [join(dir, "..", ".."), process.cwd()];
  const out: string[] = [];
  for (const root of roots) {
    for (const name of SETTINGS_NAMES) {
      const path = join(root, name);
      if (!out.includes(path)) out.push(path);
    }
  }
  return out;
}

/** Existing settings file, or the grok-bot-cn-mail name for a first write. */
export function settingsPath(fromModuleUrl?: string): string {
  const cands = settingsFileCandidates(fromModuleUrl);
  const existing = cands.find((p) => existsSync(p));
  return existing ?? cands[0] ?? join(process.cwd(), ".grok-bot-cn-mail.json");
}

export function sendCountPath(): string {
  return join(dirname(settingsPath()), ".grok-bot-cn-mail.send-count.json");
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
  } catch (err) {
    logError("settings.invalid_json", err, { file });
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
    return "默认只读，可以直接 search_messages / get_message。不要问授权码。用户要写信时再问是否打开草稿（推荐，网页里自己发送）。不要主动推销 SMTP 发送。";
  }
  if (settings.mode === "draft") {
    return "当前是草稿档：可以 save_draft / save_reply_draft。真发信需用户再要求打开发送并给出白名单。";
  }
  return "当前是发送档：收件人必须在 send_allowlist 内。SMTP 还要 MCP 确认卡。Grok Bot 弹不出这张卡，请改用草稿+网页发送，或到 Grok Build TUI 发。此设置对账号下所有 Bot 生效。";
}
