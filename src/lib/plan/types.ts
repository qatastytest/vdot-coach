export type PlanPhase = "base" | "build" | "specific" | "deload" | "taper";
export type WorkoutType = "easy" | "recovery" | "threshold" | "interval" | "long_run" | "strides";

export interface WorkoutAlternative {
  noTrack: string;
  tired: string;
  missed: string;
}

export interface PlannedWorkout {
  id: string;
  day: string;
  type: WorkoutType;
  isKey: boolean;
  title: string;
  warmup: string;
  mainSet: string;
  cooldown: string;
  paceTarget: string;
  hrFallback: string;
  rpe: string;
  purpose: string;
  alternatives: WorkoutAlternative;
  distanceKm: number;
}

export interface TrainingWeekPlan {
  weekNumber: number;
  phase: PlanPhase;
  targetVolumeKm: number;
  workouts: PlannedWorkout[];
  notes: string[];
}

export interface TrainingPlanOutput {
  durationWeeks: 4 | 8;
  generatedAt: string;
  summary: string;
  weeks: TrainingWeekPlan[];
}
