import { describe, expect, it } from "vitest";
import { buildRacePredictions, calculateVdotFromPerformance, solveTimeForVdot } from "@/lib/core";

describe("Prediction solver", () => {
  it("round-trips VDOT consistently", () => {
    const source = calculateVdotFromPerformance(5000, 1200).vdot;
    const predictedFiveKTime = solveTimeForVdot(source, 5000);
    const roundTrip = calculateVdotFromPerformance(5000, predictedFiveKTime).vdot;
    expect(roundTrip).toBeCloseTo(source, 3);
  });

  it("returns all supported race distances", () => {
    const predictions = buildRacePredictions(50);
    expect(predictions).toHaveLength(7);
    expect(predictions.every((prediction) => prediction.timeSeconds > 0)).toBe(true);
  });
});
