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
import { getStoredBaseline, setStoredBaseline } from "@/lib/storage/local";
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

function baselineToForm(baseline: BaselineSnapshot): PerformanceFormValues {
  return {
    distanceMeters: baseline.performance.distanceMeters,
    time: formatTime(baseline.performance.timeSeconds),
    date: baseline.performance.date,
    eventType: baseline.performance.eventType,
    effortType: baseline.performance.effortType,
    surface: baseline.performance.surface,
    elevationGainM: baseline.performance.elevationGainM ?? "",
    temperatureC: baseline.performance.temperatureC ?? "",
    windKph: baseline.performance.windKph ?? ""
  };
}

export function PerformanceForm(): React.JSX.Element {
  const router = useRouter();
  const [existingBaseline] = useState<BaselineSnapshot | null>(() => getStoredBaseline());
  const [form, setForm] = useState<PerformanceFormValues>(() =>
    existingBaseline ? baselineToForm(existingBaseline) : DEFAULT_FORM
  );
  const [mode, setMode] = useState<"saved" | "new">(() => (existingBaseline ? "saved" : "new"));
  const [errors, setErrors] = useState<string[]>([]);

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

  function handleUseSaved(): void {
    if (!existingBaseline) return;
    setMode("saved");
    setErrors([]);
    setForm(baselineToForm(existingBaseline));
  }

  function handleAddNew(): void {
    setMode("new");
    setErrors([]);
    setForm({
      ...DEFAULT_FORM,
      date: new Date().toISOString().slice(0, 10)
    });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
      {existingBaseline ? (
        <div className="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-sm font-medium text-slate-800">Performance source</p>
          <p className="mt-1 text-xs text-slate-600">
            Saved baseline: {formatTime(existingBaseline.performance.timeSeconds)} /{" "}
            {(existingBaseline.performance.distanceMeters / 1000).toFixed(2)} km ({existingBaseline.performance.date})
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleUseSaved}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                mode === "saved"
                  ? "border-accent bg-teal-50 text-teal-800"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              Use Saved Baseline
            </button>
            <button
              type="button"
              onClick={handleAddNew}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                mode === "new"
                  ? "border-accent bg-teal-50 text-teal-800"
                  : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              Add New Performance
            </button>
          </div>
        </div>
      ) : null}

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
  );
}

