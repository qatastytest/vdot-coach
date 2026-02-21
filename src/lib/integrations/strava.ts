import {
  assessPerformanceConfidence,
  buildCoachingNotes,
  buildRacePredictions,
  calculateVdotFromPerformance,
  deriveTrainingPaces
} from "@/lib/core";
import { BaselineSnapshot, SyncedActivity } from "@/lib/domain/models";

export interface StravaImportResult {
  activities: SyncedActivity[];
  warnings: string[];
}

export interface ActivityInsights {
  totalActivities: number;
  runActivities: number;
  totalRunKm: number;
  km7d: number;
  km28d: number;
  longestRunKm: number;
  lastActivityDate?: string;
  fiveKPbSec?: number;
  tenKPbSec?: number;
  halfPbSec?: number;
}

export interface StravaAuthTokenResponse {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete?: {
    id?: number;
    username?: string;
  };
}

interface StravaTokenApiError {
  message?: string;
  errors?: Array<{ resource?: string; field?: string; code?: string }>;
}

const PB_TARGETS = [
  { key: "fiveKPbSec", meters: 5000 },
  { key: "tenKPbSec", meters: 10000 },
  { key: "halfPbSec", meters: 21097.5 }
] as const;

const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_API_BASE_URL = "https://www.strava.com/api/v3";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((item) => item.trim() !== "")) {
        rows.push(row);
      }
      row = [];
      continue;
    }
    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((item) => item.trim() !== "")) {
      rows.push(row);
    }
  }
  return rows;
}

function toIsoDate(value: string): string | null {
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) {
    return `${direct.getFullYear()}-${String(direct.getMonth() + 1).padStart(2, "0")}-${String(direct.getDate()).padStart(2, "0")}`;
  }
  return null;
}

function parseDurationSeconds(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  const hms = value.match(/^(\d{1,2}):([0-5]?\d):([0-5]?\d)$/);
  if (hms) return Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]);
  const ms = value.match(/^(\d{1,3}):([0-5]?\d)$/);
  if (ms) return Number(ms[1]) * 60 + Number(ms[2]);

  const h = /(\d+(?:\.\d+)?)\s*h/.exec(value)?.[1];
  const m = /(\d+(?:\.\d+)?)\s*m/.exec(value)?.[1];
  const s = /(\d+(?:\.\d+)?)\s*s/.exec(value)?.[1];
  if (h || m || s) {
    return Math.round((Number(h ?? 0) * 3600) + (Number(m ?? 0) * 60) + Number(s ?? 0));
  }
  return null;
}

function parseDistanceMeters(raw: string): number | null {
  const value = raw.trim().toLowerCase().replace(",", ".");
  if (!value) return null;
  const numeric = Number(value.replace(/[^0-9.]/g, ""));
  if (!Number.isFinite(numeric)) return null;
  if (value.includes("km")) return numeric * 1000;
  if (value.includes("mi")) return numeric * 1609.34;
  if (value.includes(" m")) return numeric;
  if (numeric <= 80) return numeric * 1000;
  return numeric;
}

function parseTokenError(body: unknown): string {
  if (!body || typeof body !== "object") {
    return "Unknown Strava API error.";
  }
  const parsed = body as StravaTokenApiError;
  if (parsed.message) return parsed.message;
  if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
    const first = parsed.errors[0];
    return `${first.resource ?? "resource"}:${first.field ?? "field"}:${first.code ?? "error"}`;
  }
  return "Unknown Strava API error.";
}

function isRunLike(activity: SyncedActivity): boolean {
  return /run/i.test(activity.type);
}

function normalizeIncomingActivity(raw: {
  externalId: string;
  name: string;
  type: string;
  startDate: string;
  startDateTime?: string;
  distanceMeters: number;
  movingTimeSec: number;
  elapsedTimeSec?: number;
  averageHr?: number;
  maxHr?: number;
  elevationGainM?: number;
}): SyncedActivity | null {
  if (!raw.externalId || !raw.startDate || !Number.isFinite(raw.distanceMeters) || !Number.isFinite(raw.movingTimeSec)) {
    return null;
  }
  if (raw.distanceMeters <= 0 || raw.movingTimeSec <= 0) return null;
  return {
    source: "strava",
    externalId: raw.externalId,
    name: raw.name || "Run",
    type: raw.type || "Run",
    startDate: raw.startDate,
    startDateTime: raw.startDateTime,
    distanceMeters: raw.distanceMeters,
    movingTimeSec: raw.movingTimeSec,
    elapsedTimeSec: raw.elapsedTimeSec,
    averageHr: raw.averageHr,
    maxHr: raw.maxHr,
    elevationGainM: raw.elevationGainM
  };
}

