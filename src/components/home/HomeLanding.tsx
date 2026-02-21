"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  StoredProfileSummary,
  createStoredProfile,
  getActiveProfileId,
  listStoredProfiles,
  setActiveProfile
} from "@/lib/storage/local";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "P";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

const CARD_COLORS = ["bg-teal-600", "bg-blue-600", "bg-rose-600", "bg-amber-600", "bg-indigo-600"];

export function HomeLanding(): React.JSX.Element {
  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [newProfileName, setNewProfileName] = useState("Andrei");
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Who is training today?</h1>
        <p className="mt-2 text-sm text-slate-600">
          Choose your runner profile. Plans, VDOT baselines, and settings are saved per profile on this device.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {profiles.map((profile, index) => {
            const selected = profile.id === activeProfileId;
            return (
              <button
                key={profile.id}
                type="button"
                onClick={() => handleProfileSelect(profile.id)}
                className={`rounded-xl border p-4 text-left transition ${
                  selected ? "border-accent ring-2 ring-accent/20" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className={`mb-3 flex h-14 w-14 items-center justify-center rounded-lg text-lg font-semibold text-white ${CARD_COLORS[index % CARD_COLORS.length]}`}>
                  {initialsFromName(profile.name)}
                </div>
                <p className="text-base font-medium">{profile.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {profile.hasRunnerProfile ? "Profile set" : "Profile not set"} |{" "}
                  {profile.hasPlan ? "Plan available" : "No plan yet"}
                </p>
              </button>
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
          {error ? <p className="mt-2 text-sm text-rose-700">{error}</p> : null}
        </div>
      </section>

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
              <p className="muted mt-1">4 or 8 week plan</p>
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}
