import { PredictedRaceTime, RACE_DISTANCES } from "@/lib/core/types";
import { calculateVdotFromPerformance } from "@/lib/core/vdot";

function pacePerKmSeconds(distanceMeters: number, timeSeconds: number): number {
  return timeSeconds / (distanceMeters / 1000);
}

function pacePerMileSeconds(distanceMeters: number, timeSeconds: number): number {
  return timeSeconds / (distanceMeters / 1609.34);
}

export function solveTimeForVdot(targetVdot: number, distanceMeters: number): number {
  const minMinutes = distanceMeters / 500;
  const maxMinutes = distanceMeters / 80;

  let lowSeconds = minMinutes * 60;
  let highSeconds = maxMinutes * 60;

  for (let i = 0; i < 80; i += 1) {
    const mid = (lowSeconds + highSeconds) / 2;
    const midVdot = calculateVdotFromPerformance(distanceMeters, mid).vdot;
    if (midVdot > targetVdot) {
      lowSeconds = mid;
    } else {
      highSeconds = mid;
    }
  }

  return (lowSeconds + highSeconds) / 2;
}

export function buildRacePredictions(vdot: number): PredictedRaceTime[] {
  return RACE_DISTANCES.map((distance) => {
    const solvedSeconds = solveTimeForVdot(vdot, distance.meters);
    return {
      raceKey: distance.key,
      distanceMeters: distance.meters,
      timeSeconds: solvedSeconds,
      pacePerKmSeconds: pacePerKmSeconds(distance.meters, solvedSeconds),
      pacePerMileSeconds: pacePerMileSeconds(distance.meters, solvedSeconds)
    };
  });
}
