export type PlanPhase = "base" | "build" | "specific" | "deload" | "taper";
export type WorkoutType =
  | "easy"
  | "recovery"
  | "threshold"
  | "interval"
  | "long_run"
  | "strides"
  | "race";
export type WorkoutStatus = "planned" | "done" | "skipped";
export type PlanDurationWeeks = 4 | 8 | 12 | 16;

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
  status: WorkoutStatus;
  actualSummary?: string;
  actualDistanceKm?: number;
  actualRpe?: string;
  actualNotes?: string;
  completedAt?: string;
  lastEditedAt?: string;
  isEdited?: boolean;
}

export interface TrainingWeekPlan {
  weekNumber: number;
  phase: PlanPhase;
  targetVolumeKm: number;
  workouts: PlannedWorkout[];
  notes: string[];
}

export interface TrainingPlanOutput {
  id: string;
  durationWeeks: PlanDurationWeeks;
  generatedAt: string;
  summary: string;
  replanCount: number;
  refreshContext?: {
    done: number;
    skipped: number;
    edited: number;
    skipRate: number;
  };
  weeks: TrainingWeekPlan[];
}
