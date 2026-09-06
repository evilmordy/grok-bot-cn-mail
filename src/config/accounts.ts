import { domainOf, isPrivateOrMetadataHost, resolvePreset, type ImapPreset } from "./presets.js";

export type Account = {
  id: string;
  address: string;
  authCode: string;
  preset: ImapPreset;
  host: string;
  port: number;
  sendImapId: boolean;
  smtpHost: string;
  smtpPort: number;
};

function readEnv(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === "" ? undefined : v;
}

function parseJsonAccounts(raw: string): Account[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("QQCONNECT_ACCOUNTS must be JSON array");
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error("QQCONNECT_ACCOUNTS must be a non-empty JSON array");
  }
  return parsed.map((row, i) => accountFromRow(row, i, false));
}

function accountFromRow(row: unknown, index: number, allowInlineAuth = true): Account {
  if (!row || typeof row !== "object") {
    throw new Error(`account[${index}] must be an object`);
  }
  const rec = row as Record<string, unknown>;
  const address = String(rec.address ?? rec.user ?? "").trim();
  if (!address.includes("@")) {
    throw new Error(`account[${index}] needs address like you@qq.com`);
  }
  const id = String(rec.id ?? address.split("@")[0] ?? `acct${index}`).trim();
  const authCodeEnv = rec.authCodeEnv ? String(rec.authCodeEnv) : undefined;
  const authCodeDirect = rec.authCode ? String(rec.authCode) : undefined;
  if (!allowInlineAuth && authCodeDirect && !authCodeEnv) {
    throw new Error(
      `account ${id}: do not put authCode in JSON; set authCodeEnv to an env var (fill it in the secret box)`,
    );
  }
  const authCode = authCodeEnv ? readEnv(authCodeEnv) : authCodeDirect;
  if (!authCode) {
    throw new Error(
      `account ${id}: set authCodeEnv to an env var holding the IMAP authorization code (not the web password)`,
    );
  }
  const hostOverride = rec.host ? String(rec.host).trim() : undefined;
  if (hostOverride && isPrivateOrMetadataHost(hostOverride)) {
    throw new Error(`account ${id}: host ${hostOverride} is not allowed`);
  }
  let preset: ImapPreset;
  if (hostOverride) {
    const smtpHost = rec.smtpHost ? String(rec.smtpHost).trim() : "";
    if (smtpHost && isPrivateOrMetadataHost(smtpHost)) {
      throw new Error(`account ${id}: smtp host ${smtpHost} is not allowed`);
    }
    preset = {
      provider: "custom",
      host: hostOverride,
      port: rec.port ? Number(rec.port) : 993,
      secure: true,
      sendImapId: rec.sendImapId === true,
      disableImap4rev2: true,
      smtpHost,
      smtpPort: rec.smtpPort ? Number(rec.smtpPort) : 465,
    };
  } else {
    preset = resolvePreset(address);
  }
  const sendImapId =
    rec.sendImapId === false ? false : rec.sendImapId === true ? true : preset.sendImapId;
  const smtpOverride = rec.smtpHost ? String(rec.smtpHost).trim() : undefined;
  if (smtpOverride && isPrivateOrMetadataHost(smtpOverride)) {
    throw new Error(`account ${id}: smtp host ${smtpOverride} is not allowed`);
  }
  return {
    id,
    address,
    authCode,
    preset,
    host: preset.host,
    port: preset.port,
    sendImapId,
    smtpHost: smtpOverride || preset.smtpHost,
    smtpPort: rec.smtpPort ? Number(rec.smtpPort) : preset.smtpPort,
  };
}

function envSlot(base: string, index: number): string | undefined {
  if (index <= 1) {
    return readEnv(base) ?? readEnv(`${base}_1`) ?? (base === "MAIL_USER" ? readEnv("QQCONNECT_USER") : undefined) ?? (base === "MAIL_AUTH_CODE" ? readEnv("QQCONNECT_AUTH_CODE") : undefined);
  }
  return readEnv(`${base}_${index}`);
}

function parseEnvAccounts(): Account[] {
  const out: Account[] = [];
  for (let i = 1; i <= 20; i++) {
    const address = envSlot("MAIL_USER", i);
    const authCode = envSlot("MAIL_AUTH_CODE", i);
    if (!address && !authCode) continue;
    if (!address || !authCode) {
      const n = i <= 1 ? "" : `_${i}`;
      throw new Error(`mailbox ${i}: set both MAIL_USER${n} and MAIL_AUTH_CODE${n}`);
    }
    const host = envSlot("MAIL_HOST", i) ?? (i === 1 ? readEnv("QQCONNECT_HOST") : undefined);
    const row: Record<string, unknown> = {
      id: envSlot("MAIL_ACCOUNT_ID", i) ?? (i === 1 ? "default" : undefined),
      address,
      authCode,
    };
    if (host) {
      row.host = host;
      row.port = Number(envSlot("MAIL_PORT", i) ?? "993");
    }
    const smtpHost = envSlot("MAIL_SMTP_HOST", i) ?? (i === 1 ? readEnv("QQCONNECT_SMTP_HOST") : undefined);
    if (smtpHost) row.smtpHost = smtpHost;
    const smtpPort = envSlot("MAIL_SMTP_PORT", i) ?? (i === 1 ? readEnv("QQCONNECT_SMTP_PORT") : undefined);
    if (smtpPort) row.smtpPort = Number(smtpPort);
    const idFlag = envSlot("QQCONNECT_IMAP_ID", i) ?? (i === 1 ? readEnv("QQCONNECT_IMAP_ID") : undefined);
    if (idFlag === "0" || idFlag === "false") row.sendImapId = false;
    if (idFlag === "1" || idFlag === "true") row.sendImapId = true;
    out.push(accountFromRow(row, i - 1));
  }
  return out;
}

export function loadAccounts(): Account[] {
  const json = readEnv("QQCONNECT_ACCOUNTS");
  const accounts = json ? parseJsonAccounts(json) : parseEnvAccounts();
  if (accounts.length === 0) {
    throw new Error(
      "no mailbox configured: set MAIL_USER + MAIL_AUTH_CODE (or MAIL_USER_2 / MAIL_AUTH_CODE_2 …), or QQCONNECT_ACCOUNTS JSON",
    );
  }
  const ids = new Set<string>();
  for (const a of accounts) {
    if (ids.has(a.id)) throw new Error(`duplicate account id ${a.id}`);
    ids.add(a.id);
    domainOf(a.address);
  }
  return accounts;
}

export function publicAccountView(account: Account): {
  id: string;
  address: string;
  provider: string;
  host: string;
} {
  return {
    id: account.id,
    address: account.address,
    provider: account.preset.provider,
    host: account.host,
  };
}
