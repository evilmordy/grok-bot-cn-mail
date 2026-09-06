import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getSettings, overrideSettingsForTest, saveSettings } from "./settings.js";

afterEach(() => {
  delete process.env.QQCONNECT_CONFIG;
  overrideSettingsForTest(null);
});

describe("settings", () => {
  it("defaults to read with empty allowlist", () => {
    process.env.QQCONNECT_CONFIG = join(mkdtempSync(join(tmpdir(), "qq-")), "missing.json");
    expect(getSettings()).toEqual({ mode: "read", send_allowlist: [], allow_sensitive: false });
  });

  it("round-trips a draft config", () => {
    const file = join(mkdtempSync(join(tmpdir(), "qq-")), ".qqconnect.json");
    process.env.QQCONNECT_CONFIG = file;
    saveSettings({ mode: "draft", send_allowlist: [], allow_sensitive: false });
    overrideSettingsForTest(null);
    expect(getSettings().mode).toBe("draft");
    const disk = JSON.parse(readFileSync(file, "utf8")) as { mode: string };
    expect(disk.mode).toBe("draft");
  });

  it("refuses send without allowlist", () => {
    const file = join(mkdtempSync(join(tmpdir(), "qq-")), ".qqconnect.json");
    process.env.QQCONNECT_CONFIG = file;
    expect(() =>
      saveSettings({ mode: "send", send_allowlist: [], allow_sensitive: false }),
    ).toThrow(/send_allowlist/);
  });
});
