import { describe, expect, it } from "vitest";
import { SendLimiter } from "./client.js";

describe("SendLimiter", () => {
  it("allows five takes and rejects the sixth", () => {
    const lim = new SendLimiter(5);
    for (let i = 0; i < 5; i++) lim.take();
    expect(() => lim.take()).toThrow(/rate limit/);
  });
});
