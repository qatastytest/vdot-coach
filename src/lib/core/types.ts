export const RACE_DISTANCES = [
  { key: "1500m", label: "1500m", meters: 1500 },
  { key: "1mile", label: "1 mile", meters: 1609.34 },
  { key: "3k", label: "3K", meters: 3000 },
  { key: "5k", label: "5K", meters: 5000 },
  { key: "10k", label: "10K", meters: 10000 },
  { key: "half", label: "Half Marathon", meters: 21097.5 },
  { key: "marathon", label: "Marathon", meters: 42195 }
] as const;

export type RaceDistanceKey = (typeof RACE_DISTANCES)[number]["key"];
export type EventType = "race" | "test";
export type EffortType = "all_out" | "hard" | "controlled";
export type SurfaceType = "track" | "road" | "trail" | "mixed";
export type Units = "km" | "mile";

export interface PerformanceInput {
  distanceMeters: number;
  timeSeconds: number;
  date: string;
  eventType: EventType;
  effortType: EffortType;
  surface: SurfaceType;
  elevationGainM?: number;
  temperatureC?: number;
  windKph?: number;
}

export type ConfidenceLabel = "high" | "medium" | "low";

export interface ConfidenceResult {
  label: ConfidenceLabel;
  reasons: string[];
}

export interface VdotResult {
  vdot: number;
  roundedVdot: number;
  vo2Demand: number;
  fractionSustained: number;
  speedMPerMin: number;
}

export interface PredictedRaceTime {
  raceKey: RaceDistanceKey;
  distanceMeters: number;
  timeSeconds: number;
  pacePerKmSeconds: number;
  pacePerMileSeconds: number;
}

export interface PaceZone {
  label: string;
  lowSecondsPerKm?: number;
  highSecondsPerKm?: number;
  targetSecondsPerKm?: number;
  guidance: string;
}

export interface LapSplit {
  lapMeters: number;
  seconds: number;
}

export interface TrainingPaces {
  easy: PaceZone;
  marathon: PaceZone;
  threshold: PaceZone;
  interval: PaceZone;
  repetition: PaceZone;
  lapSplits: Record<"T" | "I" | "R", LapSplit[]>;
  stridesGuidance: string;
}

export interface HrZone {
  name: string;
  low: number;
  high: number;
}

export interface HrEstimationResult {
  method: "percent_max" | "karvonen" | "lthr";
  zones: HrZone[];
  warning: string;
}
