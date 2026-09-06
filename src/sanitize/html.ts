import { convert } from "html-to-text";

export const DEFAULT_BODY_LIMIT = 50_000;

function replaceUntilStable(input: string, pattern: RegExp, replacement: string): string {
  let previous = "";
  let current = input;
  while (current !== previous) {
    previous = current;
    current = current.replace(pattern, replacement);
  }
  return current;
}

export function htmlToText(html: string): string {
  const text = convert(html, {
    wordwrap: false,
    selectors: [
      { selector: "script", format: "skip" },
      { selector: "style", format: "skip" },
      { selector: "img", format: "skip" },
      { selector: "a", options: { ignoreHref: false } },
    ],
  });
  const noTags = replaceUntilStable(text, /<[^>]*>/g, "");
  return replaceUntilStable(noTags, /(?:javascript|data|vbscript):/gi, "");
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


