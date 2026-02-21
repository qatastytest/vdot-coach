"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  StoredProfileSummary,
  createStoredProfile,
  listStoredProfiles,
  setActiveProfile
} from "@/lib/storage/local";

export function ProfileLoginScreen(): React.JSX.Element {
  const router = useRouter();
  const [profiles, setProfiles] = useState<StoredProfileSummary[]>([]);
  const [newProfileName, setNewProfileName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProfiles(listStoredProfiles());
  }, []);

  function refreshProfiles(): void {
    setProfiles(listStoredProfiles());
  }

  function handleSelectProfile(profileId: string): void {
    const ok = setActiveProfile(profileId);
    if (!ok) {
      setError("Could not select profile. Try again.");
      return;
    }
    router.push("/dashboard");
  }

  function handleCreateProfile(): void {
    setError(null);
    const name = newProfileName.trim();
    if (!name) {
      setError("Profile name is required.");
      return;
    }

    createStoredProfile(name);
    refreshProfiles();
    router.push("/dashboard");
  }

  return (
    <div className="relative min-h-[calc(100vh-5rem)] overflow-hidden rounded-2xl border border-slate-200">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('./login-track.svg')" }}
      />
      <div className="absolute inset-0 bg-slate-950/55" />

      <div className="relative z-10 flex min-h-[calc(100vh-5rem)] items-center justify-center p-6 md:p-10">
        <section className="w-full max-w-2xl rounded-2xl border border-white/20 bg-slate-950/75 p-6 text-white shadow-2xl backdrop-blur-sm md:p-8">
          <p className="text-xs uppercase tracking-[0.22em] text-teal-200">VDOT Coach</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Select Profile</h1>
          <p className="mt-2 text-sm text-slate-200">
            Choose an existing runner profile or create a new one to enter your dashboard.
          </p>

          {profiles.length > 0 ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {profiles.map((profile) => (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => handleSelectProfile(profile.id)}
                  className="rounded-xl border border-white/20 bg-white/10 p-4 text-left transition hover:bg-white/20"
                >
                  <p className="flex items-center gap-2 text-lg font-medium">
                    <span>{profile.appearance.icon}</span>
                    <span>{profile.name}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-200">
                    {profile.hasPlan ? "Has plan" : "No plan yet"} | {profile.hasRunnerProfile ? "Profile set" : "Setup needed"}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-6 rounded-md border border-amber-300/50 bg-amber-200/15 px-3 py-2 text-sm text-amber-100">
              No profiles yet. Create your first profile to continue.
            </p>
          )}

          <div className="mt-5 border-t border-white/20 pt-5">
            {profiles.length > 0 && !showCreate ? (
              <button type="button" className="btn-primary" onClick={() => setShowCreate(true)}>
                New Profile
              </button>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className="input bg-white/90 text-slate-900"
                  value={newProfileName}
                  onChange={(event) => setNewProfileName(event.target.value)}
                  placeholder="Runner name"
                />
                <button type="button" className="btn-primary sm:w-auto" onClick={handleCreateProfile}>
                  Create Profile
                </button>
              </div>
            )}
          </div>

          {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
        </section>
      </div>
    </div>
  );
}
