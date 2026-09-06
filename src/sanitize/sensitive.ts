import { getSettings } from "../config/settings.js";

export type SensitiveClass = "otp" | "password" | "recovery";

const SUBJECT_OTP =
  /验证码|校验码|动态码|授权码|\botp\b|\b2fa\b|verification code|security code|login code|one[-\s]?time (?:code|password)/i;
const SUBJECT_PASSWORD = /密码重置|重置密码|password reset|reset your password|magic link/i;
const SUBJECT_RECOVERY = /账号找回|账户找回|account recovery|recover (?:your )?account/i;
const CODE_NEAR_LABEL = /(?:码|code).{0,12}\d{4,8}|\d{4,8}.{0,12}(?:码|code)/i;

function allowSensitive(): boolean {
  return getSettings().allow_sensitive;
}

function localPart(from?: string): string {
  if (!from) return "";
  const angle = from.match(/<([^>]+)>/);
  const addr = (angle ? angle[1] : from).trim();
  const at = addr.lastIndexOf("@");
  return at > 0 ? addr.slice(0, at).toLowerCase() : "";
}

function domainOfFrom(from?: string): string {
  if (!from) return "";
  const angle = from.match(/<([^>]+)>/);
  const addr = (angle ? angle[1] : from).trim();
  const at = addr.lastIndexOf("@");
  return at > 0 ? addr.slice(at + 1).toLowerCase() : "";
}

export function classifyEnvelope(from?: string, subject?: string): SensitiveClass | undefined {
  if (allowSensitive()) return undefined;
  const sub = subject ?? "";
  if (SUBJECT_OTP.test(sub)) return "otp";
  if (CODE_NEAR_LABEL.test(sub) && /码|code|验证/i.test(sub)) return "otp";
  if (SUBJECT_PASSWORD.test(sub)) return "password";
  if (SUBJECT_RECOVERY.test(sub)) return "recovery";

  const local = localPart(from);
  const domain = domainOfFrom(from);
  const securityLocal = /^(?:security|accounts|password|no-?reply|noreply)$/.test(local);
  if (securityLocal && /(verify|verification|login|signin|password|security|recover|reset|授权|验证)/i.test(sub)) {
    return "otp";
  }
  if (
    (domain.endsWith("github.com") ||
      domain.endsWith("steampowered.com") ||
      domain.endsWith("appleid.apple.com")) &&
    /(security|recover|oauth|verification|added to your account)/i.test(sub)
  ) {
    return "recovery";
  }
  return undefined;
}

export function classifyBody(text: string): SensitiveClass | undefined {
  if (allowSensitive()) return undefined;
  const slice = text.slice(0, 8000);
  if (SUBJECT_OTP.test(slice) && /\d{4,8}/.test(slice)) return "otp";
  if (SUBJECT_PASSWORD.test(slice)) return "password";
  if (SUBJECT_RECOVERY.test(slice)) return "recovery";
  return undefined;
}

export function redactedLabel(cls: SensitiveClass): string {
  return `[redacted:${cls}]`;
}
