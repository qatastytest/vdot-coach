import { VdotResult } from "@/lib/core/types";

const MIN_TIME_SECONDS = 120;
const MAX_TIME_SECONDS = 8 * 3600;

export function calculateVo2Demand(speedMPerMin: number): number {
  return -4.6 + 0.182258 * speedMPerMin + 0.000104 * speedMPerMin ** 2;
}

export function calculateFractionSustained(timeMinutes: number): number {
  return (
    0.8 +
    0.1894393 * Math.exp(-0.012778 * timeMinutes) +
    0.2989558 * Math.exp(-0.1932605 * timeMinutes)
  );
}

export function calculateVdotFromPerformance(
  distanceMeters: number,
  timeSeconds: number
): VdotResult {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 600 || distanceMeters > 100000) {
    throw new Error("Distance must be between 600m and 100000m.");
  }

  if (!Number.isFinite(timeSeconds) || timeSeconds < MIN_TIME_SECONDS || timeSeconds > MAX_TIME_SECONDS) {
    throw new Error("Time is outside realistic bounds for this calculator.");
  }

  const timeMinutes = timeSeconds / 60;
  const speedMPerMin = distanceMeters / timeMinutes;
  const vo2Demand = calculateVo2Demand(speedMPerMin);
  const fractionSustained = calculateFractionSustained(timeMinutes);
  const vdot = vo2Demand / fractionSustained;

  return {
    vdot,
    roundedVdot: Math.round(vdot * 10) / 10,
    vo2Demand,
    fractionSustained,
    speedMPerMin
  };
}
