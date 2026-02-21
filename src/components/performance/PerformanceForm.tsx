"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  assessPerformanceConfidence,
  buildCoachingNotes,
  buildRacePredictions,
  calculateVdotFromPerformance,
  deriveTrainingPaces,
  formatTime,
  parseTimeToSeconds
} from "@/lib/core";
import { BaselineSnapshot, StravaConnection } from "@/lib/domain/models";
import {
  applyActivitiesToStoredPlan,
  clearStoredStravaConnection,
  getActiveProfileId,
  getStoredActivities,
  getStoredGoal,
  getStoredLastActivitySyncAt,
  getStoredStravaConnection,
  mergeStoredActivities,
  setStoredBaseline,
  setStoredStravaConnection
} from "@/lib/storage/local";
import {
  buildStravaAuthorizeUrl,
  buildActivityInsights,
  deriveBaselineFromActivities,
  exchangeStravaCodeForToken,
  fetchStravaActivities,
  parseStravaImportFile,
  refreshStravaToken
} from "@/lib/integrations/strava";
import { PerformanceFormValues, performanceFormSchema } from "@/lib/validation/schemas";

const DEFAULT_FORM: PerformanceFormValues = {
  distanceMeters: 5000,
  time: "20:00",
  date: new Date().toISOString().slice(0, 10),
  eventType: "race",
  effortType: "all_out",
  surface: "road",
  elevationGainM: "",
  temperatureC: "",
  windKph: ""
};

function optionalNumber(value: number | "" | undefined): number | undefined {
  return value === "" || value === undefined ? undefined : value;
}

const OAUTH_STATE_KEY = "vdot-coach:strava-oauth-state";

function rememberOAuthState(state: string): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(OAUTH_STATE_KEY, state);
}

function readOAuthState(): string | null {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem(OAUTH_STATE_KEY);
}

function clearOAuthState(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(OAUTH_STATE_KEY);
}

