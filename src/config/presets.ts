export type ProviderId = "qq" | "foxmail" | "exmail" | "163" | "126" | "custom";

export type ImapPreset = {
  provider: ProviderId;
  host: string;
  port: number;
  secure: true;
  sendImapId: boolean;
  disableImap4rev2: boolean;
  smtpHost: string;
  smtpPort: number;
};

const PRESETS: Record<string, ImapPreset> = {
  "qq.com": {
    provider: "qq",
    host: "imap.qq.com",
    port: 993,
    secure: true,
    sendImapId: true,
    disableImap4rev2: true,
    smtpHost: "smtp.qq.com",
    smtpPort: 465,
  },
  "foxmail.com": {
    provider: "foxmail",
    host: "imap.qq.com",
    port: 993,
    secure: true,
    sendImapId: true,
    disableImap4rev2: true,
    smtpHost: "smtp.qq.com",
    smtpPort: 465,
  },
  "vip.qq.com": {
    provider: "qq",
    host: "imap.qq.com",
    port: 993,
    secure: true,
    sendImapId: true,
    disableImap4rev2: true,
    smtpHost: "smtp.qq.com",
    smtpPort: 465,
  },
  "163.com": {
    provider: "163",
    host: "imap.163.com",
    port: 993,
    secure: true,
    sendImapId: true,
    disableImap4rev2: true,
    smtpHost: "smtp.163.com",
    smtpPort: 465,
  },
  "126.com": {
    provider: "126",
    host: "imap.126.com",
    port: 993,
    secure: true,
    sendImapId: true,
    disableImap4rev2: true,
    smtpHost: "smtp.126.com",
    smtpPort: 465,
  },
  "yeah.net": {
    provider: "163",
    host: "imap.163.com",
    port: 993,
    secure: true,
    sendImapId: true,
    disableImap4rev2: true,
    smtpHost: "smtp.163.com",
    smtpPort: 465,
  },
};

const EXMAIL_SUFFIXES = [".exmail.qq.com"];

export function domainOf(address: string): string {
  const at = address.lastIndexOf("@");
  if (at < 0 || at === address.length - 1) {
    throw new Error("mailbox address must be a full email, like you@qq.com");
  }
  return address.slice(at + 1).toLowerCase();
}

export function resolvePreset(address: string): ImapPreset {
  const domain = domainOf(address);
  const exact = PRESETS[domain];
  if (exact) return exact;
  if (EXMAIL_SUFFIXES.some((s) => domain.endsWith(s)) || domain === "exmail.qq.com") {
    return {
      provider: "exmail",
      host: "imap.exmail.qq.com",
      port: 993,
      secure: true,
      sendImapId: true,
      disableImap4rev2: true,
      smtpHost: "smtp.exmail.qq.com",
      smtpPort: 465,
    };
  }
  throw new Error(
    `no IMAP preset for @${domain}; set host (and optional port) on the account, TLS 993 required`,
  );
}

export function isPrivateOrMetadataHost(host: string): boolean {
  const h = host.trim().toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "metadata.google.internal") return true;
  const ip = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!ip) return false;
  const [a, b] = [Number(ip[1]), Number(ip[2])];
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  return false;
}