function parseStravaJson(text: string, warnings: string[]): SyncedActivity[] {
  const parsed = JSON.parse(text) as unknown;
  const array = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { activities?: unknown[] }).activities)
      ? (parsed as { activities: unknown[] }).activities
      : [];

  const activities: SyncedActivity[] = [];
  for (const item of array) {
    const obj = item as Record<string, unknown>;
    const startDateTime = String(obj.start_date_local ?? obj.start_date ?? "").trim();
    const startDate = toIsoDate(startDateTime) ?? toIsoDate(String(obj.startDate ?? "")) ?? "";
    const distanceMeters = Number(obj.distance ?? obj.distanceMeters ?? 0);
    const movingTimeSec = Number(obj.moving_time ?? obj.movingTimeSec ?? obj.moving_time_sec ?? 0);
    const elapsedTimeSec = Number(obj.elapsed_time ?? obj.elapsedTimeSec ?? Number.NaN);
    const activity = normalizeIncomingActivity({
      externalId: String(obj.id ?? obj.externalId ?? `${startDate}-${obj.name ?? "run"}-${movingTimeSec}`),
      name: String(obj.name ?? "Run"),
      type: String(obj.type ?? obj.sport_type ?? "Run"),
      startDate,
      startDateTime: startDateTime || undefined,
      distanceMeters,
      movingTimeSec,
      elapsedTimeSec: Number.isFinite(elapsedTimeSec) ? elapsedTimeSec : undefined,
      averageHr: Number(obj.average_heartrate ?? obj.averageHr ?? Number.NaN),
      maxHr: Number(obj.max_heartrate ?? obj.maxHr ?? Number.NaN),
      elevationGainM: Number(obj.total_elevation_gain ?? obj.elevationGainM ?? Number.NaN)
    });
    if (activity) {
      activities.push(activity);
    } else {
      warnings.push("Skipped one JSON activity due to missing date/time/distance fields.");
    }
  }
  return activities;
}

function parseStravaCsv(text: string, warnings: string[]): SyncedActivity[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map((item) => item.trim().toLowerCase());
  const idx = (candidates: string[]): number => header.findIndex((item) => candidates.includes(item));

  const dateIdx = idx(["activity date", "start date", "date"]);
  const nameIdx = idx(["activity name", "name"]);
  const typeIdx = idx(["activity type", "type", "sport type"]);
  const movingIdx = idx(["moving time", "moving_time"]);
  const elapsedIdx = idx(["elapsed time", "elapsed_time"]);
  const distanceIdx = idx(["distance"]);
  const idIdx = idx(["activity id", "id", "activity_id"]);
  const avgHrIdx = idx(["average heart rate", "average heartrate", "avg hr"]);
  const maxHrIdx = idx(["max heart rate", "max heartrate", "max hr"]);
  const elevIdx = idx(["elevation gain", "total elevation gain"]);

  const activities: SyncedActivity[] = [];
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const rawDate = dateIdx >= 0 ? row[dateIdx] ?? "" : "";
    const startDate = toIsoDate(rawDate);
    const distanceMeters = parseDistanceMeters(distanceIdx >= 0 ? row[distanceIdx] ?? "" : "");
    const movingTimeSec = parseDurationSeconds(movingIdx >= 0 ? row[movingIdx] ?? "" : "");
    if (!startDate || !distanceMeters || !movingTimeSec) {
      continue;
    }

    const externalId =
      (idIdx >= 0 ? String(row[idIdx] ?? "").trim() : "") ||
      `${startDate}-${String(row[nameIdx] ?? "run").trim()}-${movingTimeSec}`;

    const avgHr = avgHrIdx >= 0 ? Number(String(row[avgHrIdx] ?? "").replace(",", ".")) : Number.NaN;
    const maxHr = maxHrIdx >= 0 ? Number(String(row[maxHrIdx] ?? "").replace(",", ".")) : Number.NaN;
    const elev = elevIdx >= 0 ? Number(String(row[elevIdx] ?? "").replace(",", ".")) : Number.NaN;
    const elapsed = elapsedIdx >= 0 ? parseDurationSeconds(row[elapsedIdx] ?? "") : null;

    const activity = normalizeIncomingActivity({
      externalId,
      name: nameIdx >= 0 ? String(row[nameIdx] ?? "Run").trim() : "Run",
      type: typeIdx >= 0 ? String(row[typeIdx] ?? "Run").trim() : "Run",
      startDate,
      startDateTime: rawDate || undefined,
      distanceMeters,
      movingTimeSec,
      elapsedTimeSec: elapsed ?? undefined,
      averageHr: Number.isFinite(avgHr) ? avgHr : undefined,
      maxHr: Number.isFinite(maxHr) ? maxHr : undefined,
      elevationGainM: Number.isFinite(elev) ? elev : undefined
    });
    if (activity) activities.push(activity);
  }

  if (activities.length === 0) {
    warnings.push("No valid activities found in CSV. Ensure it is Strava activities export.");
  }
  return activities;
}

