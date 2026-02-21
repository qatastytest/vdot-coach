"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getStoredPlan, setStoredWorkoutStatus, updateStoredWorkout } from "@/lib/storage/local";
import { PlannedWorkout, TrainingPlanOutput, WorkoutStatus } from "@/lib/plan";

interface WorkoutDetailProps {
  weekIndex: number;
  workoutIndex: number;
}

type EditableWorkoutFields = Pick<
  PlannedWorkout,
  "title" | "warmup" | "mainSet" | "cooldown" | "paceTarget" | "hrFallback" | "rpe" | "purpose" | "distanceKm"
> & {
  status: WorkoutStatus;
  actualSummary: string;
  actualDistanceKm: string;
  actualRpe: string;
  actualNotes: string;
};

function toEditableFields(workout: PlannedWorkout): EditableWorkoutFields {
  return {
    title: workout.title,
    warmup: workout.warmup,
    mainSet: workout.mainSet,
    cooldown: workout.cooldown,
    paceTarget: workout.paceTarget,
    hrFallback: workout.hrFallback,
    rpe: workout.rpe,
    purpose: workout.purpose,
    distanceKm: workout.distanceKm,
    status: workout.status,
    actualSummary: workout.actualSummary ?? "",
    actualDistanceKm: workout.actualDistanceKm ? String(workout.actualDistanceKm) : "",
    actualRpe: workout.actualRpe ?? "",
    actualNotes: workout.actualNotes ?? ""
  };
}