function randomState(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `state-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function toConnectionPayload(connection: StravaConnection): Omit<StravaConnection, "updatedAt"> {
  return {
    clientId: connection.clientId,
    clientSecret: connection.clientSecret,
    token: connection.token
  };
}

export function PerformanceForm(): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState<PerformanceFormValues>(DEFAULT_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  const [activities, setActivities] = useState(() => getStoredActivities());
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncWarnings, setSyncWarnings] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [stravaConnection, setStravaConnectionState] = useState<StravaConnection | null>(null);
  const [stravaClientId, setStravaClientId] = useState("");
  const [stravaClientSecret, setStravaClientSecret] = useState("");
  const [oauthBusy, setOauthBusy] = useState(false);
  const [oauthMessage, setOauthMessage] = useState<string | null>(null);
  const [oauthWarnings, setOauthWarnings] = useState<string[]>([]);
  const [isStravaConnectionReady, setIsStravaConnectionReady] = useState(false);
  const activeProfileId = getActiveProfileId();
  const oauthCode = searchParams.get("code");
  const oauthState = searchParams.get("state");
  const oauthError = searchParams.get("error");

  const lastSyncAt = getStoredLastActivitySyncAt();
  const goal = getStoredGoal();
  const insights = useMemo(() => buildActivityInsights(activities), [activities]);

  const distanceChoices = useMemo(
    () => [
      { label: "1500m", value: 1500 },
      { label: "1 mile", value: 1609.34 },
      { label: "3K", value: 3000 },
      { label: "5K", value: 5000 },
      { label: "10K", value: 10000 },
      { label: "Half Marathon", value: 21097.5 },
      { label: "Marathon", value: 42195 }
    ],
    []
  );

  useEffect(() => {
    setIsStravaConnectionReady(false);
    const savedConnection = getStoredStravaConnection();
    setStravaConnectionState(savedConnection);
    setStravaClientId(savedConnection?.clientId ?? "");
    setStravaClientSecret(savedConnection?.clientSecret ?? "");
    setActivities(getStoredActivities());
    setSyncWarnings([]);
    setSyncMessage(null);
    setOauthWarnings([]);
    setOauthMessage(null);
    setIsStravaConnectionReady(true);
  }, [activeProfileId]);

  useEffect(() => {
    if (!oauthCode && !oauthError) return;
    if (!isStravaConnectionReady) return;

    const clearQuery = (): void => {
      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", window.location.pathname);
      }
    };

    if (oauthError) {
      setOauthWarnings([`Strava authorization failed: ${oauthError}`]);
      clearOAuthState();
      clearQuery();
      return;
    }
    if (!oauthCode) return;

    if (!stravaConnection?.clientId || !stravaConnection?.clientSecret) {
      setOauthWarnings(["Missing Strava Client ID/Secret in this profile. Save connection then retry."]);
      clearQuery();
      return;
    }

    const expectedState = readOAuthState();
    if (!expectedState || !oauthState || expectedState !== oauthState) {
      setOauthWarnings(["Invalid OAuth state returned by Strava. Retry connection from this profile."]);
      clearQuery();
      return;
    }
    clearOAuthState();

    let cancelled = false;
    setOauthBusy(true);
    setOauthWarnings([]);
    setOauthMessage("Completing Strava connection...");

    (async () => {
      try {
        const token = await exchangeStravaCodeForToken({
          clientId: stravaConnection.clientId,
          clientSecret: stravaConnection.clientSecret,
          code: oauthCode
        });

        if (cancelled) return;

        const nextConnection: StravaConnection = {
          ...stravaConnection,
          token: {
            accessToken: token.access_token,
            refreshToken: token.refresh_token,
            expiresAt: token.expires_at,
            athleteId: token.athlete?.id,
            athleteUsername: token.athlete?.username
          },
          updatedAt: new Date().toISOString()
        };

        const saved = setStoredStravaConnection(toConnectionPayload(nextConnection));
        if (!saved) {
          setOauthWarnings(["Connected to Strava, but failed to save token for this profile."]);
          return;
        }

        setStravaConnectionState(nextConnection);
        setStravaClientId(nextConnection.clientId);
        setStravaClientSecret(nextConnection.clientSecret);
        setOauthMessage("Strava connected. You can now run Sync now.");
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Unknown Strava OAuth error.";
        setOauthWarnings([
          `Token exchange failed: ${message}. Browser CORS can block direct OAuth on static hosting.`
        ]);
        setOauthMessage(null);
      } finally {
        if (!cancelled) {
          setOauthBusy(false);
          clearQuery();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    oauthCode,
    oauthError,
    oauthState,
    isStravaConnectionReady,
    stravaConnection
  ]);

  function persistActivities(
    incomingActivities: ReturnType<typeof getStoredActivities>,
    warnings: string[],
    sourceLabel: string
  ): void {
    if (incomingActivities.length === 0) {
      setSyncWarnings(warnings.length > 0 ? warnings : [`No activities returned from ${sourceLabel}.`]);
      return;
    }

    const merged = mergeStoredActivities(incomingActivities);
    if (!merged) {
      setSyncWarnings(["Could not save imported activities. Select an active profile first."]);
      return;
    }

    const planSync = applyActivitiesToStoredPlan(incomingActivities);
    const allActivities = getStoredActivities();
    const derivedBaseline = deriveBaselineFromActivities(allActivities);
    if (derivedBaseline) {
      setStoredBaseline(derivedBaseline);
      setForm((prev) => ({
        ...prev,
        distanceMeters: derivedBaseline.performance.distanceMeters,
        time: formatTime(derivedBaseline.performance.timeSeconds),
        date: derivedBaseline.performance.date,
        eventType: derivedBaseline.performance.eventType,
        effortType: derivedBaseline.performance.effortType,
        surface: derivedBaseline.performance.surface,
        elevationGainM: derivedBaseline.performance.elevationGainM ?? ""
      }));
    }

    setActivities(allActivities);
    setSyncWarnings(warnings);
    setSyncMessage(
      `Imported ${merged.importedCount} new activities (${merged.totalCount} total) from ${sourceLabel}. ` +
        `${planSync ? `${planSync.matchedCount} workouts matched in plan.` : "No active plan to update."}`
    );
  }

  function handleSaveStravaConnection(): void {
    setOauthWarnings([]);
    setOauthMessage(null);
    const clientId = stravaClientId.trim();
    const clientSecret = stravaClientSecret.trim();
    if (!clientId || !clientSecret) {
      setOauthWarnings(["Provide both Strava Client ID and Client Secret."]);
      return;
    }

    const saved = setStoredStravaConnection({
      clientId,
      clientSecret,
      token: stravaConnection?.token
    });
    if (!saved) {
      setOauthWarnings(["Could not save Strava connection. Select an active profile first."]);
      return;
    }

    const next: StravaConnection = {
      clientId,
      clientSecret,
      token: stravaConnection?.token,
      updatedAt: new Date().toISOString()
    };
    setStravaConnectionState(next);
    setOauthMessage("Strava credentials saved for this profile.");
  }

  function handleStartStravaConnect(): void {
    setOauthWarnings([]);
    setOauthMessage(null);
    const clientId = stravaClientId.trim();
    const clientSecret = stravaClientSecret.trim();
    if (!clientId || !clientSecret) {
      setOauthWarnings(["Save Strava Client ID and Client Secret first."]);
      return;
    }
    if (typeof window === "undefined") return;

    const saved = setStoredStravaConnection({
      clientId,
      clientSecret,
      token: stravaConnection?.token
    });
    if (!saved) {
      setOauthWarnings(["Could not save Strava connection in this profile."]);
      return;
    }

    const state = randomState();
    rememberOAuthState(state);
    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    const url = buildStravaAuthorizeUrl({
      clientId,
      redirectUri,
      state
    });
    window.location.assign(url);
  }

  async function handleSyncFromStravaApi(): Promise<void> {
    if (!stravaConnection?.clientId || !stravaConnection.clientSecret) {
      setSyncWarnings(["Connect Strava first (Client ID + Secret + OAuth)."]);
      return;
    }
    if (!stravaConnection.token) {
      setSyncWarnings(["No Strava access token found. Use Connect Strava first."]);
      return;
    }

    setSyncing(true);
    setSyncWarnings([]);
    setSyncMessage(null);
    let nextConnection = stravaConnection;

    try {
      const nowEpoch = Math.floor(Date.now() / 1000);
      if (nextConnection.token?.expiresAt !== undefined && nextConnection.token.expiresAt <= nowEpoch + 120) {
        const refreshed = await refreshStravaToken({
          clientId: nextConnection.clientId,
          clientSecret: nextConnection.clientSecret,
          refreshToken: nextConnection.token.refreshToken
        });
        nextConnection = {
          ...nextConnection,
          token: {
            accessToken: refreshed.access_token,
            refreshToken: refreshed.refresh_token,
            expiresAt: refreshed.expires_at,
            athleteId: refreshed.athlete?.id,
            athleteUsername: refreshed.athlete?.username
          },
          updatedAt: new Date().toISOString()
        };
        const saved = setStoredStravaConnection(toConnectionPayload(nextConnection));
        if (!saved) {
          setSyncWarnings(["Token refreshed but failed to save in profile storage."]);
          return;
        }
        setStravaConnectionState(nextConnection);
      }

      const usableToken = nextConnection.token;
      if (!usableToken) {
        setSyncWarnings(["No usable Strava token found for sync. Reconnect Strava."]);
        return;
      }

      const afterEpochSec = lastSyncAt
        ? Math.floor(new Date(lastSyncAt).getTime() / 1000) - 86400
        : undefined;
      const fetched = await fetchStravaActivities({
        accessToken: usableToken.accessToken,
        afterEpochSec
      });
      persistActivities(fetched, [], "Strava API");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Strava sync error.";
      setSyncWarnings([`Live Strava sync failed: ${message}.`]);
    } finally {
      setSyncing(false);
    }
  }

  function handleDisconnectStrava(): void {
    const cleared = clearStoredStravaConnection();
    if (!cleared) {
      setOauthWarnings(["Could not clear Strava connection."]);
      return;
    }
    setStravaConnectionState(null);
    setStravaClientId("");
    setStravaClientSecret("");
    setOauthWarnings([]);
    setOauthMessage("Strava connection removed for this profile.");
  }

  async function handleStravaImport(event: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;

    setSyncing(true);
    setSyncWarnings([]);
    setSyncMessage(null);
    try {
      const text = await file.text();
      const parsed = parseStravaImportFile(text);
      persistActivities(parsed.activities, parsed.warnings, "Strava file import");
    } catch {
      setSyncWarnings(["Import failed. Use Strava CSV export or JSON data file."]);
    } finally {
      setSyncing(false);
      event.target.value = "";
    }
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const parsed = performanceFormSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((issue) => issue.message));
      return;
    }

    const timeSeconds = parseTimeToSeconds(parsed.data.time);
    const performance = {
      distanceMeters: parsed.data.distanceMeters,
      timeSeconds,
      date: parsed.data.date,
      eventType: parsed.data.eventType,
      effortType: parsed.data.effortType,
      surface: parsed.data.surface,
      elevationGainM: optionalNumber(parsed.data.elevationGainM),
      temperatureC: optionalNumber(parsed.data.temperatureC),
      windKph: optionalNumber(parsed.data.windKph)
    };

    const vdotResult = calculateVdotFromPerformance(performance.distanceMeters, performance.timeSeconds);
    const confidence = assessPerformanceConfidence(performance);
    const predictions = buildRacePredictions(vdotResult.vdot);
    const paces = deriveTrainingPaces(vdotResult.vdot);
    const coachingNotes = buildCoachingNotes(confidence);

    const baseline: BaselineSnapshot = {
      performance,
      vdot: vdotResult.roundedVdot,
      confidence,
      predictions,
      paces,
      coachingNotes
    };

    const saved = setStoredBaseline(baseline);
    if (!saved) {
      setErrors(["Select a profile from Home before saving results."]);
      return;
    }

    router.push("/results");
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-800">Strava Activity Sync</p>
            <p className="text-xs text-slate-600">
              Live API sync and file import both update plan status, baseline VDOT, and performance widgets.
            </p>
            <p className="mt-1 text-[11px] text-amber-700">
              GitHub Pages mode: Client Secret and token are kept in browser local storage for this profile.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              stravaConnection?.token ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"
            }`}
          >
            {stravaConnection?.token ? "Strava connected" : "Not connected"}
          </span>
        </div>

        {!activeProfileId ? (
          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Select a profile first from landing screen before connecting Strava.
          </p>
        ) : null}

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label>
            <span className="label">Strava Client ID</span>
            <input
              className="input"
              value={stravaClientId}
              onChange={(event) => setStravaClientId(event.target.value)}
              placeholder="e.g. 123456"
              autoComplete="off"
            />
          </label>
          <label>
            <span className="label">Strava Client Secret</span>
            <input
              className="input"
              type="password"
              value={stravaClientSecret}
              onChange={(event) => setStravaClientSecret(event.target.value)}
              placeholder="Paste secret (stored locally)"
              autoComplete="off"
            />
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" onClick={handleSaveStravaConnection} disabled={oauthBusy || syncing}>
            Save credentials
          </button>
          <button type="button" className="btn-primary" onClick={handleStartStravaConnect} disabled={oauthBusy || syncing}>
            {oauthBusy ? "Connecting..." : "Connect Strava"}
          </button>
          <button type="button" className="btn-secondary" onClick={handleSyncFromStravaApi} disabled={syncing || oauthBusy || !stravaConnection?.token}>
            {syncing ? "Syncing..." : "Sync now"}
          </button>
          <label className="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-sm hover:bg-slate-100">
            {syncing ? "Importing..." : "Import file"}
            <input
              type="file"
              accept=".csv,application/json,.json,text/csv"
              className="hidden"
              onChange={handleStravaImport}
              disabled={syncing || oauthBusy}
            />
          </label>
          <button type="button" className="btn-secondary" onClick={handleDisconnectStrava} disabled={oauthBusy || syncing}>
            Disconnect
          </button>
        </div>

        {oauthMessage ? <p className="mt-2 text-sm text-emerald-700">{oauthMessage}</p> : null}
        {oauthWarnings.length > 0 ? (
          <ul className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {oauthWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
        {syncMessage ? <p className="mt-2 text-sm text-emerald-700">{syncMessage}</p> : null}
        {syncWarnings.length > 0 ? (
          <ul className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {syncWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border border-slate-200 bg-white p-2">
            <p className="text-[11px] text-slate-500">7d volume</p>
            <p className="text-lg font-semibold">{insights.km7d.toFixed(1)} km</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-2">
            <p className="text-[11px] text-slate-500">28d volume</p>
            <p className="text-lg font-semibold">{insights.km28d.toFixed(1)} km</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-2">
            <p className="text-[11px] text-slate-500">Best 5K / 10K</p>
            <p className="text-sm font-semibold">
              {insights.fiveKPbSec ? formatTime(insights.fiveKPbSec) : "--"} /{" "}
              {insights.tenKPbSec ? formatTime(insights.tenKPbSec) : "--"}
            </p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white p-2">
            <p className="text-[11px] text-slate-500">Longest run</p>
            <p className="text-lg font-semibold">{insights.longestRunKm.toFixed(1)} km</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Activities: {insights.totalActivities} total ({insights.runActivities} runs), last sync{" "}
          {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : "not synced"}, goal date{" "}
          {goal?.targetDate ?? "not set"}.
        </p>
        {stravaConnection?.token?.expiresAt ? (
          <p className="mt-1 text-[11px] text-slate-500">
            Token expiry: {new Date(stravaConnection.token.expiresAt * 1000).toLocaleString()}.
          </p>
        ) : null}
      </section>

      <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
        <label>
          <span className="label">Distance</span>
          <select
            className="input"
            value={form.distanceMeters}
            onChange={(event) => setForm((prev) => ({ ...prev, distanceMeters: Number(event.target.value) }))}
          >
            {distanceChoices.map((distance) => (
              <option key={distance.label} value={distance.value}>
                {distance.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="label">Time (mm:ss or hh:mm:ss)</span>
          <input
            className="input"
            value={form.time}
            onChange={(event) => setForm((prev) => ({ ...prev, time: event.target.value }))}
            placeholder="20:00"
          />
        </label>

        <label>
          <span className="label">Date</span>
          <input
            className="input"
            type="date"
            value={form.date}
            onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
          />
        </label>

        <label>
          <span className="label">Event Type</span>
          <select
            className="input"
            value={form.eventType}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, eventType: event.target.value as PerformanceFormValues["eventType"] }))
            }
          >
            <option value="race">Race</option>
            <option value="test">Test</option>
          </select>
        </label>

        <label>
          <span className="label">Effort Type</span>
          <select
            className="input"
            value={form.effortType}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, effortType: event.target.value as PerformanceFormValues["effortType"] }))
            }
          >
            <option value="all_out">All Out</option>
            <option value="hard">Hard</option>
            <option value="controlled">Controlled</option>
          </select>
        </label>

        <label>
          <span className="label">Surface</span>
          <select
            className="input"
            value={form.surface}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, surface: event.target.value as PerformanceFormValues["surface"] }))
            }
          >
            <option value="track">Track</option>
            <option value="road">Road</option>
            <option value="trail">Trail</option>
            <option value="mixed">Mixed</option>
          </select>
        </label>

        <label>
          <span className="label">Elevation Gain (m, optional)</span>
          <input
            className="input"
            type="number"
            min={0}
            value={form.elevationGainM}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                elevationGainM: event.target.value === "" ? "" : Number(event.target.value)
              }))
            }
          />
        </label>

        <label>
          <span className="label">Temperature (C, optional)</span>
          <input
            className="input"
            type="number"
            value={form.temperatureC}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                temperatureC: event.target.value === "" ? "" : Number(event.target.value)
              }))
            }
          />
        </label>

        <label>
          <span className="label">Wind (kph, optional)</span>
          <input
            className="input"
            type="number"
            min={0}
            value={form.windKph}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, windKph: event.target.value === "" ? "" : Number(event.target.value) }))
            }
          />
        </label>

        <div className="md:col-span-2">
          {errors.length > 0 ? (
            <ul className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
          <button type="submit" className="btn-primary">
            Calculate VDOT
          </button>
        </div>
      </form>
    </div>
  );
}
