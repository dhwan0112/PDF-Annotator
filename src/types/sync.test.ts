import { describe, it, expect } from "vitest";
import { VectorClockUtils, type VectorClock } from "./sync";

describe("VectorClockUtils", () => {
  describe("create", () => {
    it("creates a clock with initial count of 1 for the device", () => {
      const clock = VectorClockUtils.create("device-1");
      expect(clock).toEqual({ "device-1": 1 });
    });
  });

  describe("increment", () => {
    it("increments an existing device counter", () => {
      const clock: VectorClock = { "device-1": 3 };
      const result = VectorClockUtils.increment(clock, "device-1");
      expect(result).toEqual({ "device-1": 4 });
    });

    it("creates a new device counter if not exists", () => {
      const clock: VectorClock = { "device-1": 3 };
      const result = VectorClockUtils.increment(clock, "device-2");
      expect(result).toEqual({ "device-1": 3, "device-2": 1 });
    });

    it("does not mutate original clock", () => {
      const clock: VectorClock = { "device-1": 3 };
      VectorClockUtils.increment(clock, "device-1");
      expect(clock).toEqual({ "device-1": 3 });
    });
  });

  describe("merge", () => {
    it("takes max of each component", () => {
      const a: VectorClock = { "device-1": 3, "device-2": 2 };
      const b: VectorClock = { "device-1": 1, "device-2": 5, "device-3": 1 };
      const result = VectorClockUtils.merge(a, b);
      expect(result).toEqual({ "device-1": 3, "device-2": 5, "device-3": 1 });
    });

    it("handles empty clocks", () => {
      const a: VectorClock = {};
      const b: VectorClock = { "device-1": 1 };
      expect(VectorClockUtils.merge(a, b)).toEqual({ "device-1": 1 });
      expect(VectorClockUtils.merge(b, a)).toEqual({ "device-1": 1 });
    });
  });

  describe("dominates", () => {
    it("returns true when a dominates b", () => {
      const a: VectorClock = { "device-1": 3, "device-2": 2 };
      const b: VectorClock = { "device-1": 2, "device-2": 1 };
      expect(VectorClockUtils.dominates(a, b)).toBe(true);
    });

    it("returns false when a does not dominate b", () => {
      const a: VectorClock = { "device-1": 1 };
      const b: VectorClock = { "device-1": 2 };
      expect(VectorClockUtils.dominates(a, b)).toBe(false);
    });

    it("returns true when a equals b", () => {
      const a: VectorClock = { "device-1": 2 };
      const b: VectorClock = { "device-1": 2 };
      expect(VectorClockUtils.dominates(a, b)).toBe(true);
    });

    it("returns false when b has a device not in a", () => {
      const a: VectorClock = { "device-1": 2 };
      const b: VectorClock = { "device-1": 1, "device-2": 1 };
      expect(VectorClockUtils.dominates(a, b)).toBe(false);
    });
  });

  describe("isConcurrent", () => {
    it("returns true for concurrent updates", () => {
      const a: VectorClock = { "device-1": 2, "device-2": 1 };
      const b: VectorClock = { "device-1": 1, "device-2": 2 };
      expect(VectorClockUtils.isConcurrent(a, b)).toBe(true);
    });

    it("returns false when one dominates", () => {
      const a: VectorClock = { "device-1": 2, "device-2": 2 };
      const b: VectorClock = { "device-1": 1, "device-2": 1 };
      expect(VectorClockUtils.isConcurrent(a, b)).toBe(false);
    });

    it("returns false for equal clocks", () => {
      const a: VectorClock = { "device-1": 2 };
      const b: VectorClock = { "device-1": 2 };
      expect(VectorClockUtils.isConcurrent(a, b)).toBe(false);
    });
  });

  describe("compare", () => {
    it("returns 1 when a > b", () => {
      const a: VectorClock = { "device-1": 2 };
      const b: VectorClock = { "device-1": 1 };
      expect(VectorClockUtils.compare(a, b)).toBe(1);
    });

    it("returns -1 when a < b", () => {
      const a: VectorClock = { "device-1": 1 };
      const b: VectorClock = { "device-1": 2 };
      expect(VectorClockUtils.compare(a, b)).toBe(-1);
    });

    it("returns 0 for concurrent clocks", () => {
      const a: VectorClock = { "device-1": 2, "device-2": 1 };
      const b: VectorClock = { "device-1": 1, "device-2": 2 };
      expect(VectorClockUtils.compare(a, b)).toBe(0);
    });

    it("returns 0 for equal clocks", () => {
      const a: VectorClock = { "device-1": 2 };
      const b: VectorClock = { "device-1": 2 };
      expect(VectorClockUtils.compare(a, b)).toBe(0);
    });
  });

  describe("getTotal", () => {
    it("sums all device counters", () => {
      const clock: VectorClock = { "device-1": 3, "device-2": 5, "device-3": 2 };
      expect(VectorClockUtils.getTotal(clock)).toBe(10);
    });

    it("returns 0 for empty clock", () => {
      expect(VectorClockUtils.getTotal({})).toBe(0);
    });
  });
});
