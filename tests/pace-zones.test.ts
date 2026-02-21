import { describe, expect, it } from "vitest";
import { deriveTrainingPaces } from "@/lib/core";

describe("Training pace zones", () => {
  it("produces sensible pace ordering and ranges", () => {
    const paces = deriveTrainingPaces(50);
    expect(paces.easy.lowSecondsPerKm).toBeLessThan(paces.easy.highSecondsPerKm!);
    expect(paces.threshold.lowSecondsPerKm).toBeLessThan(paces.threshold.highSecondsPerKm!);

    expect(paces.interval.targetSecondsPerKm).toBeLessThan(paces.threshold.lowSecondsPerKm!);
    expect(paces.repetition.targetSecondsPerKm).toBeLessThan(paces.interval.targetSecondsPerKm!);
  });

  it("builds lap splits for T, I, and R paces", () => {
    const paces = deriveTrainingPaces(55);
    expect(paces.lapSplits.T).toHaveLength(5);
    expect(paces.lapSplits.I).toHaveLength(5);
    expect(paces.lapSplits.R).toHaveLength(5);
    expect(paces.lapSplits.T[0].lapMeters).toBe(200);
  });
});
