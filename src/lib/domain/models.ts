import {
  ConfidenceResult,
  EventType,
  PredictedRaceTime,
  SurfaceType,
  TrainingPaces,
  Units
} from "@/lib/core";

export interface RunnerProfile {
  age?: number;
  weeklyKmCurrent: number;
  weeklyKmMaxTolerated: number;
  daysPerWeekAvailable: 3 | 4 | 5 | 6;
  preferredLongRunDay:
    | "Monday"
    | "Tuesday"
    | "Wednesday"
    | "Thursday"
    | "Friday"
    | "Saturday"
    | "Sunday";
  maxHr?: number;
  restingHr?: number;
  lthr?: number;
  experienceLevel: "beginner" | "intermediate" | "advanced";
  injuryNotes?: string;
  preferredUnits: Units;
}

export interface RaceGoal {
  goalDistance: "5k" | "10k" | "half";
  targetDate?: string;
  targetTimeSeconds?: number;
  ambition: "finish" | "realistic_pb" | "aggressive_pb";
  daysPerWeek: 3 | 4 | 5 | 6;
  longRunDay:
    | "Monday"
    | "Tuesday"
    | "Wednesday"
    | "Thursday"
    | "Friday"
    | "Saturday"
    | "Sunday";
  preferredRestDay?:
    | "Monday"
    | "Tuesday"
    | "Wednesday"
    | "Thursday"
    | "Friday"
    | "Saturday"
    | "Sunday";
  trackAccess: boolean;
  planLengthWeeks: 4 | 8 | 12 | 16;
}

export interface BaselineSnapshot {
  performance: {
    distanceMeters: number;
    timeSeconds: number;
    date: string;
    eventType: EventType;
    effortType: "all_out" | "hard" | "controlled";
    surface: SurfaceType;
    elevationGainM?: number;
    temperatureC?: number;
    windKph?: number;
  };
  vdot: number;
  confidence: ConfidenceResult;
  predictions: PredictedRaceTime[];
  paces: TrainingPaces;
  coachingNotes: string[];
}
