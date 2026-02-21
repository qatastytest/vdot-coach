"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  assessPerformanceConfidence,
  buildCoachingNotes,
  buildRacePredictions,
  calculateVdotFromPerformance,
  deriveTrainingPaces,
  formatTime,
  parseTimeToSeconds
} from "@/lib/core";
import { BaselineSnapshot } from "@/lib/domain/models";
import {
  applyActivitiesToStoredPlan,
  getStoredActivities,
  getStoredGoal,
  getStoredLastActivitySyncAt,
  mergeStoredActivities,
  setStoredBaseline
} from "@/lib/storage/local";
import {
  buildActivityInsights,
  deriveBaselineFromActivities,
  parseStravaImportFile
} from "@/lib/integrations/strava";
import { PerformanceFormValues, performanceFormSchema } from "@/lib/validation/schemas";

const DEFAULT_FORM: PerformanceFormValues = {
  distanceMeters: 5000,
  time: "20:00",
  date: new Date().toISOString().slice(0, 10),
  eventType: "race",
  effortType: "all_out",
  surface: "road",
  elevationGainM: "",
  temperatureC: "",
  windKph: ""
};

function optionalNumber(value: number | "" | undefined): number | undefined {
  return value === "" || value === undefined ? undefined : value;
}

export function PerformanceForm(): React.JSX.Element {
  const router = useRouter();
  const [form, setForm] = useState<PerformanceFormValues>(DEFAULT_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  const [activities, setActivities] = useState(() => getStoredActivities());
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncWarnings, setSyncWarnings] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);

  const lastSyncAt = getStoredLastActivitySyncAt();
  const goal = getStoredGoal();
  const insights = useMemo(() => buildActivityInsights(activities), [activities]);

  const distanceChoices = useMemo(
    () => [
      { label: "1500m", value: 1500 },
      { label: "1 mile", value: 1609.34 },
      { label: "3K", value: 3000 },
      { label: "5K", value: 5000 },
      { label: "10K", value: 10000 },
      { label: "Half Marathon", value: 21097.5 },
      { label: "Marathon", value: 42195 }
    ],
    []
  );

  async function handleStravaImport(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;

    setSyncing(true);
    setSyncWarnings([]);
    setSyncMessage(null);
    try {
      const text = await file.text();
      const parsed = parseStravaImportFile(text);
      if (parsed.activities.length === 0) {
        setSyncWarnings(parsed.warnings.length > 0 ? parsed.warnings : ["No valid activities found in file."]);
        return;
      }

      const merged = mergeStoredActivities(parsed.activities);
      if (!merged) {
        setSyncWarnings(["Could not save imported activities. Select an active profile first."]);
        return;
      }

      const planSync = applyActivitiesToStoredPlan(parsed.activities);
      const allActivities = getStoredActivities();
      const derivedBaseline = deriveBaselineFromActivities(allActivities);
      if (derivedBaseline) {
        setStoredBaseline(derivedBaseline);
        setForm((prev) => ({
          ...prev,
          distanceMeters: derivedBaseline.performance.distanceMeters,
          time: formatTime(derivedBaseline.performance.timeSeconds),
          date: derivedBaseline.performance.date,
          eventType: derivedBaseline.performance.eventType,
          effortType: derivedBaseline.performance.effortType,
          surface: derivedBaseline.performance.surface,
          elevationGainM: derivedBaseline.performance.elevationGainM ?? ""
        }));
      }

      setActivities(allActivities);
      setSyncWarnings(parsed.warnings);
      setSyncMessage(
        `Imported ${merged.importedCount} new activities (${merged.totalCount} total). ` +
          `${planSync ? `${planSync.matchedCount} workouts matched in plan.` : "No active plan to update."}`
      );
    } catch {
      setSyncWarnings(["Import failed. Use Strava CSV export or JSON data file."]);
    } finally {
      setSyncing(false);
      event.target.value = "";
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const parsed = performanceFormSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.message));
      return;
    }

    const timeSeconds = parseTimeToSeconds(parsed.data.time);
    const performance = {
      distanceMeters: parsed.data.distanceMeters,
      timeSeconds,
      date: parsed.data.date,
      eventType: parsed.data.eventType,
      effortType: parsed.data.effortType,
      surface: parsed.data.surface,
      elevationGainM: optionalNumber(parsed.data.elevationGainM),
      temperatureC: optionalNumber(parsed.data.temperatureC),
      windKph: optionalNumber(parsed.data.windKph)
    };

    const vdotResult = calculateVdotFromPerformance(performance.distanceMeters, performance.timeSeconds);
    const confidence = assessPerformanceConfidence(performance);
    const predictions = buildRacePredictions(vdotResult.vdot);
    const paces = deriveTrainingPaces(vdotResult.vdot);
    const coachingNotes = buildCoachingNotes(confidence);

    const baseline: BaselineSnapshot = {
      performance,
      vdot: vdotResult.roundedVdot,
      confidence,
      predictions,
      paces,
      coachingNotes
    };

    const saved = setStoredBaseline(baseline);
    if (!saved) {
      setErrors(["Select a profile from Home before saving results."]);
      return;
    }

    router.push("/results");
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-800">Strava Activity Sync</p>
            <p className="text-xs text-slate-600">
              Import Strava CSV export or API JSON to sync old/new activities, update plan status, and refresh baseline.
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Direct OAuth sync needs backend (Supabase/API proxy). This keeps you functional now on static hosting.
            </p>
          </div>
          <label className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100">
            {syncing ? "Importing..." : "Import Strava File"}
            <input
              type="file"
              accept=".csv,application/json,.json,text/csv"
              className="hidden"
              onChange={handleStravaImport}
              disabled={syncing}
            />
          </label>
        </div>
        {syncMessage ? <p className="mt-2 text-sm text-emerald-700">{syncMessage}</p> : null}
        {syncWarnings.length > 0 ? (
          <ul className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {syncWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-slate-200 bg-white p-2">
            <p className="text-[11px] text-slate-500">7d volume</p>
            <p className="text-lg font-semibold">{insights.km7d.toFixed(1)} km</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-2">
            <p className="text-[11px] text-slate-500">28d volume</p>
            <p className="text-lg font-semibold">{insights.km28d.toFixed(1)} km</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-2">
            <p className="text-[11px] text-slate-500">Best 5K / 10K</p>
            <p className="text-sm font-semibold">
              {insights.fiveKPbSec ? formatTime(insights.fiveKPbSec) : "--"} /{" "}
              {insights.tenKPbSec ? formatTime(insights.tenKPbSec) : "--"}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-2">
            <p className="text-[11px] text-slate-500">Longest run</p>
            <p className="text-lg font-semibold">{insights.longestRunKm.toFixed(1)} km</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Activities: {insights.totalActivities} total ({insights.runActivities} runs), last sync{" "}
          {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : "not synced"}, goal date{" "}
          {goal?.targetDate ?? "not set"}.
        </p>
      </section>

      <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
        <label>
          <span className="label">Distance</span>
          <select
            className="input"
            value={form.distanceMeters}
            onChange={(event) => setForm((prev) => ({ ...prev, distanceMeters: Number(event.target.value) }))}
          >
            {distanceChoices.map((distance) => (
              <option key={distance.label} value={distance.value}>
                {distance.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="label">Time (mm:ss or hh:mm:ss)</span>
          <input
            className="input"
            value={form.time}
            onChange={(event) => setForm((prev) => ({ ...prev, time: event.target.value }))}
            placeholder="20:00"
          />
        </label>

        <label>
          <span className="label">Date</span>
          <input
            className="input"
            type="date"
            value={form.date}
            onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
          />
        </label>

        <label>
          <span className="label">Event Type</span>
          <select
            className="input"
            value={form.eventType}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, eventType: event.target.value as PerformanceFormValues["eventType"] }))
            }
          >
            <option value="race">Race</option>
            <option value="test">Test</option>
          </select>
        </label>

        <label>
          <span className="label">Effort Type</span>
          <select
            className="input"
            value={form.effortType}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, effortType: event.target.value as PerformanceFormValues["effortType"] }))
            }
          >
            <option value="all_out">All Out</option>
            <option value="hard">Hard</option>
            <option value="controlled">Controlled</option>
          </select>
        </label>

        <label>
          <span className="label">Surface</span>
          <select
            className="input"
            value={form.surface}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, surface: event.target.value as PerformanceFormValues["surface"] }))
            }
          >
            <option value="track">Track</option>
            <option value="road">Road</option>
            <option value="trail">Trail</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>

        <label>
          <span className="label">Elevation Gain (m, optional)</span>
          <input
            className="input"
            type="number"
            min={0}
            value={form.elevationGainM}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                elevationGainM: event.target.value === "" ? "" : Number(event.target.value)
              }))
            }
          />
        </label>

        <label>
          <span className="label">Temperature (C, optional)</span>
          <input
            className="input"
            type="number"
            value={form.temperatureC}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                temperatureC: event.target.value === "" ? "" : Number(event.target.value)
              }))
            }
          />
        </label>

        <label>
          <span className="label">Wind (kph, optional)</span>
          <input
            className="input"
            type="number"
            min={0}
            value={form.windKph}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, windKph: event.target.value === "" ? "" : Number(event.target.value) }))
            }
          />
        </label>

        <div className="md:col-span-2">
          {errors.length > 0 ? (
            <ul className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
          <button type="submit" className="btn-primary">
            Calculate VDOT
          </button>
        </div>
      </form>
    </div>
  );
}