export function WorkoutDetail({ weekIndex, workoutIndex }: WorkoutDetailProps): React.JSX.Element {
  const [plan, setPlan] = useState<TrainingPlanOutput | null>(null);
  const [form, setForm] = useState<EditableWorkoutFields | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refreshFromStorage(): void {
    setPlan(getStoredPlan());
  }

  useEffect(() => {
    refreshFromStorage();
  }, []);

  const selected = useMemo(() => {
    if (!plan) return null;
    const week = plan.weeks[weekIndex];
    if (!week) return null;
    const workout = week.workouts[workoutIndex];
    if (!workout) return null;
    return { week, workout };
  }, [plan, weekIndex, workoutIndex]);

  useEffect(() => {
    if (selected) {
      setForm(toEditableFields(selected.workout));
    }
  }, [selected]);

  function patchForm(patch: Partial<EditableWorkoutFields>): void {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  if (!selected || !form) {
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

  function handleQuickStatus(status: WorkoutStatus): void {
    if (!form) return;
    const updated = setStoredWorkoutStatus(weekIndex, workoutIndex, status, {
      actualSummary:
        status === "done"
          ? form.actualSummary || "Completed."
          : status === "skipped"
            ? form.actualSummary || "Skipped."
            : "Planned"
    });
    if (!updated) {
      setError("Could not update workout status.");
      return;
    }
    setError(null);
    setMessage(`Workout marked as ${status}.`);
    refreshFromStorage();
  }

  function handleSaveEdits(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!form) return;
    setMessage(null);
    setError(null);

    const numericDistance = Number(form.distanceKm);
    if (!Number.isFinite(numericDistance) || numericDistance <= 0) {
      setError("Distance must be a positive number.");
      return;
    }

    const actualDistance = form.actualDistanceKm.trim() ? Number(form.actualDistanceKm) : undefined;
    if (actualDistance !== undefined && (!Number.isFinite(actualDistance) || actualDistance <= 0)) {
      setError("Actual distance must be a positive number when provided.");
      return;
    }

    const ok = updateStoredWorkout(weekIndex, workoutIndex, {
      title: form.title,
      warmup: form.warmup,
      mainSet: form.mainSet,
      cooldown: form.cooldown,
      paceTarget: form.paceTarget,
      hrFallback: form.hrFallback,
      rpe: form.rpe,
      purpose: form.purpose,
      distanceKm: numericDistance,
      status: form.status,
      actualSummary: form.actualSummary || undefined,
      actualDistanceKm: actualDistance,
      actualRpe: form.actualRpe || undefined,
      actualNotes: form.actualNotes || undefined
    });

    if (!ok) {
      setError("Failed to save workout edits.");
      return;
    }

    setMessage("Workout updated.");
    refreshFromStorage();
  }

  return (
    <div className="space-y-5">
      <section className="panel">
        <p className="text-sm text-slate-600">
          Week {week.weekNumber} | {week.phase}
        </p>
        <h2 className="h2 mt-1">
          {workout.day}: {workout.title}
        </h2>
        <p className="mt-2 text-sm text-slate-700">
          {workout.distanceKm} km | Pace target {workout.paceTarget} | HR fallback {workout.hrFallback}
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50"
            onClick={() => handleQuickStatus("done")}
          >
            Mark Done
          </button>
          <button
            type="button"
            className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50"
            onClick={() => handleQuickStatus("skipped")}
          >
            Mark Skipped
          </button>
          <button
            type="button"
            className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
            onClick={() => handleQuickStatus("planned")}
          >
            Reset Planned
          </button>
        </div>
      </section>

      <form className="panel space-y-4" onSubmit={handleSaveEdits}>
        <h3 className="text-lg font-semibold">Edit Planned Workout</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="label">Title</span>
            <input className="input" value={form.title} onChange={(e) => patchForm({ title: e.target.value })} />
          </label>
          <label>
            <span className="label">Distance km</span>
            <input
              className="input"
              type="number"
              step="0.1"
              value={form.distanceKm}
              onChange={(e) => patchForm({ distanceKm: Number(e.target.value) })}
            />
          </label>
          <label>
            <span className="label">Pace Target</span>
            <input className="input" value={form.paceTarget} onChange={(e) => patchForm({ paceTarget: e.target.value })} />
          </label>
          <label>
            <span className="label">HR Fallback</span>
            <input className="input" value={form.hrFallback} onChange={(e) => patchForm({ hrFallback: e.target.value })} />
          </label>
          <label>
            <span className="label">RPE</span>
            <input className="input" value={form.rpe} onChange={(e) => patchForm({ rpe: e.target.value })} />
          </label>
          <label>
            <span className="label">Status</span>
            <select
              className="input"
              value={form.status}
              onChange={(e) => patchForm({ status: e.target.value as WorkoutStatus })}
            >
              <option value="planned">Planned</option>
              <option value="done">Done</option>
              <option value="skipped">Skipped</option>
            </select>
          </label>
          <label className="md:col-span-2">
            <span className="label">Warm-up</span>
            <input className="input" value={form.warmup} onChange={(e) => patchForm({ warmup: e.target.value })} />
          </label>
          <label className="md:col-span-2">
            <span className="label">Main Set</span>
            <textarea className="input min-h-20" value={form.mainSet} onChange={(e) => patchForm({ mainSet: e.target.value })} />
          </label>
          <label className="md:col-span-2">
            <span className="label">Cooldown</span>
            <input className="input" value={form.cooldown} onChange={(e) => patchForm({ cooldown: e.target.value })} />
          </label>
          <label className="md:col-span-2">
            <span className="label">Purpose</span>
            <textarea className="input min-h-20" value={form.purpose} onChange={(e) => patchForm({ purpose: e.target.value })} />
          </label>
        </div>

        <h4 className="pt-2 text-base font-semibold">What you actually did</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">
            <span className="label">Actual Summary</span>
            <input
              className="input"
              placeholder="e.g. reduced one rep due to fatigue"
              value={form.actualSummary}
              onChange={(e) => patchForm({ actualSummary: e.target.value })}
            />
          </label>
          <label>
            <span className="label">Actual Distance km (optional)</span>
            <input
              className="input"
              type="number"
              step="0.1"
              value={form.actualDistanceKm}
              onChange={(e) => patchForm({ actualDistanceKm: e.target.value })}
            />
          </label>
          <label>
            <span className="label">Actual RPE (optional)</span>
            <input className="input" value={form.actualRpe} onChange={(e) => patchForm({ actualRpe: e.target.value })} />
          </label>
          <label className="md:col-span-2">
            <span className="label">Notes (optional)</span>
            <textarea className="input min-h-24" value={form.actualNotes} onChange={(e) => patchForm({ actualNotes: e.target.value })} />
          </label>
        </div>

        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">
            Save Workout Changes
          </button>
          <Link href="/plan" className="btn-secondary">
            Back to plan
          </Link>
        </div>
      </form>
    </div>
  );
}
