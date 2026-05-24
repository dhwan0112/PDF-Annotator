import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { debug } from "./debug";

describe("debug utility", () => {
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };

  beforeEach(() => {
    console.log = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  describe("error", () => {
    it("always logs errors regardless of environment", () => {
      debug.error("test error");
      expect(console.error).toHaveBeenCalledWith("test error");
    });

    it("passes multiple arguments", () => {
      debug.error("error:", { code: 500 });
      expect(console.error).toHaveBeenCalledWith("error:", { code: 500 });
    });
  });
});
