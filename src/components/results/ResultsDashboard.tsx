"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  estimateHrZonesFromLthr,
  estimateHrZonesFromPercentMax,
  estimateHrZonesKarvonen,
  formatPacePerKm,
  formatPacePerMile,
  formatTime
} from "@/lib/core";
import { BaselineSnapshot } from "@/lib/domain/models";
import { getStoredBaseline, getStoredProfile } from "@/lib/storage/local";
import { Badge } from "@/components/ui/Badge";
import { InfoTip } from "@/components/ui/InfoTip";
import { Panel } from "@/components/ui/Panel";

export function ResultsDashboard(): React.JSX.Element {
  const [baseline, setBaseline] = useState<BaselineSnapshot | null>(null);
  const [profile, setProfile] = useState<ReturnType<typeof getStoredProfile>>(null);

  useEffect(() => {
    setBaseline(getStoredBaseline());
    setProfile(getStoredProfile());
  }, []);

  const hrZones = useMemo(() => {
    if (!profile) return [];
    const results = [];
    if (profile.maxHr) results.push(estimateHrZonesFromPercentMax(profile.maxHr));
    if (profile.maxHr && profile.restingHr) {
      results.push(estimateHrZonesKarvonen(profile.maxHr, profile.restingHr));
    }
    if (profile.lthr) results.push(estimateHrZonesFromLthr(profile.lthr));
    return results;
  }, [profile]);

  if (!baseline) {
    return (
      <Panel title="No Baseline Yet" subtitle="Add a race or test performance first.">
        <div className="flex gap-2">
          <Link href="/performance" className="btn-primary">
            Add performance
          </Link>
          <Link href="/" className="btn-secondary">
            Select profile
          </Link>
        </div>
      </Panel>
    );
  }

  const confidenceTone =
    baseline.confidence.label === "high"
      ? "success"
      : baseline.confidence.label === "medium"
        ? "warn"
        : "danger";

  return (
    <div className="space-y-6">
      <Panel title="Current Baseline" subtitle="Daniels-style VDOT derived from your submitted performance.">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-600">VDOT</p>
            <p className="mt-1 text-3xl font-semibold">{baseline.vdot.toFixed(1)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="flex items-center gap-1 text-sm text-slate-600">
              Confidence
              <InfoTip
                title="Confidence Level"
                content="High means all-out track/flat-road effort. Medium includes mild elevation/conditions. Low means trail, controlled effort, or strong wind/elevation."
              />
            </p>
            <div className="mt-2">
              <Badge label={baseline.confidence.label.toUpperCase()} tone={confidenceTone} />
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="text-sm text-slate-600">Input</p>
            <p className="mt-1 text-sm font-medium">
              {formatTime(baseline.performance.timeSeconds)} over {(baseline.performance.distanceMeters / 1000).toFixed(2)}
              km
            </p>
          </div>
        </div>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {baseline.confidence.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </Panel>

      <Panel title="Race Predictions" subtitle="Solved by matching equivalent VDOT across race distances.">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-600">
                <th className="py-2 pr-3">Distance</th>
                <th className="py-2 pr-3">Predicted Time</th>
                <th className="py-2 pr-3">Pace / km</th>
                <th className="py-2 pr-3">Pace / mile</th>
              </tr>
            </thead>
            <tbody>
              {baseline.predictions.map((prediction) => (
                <tr key={prediction.raceKey} className="border-b border-slate-100">
                  <td className="py-2 pr-3">{prediction.raceKey}</td>
                  <td className="py-2 pr-3">{formatTime(prediction.timeSeconds)}</td>
                  <td className="py-2 pr-3">{formatPacePerKm(prediction.pacePerKmSeconds)}</td>
                  <td className="py-2 pr-3">{formatPacePerMile(prediction.pacePerMileSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Training Paces" subtitle="Derived from VDOT using Daniels-style intensity bands.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="font-medium">Easy</p>
            <p className="text-sm">
              {formatPacePerKm(baseline.paces.easy.lowSecondsPerKm ?? 0)} to{" "}
              {formatPacePerKm(baseline.paces.easy.highSecondsPerKm ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="font-medium">Marathon</p>
            <p className="text-sm">{formatPacePerKm(baseline.paces.marathon.targetSecondsPerKm ?? 0)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="font-medium">Threshold</p>
            <p className="text-sm">
              {formatPacePerKm(baseline.paces.threshold.lowSecondsPerKm ?? 0)} to{" "}
              {formatPacePerKm(baseline.paces.threshold.highSecondsPerKm ?? 0)}
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <p className="font-medium">Interval / Repetition</p>
            <p className="text-sm">
              I: {formatPacePerKm(baseline.paces.interval.targetSecondsPerKm ?? 0)}, R:{" "}
              {formatPacePerKm(baseline.paces.repetition.targetSecondsPerKm ?? 0)}
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-700">{baseline.paces.stridesGuidance}</p>
      </Panel>

      <Panel title="Track Lap Splits" subtitle="Useful for threshold, interval, and repetition sessions.">
        <div className="grid gap-4 md:grid-cols-3">
          {(["T", "I", "R"] as const).map((zone) => (
            <div key={zone} className="rounded-lg border border-slate-200 p-4">
              <p className="font-medium">{zone} pace laps</p>
              <ul className="mt-2 space-y-1 text-sm">
                {baseline.paces.lapSplits[zone].map((split) => (
                  <li key={`${zone}-${split.lapMeters}`}>
                    {split.lapMeters}m: {formatTime(split.seconds)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Heart Rate Zones (Estimated)" subtitle="Use as secondary guidance, not absolute truth.">
        {hrZones.length === 0 ? (
          <p className="text-sm text-slate-700">
            Add max HR, resting HR, or LTHR in <Link href="/hr-setup" className="text-accent underline">HR Setup</Link>.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {hrZones.map((zoneResult) => (
              <div key={zoneResult.method} className="rounded-lg border border-slate-200 p-4">
                <p className="font-medium capitalize">{zoneResult.method.replace("_", " ")}</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {zoneResult.zones.map((zone) => (
                    <li key={zone.name}>
                      {zone.name}: {zone.low}-{zone.high} bpm
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          HR zones are estimates and can drift due to heat, hydration, fatigue, stress, and altitude.
        </p>
      </Panel>

      <Panel title="Coaching Notes" subtitle="Practical guidance for applying the baseline.">
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {baseline.coachingNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
        <div className="mt-4">
          <Link href="/goal" className="btn-primary">
            Generate Plan
          </Link>
        </div>
      </Panel>
    </div>
  );
}

