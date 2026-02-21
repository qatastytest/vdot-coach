"use client";

import { useMemo, useState } from "react";
import {
  estimateHrZonesFromLthr,
  estimateHrZonesFromPercentMax,
  estimateHrZonesKarvonen
} from "@/lib/core";
import { getStoredProfile, setStoredProfile } from "@/lib/storage/local";
import { InfoTip } from "@/components/ui/InfoTip";

export function HrSetupForm(): React.JSX.Element {
  const profile = getStoredProfile();
  const [maxHr, setMaxHr] = useState<string>(profile?.maxHr ? String(profile.maxHr) : "");
  const [restingHr, setRestingHr] = useState<string>(profile?.restingHr ? String(profile.restingHr) : "");
  const [lthr, setLthr] = useState<string>(profile?.lthr ? String(profile.lthr) : "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previews = useMemo(() => {
    const list = [];
    const parsedMax = maxHr ? Number(maxHr) : null;
    const parsedRest = restingHr ? Number(restingHr) : null;
    const parsedLthr = lthr ? Number(lthr) : null;

    if (parsedMax) {
      list.push(estimateHrZonesFromPercentMax(parsedMax));
    }
    if (parsedMax && parsedRest) {
      try {
        list.push(estimateHrZonesKarvonen(parsedMax, parsedRest));
      } catch {
        // Keep form interactive; save handles errors.
      }
    }
    if (parsedLthr) {
      list.push(estimateHrZonesFromLthr(parsedLthr));
    }
    return list;
  }, [lthr, maxHr, restingHr]);

  function handleSave(): void {
    setSaved(false);
    setError(null);
    const current = getStoredProfile();

    if (!current) {
      setError("Select a profile and create runner settings first.");
      return;
    }

    const parsedMax = maxHr ? Number(maxHr) : undefined;
    const parsedRest = restingHr ? Number(restingHr) : undefined;
    const parsedLthr = lthr ? Number(lthr) : undefined;

    if (parsedRest && parsedMax && parsedRest >= parsedMax) {
      setError("Resting HR must be below max HR.");
      return;
    }

    const savedProfile = setStoredProfile({
      ...current,
      maxHr: parsedMax,
      restingHr: parsedRest,
      lthr: parsedLthr
    });
    if (!savedProfile) {
      setError("Select a profile from Home before saving HR setup.");
      return;
    }

    setSaved(true);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <label>
          <span className="label flex items-center gap-1">
            Max HR
            <InfoTip
              title="Max HR"
              content="Use your highest reliable HR from a hard uphill finish or repeated short intervals."
            />
          </span>
          <input
            className="input"
            type="number"
            value={maxHr}
            onChange={(event) => setMaxHr(event.target.value)}
            placeholder="188"
          />
        </label>
        <label>
          <span className="label flex items-center gap-1">
            Resting HR
            <InfoTip
              title="Resting HR"
              content="Measure on waking before standing. Use weekly average for stability, not one random day."
            />
          </span>
          <input
            className="input"
            type="number"
            value={restingHr}
            onChange={(event) => setRestingHr(event.target.value)}
            placeholder="52"
          />
        </label>
        <label>
          <span className="label flex items-center gap-1">
            LTHR
            <InfoTip
              title="LTHR"
              content="From a 30-min time trial: average HR over the final 20 minutes. Re-test every 6-8 weeks."
            />
          </span>
          <input
            className="input"
            type="number"
            value={lthr}
            onChange={(event) => setLthr(event.target.value)}
            placeholder="171"
          />
        </label>
      </div>
      <button type="button" onClick={handleSave} className="btn-primary">
        Save HR Setup
      </button>
      {saved ? <p className="text-sm text-emerald-700">Saved to local profile.</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        HR zones are estimates only. Heat, hydration, fatigue, stress, caffeine, and terrain can shift observed HR.
      </div>

      <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        Quick setup guide: start with resting HR + max HR if known. Add LTHR once you complete a controlled 30-min
        threshold test for better zone targeting.
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {previews.map((result) => (
          <div key={result.method} className="rounded-lg border border-slate-200 p-4">
            <p className="font-medium capitalize">{result.method.replace("_", " ")}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {result.zones.map((zone) => (
                <li key={zone.name}>
                  {zone.name}: {zone.low}-{zone.high} bpm
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

