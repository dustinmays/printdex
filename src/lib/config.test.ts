import { describe, it, expect } from "vitest";
import { getConfig } from "./config";

describe("getConfig", () => {
  it("returns a config with a baseDir", () => {
    const cfg = getConfig();
    expect(cfg.baseDir).toBeTruthy();
    expect(typeof cfg.baseDir).toBe("string");
  });

  it("defaults import settings", () => {
    const cfg = getConfig();
    expect(cfg.import.max_turns).toBeGreaterThan(0);
    expect(cfg.import.max_budget_usd).toBeGreaterThan(0);
  });
});
