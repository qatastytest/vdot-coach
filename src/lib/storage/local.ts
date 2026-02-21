import { BaselineSnapshot, RaceGoal, RunnerProfile } from "@/lib/domain/models";
import { TrainingPlanOutput } from "@/lib/plan";

const LEGACY_KEYS = {
  baseline: "vdot-coach:baseline",
  profile: "vdot-coach:profile",
  goal: "vdot-coach:goal",
  plan: "vdot-coach:plan"
} as const;

const STATE_KEY = "vdot-coach:profiles-state";

interface StoredProfileRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  profile: RunnerProfile | null;
  baseline: BaselineSnapshot | null;
  goal: RaceGoal | null;
  plan: TrainingPlanOutput | null;
}

interface ProfilesState {
  version: 1;
  activeProfileId: string | null;
  profiles: StoredProfileRecord[];
}

export interface StoredProfileSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  hasRunnerProfile: boolean;
  hasPlan: boolean;
}

function safeRead<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeWrite<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function safeRemove(key: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

function nowIso(): string {
  return new Date().toISOString();
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

function toSummary(record: StoredProfileRecord): StoredProfileSummary {
  return {
    id: record.id,
    name: record.name,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    hasRunnerProfile: Boolean(record.profile),
    hasPlan: Boolean(record.plan)
  };
}

function migrateFromLegacyIfNeeded(): ProfilesState {
  const existing = safeRead<ProfilesState>(STATE_KEY);
  if (existing && existing.version === 1 && Array.isArray(existing.profiles)) {
    return existing;
  }

  const legacyProfile = safeRead<RunnerProfile>(LEGACY_KEYS.profile);
  const legacyBaseline = safeRead<BaselineSnapshot>(LEGACY_KEYS.baseline);
  const legacyGoal = safeRead<RaceGoal>(LEGACY_KEYS.goal);
  const legacyPlan = safeRead<TrainingPlanOutput>(LEGACY_KEYS.plan);

  const hasLegacyData = Boolean(legacyProfile || legacyBaseline || legacyGoal || legacyPlan);
  const migratedProfile: StoredProfileRecord | null = hasLegacyData
    ? {
        id: createId(),
        name: "My Profile",
        createdAt: nowIso(),
        updatedAt: nowIso(),
        profile: legacyProfile,
        baseline: legacyBaseline,
        goal: legacyGoal,
        plan: legacyPlan
      }
    : null;

  const nextState: ProfilesState = {
    version: 1,
    activeProfileId: migratedProfile ? migratedProfile.id : null,
    profiles: migratedProfile ? [migratedProfile] : []
  };

  safeWrite(STATE_KEY, nextState);

  if (hasLegacyData) {
    safeRemove(LEGACY_KEYS.profile);
    safeRemove(LEGACY_KEYS.baseline);
    safeRemove(LEGACY_KEYS.goal);
    safeRemove(LEGACY_KEYS.plan);
  }

  return nextState;
}

function readState(): ProfilesState {
  return migrateFromLegacyIfNeeded();
}

function writeState(state: ProfilesState): void {
  safeWrite(STATE_KEY, state);
}

function getActiveRecord(state: ProfilesState): StoredProfileRecord | null {
  if (!state.activeProfileId) return null;
  return state.profiles.find((profile) => profile.id === state.activeProfileId) ?? null;
}

function updateActiveRecord(
  updater: (record: StoredProfileRecord) => StoredProfileRecord
): boolean {
  const state = readState();
  const active = getActiveRecord(state);
  if (!active) return false;

  const updated = updater(active);
  const nextState: ProfilesState = {
    ...state,
    profiles: state.profiles.map((profile) => (profile.id === active.id ? updated : profile))
  };
  writeState(nextState);
  return true;
}

export function listStoredProfiles(): StoredProfileSummary[] {
  return readState().profiles.map(toSummary);
}

export function getActiveProfileId(): string | null {
  return readState().activeProfileId;
}

export function getActiveProfileSummary(): StoredProfileSummary | null {
  const active = getActiveRecord(readState());
  return active ? toSummary(active) : null;
}

export function createStoredProfile(name: string): StoredProfileSummary {
  const trimmed = name.trim();
  const safeName = trimmed.length > 0 ? trimmed : "New Profile";
  const timestamp = nowIso();
  const record: StoredProfileRecord = {
    id: createId(),
    name: safeName,
    createdAt: timestamp,
    updatedAt: timestamp,
    profile: null,
    baseline: null,
    goal: null,
    plan: null
  };

  const state = readState();
  const nextState: ProfilesState = {
    ...state,
    activeProfileId: record.id,
    profiles: [...state.profiles, record]
  };
  writeState(nextState);
  return toSummary(record);
}

export function setActiveProfile(profileId: string): boolean {
  const state = readState();
  const found = state.profiles.some((profile) => profile.id === profileId);
  if (!found) return false;
  writeState({ ...state, activeProfileId: profileId });
  return true;
}

export function clearActiveProfile(): void {
  const state = readState();
  writeState({ ...state, activeProfileId: null });
}

export function renameStoredProfile(profileId: string, nextName: string): boolean {
  const state = readState();
  const normalized = nextName.trim();
  if (!normalized) return false;
  const found = state.profiles.some((profile) => profile.id === profileId);
  if (!found) return false;

  const nextState: ProfilesState = {
    ...state,
    profiles: state.profiles.map((profile) =>
      profile.id === profileId
        ? {
            ...profile,
            name: normalized,
            updatedAt: nowIso()
          }
        : profile
    )
  };
  writeState(nextState);
  return true;
}

export function deleteStoredProfile(profileId: string): boolean {
  const state = readState();
  const remaining = state.profiles.filter((profile) => profile.id !== profileId);
  if (remaining.length === state.profiles.length) return false;

  const nextActive =
    state.activeProfileId === profileId ? (remaining.length > 0 ? remaining[0].id : null) : state.activeProfileId;

  writeState({
    ...state,
    activeProfileId: nextActive,
    profiles: remaining
  });
  return true;
}

export function getStoredBaseline(): BaselineSnapshot | null {
  return getActiveRecord(readState())?.baseline ?? null;
}

export function setStoredBaseline(baseline: BaselineSnapshot): boolean {
  return updateActiveRecord((record) => ({
    ...record,
    baseline,
    updatedAt: nowIso()
  }));
}

export function getStoredProfile(): RunnerProfile | null {
  return getActiveRecord(readState())?.profile ?? null;
}

export function setStoredProfile(profile: RunnerProfile): boolean {
  return updateActiveRecord((record) => ({
    ...record,
    profile,
    updatedAt: nowIso()
  }));
}

export function getStoredGoal(): RaceGoal | null {
  return getActiveRecord(readState())?.goal ?? null;
}

export function setStoredGoal(goal: RaceGoal): boolean {
  return updateActiveRecord((record) => ({
    ...record,
    goal,
    updatedAt: nowIso()
  }));
}

export function getStoredPlan(): TrainingPlanOutput | null {
  return getActiveRecord(readState())?.plan ?? null;
}

export function setStoredPlan(plan: TrainingPlanOutput): boolean {
  return updateActiveRecord((record) => ({
    ...record,
    plan,
    updatedAt: nowIso()
  }));
}
