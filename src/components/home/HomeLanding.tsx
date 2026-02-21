"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatTime, parseTimeToSeconds } from "@/lib/core";
import {
  PROFILE_COLOR_PRESETS,
  PROFILE_ICON_PRESETS,
  PROFILE_THEME_PRESETS,
  getActiveProfileSummary,
  updateStoredProfileAppearance
} from "@/lib/storage/local";

interface ProfileCardEditForm {
  icon: string;
  cardColor: string;
  theme: string;
  description: string;
  fiveKTime: string;
}

export function HomeLanding(): React.JSX.Element {
  const [activeProfile, setActiveProfile] = useState<ReturnType<typeof getActiveProfileSummary>>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ProfileCardEditForm | null>(null);

  useEffect(() => {
    const profile = getActiveProfileSummary();
    setActiveProfile(profile);
    if (profile) {
      setEditForm({
        icon: profile.appearance.icon,
        cardColor: profile.appearance.cardColor,
        theme: profile.appearance.theme,
        description: profile.appearance.description,
        fiveKTime: profile.appearance.fiveKTimeSeconds ? formatTime(profile.appearance.fiveKTimeSeconds) : ""
      });
    }
  }, []);

  if (!activeProfile || !editForm) {
    return (
      <section className="panel">
        <h2 className="h2">No Active Profile</h2>
        <p className="muted mt-2">Select or create a profile first.</p>
        <Link href="/" className="btn-primary mt-4">
          Go to Login
        </Link>
      </section>
    );
  }

  function patchEditForm(patch: Partial<ProfileCardEditForm>): void {
    setEditForm((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function saveCardEdits(): void {
    if (!activeProfile || !editForm) return;
    let fiveKTimeSeconds: number | undefined;
    if (editForm.fiveKTime.trim() !== "") {
      try {
        fiveKTimeSeconds = parseTimeToSeconds(editForm.fiveKTime.trim());
      } catch {
        setError("5K time must be mm:ss or hh:mm:ss.");
        return;
      }
    }

    const ok = updateStoredProfileAppearance(activeProfile.id, {
      icon: editForm.icon,
      cardColor: editForm.cardColor,
      theme: editForm.theme as (typeof PROFILE_THEME_PRESETS)[number],
      description: editForm.description,
      fiveKTimeSeconds
    });

    if (!ok) {
      setError("Could not save profile card settings.");
      return;
    }

    setError(null);
    setEditing(false);
    const refreshed = getActiveProfileSummary();
    setActiveProfile(refreshed);
    if (refreshed) {
      setEditForm({
        icon: refreshed.appearance.icon,
        cardColor: refreshed.appearance.cardColor,
        theme: refreshed.appearance.theme,
        description: refreshed.appearance.description,
        fiveKTime: refreshed.appearance.fiveKTimeSeconds ? formatTime(refreshed.appearance.fiveKTimeSeconds) : ""
      });
    }
  }

  return (
    <div className="space-y-6">
      <section className="panel">
        <h1 className="h2">Home Dashboard</h1>
        <p className="muted mt-1">Welcome, {activeProfile.name}. Continue from your latest baseline and plan.</p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <Link href="/performance" className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50">
            <p className="font-medium">Add Performance</p>
            <p className="muted mt-1">Calculate VDOT baseline</p>
          </Link>
          <Link href="/results" className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50">
            <p className="font-medium">Results</p>
            <p className="muted mt-1">Predictions and pace zones</p>
          </Link>
          <Link href="/goal" className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50">
            <p className="font-medium">Generate Plan</p>
            <p className="muted mt-1">4/8/12/16 week plans</p>
          </Link>
          <Link href="/plan" className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50">
            <p className="font-medium">Plan Overview</p>
            <p className="muted mt-1">Edit and track workouts</p>
          </Link>
        </div>
      </section>

      <section className="panel">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Profile Card</h2>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => setEditing((prev) => !prev)}>
              {editing ? "Close Editor" : "Edit Card"}
            </button>
            <Link href="/" className="btn-secondary">
              Switch Profile
            </Link>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 p-4">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-14 w-14 items-center justify-center rounded-lg text-2xl font-semibold text-white ${activeProfile.appearance.cardColor}`}
            >
              {activeProfile.appearance.icon}
            </div>
            <div>
              <p className="text-lg font-medium">{activeProfile.name}</p>
              <p className="text-sm text-slate-500">Theme: {activeProfile.appearance.theme}</p>
              {activeProfile.appearance.description ? (
                <p className="mt-1 text-sm text-slate-600">{activeProfile.appearance.description}</p>
              ) : null}
              {activeProfile.appearance.fiveKTimeSeconds ? (
                <p className="mt-1 text-sm text-slate-600">5K PB: {formatTime(activeProfile.appearance.fiveKTimeSeconds)}</p>
              ) : null}
            </div>
          </div>
        </div>

        {editing ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label>
              <span className="label">Icon</span>
              <div className="grid grid-cols-6 gap-2">
                {PROFILE_ICON_PRESETS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => patchEditForm({ icon })}
                    className={`rounded border px-2 py-2 text-xl ${editForm.icon === icon ? "border-accent" : "border-slate-300"}`}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </label>

            <label>
              <span className="label">Card Color</span>
              <div className="grid grid-cols-6 gap-2">
                {PROFILE_COLOR_PRESETS.map((colorClass) => (
                  <button
                    key={colorClass}
                    type="button"
                    onClick={() => patchEditForm({ cardColor: colorClass })}
                    className={`h-8 rounded border ${colorClass} ${editForm.cardColor === colorClass ? "ring-2 ring-accent" : "border-slate-200"}`}
                  />
                ))}
              </div>
            </label>

            <label>
              <span className="label">Theme</span>
              <select className="input" value={editForm.theme} onChange={(e) => patchEditForm({ theme: e.target.value })}>
                {PROFILE_THEME_PRESETS.map((theme) => (
                  <option key={theme} value={theme}>
                    {theme}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="label">5K PB (optional)</span>
              <input
                className="input"
                value={editForm.fiveKTime}
                onChange={(e) => patchEditForm({ fiveKTime: e.target.value })}
                placeholder="22:30"
              />
            </label>

            <label className="md:col-span-2">
              <span className="label">Short Description</span>
              <textarea
                className="input min-h-20"
                value={editForm.description}
                onChange={(e) => patchEditForm({ description: e.target.value })}
                placeholder="e.g. Building for half marathon, prefers track once/week."
              />
            </label>

            <div className="md:col-span-2">
              <button type="button" className="btn-primary" onClick={saveCardEdits}>
                Save Card
              </button>
            </div>
          </div>
        ) : null}
        {error ? <p className="mt-3 text-sm text-rose-700">{error}</p> : null}
      </section>
    </div>
  );
}
