import { describe, expect, it } from "vitest";
import {
  assertRecipientsAllowed,
  isAddressAllowed,
  parseSendAllowlist,
} from "./allowlist.js";

describe("send allowlist", () => {
  it("parses exact addresses and @domain rules", () => {
    const list = parseSendAllowlist("me@qq.com, @example.com");
    expect(isAddressAllowed("me@qq.com", list)).toBe(true);
    expect(isAddressAllowed("a@example.com", list)).toBe(true);
    expect(isAddressAllowed("evil@evil.com", list)).toBe(false);
  });

  it("refuses send when the list is empty", () => {
    expect(() => assertRecipientsAllowed(["a@b.com"], [])).toThrow(/send allowlist is empty/);
  });

  it("blocks addresses not on the list", () => {
    expect(() => assertRecipientsAllowed(["hacker@evil.com"], ["me@qq.com"])).toThrow(
      /not on send allowlist/,
    );
  });
});
