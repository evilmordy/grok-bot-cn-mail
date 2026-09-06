export type MimeNode = {
  type?: string;
  encoding?: string;
  part?: string;
  size?: number;
  disposition?: string;
  dispositionParameters?: Record<string, string>;
  parameters?: Record<string, string>;
  childNodes?: MimeNode[];
};

function walkMime(node: MimeNode | undefined, acc: MimeNode[] = []): MimeNode[] {
  if (!node) return acc;
  acc.push(node);
  for (const child of node.childNodes ?? []) walkMime(child, acc);
  return acc;
}

function isAttachment(node: MimeNode): boolean {
  const disp = (node.disposition ?? "").toLowerCase();
  if (disp === "attachment") return true;
  const filename = node.dispositionParameters?.filename ?? node.parameters?.name;
  if (filename && disp !== "inline") return true;
  return false;
}

export function textParts(root: MimeNode | undefined): { plain?: { part: string }; html?: { part: string } } {
  const nodes = walkMime(root);
  let plain: { part: string } | undefined;
  let html: { part: string } | undefined;
  for (const n of nodes) {
    if (isAttachment(n) || !n.part) continue;
    const type = (n.type ?? "").toLowerCase();
    if (type === "text/plain" && !plain) plain = { part: n.part };
    if (type === "text/html" && !html) html = { part: n.part };
  }
  return { plain, html };
}

export function attachmentNodes(root: MimeNode | undefined): AttachmentPart[] {
  const out: AttachmentPart[] = [];
  for (const n of walkMime(root)) {
    if (!n.part) continue;
    const filename =
      n.dispositionParameters?.filename ?? n.parameters?.name ?? (isAttachment(n) ? `part-${n.part}` : "");
    if (!filename) continue;
    if (!isAttachment(n) && !(n.dispositionParameters?.filename || n.parameters?.name)) continue;
    out.push({
      part: n.part,
      filename,
      contentType: n.type ?? "application/octet-stream",
      size: n.size ?? 0,
    });
  }
  return out;
}

export type AttachmentPart = {
  part: string;
  filename: string;
  contentType: string;
  size: number;
};
