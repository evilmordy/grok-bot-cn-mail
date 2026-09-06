import { describe, expect, it } from "vitest";
import { buildRfc822, forwardSubject, replySubject } from "./rfc822.js";

describe("rfc822", () => {
  it("locks From and adds reply threading headers", () => {
    const raw = buildRfc822({
      from: "me@qq.com",
      to: ["boss@example.com"],
      subject: "Re: Q4",
      body: "ok",
      messageId: "<id@qq.com>",
      inReplyTo: "<orig@example.com>",
      references: "<orig@example.com>",
    });
    expect(raw).toMatch(/^From: me@qq.com/m);
    expect(raw).toContain("In-Reply-To: <orig@example.com>");
    expect(raw).not.toMatch(/^Bcc:/m);
  });

  it("does not duplicate Re:", () => {
    expect(replySubject("Re: Hello")).toBe("Re: Hello");
    expect(replySubject("Hello")).toBe("Re: Hello");
    expect(forwardSubject("Hi")).toBe("Fwd: Hi");
  });

  it("rejects CR/LF in header fields", () => {
    expect(() =>
      buildRfc822({
        from: "me@qq.com",
        to: ["boss@example.com\r\nBcc: evil@evil.com"],
        subject: "hi",
        body: "ok",
        messageId: "<id@qq.com>",
      }),
    ).toThrow(/To contains CR\/LF/);
  });
});