export function parseStravaImportFile(content: string): StravaImportResult {
  const warnings: string[] = [];
  const trimmed = content.trim();
  if (!trimmed) return { activities: [], warnings: ["Import file is empty."] };

  let activities: SyncedActivity[] = [];
  try {
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      activities = parseStravaJson(trimmed, warnings);
    } else {
      activities = parseStravaCsv(trimmed, warnings);
    }
  } catch {
    return { activities: [], warnings: ["Failed to parse import file. Use Strava CSV export or JSON data."] };
  }

  const byId = new Map<string, SyncedActivity>();
  for (const activity of activities) {
    byId.set(activity.externalId, activity);
  }

  return {
    activities: [...byId.values()].sort((a, b) =>
      `${a.startDateTime ?? a.startDate}`.localeCompare(`${b.startDateTime ?? b.startDate}`)
    ),
    warnings
  };
}

export function buildStravaAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const search = new URLSearchParams({
    client_id: params.clientId,
    response_type: "code",
    approval_prompt: "auto",
    redirect_uri: params.redirectUri,
    scope: "read,activity:read_all,profile:read_all",
    state: params.state
  });
  return `${STRAVA_AUTHORIZE_URL}?${search.toString()}`;
}

async function postTokenRequest(body: URLSearchParams): Promise<StravaAuthTokenResponse> {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString()
  });

  const payload = (await response.json().catch(() => null)) as StravaAuthTokenResponse | StravaTokenApiError | null;
  if (!response.ok || !payload) {
    throw new Error(parseTokenError(payload));
  }

  if (
    typeof (payload as StravaAuthTokenResponse).access_token !== "string" ||
    typeof (payload as StravaAuthTokenResponse).refresh_token !== "string"
  ) {
    throw new Error("Invalid token payload from Strava.");
  }
  return payload as StravaAuthTokenResponse;
}

export async function exchangeStravaCodeForToken(params: {
  clientId: string;
  clientSecret: string;
  code: string;
}): Promise<StravaAuthTokenResponse> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: params.code,
    grant_type: "authorization_code"
  });
  return postTokenRequest(body);
}

export async function refreshStravaToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<StravaAuthTokenResponse> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    grant_type: "refresh_token",
    refresh_token: params.refreshToken
  });
  return postTokenRequest(body);
}

interface RawStravaActivity {
  id?: number | string;
  name?: string;
  type?: string;
  sport_type?: string;
  start_date?: string;
  start_date_local?: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain?: number;
}

function mapStravaApiActivity(raw: RawStravaActivity): SyncedActivity | null {
  const startDateTime = String(raw.start_date_local ?? raw.start_date ?? "").trim();
  const startDate = toIsoDate(startDateTime) ?? "";
  return normalizeIncomingActivity({
    externalId: String(raw.id ?? `${startDate}-${raw.name ?? "run"}-${raw.moving_time ?? 0}`),
    name: String(raw.name ?? "Run"),
    type: String(raw.sport_type ?? raw.type ?? "Run"),
    startDate,
    startDateTime: startDateTime || undefined,
    distanceMeters: Number(raw.distance ?? 0),
    movingTimeSec: Number(raw.moving_time ?? 0),
    elapsedTimeSec: raw.elapsed_time !== undefined ? Number(raw.elapsed_time) : undefined,
    averageHr: raw.average_heartrate !== undefined ? Number(raw.average_heartrate) : undefined,
    maxHr: raw.max_heartrate !== undefined ? Number(raw.max_heartrate) : undefined,
    elevationGainM: raw.total_elevation_gain !== undefined ? Number(raw.total_elevation_gain) : undefined
  });
}

export async function fetchStravaActivities(params: {
  accessToken: string;
  afterEpochSec?: number;
  perPage?: number;
  maxPages?: number;
}): Promise<SyncedActivity[]> {
  const perPage = params.perPage ?? 200;
  const maxPages = params.maxPages ?? 25;
  const items: SyncedActivity[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const query = new URLSearchParams({
      page: String(page),
      per_page: String(perPage)
    });
    if (params.afterEpochSec) {
      query.set("after", String(params.afterEpochSec));
    }

    const response = await fetch(`${STRAVA_API_BASE_URL}/athlete/activities?${query.toString()}`, {
      headers: {
        Authorization: `Bearer ${params.accessToken}`
      }
    });

    const payload = (await response.json().catch(() => null)) as RawStravaActivity[] | StravaTokenApiError | null;
    if (!response.ok || !payload) {
      throw new Error(parseTokenError(payload));
    }
    if (!Array.isArray(payload)) {
      throw new Error("Unexpected activities payload from Strava.");
    }
    if (payload.length === 0) {
      break;
    }

    for (const raw of payload) {
      const parsed = mapStravaApiActivity(raw);
      if (parsed) items.push(parsed);
    }

    if (payload.length < perPage) {
      break;
    }
  }

  const byId = new Map<string, SyncedActivity>();
  for (const item of items) {
    byId.set(item.externalId, item);
  }
  return [...byId.values()].sort((a, b) =>
    `${a.startDateTime ?? a.startDate}`.localeCompare(`${b.startDateTime ?? b.startDate}`)
  );
}

