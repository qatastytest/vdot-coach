import { HrEstimationResult, HrZone } from "@/lib/core/types";

function toZone(name: string, low: number, high: number): HrZone {
  return {
    name,
    low: Math.round(low),
    high: Math.round(high)
  };
}

function buildPercentMaxZones(maxHr: number): HrZone[] {
  return [
    toZone("Z1 Recovery", maxHr * 0.6, maxHr * 0.7),
    toZone("Z2 Aerobic", maxHr * 0.7, maxHr * 0.8),
    toZone("Z3 Steady", maxHr * 0.8, maxHr * 0.87),
    toZone("Z4 Threshold", maxHr * 0.87, maxHr * 0.93),
    toZone("Z5 VO2+", maxHr * 0.93, maxHr)
  ];
}

function buildKarvonenZones(maxHr: number, restingHr: number): HrZone[] {
  const reserve = maxHr - restingHr;
  return [
    toZone("Z1 Recovery", reserve * 0.6 + restingHr, reserve * 0.7 + restingHr),
    toZone("Z2 Aerobic", reserve * 0.7 + restingHr, reserve * 0.8 + restingHr),
    toZone("Z3 Steady", reserve * 0.8 + restingHr, reserve * 0.87 + restingHr),
    toZone("Z4 Threshold", reserve * 0.87 + restingHr, reserve * 0.93 + restingHr),
    toZone("Z5 VO2+", reserve * 0.93 + restingHr, maxHr)
  ];
}

function buildLthrZones(lthr: number): HrZone[] {
  return [
    toZone("Z1 Recovery", lthr * 0.78, lthr * 0.85),
    toZone("Z2 Aerobic", lthr * 0.85, lthr * 0.89),
    toZone("Z3 Tempo", lthr * 0.9, lthr * 0.94),
    toZone("Z4 Threshold", lthr * 0.95, lthr * 0.99),
    toZone("Z5 Anaerobic", lthr, lthr * 1.06)
  ];
}

const BASE_WARNING =
  "Estimated HR zones can drift with heat, hydration, fatigue, stress, and altitude. Use pace/RPE to cross-check.";

export function estimateHrZonesFromPercentMax(maxHr: number): HrEstimationResult {
  return {
    method: "percent_max",
    zones: buildPercentMaxZones(maxHr),
    warning: BASE_WARNING
  };
}

export function estimateHrZonesKarvonen(maxHr: number, restingHr: number): HrEstimationResult {
  if (restingHr >= maxHr) {
    throw new Error("Resting HR must be below max HR.");
  }
  return {
    method: "karvonen",
    zones: buildKarvonenZones(maxHr, restingHr),
    warning: BASE_WARNING
  };
}

export function estimateHrZonesFromLthr(lthr: number): HrEstimationResult {
  return {
    method: "lthr",
    zones: buildLthrZones(lthr),
    warning: BASE_WARNING
  };
}
