export type MissedWorkoutType = "easy" | "key" | "long_run";

export function missedWorkoutGuidance(
  workoutType: MissedWorkoutType,
  hoursUntilNextKeySession: number
): string {
  if (workoutType === "easy") {
    return "Skip and continue. Do not force a make-up easy run.";
  }

  if (workoutType === "key") {
    if (hoursUntilNextKeySession >= 48) {
      return "Move once only if at least 48h before the next key session.";
    }
    return "Convert to easy running and continue the plan.";
  }

  return "Do not compensate by doubling volume next week. Resume normal progression.";
}

export function fatigueAdjustment(volumeKm: number): number {
  return Math.round(volumeKm * 0.85 * 10) / 10;
}
