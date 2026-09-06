export function parseSendAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeAddress(raw: string): string {
  const trimmed = raw.trim();
  const angle = trimmed.match(/<([^>]+)>/);
  return (angle ? angle[1] : trimmed).trim().toLowerCase();
}

export function isAddressAllowed(address: string, allowlist: string[]): boolean {
  const addr = normalizeAddress(address);
  if (!addr.includes("@")) return false;
  const domain = addr.slice(addr.lastIndexOf("@"));
  for (const rule of allowlist) {
    if (rule.startsWith("@")) {
      if (domain === rule || addr.endsWith(rule)) return true;
    } else if (addr === rule) {
      return true;
    }
  }
  return false;
}

export function assertRecipientsAllowed(addresses: string[], allowlist: string[]): void {
  if (allowlist.length === 0) {
    throw new Error("send allowlist is empty; set it with config set-mode send --allow you@qq.com");
  }
  const bad = addresses.filter((a) => !isAddressAllowed(a, allowlist));
  if (bad.length > 0) {
    throw new Error(`recipient not on send allowlist: ${bad.join(", ")}`);
  }
}

export function parseAddressList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Local@domain, no lookahead (MCP schemas must not use z.string().email()). */
const ADDR = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

export function assertLooksLikeAddress(address: string): void {
  if (/[\r\n\0]/.test(address)) {
    throw new Error(`invalid recipient ${address}`);
  }
  const addr = normalizeAddress(address);
  if (!ADDR.test(addr)) {
    throw new Error(`invalid recipient ${address}`);
  }
}
