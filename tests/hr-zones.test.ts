import { describe, expect, it } from "vitest";
import {
  estimateHrZonesFromLthr,
  estimateHrZonesFromPercentMax,
  estimateHrZonesKarvonen
} from "@/lib/core";

describe("Heart rate zone methods", () => {
  it("supports percent of max HR", () => {
    const result = estimateHrZonesFromPercentMax(190);
    expect(result.method).toBe("percent_max");
    expect(result.zones).toHaveLength(5);
    expect(result.zones[0].low).toBe(114);
  });

  it("supports Karvonen with resting HR", () => {
    const result = estimateHrZonesKarvonen(190, 50);
    expect(result.method).toBe("karvonen");
    expect(result.zones[0].low).toBe(134);
    expect(result.zones[4].high).toBe(190);
  });

  it("supports LTHR zones", () => {
    const result = estimateHrZonesFromLthr(170);
    expect(result.method).toBe("lthr");
    expect(result.zones[3].low).toBe(162);
  });
});
