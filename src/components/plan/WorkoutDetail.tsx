"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getStoredPlan } from "@/lib/storage/local";
import { TrainingPlanOutput } from "@/lib/plan";

interface WorkoutDetailProps {
  weekIndex: number;
  workoutIndex: number;
}

export function WorkoutDetail({ weekIndex, workoutIndex }: WorkoutDetailProps): React.JSX.Element {
  const [plan, setPlan] = useState<TrainingPlanOutput | null>(null);

  useEffect(() => {
    setPlan(getStoredPlan());
  }, []);

  const selected = useMemo(() => {
    if (!plan) return null;
    const week = plan.weeks[weekIndex];
    if (!week) return null;
    const workout = week.workouts[workoutIndex];
    if (!workout) return null;
    return { week, workout };
  }, [plan, weekIndex, workoutIndex]);

  if (!selected) {
    return (
      <section className="panel">
        <h2 className="h2">Workout Not Found</h2>
        <p className="muted mt-2">Generate a plan first or open a valid workout link.</p>
        <Link href="/plan" className="btn-primary mt-4">
          Back to plan
        </Link>
      </section>
    );
  }

  const { week, workout } = selected;

  return (
    <div className="space-y-5">
      <section className="panel">
        <p className="text-sm text-slate-600">
          Week {week.weekNumber} â€¢ {week.phase}
        </p>
        <h2 className="h2 mt-1">
          {workout.day}: {workout.title}
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          {workout.distanceKm} km â€¢ Pace target {workout.paceTarget} â€¢ HR fallback {workout.hrFallback}
        </p>
      </section>

      <section className="panel">
        <h3 className="text-lg font-semibold">Workout Structure</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>
            <span className="font-medium">Warm-up:</span> {workout.warmup}
          </li>
          <li>
            <span className="font-medium">Main set:</span> {workout.mainSet}
          </li>
          <li>
            <span className="font-medium">Cooldown:</span> {workout.cooldown}
          </li>
          <li>
            <span className="font-medium">RPE:</span> {workout.rpe}
          </li>
          <li>
            <span className="font-medium">Purpose:</span> {workout.purpose}
          </li>
        </ul>
      </section>

      <section className="panel">
        <h3 className="text-lg font-semibold">Alternatives</h3>
        <ul className="mt-3 space-y-2 text-sm text-slate-700">
          <li>
            <span className="font-medium">No track:</span> {workout.alternatives.noTrack}
          </li>
          <li>
            <span className="font-medium">If tired:</span> {workout.alternatives.tired}
          </li>
          <li>
            <span className="font-medium">If missed:</span> {workout.alternatives.missed}
          </li>
        </ul>
      </section>

      <Link href="/plan" className="btn-secondary">
        Back to plan
      </Link>
    </div>
  );
}

