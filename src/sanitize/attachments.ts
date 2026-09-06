const DENIED_EXT = new Set([
  "exe",
  "bat",
  "cmd",
  "com",
  "scr",
  "js",
  "mjs",
  "cjs",
  "vbs",
  "ps1",
  "sh",
  "bash",
  "dll",
  "msi",
  "jar",
  "apk",
  "hta",
  "wsf",
  "zip",
  "eml",
  "rar",
  "7z",
  "gz",
  "tgz",
  "tar",
]);

const ALLOWED_EXT = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "txt",
  "csv",
  "md",
  "docx",
  "xlsx",
  "pptx",
  "ics",
]);

export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

export function extensionOf(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? filename;
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  return base.slice(dot + 1).toLowerCase();
}

export function assertAttachmentAllowed(filename: string, bytes: number): void {
  if (bytes > MAX_ATTACHMENT_BYTES) {
    throw new Error(`attachment exceeds ${MAX_ATTACHMENT_BYTES} bytes`);
  }
  const ext = extensionOf(filename);
  if (!ext) throw new Error("attachment has no file extension");
  if (DENIED_EXT.has(ext)) throw new Error(`attachment type .${ext} is blocked`);
  if (!ALLOWED_EXT.has(ext)) throw new Error(`attachment type .${ext} is not in the allowlist`);
}
