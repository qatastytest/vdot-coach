"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  getStoredBaseline,
  getStoredGoal,
  getStoredPlan,
  getStoredProfile,
  setStoredPlan,
  setStoredWorkoutStatus
} from "@/lib/storage/local";
import { refreshTrainingPlanFromFeedback, TrainingPlanOutput } from "@/lib/plan";

function statusPillClasses(status: string): string {
  if (status === "done") return "bg-emerald-100 text-emerald-800";
  if (status === "skipped") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

export function PlanOverview(): React.JSX.Element {
  const [plan, setPlan] = useState<TrainingPlanOutput | null>(null);
  const [goal, setGoal] = useState<ReturnType<typeof getStoredGoal>>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlan(getStoredPlan());
    setGoal(getStoredGoal());
  }, []);

  function refreshFromStorage(): void {
    setPlan(getStoredPlan());
    setGoal(getStoredGoal());
  }

  function handleStatusUpdate(
    weekIndex: number,
    workoutIndex: number,
    status: "planned" | "done" | "skipped"
  ): void {
    const ok = setStoredWorkoutStatus(weekIndex, workoutIndex, status, {
      actualSummary:
        status === "done"
          ? "Completed as planned."
          : status === "skipped"
            ? "Skipped."
            : "Returned to planned."
    });
    if (!ok) {
      setError("Could not update workout status. Re-open profile and try again.");
      return;
    }
    setError(null);
    setMessage("Workout status updated.");
    refreshFromStorage();
  }

  function handleRefreshPlan(): void {
    setError(null);
    setMessage(null);
    const currentPlan = getStoredPlan();
    const currentProfile = getStoredProfile();
    const currentGoal = getStoredGoal();
    const currentBaseline = getStoredBaseline();

    if (!currentPlan || !currentProfile || !currentGoal) {
      setError("Profile, goal, and plan are required before refresh.");
      return;
    }

    const refreshed = refreshTrainingPlanFromFeedback({
      existingPlan: currentPlan,
      profile: currentProfile,
      goal: currentGoal,
      paces: currentBaseline?.paces
    });

    const saved = setStoredPlan(refreshed);
    if (!saved) {
      setError("Failed to store refreshed plan.");
      return;
    }

    setPlan(refreshed);
    setGoal(currentGoal);
    setMessage("Plan refreshed using completed/skipped history.");
  }

  if (!plan) {
    return (
      <div className="panel">
        <h2 className="h2">No Plan Yet</h2>
        <p className="muted mt-2">Set your goal and generate a plan first.</p>
        <div className="mt-4 flex gap-2">
          <Link href="/goal" className="btn-primary">
            Go to Goal Setup
          </Link>
          <Link href="/" className="btn-secondary">
            Select Profile
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <h2 className="h2">Training Plan Overview</h2>
        <p className="muted mt-1">
          {plan.durationWeeks} weeks | Goal: {goal?.goalDistance ?? "N/A"} | Long run: {goal?.longRunDay ?? "N/A"}{" "}
          | Rest: {goal?.preferredRestDay ?? "Auto"}
        </p>
        <p className="muted mt-1">Target date: {goal?.targetDate ?? "No race/date in future"}</p>
        <p className="muted mt-1">
          Refreshes: {plan.replanCount}
          {plan.refreshContext
            ? ` | done ${plan.refreshContext.done}, skipped ${plan.refreshContext.skipped}, edited ${plan.refreshContext.edited}`
            : ""}
        </p>
        <p className="mt-3 text-sm text-slate-700">{plan.summary}</p>
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn-primary" onClick={handleRefreshPlan}>
            Refresh Plan From Feedback
          </button>
          <Link href="/goal" className="btn-secondary">
            Regenerate From Goal
          </Link>
        </div>
        {message ? <p className="mt-2 text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {plan.weeks.map((week, weekIdx) => (
          <section key={week.weekNumber} className="panel">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Week {week.weekNumber}</h3>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs capitalize">{week.phase}</span>
            </div>
            <p className="mt-2 text-sm text-slate-700">Target volume: {week.targetVolumeKm} km</p>

            <ul className="mt-3 space-y-2 text-sm">
              {week.workouts.map((workout, workoutIdx) => (
                <li key={workout.id} className="rounded-md border border-slate-200 p-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="flex items-center gap-2 font-medium">
                        {workout.day}: {workout.title}
                        <span className={`rounded-full px-2 py-0.5 text-[11px] ${statusPillClasses(workout.status)}`}>
                          {workout.status}
                        </span>
                      </p>
                      <p className="text-slate-600">{workout.distanceKm} km | {workout.paceTarget}</p>
                      {workout.actualSummary ? (
                        <p className="text-xs text-slate-500">Actual: {workout.actualSummary}</p>
                      ) : null}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(weekIdx, workoutIdx, "done")}
                        className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
                      >
                        Done
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStatusUpdate(weekIdx, workoutIdx, "skipped")}
                        className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
                      >
                        Skip
                      </button>
                      <Link
                        href={`/plan/${weekIdx}/${workoutIdx}`}
                        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

