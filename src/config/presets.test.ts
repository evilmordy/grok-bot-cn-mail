import { describe, expect, it } from "vitest";
import { isPrivateOrMetadataHost, resolvePreset } from "./presets.js";

describe("resolvePreset", () => {
  it("maps QQ and Foxmail to imap.qq.com:993", () => {
    expect(resolvePreset("a@qq.com").host).toBe("imap.qq.com");
    expect(resolvePreset("a@foxmail.com").host).toBe("imap.qq.com");
    expect(resolvePreset("a@qq.com").sendImapId).toBe(true);
    expect(resolvePreset("a@qq.com").smtpHost).toBe("smtp.qq.com");
  });

  it("maps 163/126 and Tencent exmail", () => {
    expect(resolvePreset("a@163.com")).toMatchObject({ host: "imap.163.com", sendImapId: true });
    expect(resolvePreset("a@126.com").host).toBe("imap.126.com");
    expect(resolvePreset("user@corp.exmail.qq.com").host).toBe("imap.exmail.qq.com");
  });

  it("rejects unknown domains without an explicit host", () => {
    expect(() => resolvePreset("a@gmail.com")).toThrow(/no IMAP preset/);
  });
});

describe("isPrivateOrMetadataHost", () => {
  it("blocks loopback, RFC1918, and cloud metadata", () => {
    expect(isPrivateOrMetadataHost("127.0.0.1")).toBe(true);
    expect(isPrivateOrMetadataHost("10.0.0.5")).toBe(true);
    expect(isPrivateOrMetadataHost("192.168.1.1")).toBe(true);
    expect(isPrivateOrMetadataHost("169.254.169.254")).toBe(true);
    expect(isPrivateOrMetadataHost("imap.qq.com")).toBe(false);
  });
});
