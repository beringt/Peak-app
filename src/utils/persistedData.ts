import type { PeakData, TrainingDay } from "../types";
import { validProfileInputs } from "../features/profile/profileInputs";
import { sessionsForDay, validSessions } from "../features/training/plannedSessions";
import { validRecommendationSnapshots } from "./recommendationSnapshots";
import { validWeeklyReviewState } from "./weeklyReviewData";
import { isDateKey } from "./date";

export const PEAK_DATA_VERSION = 5 as const;

export type PersistedPeakData = {
  version: typeof PEAK_DATA_VERSION;
  data: PeakData;
};

/** Raw storage only; adapters must reject failures, never return null for errors. */
export interface PeakStorage {
  read(): Promise<string | null>;
  write(raw: string): Promise<void>;
  remove(): Promise<void>;
}

export type DecodeResult =
  | { status: "missing" }
  | { status: "valid"; value: PersistedPeakData }
  | { status: "invalid"; reason: "json" | "schema"; raw: string }
  | { status: "unsupported-version"; version: number; raw: string };

export type EncodeResult =
  | { status: "valid"; raw: string }
  | { status: "invalid"; reason: "schema" };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) =>
    Object.prototype.hasOwnProperty.call(value, key)
  );
}

function positiveWeight(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function validData(value: unknown, version = PEAK_DATA_VERSION as number): value is PeakData {
  if (!record(value)) return false;
  const required = ["profile", "trainingPlan", "weightEntries"];
  const allowed = [...required, ...(version >= 4 ? ["recommendationSnapshots"] : []), ...(version >= 5 ? ["weeklyReview"] : [])];
  if (!required.every(k => Object.prototype.hasOwnProperty.call(value, k)) || Object.keys(value).some(k => !allowed.includes(k)) ||
    ("recommendationSnapshots" in value && !validRecommendationSnapshots(value.recommendationSnapshots)) ||
    ("weeklyReview" in value && !validWeeklyReviewState(value.weeklyReview))) return false;
  const { profile, trainingPlan, weightEntries } = value;
  if (profile !== null && (
    !record(profile) ||
    !(hasKeys(profile, ["weight", "goal", "activityLevel"]) || (version >= 2 &&
      hasKeys(profile, ["weight", "goal", "activityLevel", "baselineInputs"]) &&
      (profile.baselineInputs === null || validProfileInputs(profile.baselineInputs, profile.goal)))) ||
    !positiveWeight(profile.weight) ||
    !["lose", "maintain", "gain"].includes(profile.goal as string) ||
    !["low", "medium", "high"].includes(profile.activityLevel as string)
  )) return false;

  if (!Array.isArray(trainingPlan) || !Array.isArray(weightEntries)) return false;
  const dates = new Set<string>();
  for (const day of trainingPlan) {
    if (!record(day) || !(hasKeys(day, ["date", "type"]) || (version >= 3 &&
      hasKeys(day, ["date", "type", "sessions"]) && validSessions(day.sessions) &&
      day.type === (day.sessions[0]?.type ?? "rest"))) || !isDateKey(day.date) ||
      !["strength", "endurance", "rest"].includes(day.type as string) ||
      dates.has(day.date)) return false;
    dates.add(day.date);
  }
  const sessionIds = new Set<string>();
  for (const day of trainingPlan as TrainingDay[]) {
    for (const session of sessionsForDay(day)) {
      if (sessionIds.has(session.id)) return false;
      sessionIds.add(session.id);
    }
  }
  const ids = new Set<string>();
  for (const entry of weightEntries) {
    if (!record(entry) || !hasKeys(entry, ["id", "date", "weightKg"]) ||
      typeof entry.id !== "string" || entry.id.trim().length === 0 ||
      ids.has(entry.id) || !isDateKey(entry.date) ||
      !positiveWeight(entry.weightKg) || entry.weightKg > 500) return false;
    ids.add(entry.id);
  }
  return true;
}

export function decodePersistedData(raw: string | null): DecodeResult {
  if (raw === null) return { status: "missing" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "invalid", reason: "json", raw };
  }
  if (!record(parsed) || !Number.isSafeInteger(parsed.version) ||
    (parsed.version as number) < 1) {
    return { status: "invalid", reason: "schema", raw };
  }
  if (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3 && parsed.version !== 4 && parsed.version !== PEAK_DATA_VERSION) {
    return { status: "unsupported-version", version: parsed.version as number, raw };
  }
  if (!hasKeys(parsed, ["version", "data"]) || !validData(parsed.data, parsed.version as number)) {
    return { status: "invalid", reason: "schema", raw };
  }
  return { status: "valid", value: { version: PEAK_DATA_VERSION, data: parsed.data } };
}

export function encodePersistedData(data: PeakData): EncodeResult {
  if (!validData(data)) return { status: "invalid", reason: "schema" };
  return { status: "valid", raw: JSON.stringify({ version: PEAK_DATA_VERSION, data }) };
}
