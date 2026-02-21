import { BaselineSnapshot, RaceGoal, RunnerProfile } from "@/lib/domain/models";
import { TrainingPlanOutput } from "@/lib/plan";

const KEYS = {
  baseline: "vdot-coach:baseline",
  profile: "vdot-coach:profile",
  goal: "vdot-coach:goal",
  plan: "vdot-coach:plan"
} as const;

function safeRead<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeWrite<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getStoredBaseline(): BaselineSnapshot | null {
  return safeRead<BaselineSnapshot>(KEYS.baseline);
}

export function setStoredBaseline(baseline: BaselineSnapshot): void {
  safeWrite(KEYS.baseline, baseline);
}

export function getStoredProfile(): RunnerProfile | null {
  return safeRead<RunnerProfile>(KEYS.profile);
}

export function setStoredProfile(profile: RunnerProfile): void {
  safeWrite(KEYS.profile, profile);
}

export function getStoredGoal(): RaceGoal | null {
  return safeRead<RaceGoal>(KEYS.goal);
}

export function setStoredGoal(goal: RaceGoal): void {
  safeWrite(KEYS.goal, goal);
}

export function getStoredPlan(): TrainingPlanOutput | null {
  return safeRead<TrainingPlanOutput>(KEYS.plan);
}

export function setStoredPlan(plan: TrainingPlanOutput): void {
  safeWrite(KEYS.plan, plan);
}