function sumDistanceKm(activities: SyncedActivity[]): number {
  return activities.reduce((sum, activity) => sum + activity.distanceMeters / 1000, 0);
}

function activitiesWithinDays(activities: SyncedActivity[], days: number, today = new Date()): SyncedActivity[] {
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0).getTime();
  const min = now - (days - 1) * 86400000;
  return activities.filter((activity) => {
    const parsed = new Date(`${activity.startDate}T12:00:00`).getTime();
    return parsed >= min && parsed <= now;
  });
}

export function buildActivityInsights(activities: SyncedActivity[]): ActivityInsights {
  const runActivities = activities.filter(isRunLike);
  const latest = runActivities.length > 0 ? runActivities[runActivities.length - 1] : undefined;
  const km7d = sumDistanceKm(activitiesWithinDays(runActivities, 7));
  const km28d = sumDistanceKm(activitiesWithinDays(runActivities, 28));
  const longestRunKm =
    runActivities.reduce((max, activity) => Math.max(max, activity.distanceMeters / 1000), 0);

  const pbs: Partial<Record<(typeof PB_TARGETS)[number]["key"], number>> = {};
  for (const target of PB_TARGETS) {
    let best: number | undefined;
    for (const activity of runActivities) {
      const ratio = activity.distanceMeters / target.meters;
      if (ratio < 0.97 || ratio > 1.05) continue;
      const projected = activity.movingTimeSec * (target.meters / activity.distanceMeters);
      if (!best || projected < best) best = projected;
    }
    if (best) pbs[target.key] = Math.round(best);
  }

  return {
    totalActivities: activities.length,
    runActivities: runActivities.length,
    totalRunKm: Math.round(sumDistanceKm(runActivities) * 10) / 10,
    km7d: Math.round(km7d * 10) / 10,
    km28d: Math.round(km28d * 10) / 10,
    longestRunKm: Math.round(longestRunKm * 10) / 10,
    lastActivityDate: latest?.startDate,
    fiveKPbSec: pbs.fiveKPbSec,
    tenKPbSec: pbs.tenKPbSec,
    halfPbSec: pbs.halfPbSec
  };
}

function inferEffort(name: string): "all_out" | "hard" | "controlled" {
  const lower = name.toLowerCase();
  if (/(race|parkrun|time trial|tt)\b/.test(lower)) return "all_out";
  if (/(tempo|threshold|interval|vo2)\b/.test(lower)) return "hard";
  return "hard";
}

function inferSurface(name: string): "track" | "road" | "trail" | "mixed" {
  const lower = name.toLowerCase();
  if (/\btrack\b/.test(lower)) return "track";
  if (/\btrail\b/.test(lower)) return "trail";
  return "road";
}

export function deriveBaselineFromActivities(activities: SyncedActivity[]): BaselineSnapshot | null {
  const candidates = activities.filter(
    (activity) => isRunLike(activity) && activity.distanceMeters >= 1500 && activity.distanceMeters <= 50000
  );
  if (candidates.length === 0) return null;

  let bestActivity: SyncedActivity | null = null;
  let bestVdot = -Infinity;
  for (const activity of candidates) {
    const vdot = calculateVdotFromPerformance(activity.distanceMeters, activity.movingTimeSec).vdot;
    if (vdot > bestVdot) {
      bestVdot = vdot;
      bestActivity = activity;
    }
  }
  if (!bestActivity) return null;

  const performance = {
    distanceMeters: bestActivity.distanceMeters,
    timeSeconds: bestActivity.movingTimeSec,
    date: bestActivity.startDate,
    eventType: /race|parkrun|time trial|tt/i.test(bestActivity.name) ? ("race" as const) : ("test" as const),
    effortType: inferEffort(bestActivity.name),
    surface: inferSurface(bestActivity.name),
    elevationGainM: bestActivity.elevationGainM
  };

  const vdotResult = calculateVdotFromPerformance(performance.distanceMeters, performance.timeSeconds);
  const confidence = assessPerformanceConfidence(performance);
  return {
    performance,
    vdot: vdotResult.roundedVdot,
    confidence,
    predictions: buildRacePredictions(vdotResult.vdot),
    paces: deriveTrainingPaces(vdotResult.vdot),
    coachingNotes: buildCoachingNotes(confidence)
  };
}
