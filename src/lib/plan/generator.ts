import { formatPace } from "@/lib/core/time";
import { TrainingPaces } from "@/lib/core/types";
import { RaceGoal, RunnerProfile } from "@/lib/domain/models";
import { fatigueAdjustment, missedWorkoutGuidance } from "@/lib/plan/rules";
import {
  PlannedWorkout,
  PlanDurationWeeks,
  PlanPhase,
  TrainingPlanOutput,
  TrainingWeekPlan,
  WorkoutType
} from "@/lib/plan/types";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

interface BuildPlanInput {
  profile: RunnerProfile;
  goal: RaceGoal;
  paces?: TrainingPaces;
  loadAdjustmentFactor?: number;
  replanCount?: number;
  refreshContext?: TrainingPlanOutput["refreshContext"];
}

interface PlanFeedbackSummary {
  done: number;
  skipped: number;
  edited: number;
  skipRate: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function createPlanId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `plan-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

function getPhaseSchedule(durationWeeks: PlanDurationWeeks): PlanPhase[] {
  if (durationWeeks === 4) {
    return ["base", "build", "specific", "taper"];
  }

  if (durationWeeks === 8) {
    return ["base", "base", "build", "build", "specific", "deload", "specific", "taper"];
  }

  if (durationWeeks === 12) {
    return [
      "base",
      "base",
      "build",
      "build",
      "specific",
      "deload",
      "build",
      "specific",
      "specific",
      "deload",
      "specific",
      "taper"
    ];
  }

  return [
    "base",
    "base",
    "base",
    "build",
    "build",
    "build",
    "specific",
    "deload",
    "build",
    "specific",
    "specific",
    "deload",
    "specific",
    "specific",
    "specific",
    "taper"
  ];
}

function buildVolumeTargets(
  durationWeeks: PlanDurationWeeks,
  currentKm: number,
  maxKm: number,
  phases: PlanPhase[],
  loadAdjustmentFactor: number
): number[] {
  const targets: number[] = [];
  const adjustedCurrent = currentKm * loadAdjustmentFactor;
  const weekOneLower = currentKm * (loadAdjustmentFactor < 1 ? 0.75 : 0.9);
  const weekOne = clamp(adjustedCurrent * 0.95, weekOneLower, Math.min(adjustedCurrent, maxKm));
  targets.push(roundTenth(weekOne));

  for (let i = 1; i < durationWeeks; i += 1) {
    const previous = targets[i - 1];
    const phase = phases[i];
    let next = previous;

    if (phase === "deload") {
      next = previous * 0.8;
    } else if (phase === "taper") {
      next = previous * (durationWeeks === 4 ? 0.82 : durationWeeks === 8 ? 0.78 : 0.86);
    } else if (phase === "base") {
      next = previous * 1.05;
    } else if (phase === "build") {
      next = previous * 1.07;
    } else if (phase === "specific") {
      next = previous * 1.04;
    }

    targets.push(roundTenth(Math.min(next, maxKm)));
  }

  return targets;
}

function modDay(index: number): number {
  return (index + 7) % 7;
}

function resolveRunDayIndices(daysPerWeek: number, longRunDay: string): number[] {
  const longIdx = DAYS.indexOf(longRunDay as (typeof DAYS)[number]);
  const key1 = modDay(longIdx + 3);
  const key2 = modDay(longIdx + 5);

  const selected = new Set<number>([longIdx, key1]);
  if (daysPerWeek >= 4) selected.add(key2);

  const fillers = [
    modDay(longIdx - 1),
    modDay(longIdx - 2),
    modDay(longIdx - 3),
    modDay(longIdx + 1),
    modDay(longIdx + 2),
    modDay(longIdx + 4)
  ];

  for (const idx of fillers) {
    if (selected.size >= daysPerWeek) break;
    selected.add(idx);
  }

  return [...selected].sort((a, b) => a - b);
}

function paceString(paces: TrainingPaces | undefined, type: WorkoutType): string {
  if (!paces) return "Run by RPE and talk-test.";

  if (type === "easy" || type === "recovery" || type === "long_run") {
    return `${formatPace(paces.easy.lowSecondsPerKm ?? 0)}-${formatPace(paces.easy.highSecondsPerKm ?? 0)}/km`;
  }

  if (type === "threshold") {
    return `${formatPace(paces.threshold.lowSecondsPerKm ?? 0)}-${formatPace(paces.threshold.highSecondsPerKm ?? 0)}/km`;
  }

  if (type === "interval") {
    return `${formatPace(paces.interval.targetSecondsPerKm ?? 0)}/km`;
  }

  return `${formatPace(paces.repetition.targetSecondsPerKm ?? 0)}/km`;
}

function hrFallback(profile: RunnerProfile, type: WorkoutType): string {
  if (profile.lthr) {
    if (type === "easy" || type === "long_run") return "LTHR Z1-Z2";
    if (type === "threshold") return "LTHR Z3-Z4";
    return "LTHR Z4-Z5";
  }

  if (profile.maxHr && profile.restingHr) {
    if (type === "easy" || type === "long_run") return "Karvonen Z1-Z2";
    if (type === "threshold") return "Karvonen Z3-Z4";
    return "Karvonen Z4-Z5";
  }

  if (profile.maxHr) {
    if (type === "easy" || type === "long_run") return "60-80% max HR";
    if (type === "threshold") return "87-93% max HR";
    return "93-100% max HR";
  }

  return "RPE and talk-test fallback";
}

function splitVolume(
  totalKm: number,
  runDays: number,
  hasSecondKey: boolean
): { long: number; key1: number; key2: number; easy: number[] } {
  const longPct = runDays === 3 ? 0.4 : runDays === 4 ? 0.34 : runDays === 5 ? 0.3 : 0.28;
  const key1Pct = runDays === 3 ? 0.32 : 0.2;
  const key2Pct = hasSecondKey ? (runDays >= 5 ? 0.18 : 0.22) : 0;
  const easyDays = runDays - 1 - (hasSecondKey ? 2 : 1);
  const easyTotal = Math.max(0, 1 - longPct - key1Pct - key2Pct);
  const eachEasyPct = easyDays > 0 ? easyTotal / easyDays : 0;

  return {
    long: roundTenth(totalKm * longPct),
    key1: roundTenth(totalKm * key1Pct),
    key2: roundTenth(totalKm * key2Pct),
    easy: Array.from({ length: easyDays }, () => roundTenth(totalKm * eachEasyPct))
  };
}

function workoutTemplateByPhase(
  phase: PlanPhase,
  whichKey: 1 | 2,
  goalDistance: RaceGoal["goalDistance"]
): Omit<PlannedWorkout, "id" | "day" | "distanceKm" | "paceTarget" | "hrFallback" | "status"> {
  if (phase === "taper") {
    return {
      type: whichKey === 1 ? "threshold" : "interval",
      isKey: true,
      title: whichKey === 1 ? "Taper Tempo Tune-Up" : "Taper Sharpener",
      warmup: "10-15 min easy + drills",
      mainSet:
        whichKey === 1
          ? "2 x 8 min at threshold with 3 min jog"
          : "6 x 1 min quick at 5K effort with 2 min easy",
      cooldown: "10 min easy",
      rpe: "5-7",
      purpose: "Maintain feel for pace with reduced fatigue load.",
      alternatives: {
        noTrack: "Run by time on flat road.",
        tired: "Shorten to 1 set only and keep controlled.",
        missed: "Skip. Do not make up during race week."
      }
    };
  }

  if (phase === "deload") {
    return {
      type: whichKey === 1 ? "threshold" : "easy",
      isKey: whichKey === 1,
      title: whichKey === 1 ? "Deload Cruise Intervals" : "Deload Easy Run",
      warmup: "12 min easy + mobility",
      mainSet:
        whichKey === 1 ? "4 x 5 min threshold, 90s float jog" : "35-50 min easy aerobic running",
      cooldown: "10 min easy",
      rpe: whichKey === 1 ? "6-7" : "3-4",
      purpose: "Reduce fatigue while keeping aerobic rhythm.",
      alternatives: {
        noTrack: "Use timed reps on a flat loop.",
        tired: "Run all easy and cut volume 10-20%.",
        missed: "Continue plan. Do not add volume."
      }
    };
  }

  if (phase === "specific") {
    return {
      type: whichKey === 1 ? "threshold" : "interval",
      isKey: true,
      title: whichKey === 1 ? "Race-Specific Tempo" : "Specific Intervals",
      warmup: "15 min easy + drills + strides",
      mainSet:
        whichKey === 1
          ? goalDistance === "half"
            ? "3 x 12 min around half-marathon effort, 3 min jog"
            : "20-30 min broken tempo around threshold"
          : goalDistance === "5k"
            ? "5 x 1000m at 5K pace with 2-3 min jog"
            : goalDistance === "10k"
              ? "6 x 1km at 10K-5K blend effort with 2 min jog"
              : "4 x 2km at HM effort with 2 min float",
      cooldown: "10-15 min easy",
      rpe: whichKey === 1 ? "6-7" : "7-8",
      purpose: "Build pace durability for your target event.",
      alternatives: {
        noTrack: "Run by time and effort over a measured loop.",
        tired: "Cut one rep and keep recoveries generous.",
        missed: "Move only if >=48h before next key day, otherwise easy run."
      }
    };
  }

  if (phase === "build") {
    return {
      type: whichKey === 1 ? "threshold" : "interval",
      isKey: true,
      title: whichKey === 1 ? "Threshold Builder" : "VO2 Builder",
      warmup: "12-15 min easy + drills",
      mainSet:
        whichKey === 1
          ? "3 x 10 min threshold with 2 min jog"
          : "5-6 x 3 min interval effort with 2 min jog",
      cooldown: "10-12 min easy",
      rpe: whichKey === 1 ? "6-7" : "7-8",
      purpose: "Raise lactate threshold and aerobic power safely.",
      alternatives: {
        noTrack: "Use measured road loop or timed reps.",
        tired: "Reduce reps by 20% and hold form.",
        missed: "Do not stack with next key workout."
      }
    };
  }

  return {
    type: whichKey === 1 ? "threshold" : "interval",
    isKey: true,
    title: whichKey === 1 ? "Base Tempo" : "Hill/Fartlek Support",
    warmup: "12 min easy + drills",
    mainSet:
      whichKey === 1
        ? "2 x 12 min comfortably hard with 3 min easy"
        : "8 x 60s uphill or fartlek hard / 90s easy",
    cooldown: "10 min easy",
    rpe: whichKey === 1 ? "6" : "7",
    purpose: "Establish durable aerobic foundation before harder specificity.",
    alternatives: {
      noTrack: "Use rolling road, maintain effort not pace.",
      tired: "Convert to easy aerobic run.",
      missed: "Skip and continue progression."
    }
  };
}

function easyWorkout(): Omit<
  PlannedWorkout,
  "id" | "paceTarget" | "hrFallback" | "distanceKm" | "day" | "status"
> {
  return {
    type: "easy",
    isKey: false,
    title: "Easy Aerobic Run",
    warmup: "5-10 min very easy",
    mainSet: "Steady conversational running",
    cooldown: "Optional 4 x 20s strides",
    rpe: "3-4",
    purpose: "Build consistency and low-cost aerobic volume.",
    alternatives: {
      noTrack: "No change needed.",
      tired: "Shorten by 15-20 min.",
      missed: "Skip, do not force catch-up."
    }
  };
}

function longRunWorkout(
  phase: PlanPhase
): Omit<PlannedWorkout, "id" | "day" | "paceTarget" | "hrFallback" | "distanceKm" | "status"> {
  return {
    type: "long_run",
    isKey: false,
    title: phase === "specific" ? "Specific Long Run" : "Long Aerobic Run",
    warmup: "10 min easy",
    mainSet:
      phase === "specific"
        ? "Long run mostly easy, final 15-25 min moderate if feeling good"
        : "Long run at easy effort",
    cooldown: "5-10 min easy + mobility",
    rpe: "3-5",
    purpose: "Improve fatigue resistance and aerobic durability.",
    alternatives: {
      noTrack: "No change needed.",
      tired: "Keep fully easy and cut 10-20% volume.",
      missed: "Do not compensate by doubling next week."
    }
  };
}

function makeWorkout(
  weekNumber: number,
  day: string,
  template: Omit<PlannedWorkout, "id" | "day" | "distanceKm" | "paceTarget" | "hrFallback" | "status">,
  distanceKm: number,
  paces: TrainingPaces | undefined,
  profile: RunnerProfile
): PlannedWorkout {
  return {
    id: `w${weekNumber}-${day.toLowerCase()}-${template.type}`,
    day,
    type: template.type,
    isKey: template.isKey,
    title: template.title,
    warmup: template.warmup,
    mainSet: template.mainSet,
    cooldown: template.cooldown,
    paceTarget: paceString(paces, template.type),
    hrFallback: hrFallback(profile, template.type),
    rpe: template.rpe,
    purpose: template.purpose,
    alternatives: template.alternatives,
    distanceKm: roundTenth(Math.max(4, distanceKm)),
    status: "planned"
  };
}

function sortWorkoutsByDay(workouts: PlannedWorkout[]): PlannedWorkout[] {
  return workouts.sort(
    (a, b) =>
      DAYS.indexOf(a.day as (typeof DAYS)[number]) - DAYS.indexOf(b.day as (typeof DAYS)[number])
  );
}

function countWorkoutFeedback(plan: TrainingPlanOutput): PlanFeedbackSummary {
  let done = 0;
  let skipped = 0;
  let edited = 0;

  for (const week of plan.weeks) {
    for (const workout of week.workouts) {
      if (workout.status === "done") done += 1;
      if (workout.status === "skipped") skipped += 1;
      if (workout.isEdited) edited += 1;
    }
  }

  const tracked = done + skipped;
  const skipRate = tracked === 0 ? 0 : skipped / tracked;
  return { done, skipped, edited, skipRate };
}

function calculateLoadAdjustmentFromFeedback(feedback: PlanFeedbackSummary): number {
  if (feedback.skipRate >= 0.4 || feedback.skipped >= 4) return 0.82;
  if (feedback.skipRate >= 0.25 || feedback.skipped >= 2) return 0.9;
  if (feedback.done >= 8 && feedback.skipRate <= 0.1) return 1.03;
  return 1;
}

function shouldPreserveWorkout(workout: PlannedWorkout): boolean {
  return (
    workout.status !== "planned" ||
    Boolean(
      workout.completedAt ||
        workout.actualSummary ||
        workout.actualDistanceKm !== undefined ||
        workout.actualRpe ||
        workout.actualNotes
    )
  );
}

function findMatchingExistingWorkout(
  workouts: PlannedWorkout[],
  fallbackIndex: number,
  generatedWorkout: PlannedWorkout
): PlannedWorkout | undefined {
  const byIndex = workouts[fallbackIndex];
  if (byIndex && byIndex.day === generatedWorkout.day) {
    return byIndex;
  }

  return workouts.find(
    (workout) => workout.day === generatedWorkout.day && workout.type === generatedWorkout.type
  );
}

function mergePlanWithCompletedHistory(
  generatedPlan: TrainingPlanOutput,
  existingPlan: TrainingPlanOutput
): TrainingPlanOutput {
  const weeks = generatedPlan.weeks.map((generatedWeek, weekIndex) => {
    const existingWeek = existingPlan.weeks[weekIndex];
    if (!existingWeek) return generatedWeek;

    const workouts = generatedWeek.workouts.map((generatedWorkout, workoutIndex) => {
      const existingWorkout = findMatchingExistingWorkout(
        existingWeek.workouts,
        workoutIndex,
        generatedWorkout
      );
      if (!existingWorkout) return generatedWorkout;
      if (shouldPreserveWorkout(existingWorkout)) {
        return { ...existingWorkout };
      }
      return generatedWorkout;
    });

    return {
      ...generatedWeek,
      workouts
    };
  });

  return {
    ...generatedPlan,
    weeks
  };
}

export function generateTrainingPlan({
  profile,
  goal,
  paces,
  loadAdjustmentFactor = 1,
  replanCount = 0,
  refreshContext
}: BuildPlanInput): TrainingPlanOutput {
  const phases = getPhaseSchedule(goal.planLengthWeeks);
  const volumes = buildVolumeTargets(
    goal.planLengthWeeks,
    profile.weeklyKmCurrent,
    profile.weeklyKmMaxTolerated,
    phases,
    loadAdjustmentFactor
  );

  const runDayIndices = resolveRunDayIndices(goal.daysPerWeek, goal.longRunDay);
  const longIdx = DAYS.indexOf(goal.longRunDay);
  const key1Idx = modDay(longIdx + 3);
  const key2Idx = modDay(longIdx + 5);

  const weeks: TrainingWeekPlan[] = volumes.map((volume, i) => {
    const weekNumber = i + 1;
    const phase = phases[i];
    const secondKeyAllowed = goal.daysPerWeek >= 4 && phase !== "deload";
    const volumePieces = splitVolume(volume, goal.daysPerWeek, secondKeyAllowed);

    const workouts: PlannedWorkout[] = [];
    let easyCounter = 0;

    for (const dayIdx of runDayIndices) {
      const day = DAYS[dayIdx];

      if (dayIdx === longIdx) {
        workouts.push(makeWorkout(weekNumber, day, longRunWorkout(phase), volumePieces.long, paces, profile));
        continue;
      }

      if (dayIdx === key1Idx) {
        const keyOne = workoutTemplateByPhase(phase, 1, goal.goalDistance);
        workouts.push(makeWorkout(weekNumber, day, keyOne, volumePieces.key1, paces, profile));
        continue;
      }

      if (secondKeyAllowed && dayIdx === key2Idx) {
        const keyTwo = workoutTemplateByPhase(phase, 2, goal.goalDistance);
        workouts.push(makeWorkout(weekNumber, day, keyTwo, volumePieces.key2, paces, profile));
        continue;
      }

      const easy = easyWorkout();
      workouts.push(makeWorkout(weekNumber, day, easy, volumePieces.easy[easyCounter] ?? 0, paces, profile));
      easyCounter += 1;
    }

    const sorted = sortWorkoutsByDay(workouts);
    const adjustedVolume = phase === "deload" ? fatigueAdjustment(volume) : volume;

    return {
      weekNumber,
      phase,
      targetVolumeKm: adjustedVolume,
      workouts: sorted,
      notes: [
        missedWorkoutGuidance("easy", 24),
        missedWorkoutGuidance("key", 36),
        missedWorkoutGuidance("long_run", 72),
        "If fatigue is high, reduce weekly volume by 10-20% and downgrade interval intensity."
      ]
    };
  });

  return {
    id: createPlanId(),
    durationWeeks: goal.planLengthWeeks,
    generatedAt: new Date().toISOString(),
    summary:
      "Rule-based conservative plan with capped weekly growth, max two key sessions, and fallback options for track access, fatigue, and missed sessions.",
    replanCount,
    refreshContext,
    weeks
  };
}

export function refreshTrainingPlanFromFeedback(params: {
  existingPlan: TrainingPlanOutput;
  profile: RunnerProfile;
  goal: RaceGoal;
  paces?: TrainingPaces;
}): TrainingPlanOutput {
  const feedback = countWorkoutFeedback(params.existingPlan);
  const loadAdjustmentFactor = calculateLoadAdjustmentFromFeedback(feedback);

  const regenerated = generateTrainingPlan({
    profile: params.profile,
    goal: params.goal,
    paces: params.paces,
    loadAdjustmentFactor,
    replanCount: params.existingPlan.replanCount + 1,
    refreshContext: feedback
  });

  return mergePlanWithCompletedHistory(regenerated, params.existingPlan);
}
