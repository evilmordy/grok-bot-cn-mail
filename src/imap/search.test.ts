import { describe, expect, it } from "vitest";
import { clampLimit, parseDay, toImapSearch } from "./search.js";

describe("parseDay", () => {
  it("accepts YYYY-MM-DD", () => {
    expect(parseDay("2026-09-01", "since")?.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("rejects other formats", () => {
    expect(() => parseDay("09/01/2026", "since")).toThrow(/YYYY-MM-DD/);
  });
});

describe("toImapSearch", () => {
  it("only sets provided fields", () => {
    expect(
      toImapSearch({
        accountId: "qq",
        folder: "INBOX",
        from: "a@b.com",
        unseen: true,
        limit: 10,
      }),
    ).toEqual({ from: "a@b.com", unseen: true });
  });
});

describe("clampLimit", () => {
  it("caps at 25", () => {
    expect(clampLimit(100)).toBe(25);
    expect(clampLimit(0)).toBe(1);
  });
});
