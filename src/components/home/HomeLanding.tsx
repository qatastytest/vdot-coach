"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  assessPerformanceConfidence,
  buildCoachingNotes,
  buildRacePredictions,
  calculateVdotFromPerformance,
  deriveTrainingPaces,
  formatTime,
  parseTimeToSeconds
} from "@/lib/core";
import { BaselineSnapshot, RaceGoal, RunnerProfile } from "@/lib/domain/models";
import { generateTrainingPlan, refreshTrainingPlanFromFeedback, TrainingPlanOutput } from "@/lib/plan";
import {
  PROFILE_COLOR_PRESETS,
  PROFILE_ICON_PRESETS,
  PROFILE_THEME_PRESETS,
  getActiveProfileSummary,
  getStoredBaseline,
  getStoredGoal,
  getStoredPlan,
  getStoredProfile,
  setStoredBaseline,
  setStoredGoal,
  setStoredPlan,
  setStoredProfile,
  setStoredWorkoutStatus,
  updateStoredProfileAppearance
} from "@/lib/storage/local";
import {
  PerformanceFormValues,
  RaceGoalFormValues,
  RunnerProfileFormValues,
  performanceFormSchema,
  raceGoalSchema,
  runnerProfileSchema
} from "@/lib/validation/schemas";
import { InfoTip } from "@/components/ui/InfoTip";

const DAY_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

interface ProfileCardEditForm {
  icon: string;
  cardColor: string;
  theme: string;
  description: string;
  fiveKTime: string;
}

interface CalendarEntry {
  date: Date;
  dayName: (typeof DAY_ORDER)[number];
  weekIndex: number;
  workoutIndex: number | null;
  isRest: boolean;
  label: string;
}

