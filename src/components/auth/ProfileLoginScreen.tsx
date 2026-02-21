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
    <div className="relative min-h-screen w-full overflow-hidden">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/login-track.svg')" }} />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/70 via-slate-900/55 to-slate-900/70" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-10 md:px-10">
        <section className="w-full rounded-3xl border border-white/20 bg-slate-950/72 p-6 text-white shadow-2xl backdrop-blur-sm md:p-8">
          <p className="text-xs uppercase tracking-[0.22em] text-teal-200">VDOT Coach</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">Choose Runner Profile</h1>
          <p className="mt-2 text-sm text-slate-200">
            Select a profile to continue to your dashboard. Create a new one for a fresh training setup.
          </p>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => handleSelectProfile(profile.id)}
                className="group aspect-square rounded-2xl border border-white/25 bg-white/10 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/20"
              >
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between">
                    <span className="text-3xl">{profile.appearance.icon}</span>
                    <span className="rounded-full bg-white/20 px-2 py-0.5 text-[11px]">
                      {profile.hasPlan ? "plan active" : "new"}
                    </span>
                  </div>
                  <div className="mt-auto">
                    <p className="text-xl font-semibold">{profile.name}</p>
                    <p className="mt-1 text-xs text-slate-200">
                      {profile.hasRunnerProfile ? "profile complete" : "setup pending"}
                    </p>
                    <p className="mt-2 text-xs text-slate-300 group-hover:text-white">Enter dashboard</p>
                  </div>
                </div>
              </button>
            ))}

            <button
              type="button"
              onClick={() => setShowCreate((prev) => !prev)}
              className="aspect-square rounded-2xl border border-dashed border-white/45 bg-white/10 p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/20"
            >
              <div className="flex h-full flex-col">
                <div className="text-4xl leading-none">+</div>
                <div className="mt-auto">
                  <p className="text-xl font-semibold">New Profile</p>
                  <p className="mt-1 text-xs text-slate-200">Create another runner slot</p>
                </div>
              </div>
            </button>
          </div>

          {(showCreate || profiles.length === 0) && (
            <div className="mt-6 rounded-xl border border-white/25 bg-white/10 p-4">
              <p className="text-sm font-medium">Create profile</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  className="input bg-white/95 text-slate-900"
                  value={newProfileName}
                  onChange={(event) => setNewProfileName(event.target.value)}
                  placeholder="Runner name"
                />
                <button type="button" className="btn-primary sm:w-auto" onClick={handleCreateProfile}>
                  Create
                </button>
              </div>
            </div>
          )}

          {error ? <p className="mt-3 text-sm text-rose-200">{error}</p> : null}
        </section>
      </div>
    </div>
  );
}
