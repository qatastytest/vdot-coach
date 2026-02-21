"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatTime, parseTimeToSeconds } from "@/lib/core";
import { RaceGoal } from "@/lib/domain/models";
import { generateTrainingPlan } from "@/lib/plan";
import {
  getStoredBaseline,
  getStoredGoal,
  getStoredProfile,
  setStoredGoal,
  setStoredPlan
} from "@/lib/storage/local";
import { RaceGoalFormValues, raceGoalSchema } from "@/lib/validation/schemas";

const PLAN_LENGTHS = [4, 8, 12, 16] as const;
type PlanLength = (typeof PLAN_LENGTHS)[number];
const WEEK_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

const DEFAULT_GOAL: RaceGoalFormValues = {
  goalDistance: "10k",
  targetDate: "",
  targetTime: "",
  ambition: "realistic_pb",
  daysPerWeek: 4,
  longRunDay: "Sunday",
  preferredRestDay: "Friday",
  trackAccess: true,
  planLengthWeeks: 12
};

function toIsoDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

function daysToTarget(targetDate: string): number | null {
  const parsed = new Date(`${targetDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const today = toIsoDay(new Date());
  const diffMs = parsed.getTime() - today.getTime();
  return Math.round(diffMs / 86400000);
}

function recommendPlanLength(daysUntilRace: number): PlanLength {
  return PLAN_LENGTHS.reduce((best, option) => {
    const bestDiff = Math.abs(best * 7 - daysUntilRace);
    const optionDiff = Math.abs(option * 7 - daysUntilRace);
    return optionDiff < bestDiff ? option : best;
  }, PLAN_LENGTHS[0]);
}

function normalizePreferredRestDay(
  value: string
): RaceGoal["preferredRestDay"] | undefined {
  return value.trim() === "" ? undefined : (value as RaceGoal["preferredRestDay"]);
}

function buildInitialGoalForm(): RaceGoalFormValues {
  const storedGoal = getStoredGoal();
  if (storedGoal) {
    return {
      goalDistance: storedGoal.goalDistance,
      targetDate: storedGoal.targetDate ?? "",
      targetTime: storedGoal.targetTimeSeconds ? formatTime(storedGoal.targetTimeSeconds) : "",
      ambition: storedGoal.ambition,
      daysPerWeek: storedGoal.daysPerWeek,
      longRunDay: storedGoal.longRunDay,
      preferredRestDay: storedGoal.preferredRestDay ?? "Friday",
      trackAccess: storedGoal.trackAccess,
      planLengthWeeks: storedGoal.planLengthWeeks
    };
  }

  const profile = getStoredProfile();
  if (!profile) return DEFAULT_GOAL;
  return {
    ...DEFAULT_GOAL,
    daysPerWeek: profile.daysPerWeekAvailable,
    longRunDay: profile.preferredLongRunDay
  };
}

export function GoalSetupForm(): React.JSX.Element {
  const router = useRouter();
  const storedGoal = getStoredGoal();
  const [form, setForm] = useState<RaceGoalFormValues>(buildInitialGoalForm);
  const [useExisting, setUseExisting] = useState<boolean>(Boolean(storedGoal));
  const [noRaceDate, setNoRaceDate] = useState<boolean>(() => Boolean(storedGoal && !storedGoal.targetDate));
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const targetDateWarning = useMemo(() => {
    if (noRaceDate || !form.targetDate) return null;
    const days = daysToTarget(form.targetDate);
    if (days === null) return null;
    if (days <= 0) return "Target date should be in the future.";

    const selectedDays = form.planLengthWeeks * 7;
    if (Math.abs(days - selectedDays) <= 7) return null;

    const recommended = recommendPlanLength(days);
    return `Target date is in about ${days} days. ${form.planLengthWeeks} weeks may be off; recommended ${recommended} weeks.`;
  }, [form.planLengthWeeks, form.targetDate, noRaceDate]);

  function loadExistingGoal(): void {
    const existing = getStoredGoal();
    if (!existing) return;
    setForm({
      goalDistance: existing.goalDistance,
      targetDate: existing.targetDate ?? "",
      targetTime: existing.targetTimeSeconds ? formatTime(existing.targetTimeSeconds) : "",
      ambition: existing.ambition,
      daysPerWeek: existing.daysPerWeek,
      longRunDay: existing.longRunDay,
      preferredRestDay: existing.preferredRestDay ?? "Friday",
      trackAccess: existing.trackAccess,
      planLengthWeeks: existing.planLengthWeeks
    });
    setNoRaceDate(!existing.targetDate);
    setUseExisting(true);
    setErrors([]);
    setMessage(null);
  }

  function startNewGoal(): void {
    const profile = getStoredProfile();
    setForm(
      profile
        ? {
            ...DEFAULT_GOAL,
            daysPerWeek: profile.daysPerWeekAvailable,
            longRunDay: profile.preferredLongRunDay
          }
        : DEFAULT_GOAL
    );
    setNoRaceDate(false);
    setUseExisting(false);
    setErrors([]);
    setMessage(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setMessage(null);

    const parsed = raceGoalSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.message));
      return;
    }

    if (!noRaceDate && (!parsed.data.targetDate || parsed.data.targetDate.trim() === "")) {
      setErrors(["Target date is required unless 'No race/date in the future' is checked."]);
      return;
    }

    const profile = getStoredProfile();
    if (!profile) {
      setErrors(["Runner profile is required. Complete Settings first."]);
      return;
    }

    const goal: RaceGoal = {
      goalDistance: parsed.data.goalDistance,
      targetDate: noRaceDate ? undefined : parsed.data.targetDate?.trim() || undefined,
      targetTimeSeconds:
        parsed.data.targetTime && parsed.data.targetTime.trim() !== ""
          ? parseTimeToSeconds(parsed.data.targetTime)
          : undefined,
      ambition: parsed.data.ambition,
      daysPerWeek: parsed.data.daysPerWeek as 3 | 4 | 5 | 6,
      longRunDay: parsed.data.longRunDay,
      preferredRestDay: normalizePreferredRestDay(String(parsed.data.preferredRestDay ?? "")),
      trackAccess: parsed.data.trackAccess,
      planLengthWeeks: parsed.data.planLengthWeeks
    };

    const baseline = getStoredBaseline();
    const plan = generateTrainingPlan({ profile, goal, paces: baseline?.paces });

    const goalSaved = setStoredGoal(goal);
    const planSaved = setStoredPlan(plan);
    if (!goalSaved || !planSaved) {
      setErrors(["Select a profile from Home before generating a plan."]);
      return;
    }

    setErrors([]);
    setMessage("Plan generated.");
    router.push("/plan");
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
      {storedGoal ? (
        <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-800">Goal source</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadExistingGoal}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                useExisting ? "border-accent bg-teal-50 text-teal-800" : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              Use Current Goal
            </button>
            <button
              type="button"
              onClick={startNewGoal}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                !useExisting ? "border-accent bg-teal-50 text-teal-800" : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              Set New Goal
            </button>
          </div>
        </div>
      ) : null}

      <label>
        <span className="label">Goal Distance</span>
        <select
          className="input"
          value={form.goalDistance}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, goalDistance: event.target.value as "5k" | "10k" | "half" }))
          }
        >
          <option value="5k">5K</option>
          <option value="10k">10K</option>
          <option value="half">Half Marathon</option>
        </select>
      </label>

      <label>
        <span className="label">Target Date</span>
        <input
          className="input"
          type="date"
          disabled={noRaceDate}
          value={form.targetDate ?? ""}
          onChange={(event) => setForm((prev) => ({ ...prev, targetDate: event.target.value }))}
        />
      </label>

      <label className="md:col-span-2 flex items-center gap-2">
        <input
          type="checkbox"
          checked={noRaceDate}
          onChange={(event) => {
            const checked = event.target.checked;
            setNoRaceDate(checked);
            if (checked) {
              setForm((prev) => ({ ...prev, targetDate: "" }));
            }
          }}
        />
        <span className="text-sm">No race/date in the future</span>
      </label>

      {targetDateWarning ? (
        <p className="md:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {targetDateWarning}
        </p>
      ) : null}

      <label>
        <span className="label">Target Time (optional)</span>
        <input
          className="input"
          value={form.targetTime}
          onChange={(event) => setForm((prev) => ({ ...prev, targetTime: event.target.value }))}
          placeholder="45:00"
        />
      </label>

      <label>
        <span className="label">Ambition</span>
        <select
          className="input"
          value={form.ambition}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              ambition: event.target.value as "finish" | "realistic_pb" | "aggressive_pb"
            }))
          }
        >
          <option value="finish">Finish</option>
          <option value="realistic_pb">Realistic PB</option>
          <option value="aggressive_pb">Aggressive PB</option>
        </select>
      </label>

      <label>
        <span className="label">Days per Week</span>
        <select
          className="input"
          value={form.daysPerWeek}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, daysPerWeek: Number(event.target.value) as 3 | 4 | 5 | 6 }))
          }
        >
          <option value={3}>3</option>
          <option value={4}>4</option>
          <option value={5}>5</option>
          <option value={6}>6</option>
        </select>
      </label>

      <label>
        <span className="label">Long Run Day</span>
        <select
          className="input"
          value={form.longRunDay}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, longRunDay: event.target.value as RaceGoal["longRunDay"] }))
          }
        >
          {WEEK_DAYS.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="label">Preferred Rest Day</span>
        <select
          className="input"
          value={form.preferredRestDay ?? ""}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              preferredRestDay:
                event.target.value === ""
                  ? undefined
                  : (event.target.value as RaceGoalFormValues["preferredRestDay"])
            }))
          }
        >
          <option value="">Auto</option>
          {WEEK_DAYS.map((day) => (
            <option key={day} value={day}>
              {day}
            </option>
          ))}
        </select>
      </label>

      <label>
        <span className="label">Plan Length</span>
        <select
          className="input"
          value={form.planLengthWeeks}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, planLengthWeeks: Number(event.target.value) as PlanLength }))
          }
        >
          <option value={4}>4 weeks</option>
          <option value={8}>8 weeks</option>
          <option value={12}>12 weeks</option>
          <option value={16}>16 weeks</option>
        </select>
      </label>

      <label className="flex items-center gap-2 pt-8">
        <input
          type="checkbox"
          checked={form.trackAccess}
          onChange={(event) => setForm((prev) => ({ ...prev, trackAccess: event.target.checked }))}
        />
        <span className="text-sm">Track access</span>
      </label>

      <div className="md:col-span-2">
        {errors.length > 0 ? (
          <ul className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
        {message ? <p className="mb-2 text-sm text-emerald-700">{message}</p> : null}
        <button className="btn-primary" type="submit">
          Generate Training Plan
        </button>
      </div>
    </form>
  );
}
