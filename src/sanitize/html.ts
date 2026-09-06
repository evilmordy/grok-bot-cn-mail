import { convert } from "html-to-text";

export const DEFAULT_BODY_LIMIT = 50_000;

export function htmlToText(html: string): string {
  const stripped = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
  const text = convert(stripped, {
    wordwrap: false,
    selectors: [
      { selector: "script", format: "skip" },
      { selector: "style", format: "skip" },
      { selector: "img", format: "skip" },
      { selector: "a", options: { ignoreHref: false } },
    ],
  });
  return text.replace(/<[^>]*>/g, "").replace(/javascript:/gi, "");
}

export function pickBody(plain: string | undefined, html: string | undefined): string {
  const plainText = (plain ?? "").trim();
  const fromHtml = html ? htmlToText(html).trim() : "";
  if (
    fromHtml &&
    (fromHtml.length >= plainText.length + 20 || fromHtml.length > plainText.length * 1.2)
  ) {
    return fromHtml;
  }
  if (plainText) return plainText;
  return fromHtml;
}

export function truncateBody(text: string, limit = DEFAULT_BODY_LIMIT): { text: string; truncated: boolean } {
  if (text.length <= limit) return { text, truncated: false };
  return { text: `${text.slice(0, limit)}\n…[truncated]`, truncated: true };
}


