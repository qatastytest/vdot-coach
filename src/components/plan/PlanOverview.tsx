"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getStoredGoal, getStoredPlan } from "@/lib/storage/local";
import { TrainingPlanOutput } from "@/lib/plan";

export function PlanOverview(): React.JSX.Element {
  const [plan, setPlan] = useState<TrainingPlanOutput | null>(null);
  const [goal, setGoal] = useState<ReturnType<typeof getStoredGoal>>(null);

  useEffect(() => {
    setPlan(getStoredPlan());
    setGoal(getStoredGoal());
  }, []);

  if (!plan) {
    return (
      <div className="panel">
        <h2 className="h2">No Plan Yet</h2>
        <p className="muted mt-2">Set your goal and generate a plan first.</p>
        <Link href="/goal" className="btn-primary mt-4">
          Go to Goal Setup
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <h2 className="h2">Training Plan Overview</h2>
        <p className="muted mt-1">
          {plan.durationWeeks} weeks â€¢ Goal: {goal?.goalDistance ?? "N/A"} â€¢ Long run: {goal?.longRunDay ?? "N/A"}
        </p>
        <p className="mt-3 text-sm text-slate-700">{plan.summary}</p>
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
                      <p className="font-medium">
                        {workout.day}: {workout.title}
                      </p>
                      <p className="text-slate-600">
                        {workout.distanceKm} km â€¢ {workout.paceTarget}
                      </p>
                    </div>
                    <Link
                      href={`/plan/${weekIdx}/${workoutIdx}`}
                      className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                    >
                      Details
                    </Link>
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

