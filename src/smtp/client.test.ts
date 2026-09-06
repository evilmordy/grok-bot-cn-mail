import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { SendLimiter } from "./client.js";

describe("SendLimiter", () => {
  it("allows five takes and rejects the sixth", () => {
    const lim = new SendLimiter(5);
    for (let i = 0; i < 5; i++) lim.take();
    expect(() => lim.take()).toThrow(/rate limit/);
  });

  it("persists the hourly window across instances", () => {
    const file = join(mkdtempSync(join(tmpdir(), "send-")), "count.json");
    const now = () => 1_700_000_000_000;
    const a = new SendLimiter(5, { file, now, windowMs: 3_600_000 });
    for (let i = 0; i < 5; i++) a.take();
    const b = new SendLimiter(5, { file, now, windowMs: 3_600_000 });
    expect(() => b.take()).toThrow(/per hour/);
    const disk = JSON.parse(readFileSync(file, "utf8")) as { count: number };
    expect(disk.count).toBe(5);
    expect(readdirSync(dirname(file)).filter((n) => n.endsWith(".tmp"))).toEqual([]);
  });

  it("resets after the window elapses", () => {
    const file = join(mkdtempSync(join(tmpdir(), "send-")), "count.json");
    writeFileSync(file, JSON.stringify({ startedAt: 1, count: 5 }), "utf8");
    const lim = new SendLimiter(5, { file, now: () => 1 + 3_600_001, windowMs: 3_600_000 });
    expect(() => lim.take()).not.toThrow();
  });
});
