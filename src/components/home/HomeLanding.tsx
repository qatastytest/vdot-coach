"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatTime, parseTimeToSeconds } from "@/lib/core";
import {
  PROFILE_COLOR_PRESETS,
  PROFILE_ICON_PRESETS,
  PROFILE_THEME_PRESETS,
  StoredProfileSummary,
  createStoredProfile,
  getActiveProfileId,
  listStoredProfiles,
  setActiveProfile,
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
  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState("Andrei");
  const [error, setError] = useState<string | null>(null);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ProfileCardEditForm | null>(null);

  useEffect(() => {
    setProfiles(listStoredProfiles());
    setActiveProfileId(getActiveProfileId());
  }, []);

  const activeProfile = useMemo(
    () => profiles.find((profile) => profile.id === activeProfileId) ?? null,
    [activeProfileId, profiles]
  );

  function refreshState(): void {
    setProfiles(listStoredProfiles());
    setActiveProfileId(getActiveProfileId());
  }

  function handleProfileSelect(profileId: string): void {
    setActiveProfile(profileId);
    refreshState();
  }

  function handleCreateProfile(): void {
    setError(null);
    const name = newProfileName.trim();
    if (!name) {
      setError("Profile name is required.");
      return;
    }

    createStoredProfile(name);
    setNewProfileName("");
    refreshState();
  }

  function startEditing(profile: StoredProfileSummary): void {
    setEditingProfileId(profile.id);
    setEditForm({
      icon: profile.appearance.icon,
      cardColor: profile.appearance.cardColor,
      theme: profile.appearance.theme,
      description: profile.appearance.description,
      fiveKTime: profile.appearance.fiveKTimeSeconds ? formatTime(profile.appearance.fiveKTimeSeconds) : ""
    });
  }

  function saveProfileCardEdits(): void {
    if (!editingProfileId || !editForm) return;
    let fiveKTimeSeconds: number | undefined;

    if (editForm.fiveKTime.trim() !== "") {
      try {
        fiveKTimeSeconds = parseTimeToSeconds(editForm.fiveKTime.trim());
      } catch {
        setError("5K time must be mm:ss or hh:mm:ss.");
        return;
      }
    }

    const ok = updateStoredProfileAppearance(editingProfileId, {
      icon: editForm.icon,
      cardColor: editForm.cardColor,
      theme: editForm.theme as (typeof PROFILE_THEME_PRESETS)[number],
      description: editForm.description,
      fiveKTimeSeconds
    });
    if (!ok) {
      setError("Could not save profile card edits.");
      return;
    }

    setError(null);
    setEditingProfileId(null);
    setEditForm(null);
    refreshState();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Who is training today?</h1>
        <p className="mt-2 text-sm text-slate-600">
          Choose your runner profile. Plans, VDOT baselines, and settings are saved per profile on this device.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {profiles.map((profile) => {
            const selected = profile.id === activeProfileId;
            return (
              <div
                key={profile.id}
                className={`rounded-xl border p-4 transition ${
                  selected ? "border-accent ring-2 ring-accent/20" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-start justify-between">
                  <button type="button" className="text-left" onClick={() => handleProfileSelect(profile.id)}>
                    <div
                      className={`mb-3 flex h-14 w-14 items-center justify-center rounded-lg text-2xl font-semibold text-white ${profile.appearance.cardColor}`}
                    >
                      {profile.appearance.icon}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => startEditing(profile)}
                    className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Edit
                  </button>
                </div>
                <button type="button" className="w-full text-left" onClick={() => handleProfileSelect(profile.id)}>
                  <p className="text-base font-medium">{profile.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {profile.hasRunnerProfile ? "Profile set" : "Profile not set"} |{" "}
                    {profile.hasPlan ? "Plan available" : "No plan yet"}
                  </p>
                  {profile.appearance.description ? (
                    <p className="mt-1 text-xs text-slate-500">{profile.appearance.description}</p>
                  ) : null}
                  {profile.appearance.fiveKTimeSeconds ? (
                    <p className="mt-1 text-xs text-slate-500">5K PB: {formatTime(profile.appearance.fiveKTimeSeconds)}</p>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-xl border border-dashed border-slate-300 p-4">
          <p className="text-sm font-medium text-slate-800">Add profile</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              className="input"
              value={newProfileName}
              onChange={(event) => setNewProfileName(event.target.value)}
              placeholder="Runner name"
            />
            <button type="button" onClick={handleCreateProfile} className="btn-primary sm:w-auto">
              Create
            </button>
          </div>
        </div>
      </section>

      {editingProfileId && editForm ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <h2 className="text-xl font-semibold">Edit Profile Card</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label>
              <span className="label">Icon</span>
              <div className="grid grid-cols-6 gap-2">
                {PROFILE_ICON_PRESETS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setEditForm((prev) => (prev ? { ...prev, icon } : prev))}
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
                    onClick={() => setEditForm((prev) => (prev ? { ...prev, cardColor: colorClass } : prev))}
                    className={`h-8 rounded border ${colorClass} ${editForm.cardColor === colorClass ? "ring-2 ring-accent" : "border-slate-200"}`}
                  />
                ))}
              </div>
            </label>

            <label>
              <span className="label">Theme</span>
              <select
                className="input"
                value={editForm.theme}
                onChange={(event) => setEditForm((prev) => (prev ? { ...prev, theme: event.target.value } : prev))}
              >
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
                onChange={(event) => setEditForm((prev) => (prev ? { ...prev, fiveKTime: event.target.value } : prev))}
                placeholder="22:30"
              />
            </label>

            <label className="md:col-span-2">
              <span className="label">Short Description</span>
              <textarea
                className="input min-h-20"
                value={editForm.description}
                onChange={(event) => setEditForm((prev) => (prev ? { ...prev, description: event.target.value } : prev))}
                placeholder="e.g. Preparing for spring HM, prefers easy trails."
              />
            </label>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" className="btn-primary" onClick={saveProfileCardEdits}>
              Save Card
            </button>
            <button type="button" className="btn-secondary" onClick={() => setEditingProfileId(null)}>
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {activeProfile ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <p className="text-sm text-slate-600">Active profile</p>
          <h2 className="mt-1 text-2xl font-semibold">{activeProfile.name}</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <Link href="/settings" className="rounded-lg border border-slate-200 p-4 hover:bg-slate-50">
              <p className="font-medium">Settings</p>
              <p className="muted mt-1">Runner profile and constraints</p>
            </Link>
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
              <p className="muted mt-1">4/8/12/16 week plan</p>
            </Link>
          </div>
        </section>
      ) : null}

      {error ? (
        <section className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </section>
      ) : null}
    </div>
  );
}
