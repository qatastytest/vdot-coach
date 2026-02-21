import { ConfidenceResult } from "@/lib/core/types";

export function buildCoachingNotes(confidence: ConfidenceResult): string[] {
  const notes = [
    "Training guidance only: not medical advice.",
    "Easy runs should prioritize effort, consistency, and recovery over exact pace.",
    "Use HR as a secondary signal; adjust for heat, fatigue, stress, and hydration."
  ];

  if (confidence.label === "low") {
    notes.push("Prediction confidence is low. Re-test with an all-out track/flat road effort when possible.");
  } else if (confidence.label === "medium") {
    notes.push("Confidence is moderate. Keep workouts effort-led and update baseline after your next race.");
  } else {
    notes.push("Confidence is high. Current VDOT can drive workout targets, but keep easy days genuinely easy.");
  }

  return notes;
}