const DEFAULT_PROFILE_FORM: RunnerProfileFormValues = {
  age: "",
  weeklyKmCurrent: 35,
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

const DEFAULT_PERFORMANCE_FORM: PerformanceFormValues = {
  distanceMeters: 5000,
  time: "25:00",
  date: new Date().toISOString().slice(0, 10),
  eventType: "test",
  effortType: "hard",
  surface: "road",
  elevationGainM: "",
  temperatureC: "",
  windKph: ""
};

const DEFAULT_GOAL_FORM: RaceGoalFormValues = {
  goalDistance: "10k",
  targetDate: "",
  targetTime: "",
  ambition: "realistic_pb",
  daysPerWeek: 4,
  longRunDay: "Sunday",
  trackAccess: true,
  planLengthWeeks: 12
};

const THEME_ACCENTS: Record<(typeof PROFILE_THEME_PRESETS)[number], string> = {
  classic: "from-teal-600 to-cyan-600",
  ocean: "from-blue-600 to-sky-600",
  sunrise: "from-amber-500 to-rose-500",
  forest: "from-emerald-600 to-lime-600"
};

function optionalNumber(value: number | "" | undefined): number | undefined {
  return value === "" || value === undefined ? undefined : value;
}

function formatDateLabel(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function parseDate(dateString: string): Date {
  return new Date(`${dateString}T12:00:00`);
}

function cleanText(value: string): string {
  return value.replaceAll("â€¢", "-").replaceAll("â€“", "-").replaceAll("â€”", "-").replaceAll("Â", " ");
}

function statusClass(status: "planned" | "done" | "skipped"): string {
  if (status === "done") return "bg-emerald-100 text-emerald-800";
  if (status === "skipped") return "bg-rose-100 text-rose-800";
  return "bg-slate-100 text-slate-700";
}

function buildCalendarEntries(plan: TrainingPlanOutput, goal: RaceGoal): CalendarEntry[] {
  const totalDays = plan.durationWeeks * 7;
  const targetDate = parseDate(goal.targetDate);
  const startDate = addDays(targetDate, -(totalDays - 1));
  const entries: CalendarEntry[] = [];

  for (let weekIndex = 0; weekIndex < plan.weeks.length; weekIndex += 1) {
    const week = plan.weeks[weekIndex];
    for (let dayIndex = 0; dayIndex < DAY_ORDER.length; dayIndex += 1) {
      const dayName = DAY_ORDER[dayIndex];
      const workoutIndex = week.workouts.findIndex((workout) => workout.day === dayName);
      const date = addDays(startDate, weekIndex * 7 + dayIndex);
      entries.push({
        date,
        dayName,
        weekIndex,
        workoutIndex: workoutIndex >= 0 ? workoutIndex : null,
        isRest: workoutIndex < 0,
        label: formatDateLabel(date)
      });
    }
  }

  return entries;
}

export function HomeLanding(): React.JSX.Element {
  const [activeProfile, setActiveProfile] = useState<ReturnType<typeof getActiveProfileSummary>>(null);
  const [profile, setProfile] = useState<RunnerProfile | null>(null);
  const [baseline, setBaseline] = useState<BaselineSnapshot | null>(null);
  const [goal, setGoal] = useState<RaceGoal | null>(null);
  const [plan, setPlan] = useState<TrainingPlanOutput | null>(null);

  const [editingCard, setEditingCard] = useState(false);
  const [editForm, setEditForm] = useState<ProfileCardEditForm | null>(null);

  const [profileForm, setProfileForm] = useState<RunnerProfileFormValues>(DEFAULT_PROFILE_FORM);
  const [performanceForm, setPerformanceForm] = useState<PerformanceFormValues>(DEFAULT_PERFORMANCE_FORM);
  const [goalForm, setGoalForm] = useState<RaceGoalFormValues>(DEFAULT_GOAL_FORM);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function refreshFromStorage(): void {
    const active = getActiveProfileSummary();
    const storedProfile = getStoredProfile();
    const storedBaseline = getStoredBaseline();
    const storedGoal = getStoredGoal();
    const storedPlan = getStoredPlan();

    setActiveProfile(active);
    setProfile(storedProfile);
    setBaseline(storedBaseline);
    setGoal(storedGoal);
    setPlan(storedPlan);

    if (active) {
      setEditForm({
        icon: active.appearance.icon,
        cardColor: active.appearance.cardColor,
        theme: active.appearance.theme,
        description: active.appearance.description,
        fiveKTime: active.appearance.fiveKTimeSeconds ? formatTime(active.appearance.fiveKTimeSeconds) : ""
      });
    }
  }

  useEffect(() => {
    refreshFromStorage();
  }, []);

  const needsProfileSetup = !profile;
  const needsBaselineSetup = Boolean(profile) && !baseline;
  const needsGoalSetup = Boolean(profile && baseline) && (!goal || !plan);
  const needsOnboarding = needsProfileSetup || needsBaselineSetup || needsGoalSetup;

  const calendarEntries = useMemo(() => {
    if (!plan || !goal) return [];
    return buildCalendarEntries(plan, goal);
  }, [goal, plan]);

  const calendarLookup = useMemo(() => {
    const map = new Map<string, CalendarEntry>();
    for (const entry of calendarEntries) map.set(`${entry.weekIndex}-${entry.dayName}`, entry);
    return map;
  }, [calendarEntries]);

  const progress = useMemo(() => {
    if (!plan) return null;
    let total = 0;
    let done = 0;
    let skipped = 0;
    for (const week of plan.weeks) {
      for (const workout of week.workouts) {
        total += 1;
        if (workout.status === "done") done += 1;
        if (workout.status === "skipped") skipped += 1;
      }
    }
    return { total, done, skipped, remaining: total - done - skipped };
  }, [plan]);

  const nextWorkout = useMemo(() => {
    if (!plan) return null;
    for (let weekIndex = 0; weekIndex < plan.weeks.length; weekIndex += 1) {
      const week = plan.weeks[weekIndex];
      for (let workoutIndex = 0; workoutIndex < week.workouts.length; workoutIndex += 1) {
        const workout = week.workouts[workoutIndex];
        if (workout.status === "planned") return { weekIndex, workoutIndex, week, workout };
      }
    }
    return null;
  }, [plan]);

  function patchEditForm(patch: Partial<ProfileCardEditForm>): void {
    setEditForm((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function saveCardEdits(): void {
    if (!activeProfile || !editForm) return;
    let fiveKTimeSeconds: number | undefined;
    if (editForm.fiveKTime.trim()) {
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

    setEditingCard(false);
    setError(null);
    setMessage("Profile card updated.");
    refreshFromStorage();
  }

  function saveRunnerProfile(): void {
    const parsed = runnerProfileSchema.safeParse(profileForm);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid runner profile input.");
      return;
    }

    const saved = setStoredProfile({
      age: optionalNumber(parsed.data.age),
      weeklyKmCurrent: parsed.data.weeklyKmCurrent,
      weeklyKmMaxTolerated: parsed.data.weeklyKmMaxTolerated,
      daysPerWeekAvailable: parsed.data.daysPerWeekAvailable as 3 | 4 | 5 | 6,
      preferredLongRunDay: parsed.data.preferredLongRunDay,
      maxHr: optionalNumber(parsed.data.maxHr),
      restingHr: optionalNumber(parsed.data.restingHr),
      lthr: optionalNumber(parsed.data.lthr),
      experienceLevel: parsed.data.experienceLevel,
      injuryNotes: parsed.data.injuryNotes,
      preferredUnits: parsed.data.preferredUnits
    });

    if (!saved) {
      setError("Could not save runner profile.");
      return;
    }

    setError(null);
    setMessage("Step 1 complete.");
    refreshFromStorage();
  }

  function saveBaselinePerformance(): void {
    const parsed = performanceFormSchema.safeParse(performanceForm);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid performance input.");
      return;
    }

    const performance = {
      distanceMeters: parsed.data.distanceMeters,
      timeSeconds: parseTimeToSeconds(parsed.data.time),
      date: parsed.data.date,
      eventType: parsed.data.eventType,
      effortType: parsed.data.effortType,
      surface: parsed.data.surface,
      elevationGainM: optionalNumber(parsed.data.elevationGainM),
      temperatureC: optionalNumber(parsed.data.temperatureC),
      windKph: optionalNumber(parsed.data.windKph)
    };

    const vdot = calculateVdotFromPerformance(performance.distanceMeters, performance.timeSeconds);
    const confidence = assessPerformanceConfidence(performance);
    const baselineSnapshot: BaselineSnapshot = {
      performance,
      vdot: vdot.roundedVdot,
      confidence,
      predictions: buildRacePredictions(vdot.vdot),
      paces: deriveTrainingPaces(vdot.vdot),
      coachingNotes: buildCoachingNotes(confidence)
    };

    const saved = setStoredBaseline(baselineSnapshot);
    if (!saved) {
      setError("Could not save baseline performance.");
      return;
    }

    setError(null);
    setMessage("Step 2 complete.");
    refreshFromStorage();
  }

  function saveGoalAndPlan(): void {
    const parsed = raceGoalSchema.safeParse(goalForm);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid goal input.");
      return;
    }

    const currentProfile = getStoredProfile();
    const currentBaseline = getStoredBaseline();
    if (!currentProfile || !currentBaseline) {
      setError("Profile and baseline are required before goal setup.");
      return;
    }

    const nextGoal: RaceGoal = {
      goalDistance: parsed.data.goalDistance,
      targetDate: parsed.data.targetDate,
      targetTimeSeconds:
        parsed.data.targetTime && parsed.data.targetTime.trim() !== ""
          ? parseTimeToSeconds(parsed.data.targetTime)
          : undefined,
      ambition: parsed.data.ambition,
      daysPerWeek: parsed.data.daysPerWeek as 3 | 4 | 5 | 6,
      longRunDay: parsed.data.longRunDay,
      trackAccess: parsed.data.trackAccess,
      planLengthWeeks: parsed.data.planLengthWeeks
    };

    const nextPlan = generateTrainingPlan({
      profile: currentProfile,
      goal: nextGoal,
      paces: currentBaseline.paces
    });

    const goalSaved = setStoredGoal(nextGoal);
    const planSaved = setStoredPlan(nextPlan);
    if (!goalSaved || !planSaved) {
      setError("Could not save goal and plan.");
      return;
    }

    setError(null);
    setMessage("Step 3 complete.");
    refreshFromStorage();
  }

  function updateWorkoutFromCalendar(
    weekIndex: number,
    workoutIndex: number,
    status: "planned" | "done" | "skipped"
  ): void {
    const ok = setStoredWorkoutStatus(weekIndex, workoutIndex, status, {
      actualSummary:
        status === "done"
          ? "Completed from calendar."
          : status === "skipped"
            ? "Skipped from calendar."
            : "Back to planned."
    });
    if (!ok) {
      setError("Could not update workout status.");
      return;
    }

    setError(null);
    setMessage("Workout status updated.");
    refreshFromStorage();
  }

  function refreshFutureWorkouts(): void {
    const currentPlan = getStoredPlan();
    const currentProfile = getStoredProfile();
    const currentGoal = getStoredGoal();
    const currentBaseline = getStoredBaseline();

    if (!currentPlan || !currentProfile || !currentGoal) {
      setError("Need profile, goal, and plan before refresh.");
      return;
    }

    const refreshed = refreshTrainingPlanFromFeedback({
      existingPlan: currentPlan,
      profile: currentProfile,
      goal: currentGoal,
      paces: currentBaseline?.paces
    });

    const saved = setStoredPlan(refreshed);
    if (!saved) {
      setError("Could not refresh plan.");
      return;
    }

    setError(null);
    setMessage("Future workouts refreshed. Completed/skipped sessions were kept.");
    refreshFromStorage();
  }

  if (!activeProfile) {
    return (
      <section className="panel">
        <h2 className="h2">No Active Profile</h2>
        <p className="muted mt-2">Select or create a profile in login.</p>
        <Link href="/" className="btn-primary mt-4">
          Go to Login
        </Link>
      </section>
    );
  }

  if (needsOnboarding) {
    return (
      <div className="space-y-5">
        <section className="panel">
          <h1 className="h2">Welcome, {activeProfile.name}</h1>
          <p className="muted mt-1">Complete setup cards one by one.</p>
        </section>

        {needsProfileSetup ? (
          <section className="panel animate-card-enter">
            <h2 className="text-lg font-semibold">Step 1/3: Runner Profile</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label><span className="label">Age</span><input className="input" type="number" value={profileForm.age} onChange={(e) => setProfileForm((p) => ({ ...p, age: e.target.value === "" ? "" : Number(e.target.value) }))} /></label>
              <label><span className="label">Current Weekly km</span><input className="input" type="number" value={profileForm.weeklyKmCurrent} onChange={(e) => setProfileForm((p) => ({ ...p, weeklyKmCurrent: Number(e.target.value) }))} /></label>
              <label><span className="label">Max Weekly km</span><input className="input" type="number" value={profileForm.weeklyKmMaxTolerated} onChange={(e) => setProfileForm((p) => ({ ...p, weeklyKmMaxTolerated: Number(e.target.value) }))} /></label>
              <label><span className="label">Days Available</span><select className="input" value={profileForm.daysPerWeekAvailable} onChange={(e) => setProfileForm((p) => ({ ...p, daysPerWeekAvailable: Number(e.target.value) as 3 | 4 | 5 | 6 }))}><option value={3}>3</option><option value={4}>4</option><option value={5}>5</option><option value={6}>6</option></select></label>
              <label><span className="label">Long Run Day</span><select className="input" value={profileForm.preferredLongRunDay} onChange={(e) => setProfileForm((p) => ({ ...p, preferredLongRunDay: e.target.value as RunnerProfile["preferredLongRunDay"] }))}>{DAY_ORDER.map((day) => <option key={day} value={day}>{day}</option>)}</select></label>
              <label>
                <span className="label flex items-center gap-1">Resting HR <InfoTip title="Resting HR" content="Measure in the morning over multiple days and average." /></span>
                <input className="input" type="number" value={profileForm.restingHr} onChange={(e) => setProfileForm((p) => ({ ...p, restingHr: e.target.value === "" ? "" : Number(e.target.value) }))} />
              </label>
              <label>
                <span className="label flex items-center gap-1">LTHR <InfoTip title="LTHR" content="Final 20 minutes average HR from a hard 30-minute time trial." /></span>
                <input className="input" type="number" value={profileForm.lthr} onChange={(e) => setProfileForm((p) => ({ ...p, lthr: e.target.value === "" ? "" : Number(e.target.value) }))} />
              </label>
              <label><span className="label">Experience</span><select className="input" value={profileForm.experienceLevel} onChange={(e) => setProfileForm((p) => ({ ...p, experienceLevel: e.target.value as RunnerProfile["experienceLevel"] }))}><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label>
            </div>
            <button type="button" className="btn-primary mt-4" onClick={saveRunnerProfile}>Save Step 1</button>
          </section>
        ) : null}

        {!needsProfileSetup && needsBaselineSetup ? (
          <section className="panel animate-card-enter">
            <h2 className="text-lg font-semibold">Step 2/3: Baseline Performance</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label><span className="label">Distance (m)</span><input className="input" type="number" value={performanceForm.distanceMeters} onChange={(e) => setPerformanceForm((p) => ({ ...p, distanceMeters: Number(e.target.value) }))} /></label>
              <label><span className="label">Time</span><input className="input" value={performanceForm.time} onChange={(e) => setPerformanceForm((p) => ({ ...p, time: e.target.value }))} /></label>
              <label><span className="label">Date</span><input className="input" type="date" value={performanceForm.date} onChange={(e) => setPerformanceForm((p) => ({ ...p, date: e.target.value }))} /></label>
              <label><span className="label">Event Type</span><select className="input" value={performanceForm.eventType} onChange={(e) => setPerformanceForm((p) => ({ ...p, eventType: e.target.value as PerformanceFormValues["eventType"] }))}><option value="race">Race</option><option value="test">Test</option></select></label>
              <label><span className="label">Effort</span><select className="input" value={performanceForm.effortType} onChange={(e) => setPerformanceForm((p) => ({ ...p, effortType: e.target.value as PerformanceFormValues["effortType"] }))}><option value="all_out">All out</option><option value="hard">Hard</option><option value="controlled">Controlled</option></select></label>
              <label><span className="label">Surface</span><select className="input" value={performanceForm.surface} onChange={(e) => setPerformanceForm((p) => ({ ...p, surface: e.target.value as PerformanceFormValues["surface"] }))}><option value="track">Track</option><option value="road">Road</option><option value="trail">Trail</option><option value="mixed">Mixed</option></select></label>
            </div>
            <button type="button" className="btn-primary mt-4" onClick={saveBaselinePerformance}>Save Step 2</button>
          </section>
        ) : null}

        {!needsProfileSetup && !needsBaselineSetup && needsGoalSetup ? (
          <section className="panel animate-card-enter">
            <h2 className="text-lg font-semibold">Step 3/3: Goal and Plan</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <label><span className="label">Goal Distance</span><select className="input" value={goalForm.goalDistance} onChange={(e) => setGoalForm((p) => ({ ...p, goalDistance: e.target.value as RaceGoal["goalDistance"] }))}><option value="5k">5K</option><option value="10k">10K</option><option value="half">Half Marathon</option></select></label>
              <label><span className="label">Target Date</span><input className="input" type="date" value={goalForm.targetDate} onChange={(e) => setGoalForm((p) => ({ ...p, targetDate: e.target.value }))} /></label>
              <label><span className="label">Target Time</span><input className="input" value={goalForm.targetTime} onChange={(e) => setGoalForm((p) => ({ ...p, targetTime: e.target.value }))} /></label>
              <label><span className="label">Ambition</span><select className="input" value={goalForm.ambition} onChange={(e) => setGoalForm((p) => ({ ...p, ambition: e.target.value as RaceGoal["ambition"] }))}><option value="finish">Finish</option><option value="realistic_pb">Realistic PB</option><option value="aggressive_pb">Aggressive PB</option></select></label>
              <label><span className="label">Days/week</span><select className="input" value={goalForm.daysPerWeek} onChange={(e) => setGoalForm((p) => ({ ...p, daysPerWeek: Number(e.target.value) as 3 | 4 | 5 | 6 }))}><option value={3}>3</option><option value={4}>4</option><option value={5}>5</option><option value={6}>6</option></select></label>
              <label><span className="label">Long Run Day</span><select className="input" value={goalForm.longRunDay} onChange={(e) => setGoalForm((p) => ({ ...p, longRunDay: e.target.value as RaceGoal["longRunDay"] }))}>{DAY_ORDER.map((day) => <option key={day} value={day}>{day}</option>)}</select></label>
              <label><span className="label">Plan Length</span><select className="input" value={goalForm.planLengthWeeks} onChange={(e) => setGoalForm((p) => ({ ...p, planLengthWeeks: Number(e.target.value) as 4 | 8 | 12 | 16 }))}><option value={4}>4 weeks</option><option value={8}>8 weeks</option><option value={12}>12 weeks</option><option value={16}>16 weeks</option></select></label>
              <label className="flex items-center gap-2 pt-8"><input type="checkbox" checked={goalForm.trackAccess} onChange={(e) => setGoalForm((p) => ({ ...p, trackAccess: e.target.checked }))} /><span className="text-sm">Track access</span></label>
            </div>
            <button type="button" className="btn-primary mt-4" onClick={saveGoalAndPlan}>Save Step 3</button>
          </section>
        ) : null}

        {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
      </div>
    );
  }

  const goalLabel = goal?.goalDistance === "half" ? "Half Marathon" : goal?.goalDistance?.toUpperCase() ?? "No goal";
  const confidenceTone = baseline?.confidence.label === "high" ? "bg-emerald-100 text-emerald-800" : baseline?.confidence.label === "medium" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800";

  return (
    <div className="space-y-6">
      <section className={`rounded-2xl bg-gradient-to-br p-6 text-white ${THEME_ACCENTS[activeProfile.appearance.theme]}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm text-white/85">Active profile</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">{activeProfile.appearance.icon} {activeProfile.name}</h1>
            <p className="mt-2 text-sm text-white/90">{activeProfile.appearance.description || "Add description and 5K time from Edit card."}</p>
            {activeProfile.appearance.fiveKTimeSeconds ? <p className="mt-1 text-sm text-white/90">Best 5K: {formatTime(activeProfile.appearance.fiveKTimeSeconds)}</p> : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary border-white/40 bg-white/10 text-white" onClick={() => setEditingCard((v) => !v)}>{editingCard ? "Close card edit" : "Edit card"}</button>
            <Link href="/results" className="btn-secondary border-white/40 bg-white/10 text-white">Results</Link>
            <Link href="/plan" className="btn-secondary border-white/40 bg-white/10 text-white">Training Plan</Link>
          </div>
        </div>
      </section>

      {editingCard && editForm ? (
        <section className="panel">
          <h2 className="text-lg font-semibold">Profile Card Customization</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label>
              <span className="label">Icon</span>
              <div className="flex flex-wrap gap-2">{PROFILE_ICON_PRESETS.map((icon) => <button key={icon} type="button" onClick={() => patchEditForm({ icon })} className={`rounded-md border px-3 py-2 text-xl ${editForm.icon === icon ? "border-accent bg-teal-50" : "border-slate-200 bg-white"}`}>{icon}</button>)}</div>
            </label>
            <label>
              <span className="label">Card Color</span>
              <div className="flex flex-wrap gap-2">{PROFILE_COLOR_PRESETS.map((color) => <button key={color} type="button" onClick={() => patchEditForm({ cardColor: color })} className={`h-8 w-12 rounded-md border ${color} ${editForm.cardColor === color ? "border-slate-900" : "border-slate-200"}`} />)}</div>
            </label>
            <label><span className="label">Theme</span><select className="input" value={editForm.theme} onChange={(e) => patchEditForm({ theme: e.target.value })}>{PROFILE_THEME_PRESETS.map((theme) => <option key={theme} value={theme}>{theme}</option>)}</select></label>
            <label><span className="label">Best 5K</span><input className="input" value={editForm.fiveKTime} onChange={(e) => patchEditForm({ fiveKTime: e.target.value })} placeholder="mm:ss" /></label>
            <label className="md:col-span-2"><span className="label">Description</span><textarea className="input min-h-20" value={editForm.description} onChange={(e) => patchEditForm({ description: e.target.value })} /></label>
          </div>
          <button type="button" className="btn-primary mt-4" onClick={saveCardEdits}>Save Card Style</button>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="panel aspect-square"><p className="text-xs uppercase tracking-wide text-slate-500">Goal</p><p className="mt-2 text-2xl font-semibold">{goalLabel}</p><p className="mt-2 text-sm text-slate-600">{goal ? `Target ${goal.targetDate} - ${goal.planLengthWeeks} weeks` : "Set your goal."}</p><Link href="/goal" className="mt-4 inline-flex text-sm font-medium text-accent">Edit goal</Link></article>
        <article className="panel aspect-square"><p className="text-xs uppercase tracking-wide text-slate-500">VDOT</p><p className="mt-2 text-3xl font-semibold">{baseline ? baseline.vdot.toFixed(1) : "--"}</p>{baseline ? <span className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs ${confidenceTone}`}>{baseline.confidence.label.toUpperCase()} confidence</span> : null}<p className="mt-2 text-sm text-slate-600">{baseline ? cleanText(baseline.confidence.reasons[0] ?? "") : "Add baseline performance."}</p><Link href="/results" className="mt-4 inline-flex text-sm font-medium text-accent">Open results</Link></article>
        <article className="panel aspect-square"><p className="text-xs uppercase tracking-wide text-slate-500">Plan Progress</p><p className="mt-2 text-2xl font-semibold">{progress ? `${progress.done}/${progress.total}` : "No plan"}</p><p className="mt-2 text-sm text-slate-600">{progress ? `${progress.done} done, ${progress.skipped} skipped, ${progress.remaining} remaining` : "Generate and track plan."}</p><button type="button" className="btn-secondary mt-4" onClick={refreshFutureWorkouts}>Refresh from feedback</button></article>
        <article className="panel aspect-square"><p className="text-xs uppercase tracking-wide text-slate-500">Next Workout</p>{nextWorkout ? <><p className="mt-2 text-lg font-semibold">{cleanText(nextWorkout.workout.title)}</p><p className="mt-1 text-sm text-slate-600">Week {nextWorkout.week.weekNumber} - {nextWorkout.workout.day}</p><p className="mt-1 text-sm text-slate-600">{nextWorkout.workout.distanceKm} km</p><Link href={`/plan/${nextWorkout.weekIndex}/${nextWorkout.workoutIndex}`} className="mt-4 inline-flex text-sm font-medium text-accent">View/Edit workout</Link></> : <><p className="mt-2 text-sm text-slate-600">No planned workouts left.</p><Link href="/goal" className="mt-4 inline-flex text-sm font-medium text-accent">Build new plan</Link></>}</article>
      </section>

      <section className="panel">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Training Calendar</h2>
          <p className="text-sm text-slate-600">Done/skip + edit from each day tile. Refresh changes future sessions only.</p>
        </div>

        {!plan || !goal ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">No plan available yet. Complete goal setup first.</div>
        ) : (
          <div className="mt-4 space-y-4">
            {plan.weeks.map((week, weekIndex) => (
              <article key={week.weekNumber} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">Week {week.weekNumber} ({week.phase})</h3>
                  <p className="text-sm text-slate-600">Target volume {week.targetVolumeKm} km</p>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
                  {DAY_ORDER.map((dayName) => {
                    const entry = calendarLookup.get(`${weekIndex}-${dayName}`);
                    if (!entry) return null;

                    if (entry.isRest || entry.workoutIndex === null) {
                      return (
                        <div key={`${weekIndex}-${dayName}`} className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-2">
                          <p className="text-xs font-semibold text-slate-500">{dayName} ({entry.label})</p>
                          <p className="mt-3 text-sm text-slate-500">Rest day</p>
                        </div>
                      );
                    }

                    const workout = week.workouts[entry.workoutIndex];
                    return (
                      <div key={`${weekIndex}-${dayName}`} className="rounded-lg border border-slate-200 bg-white p-2">
                        <p className="text-xs font-semibold text-slate-500">{dayName} ({entry.label})</p>
                        <p className="mt-1 text-sm font-medium">{cleanText(workout.title)}</p>
                        <p className="text-xs text-slate-600">{workout.distanceKm} km - {cleanText(workout.paceTarget)}</p>
                        <p className="mt-1"><span className={`rounded-full px-2 py-0.5 text-[11px] ${statusClass(workout.status)}`}>{workout.status}</span></p>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <button type="button" onClick={() => updateWorkoutFromCalendar(weekIndex, entry.workoutIndex as number, "done")} className="rounded border border-emerald-300 px-2 py-1 text-[11px] text-emerald-700 hover:bg-emerald-50">Done</button>
                          <button type="button" onClick={() => updateWorkoutFromCalendar(weekIndex, entry.workoutIndex as number, "skipped")} className="rounded border border-rose-300 px-2 py-1 text-[11px] text-rose-700 hover:bg-rose-50">Skip</button>
                          <Link href={`/plan/${weekIndex}/${entry.workoutIndex}`} className="rounded border border-slate-300 px-2 py-1 text-[11px] hover:bg-slate-50">View/Edit</Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <h2 className="text-lg font-semibold">Coaching Notes</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {baseline?.coachingNotes.map((note) => <li key={note}>{cleanText(note)}</li>)}
          <li>Training guidance only, not medical advice.</li>
          <li>HR zones are estimates and shift with heat, fatigue, stress, and hydration.</li>
          <li>Easy days should prioritize effort and consistency over exact pace.</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link href="/performance" className="btn-secondary">Update baseline</Link>
          <Link href="/hr-setup" className="btn-secondary">HR setup</Link>
          <Link href="/settings" className="btn-secondary">Settings</Link>
        </div>
      </section>

      {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}
    </div>
  );
}
