import { describe, expect, it } from "vitest";
import { collectAddresses, replyTargets } from "./compose.js";

describe("replyTargets", () => {
  it("locks To to original From and ignores body-supplied attackers", () => {
    const rec = replyTargets({
      self: "you@qq.com",
      from: "boss@example.com",
      to: "you@qq.com",
      replyAll: false,
    });
    expect(rec.to).toEqual(["boss@example.com"]);
    expect(rec.cc).toEqual([]);
  });

  it("normalizes display-name To the same way as send_email", () => {
    expect(collectAddresses("Boss <boss@example.com>")).toEqual(["boss@example.com"]);
  });

  it("drops self on reply-all", () => {
    const rec = replyTargets({
      self: "you@qq.com",
      from: "boss@example.com",
      to: "you@qq.com, peer@example.com",
      cc: "cc@example.com",
      replyAll: true,
    });
    expect(rec.to).toEqual(["boss@example.com"]);
    expect(rec.cc).toContain("peer@example.com");
    expect(rec.cc).toContain("cc@example.com");
    expect(rec.cc).not.toContain("you@qq.com");
  });
});
