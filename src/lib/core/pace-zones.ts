import { LapSplit, TrainingPaces } from "@/lib/core/types";

const LAP_DISTANCES = [200, 300, 330, 400, 1000];

function speedFromVo2Demand(vo2Demand: number): number {
  const a = 0.000104;
  const b = 0.182258;
  const c = -4.6 - vo2Demand;
  const discriminant = b ** 2 - 4 * a * c;
  const positiveRoot = (-b + Math.sqrt(discriminant)) / (2 * a);
  return positiveRoot;
}

function secondsPerKmFromIntensity(vdot: number, intensity: number): number {
  const vo2Demand = vdot * intensity;
  const speedMPerMin = speedFromVo2Demand(vo2Demand);
  return (1000 / speedMPerMin) * 60;
}

function buildLapSplits(secondsPerKm: number): LapSplit[] {
  return LAP_DISTANCES.map((lapMeters) => ({
    lapMeters,
    seconds: (secondsPerKm * lapMeters) / 1000
  }));
}

export function deriveTrainingPaces(vdot: number): TrainingPaces {
  const easyLow = secondsPerKmFromIntensity(vdot, 0.74);
  const easyHigh = secondsPerKmFromIntensity(vdot, 0.59);
  const marathon = secondsPerKmFromIntensity(vdot, 0.8);
  const thresholdLow = secondsPerKmFromIntensity(vdot, 0.88);
  const thresholdHigh = secondsPerKmFromIntensity(vdot, 0.83);
  const interval = secondsPerKmFromIntensity(vdot, 0.98);
  const repetition = secondsPerKmFromIntensity(vdot, 1.08);

  return {
    easy: {
      label: "Easy",
      lowSecondsPerKm: easyLow,
      highSecondsPerKm: easyHigh,
      guidance: "Aerobic support, conversational effort, recovery focused."
    },
    marathon: {
      label: "Marathon",
      targetSecondsPerKm: marathon,
      guidance: "Steady aerobic pace, specific endurance for long sustained efforts."
    },
    threshold: {
      label: "Threshold",
      lowSecondsPerKm: thresholdLow,
      highSecondsPerKm: thresholdHigh,
      guidance: "Comfortably hard, controlled, builds lactate clearance."
    },
    interval: {
      label: "Interval",
      targetSecondsPerKm: interval,
      guidance: "VO2-focused repetitions with jog recoveries."
    },
    repetition: {
      label: "Repetition",
      targetSecondsPerKm: repetition,
      guidance: "Economy and speed stimulus, full recovery between reps."
    },
    lapSplits: {
      T: buildLapSplits((thresholdLow + thresholdHigh) / 2),
      I: buildLapSplits(interval),
      R: buildLapSplits(repetition)
    },
    stridesGuidance:
      "Optional after easy runs: 4-8 x 15-20s relaxed fast strides, walk/jog full recovery."
  };
}
