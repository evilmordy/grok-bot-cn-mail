import { describe, expect, it } from "vitest";
import { applyDotEnvText } from "./dotenv.js";

describe("applyDotEnvText", () => {
  it("fills empty keys and ignores comments", () => {
    const env: NodeJS.ProcessEnv = {};
    applyDotEnvText(
      `# hi\nMAIL_USER=you@qq.com\nexport QQCONNECT_PERMISSIONS=read,draft\n`,
      env,
    );
    expect(env.MAIL_USER).toBe("you@qq.com");
    expect(env.QQCONNECT_PERMISSIONS).toBeUndefined();
  });

  it("does not override a value already in the process env", () => {
    const env: NodeJS.ProcessEnv = { MAIL_USER: "from-grok@qq.com" };
    applyDotEnvText("MAIL_USER=from-file@qq.com\nQQCONNECT_AUTH_CODE=from-file\n", env);
    expect(env.MAIL_USER).toBe("from-grok@qq.com");
    expect(env.QQCONNECT_AUTH_CODE).toBe("from-file");
  });

  it("strips matching quotes", () => {
    const env: NodeJS.ProcessEnv = {};
    applyDotEnvText(`MAIL_AUTH_CODE='ab cd'\nMAIL_USER="a@b.com"\n`, env);
    expect(env.MAIL_AUTH_CODE).toBe("ab cd");
    expect(env.MAIL_USER).toBe("a@b.com");
  });
});
