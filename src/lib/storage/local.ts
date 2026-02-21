import { BaselineSnapshot, RaceGoal, RunnerProfile } from "@/lib/domain/models";
import { PlannedWorkout, TrainingPlanOutput, WorkoutStatus } from "@/lib/plan";

const LEGACY_KEYS = {
  baseline: "vdot-coach:baseline",
  profile: "vdot-coach:profile",
  goal: "vdot-coach:goal",
  plan: "vdot-coach:plan"
} as const;

const STATE_KEY = "vdot-coach:profiles-state";

export const PROFILE_ICON_PRESETS = ["🏃", "⚡", "🔥", "🌿", "🏔️", "🎯"] as const;
export const PROFILE_COLOR_PRESETS = [
  "bg-teal-600",
  "bg-blue-600",
  "bg-rose-600",
  "bg-amber-600",
  "bg-indigo-600",
  "bg-emerald-600"
] as const;
export const PROFILE_THEME_PRESETS = ["classic", "ocean", "sunrise", "forest"] as const;

export type ProfileTheme = (typeof PROFILE_THEME_PRESETS)[number];

export interface ProfileAppearance {
  icon: string;
  cardColor: string;
  theme: ProfileTheme;
  description: string;
  fiveKTimeSeconds?: number;
}

interface StoredProfileRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  appearance: ProfileAppearance;
  profile: RunnerProfile | null;
  baseline: BaselineSnapshot | null;
  goal: RaceGoal | null;
  plan: TrainingPlanOutput | null;
}

interface ProfilesState {
  version: 2;
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
  appearance: ProfileAppearance;
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

function createId(prefix = "p"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

function defaultAppearance(seed = 0): ProfileAppearance {
  return {
    icon: PROFILE_ICON_PRESETS[seed % PROFILE_ICON_PRESETS.length],
    cardColor: PROFILE_COLOR_PRESETS[seed % PROFILE_COLOR_PRESETS.length],
    theme: "classic",
    description: "",
    fiveKTimeSeconds: undefined
  };
}

function normalizePlan(plan: TrainingPlanOutput | null): TrainingPlanOutput | null {
  if (!plan) return null;
  return {
    ...plan,
    id: plan.id ?? createId("plan"),
    replanCount: plan.replanCount ?? 0,
    weeks: Array.isArray(plan.weeks)
      ? plan.weeks.map((week) => ({
          ...week,
          workouts: Array.isArray(week.workouts)
            ? week.workouts.map((workout) => ({
                ...workout,
                status: workout.status ?? "planned"
              }))
            : []
        }))
      : []
  };
}

function normalizeProfileRecord(raw: Partial<StoredProfileRecord>, index: number): StoredProfileRecord {
  return {
    id: raw.id ?? createId(),
    name: raw.name?.trim() || "Profile",
    createdAt: raw.createdAt ?? nowIso(),
    updatedAt: raw.updatedAt ?? nowIso(),
    appearance: {
      ...defaultAppearance(index),
      ...(raw.appearance ?? {})
    },
    profile: raw.profile ?? null,
    baseline: raw.baseline ?? null,
    goal: raw.goal ?? null,
    plan: normalizePlan(raw.plan ?? null)
  };
}

function toSummary(record: StoredProfileRecord): StoredProfileSummary {
  return {
    id: record.id,
    name: record.name,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    hasRunnerProfile: Boolean(record.profile),
    hasPlan: Boolean(record.plan),
    appearance: record.appearance
  };
}

function migrateFromLegacyIfNeeded(): ProfilesState {
  const existing = safeRead<Partial<ProfilesState>>(STATE_KEY);
  if (existing && Array.isArray(existing.profiles)) {
    const normalizedProfiles = existing.profiles.map((profile, index) =>
      normalizeProfileRecord(profile as Partial<StoredProfileRecord>, index)
    );
    const activeExists = normalizedProfiles.some((profile) => profile.id === existing.activeProfileId);
    const normalizedState: ProfilesState = {
      version: 2,
      activeProfileId: activeExists
        ? existing.activeProfileId ?? null
        : normalizedProfiles.length > 0
          ? normalizedProfiles[0].id
          : null,
      profiles: normalizedProfiles
    };
    safeWrite(STATE_KEY, normalizedState);
    return normalizedState;
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
        appearance: defaultAppearance(0),
        profile: legacyProfile,
        baseline: legacyBaseline,
        goal: legacyGoal,
        plan: normalizePlan(legacyPlan)
      }
    : null;

  const nextState: ProfilesState = {
    version: 2,
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

export function getStoredProfileById(profileId: string): StoredProfileSummary | null {
  const profile = readState().profiles.find((item) => item.id === profileId);
  return profile ? toSummary(profile) : null;
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
  const state = readState();
  const record: StoredProfileRecord = {
    id: createId(),
    name: safeName,
    createdAt: timestamp,
    updatedAt: timestamp,
    appearance: defaultAppearance(state.profiles.length),
    profile: null,
    baseline: null,
    goal: null,
    plan: null
  };

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

export function updateStoredProfileAppearance(
  profileId: string,
  appearancePatch: Partial<ProfileAppearance>
): boolean {
  const state = readState();
  const found = state.profiles.some((profile) => profile.id === profileId);
  if (!found) return false;

  const nextState: ProfilesState = {
    ...state,
    profiles: state.profiles.map((profile) =>
      profile.id === profileId
        ? {
            ...profile,
            updatedAt: nowIso(),
            appearance: {
              ...profile.appearance,
              ...appearancePatch
            }
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
    plan: normalizePlan(plan),
    updatedAt: nowIso()
  }));
}

export function mutateStoredPlan(
  mutator: (currentPlan: TrainingPlanOutput) => TrainingPlanOutput
): boolean {
  return updateActiveRecord((record) => {
    if (!record.plan) return record;
    const nextPlan = normalizePlan(mutator(record.plan));
    return {
      ...record,
      plan: nextPlan,
      updatedAt: nowIso()
    };
  });
}

export function updateStoredWorkout(
  weekIndex: number,
  workoutIndex: number,
  updates: Partial<PlannedWorkout>
): boolean {
  return mutateStoredPlan((currentPlan) => {
    const weeks = currentPlan.weeks.map((week, currentWeekIndex) => {
      if (currentWeekIndex !== weekIndex) return week;
      const workouts = week.workouts.map((workout, currentWorkoutIndex) => {
        if (currentWorkoutIndex !== workoutIndex) return workout;
        return {
          ...workout,
          ...updates,
          lastEditedAt: nowIso(),
          isEdited: true
        };
      });
      return { ...week, workouts };
    });
    return { ...currentPlan, weeks };
  });
}

export function setStoredWorkoutStatus(
  weekIndex: number,
  workoutIndex: number,
  status: WorkoutStatus,
  payload?: {
    actualSummary?: string;
    actualDistanceKm?: number;
    actualRpe?: string;
    actualNotes?: string;
  }
): boolean {
  return updateStoredWorkout(weekIndex, workoutIndex, {
    status,
    completedAt: status === "planned" ? undefined : nowIso(),
    actualSummary: payload?.actualSummary,
    actualDistanceKm: payload?.actualDistanceKm,
    actualRpe: payload?.actualRpe,
    actualNotes: payload?.actualNotes
  });
}
