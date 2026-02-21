"use client";

import { useState } from "react";
import { RunnerProfile } from "@/lib/domain/models";
import { getStoredProfile, setStoredProfile } from "@/lib/storage/local";
import { RunnerProfileFormValues, runnerProfileSchema } from "@/lib/validation/schemas";

const DEFAULT_PROFILE: RunnerProfileFormValues = {
  weeklyKmCurrent: 40,
  weeklyKmMaxTolerated: 55,
  daysPerWeekAvailable: 4,
  preferredLongRunDay: "Sunday",
  maxHr: "",
  restingHr: "",
  lthr: "",
  experienceLevel: "intermediate",
  injuryNotes: "",
  preferredUnits: "km"
};

function normalizeNumber(value: number | "" | undefined): number | undefined {
  return value === "" || value === undefined ? undefined : value;
}

export function RunnerProfileForm(): React.JSX.Element {
  const existing = getStoredProfile();
  const [form, setForm] = useState<RunnerProfileFormValues>(() => {
    if (!existing) return DEFAULT_PROFILE;
    return {
      weeklyKmCurrent: existing.weeklyKmCurrent,
      weeklyKmMaxTolerated: existing.weeklyKmMaxTolerated,
      daysPerWeekAvailable: existing.daysPerWeekAvailable,
      preferredLongRunDay: existing.preferredLongRunDay,
      maxHr: existing.maxHr ?? "",
      restingHr: existing.restingHr ?? "",
      lthr: existing.lthr ?? "",
      experienceLevel: existing.experienceLevel,
      injuryNotes: existing.injuryNotes ?? "",
      preferredUnits: existing.preferredUnits
    };
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setSaved(false);
    const parsed = runnerProfileSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.message));
      return;
    }

    const normalized: RunnerProfile = {
      weeklyKmCurrent: parsed.data.weeklyKmCurrent,
      weeklyKmMaxTolerated: parsed.data.weeklyKmMaxTolerated,
      daysPerWeekAvailable: parsed.data.daysPerWeekAvailable as 3 | 4 | 5 | 6,
      preferredLongRunDay: parsed.data.preferredLongRunDay,
      maxHr: normalizeNumber(parsed.data.maxHr),
      restingHr: normalizeNumber(parsed.data.restingHr),
      lthr: normalizeNumber(parsed.data.lthr),
      experienceLevel: parsed.data.experienceLevel,
      injuryNotes: parsed.data.injuryNotes,
      preferredUnits: parsed.data.preferredUnits
    };

    setStoredProfile(normalized);
    setErrors([]);
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
      <label>
        <span className="label">Current Weekly km</span>
        <input
          className="input"
          type="number"
          value={form.weeklyKmCurrent}
          onChange={(event) => setForm((prev) => ({ ...prev, weeklyKmCurrent: Number(event.target.value) }))}
        />
      </label>

      <label>
        <span className="label">Max Tolerated Weekly km</span>
        <input
          className="input"
          type="number"
          value={form.weeklyKmMaxTolerated}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, weeklyKmMaxTolerated: Number(event.target.value) }))
          }
        />
      </label>

      <label>
        <span className="label">Days Available</span>
        <select
          className="input"
          value={form.daysPerWeekAvailable}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, daysPerWeekAvailable: Number(event.target.value) as 3 | 4 | 5 | 6 }))
          }
        >
          <option value={3}>3</option>
          <option value={4}>4</option>
          <option value={5}>5</option>
          <option value={6}>6</option>
        </select>
      </label>

      <label>
        <span className="label">Preferred Long Run Day</span>
        <select
          className="input"
          value={form.preferredLongRunDay}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              preferredLongRunDay: event.target.value as RunnerProfile["preferredLongRunDay"]
            }))
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
        <span className="label">Max HR (optional)</span>
        <input
          className="input"
          type="number"
          value={form.maxHr}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, maxHr: event.target.value === "" ? "" : Number(event.target.value) }))
          }
        />
      </label>

      <label>
        <span className="label">Resting HR (optional)</span>
        <input
          className="input"
          type="number"
          value={form.restingHr}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              restingHr: event.target.value === "" ? "" : Number(event.target.value)
            }))
          }
        />
      </label>

      <label>
        <span className="label">LTHR (optional)</span>
        <input
          className="input"
          type="number"
          value={form.lthr}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, lthr: event.target.value === "" ? "" : Number(event.target.value) }))
          }
        />
      </label>

      <label>
        <span className="label">Experience Level</span>
        <select
          className="input"
          value={form.experienceLevel}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              experienceLevel: event.target.value as RunnerProfile["experienceLevel"]
            }))
          }
        >
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
      </label>

      <label>
        <span className="label">Preferred Units</span>
        <select
          className="input"
          value={form.preferredUnits}
          onChange={(event) => setForm((prev) => ({ ...prev, preferredUnits: event.target.value as "km" | "mile" }))}
        >
          <option value="km">km</option>
          <option value="mile">mile</option>
        </select>
      </label>

      <label className="md:col-span-2">
        <span className="label">Injury Notes (optional)</span>
        <textarea
          className="input min-h-24"
          value={form.injuryNotes}
          onChange={(event) => setForm((prev) => ({ ...prev, injuryNotes: event.target.value }))}
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
        <button className="btn-primary" type="submit">
          Save Profile
        </button>
        {saved ? <p className="mt-2 text-sm text-emerald-700">Profile saved.</p> : null}
      </div>
    </form>
  );
}

