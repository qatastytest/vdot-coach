import { describe, expect, it } from "vitest";
import { deriveTrainingPaces } from "@/lib/core";
import { RaceGoal, RunnerProfile } from "@/lib/domain/models";
import { generateTrainingPlan, refreshTrainingPlanFromFeedback } from "@/lib/plan";

const profile: RunnerProfile = {
  weeklyKmCurrent: 48,
  weeklyKmMaxTolerated: 62,
  daysPerWeekAvailable: 5,
  preferredLongRunDay: "Sunday",
  maxHr: 188,
  restingHr: 52,
  lthr: 171,
  experienceLevel: "intermediate",
  preferredUnits: "km"
};

const goal: RaceGoal = {
  goalDistance: "10k",
  targetDate: "2026-04-20",
  ambition: "realistic_pb",
  daysPerWeek: 5,
  longRunDay: "Sunday",
  trackAccess: true,
  planLengthWeeks: 8
};

describe("Rule-based plan generator", () => {
  it("limits key sessions, respects run days and max volume", () => {
    const plan = generateTrainingPlan({ profile, goal, paces: deriveTrainingPaces(50) });
    for (const week of plan.weeks) {
      const keyCount = week.workouts.filter((workout) => workout.isKey).length;
      expect(keyCount).toBeLessThanOrEqual(2);
      expect(week.workouts).toHaveLength(goal.daysPerWeek);
      expect(week.targetVolumeKm).toBeLessThanOrEqual(profile.weeklyKmMaxTolerated);
    }
  });

  it("taper week reduces volume", () => {
    const plan = generateTrainingPlan({ profile, goal, paces: deriveTrainingPaces(52) });
    const last = plan.weeks[plan.weeks.length - 1];
    const previous = plan.weeks[plan.weeks.length - 2];
    expect(last.phase).toBe("taper");
    expect(last.targetVolumeKm).toBeLessThan(previous.targetVolumeKm);
  });

  it("supports 3 day structure with one quality, one easy, one long run", () => {
    const threeDayGoal: RaceGoal = {
      ...goal,
      daysPerWeek: 3,
      planLengthWeeks: 4
    };
    const threeDayProfile: RunnerProfile = {
      ...profile,
      daysPerWeekAvailable: 3
    };

    const plan = generateTrainingPlan({ profile: threeDayProfile, goal: threeDayGoal });
    const firstWeek = plan.weeks[0];
    expect(firstWeek.workouts).toHaveLength(3);
    expect(firstWeek.workouts.filter((workout) => workout.isKey)).toHaveLength(1);
    expect(firstWeek.workouts.filter((workout) => workout.type === "long_run")).toHaveLength(1);
    expect(firstWeek.workouts.filter((workout) => workout.type === "easy")).toHaveLength(1);
  });

  it("supports 12 and 16 week schedules", () => {
    const longGoal12: RaceGoal = { ...goal, planLengthWeeks: 12 };
    const longGoal16: RaceGoal = { ...goal, planLengthWeeks: 16 };

    const plan12 = generateTrainingPlan({ profile, goal: longGoal12 });
    const plan16 = generateTrainingPlan({ profile, goal: longGoal16 });

    expect(plan12.weeks).toHaveLength(12);
    expect(plan16.weeks).toHaveLength(16);
    expect(plan12.weeks[11].phase).toBe("taper");
    expect(plan16.weeks[15].phase).toBe("taper");
  });

  it("refreshes plan with feedback and increments replan count", () => {
    const original = generateTrainingPlan({ profile, goal });
    original.weeks[0].workouts[0].status = "skipped";
    original.weeks[0].workouts[0].actualSummary = "Skipped due to poor sleep.";
    original.weeks[0].workouts[1].status = "skipped";
    original.weeks[0].workouts[2].status = "done";
    original.weeks[0].workouts[2].actualSummary = "Completed with strong finish.";
    original.weeks[0].workouts[1].isEdited = true;

    const refreshed = refreshTrainingPlanFromFeedback({
      existingPlan: original,
      profile,
      goal,
      paces: deriveTrainingPaces(50)
    });

    expect(refreshed.replanCount).toBe(1);
    expect(refreshed.refreshContext?.skipped).toBe(2);
    expect(refreshed.refreshContext?.done).toBe(1);
    expect(refreshed.weeks[0].workouts[0].status).toBe("skipped");
    expect(refreshed.weeks[0].workouts[0].actualSummary).toContain("poor sleep");
    expect(refreshed.weeks[0].workouts[2].status).toBe("done");
    expect(refreshed.weeks[0].workouts[2].actualSummary).toContain("strong finish");
  });
});
