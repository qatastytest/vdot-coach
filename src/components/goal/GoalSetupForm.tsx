"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseTimeToSeconds } from "@/lib/core";
import { RaceGoal } from "@/lib/domain/models";
import { generateTrainingPlan } from "@/lib/plan";
import { getStoredBaseline, getStoredProfile, setStoredGoal, setStoredPlan } from "@/lib/storage/local";
import { RaceGoalFormValues, raceGoalSchema } from "@/lib/validation/schemas";

const DEFAULT_GOAL: RaceGoalFormValues = {
  goalDistance: "10k",
  targetDate: "",
  targetTime: "",
  ambition: "realistic_pb",
  daysPerWeek: 4,
  longRunDay: "Sunday",
  trackAccess: true,
  planLengthWeeks: 8
};

export function GoalSetupForm(): React.JSX.Element {
  const router = useRouter();
  const [form, setForm] = useState<RaceGoalFormValues>(() => {
    const profile = getStoredProfile();
    if (!profile) return DEFAULT_GOAL;
    return {
      ...DEFAULT_GOAL,
      daysPerWeek: profile.daysPerWeekAvailable,
      longRunDay: profile.preferredLongRunDay
    };
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setMessage(null);
    const parsed = raceGoalSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.message));
      return;
    }

    const profile = getStoredProfile();
    if (!profile) {
      setErrors(["Runner profile is required. Complete Settings first."]);
      return;
    }

    const goal: RaceGoal = {
      goalDistance: parsed.data.goalDistance,
      targetDate: parsed.data.targetDate,
      targetTimeSeconds:
        parsed.data.targetTime && parsed.data.targetTime.trim() !== ""
          ? parseTimeToSeconds(parsed.data.targetTime)
          : undefined,
      ambition: parsed.data.ambition,
      daysPerWeek: parsed.data.daysPerWeek as 3 | 4 | 5 | 6,
      longRunDay: parsed.data.longRunDay,
      trackAccess: parsed.data.trackAccess,
      planLengthWeeks: parsed.data.planLengthWeeks
    };

    const baseline = getStoredBaseline();
    const plan = generateTrainingPlan({ profile, goal, paces: baseline?.paces });

    setStoredGoal(goal);
    setStoredPlan(plan);
    setErrors([]);
    setMessage("Plan generated.");
    router.push("/plan");
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
      <label>
        <span className="label">Goal Distance</span>
        <select
          className="input"
          value={form.goalDistance}
          onChange={(event) => setForm((prev) => ({ ...prev, goalDistance: event.target.value as "5k" | "10k" | "half" }))}
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
          value={form.targetDate}
          onChange={(event) => setForm((prev) => ({ ...prev, targetDate: event.target.value }))}
        />
      </label>

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
          onChange={(event) => setForm((prev) => ({ ...prev, daysPerWeek: Number(event.target.value) as 3 | 4 | 5 | 6 }))}
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
          {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
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
          onChange={(event) => setForm((prev) => ({ ...prev, planLengthWeeks: Number(event.target.value) as 4 | 8 }))}
        >
          <option value={4}>4 weeks</option>
          <option value={8}>8 weeks</option>
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

