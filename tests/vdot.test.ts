import { describe, expect, it } from "vitest";
import { calculateVdotFromPerformance } from "@/lib/core/vdot";

describe("VDOT calculation", () => {
  it("matches known Daniels-style sample values", () => {
    const fiveK = calculateVdotFromPerformance(5000, 20 * 60);
    const tenK = calculateVdotFromPerformance(10000, 40 * 60);
    const half = calculateVdotFromPerformance(21097.5, 95 * 60);

    expect(fiveK.vdot).toBeCloseTo(49.8062, 3);
    expect(tenK.vdot).toBeCloseTo(51.9441, 3);
    expect(half.vdot).toBeCloseTo(47.8878, 3);
  });

  it("is monotonic for same distance (faster time => higher VDOT)", () => {
    const faster = calculateVdotFromPerformance(5000, 19 * 60);
    const slower = calculateVdotFromPerformance(5000, 21 * 60);
    expect(faster.vdot).toBeGreaterThan(slower.vdot);
  });
});
