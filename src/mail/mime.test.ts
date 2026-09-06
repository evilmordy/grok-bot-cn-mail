import { describe, expect, it } from "vitest";
import { attachmentNodes, textParts, type MimeNode } from "./mime.js";

const tree: MimeNode = {
  type: "multipart/mixed",
  part: "1",
  childNodes: [
    {
      type: "multipart/alternative",
      part: "1",
      childNodes: [
        { type: "text/plain", part: "1.1" },
        { type: "text/html", part: "1.2" },
      ],
    },
    {
      type: "application/pdf",
      part: "2",
      disposition: "attachment",
      dispositionParameters: { filename: "invoice.pdf" },
      size: 1200,
    },
  ],
};

describe("mime walk", () => {
  it("finds plain and html parts without assuming part 1 is the body", () => {
    const parts = textParts(tree);
    expect(parts.plain?.part).toBe("1.1");
    expect(parts.html?.part).toBe("1.2");
  });

  it("lists named attachments", () => {
    const atts = attachmentNodes(tree);
    expect(atts).toEqual([
      { part: "2", filename: "invoice.pdf", contentType: "application/pdf", size: 1200 },
    ]);
  });
});
