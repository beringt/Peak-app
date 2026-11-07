import type { PeakData } from "../types";

export const PEAK_DATA_VERSION = 1 as const;

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

/** Calendar-only validation: no parsing as a UTC instant or timezone conversion. */
function dateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

function validData(value: unknown): value is PeakData {
  if (!record(value) || !hasKeys(value, ["profile", "trainingPlan", "weightEntries"])) return false;
  const { profile, trainingPlan, weightEntries } = value;
  if (profile !== null && (
    !record(profile) ||
    !hasKeys(profile, ["weight", "goal", "activityLevel"]) ||
    !positiveWeight(profile.weight) ||
    !["lose", "maintain", "gain"].includes(profile.goal as string) ||
    !["low", "medium", "high"].includes(profile.activityLevel as string)
  )) return false;

  if (!Array.isArray(trainingPlan) || !Array.isArray(weightEntries)) return false;
  const dates = new Set<string>();
  for (const day of trainingPlan) {
    if (!record(day) || !hasKeys(day, ["date", "type"]) || !dateKey(day.date) ||
      !["strength", "endurance", "rest"].includes(day.type as string) ||
      dates.has(day.date)) return false;
    dates.add(day.date);
  }
  const ids = new Set<string>();
  for (const entry of weightEntries) {
    if (!record(entry) || !hasKeys(entry, ["id", "date", "weightKg"]) ||
      typeof entry.id !== "string" || entry.id.trim().length === 0 ||
      ids.has(entry.id) || !dateKey(entry.date) ||
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
  if (parsed.version !== PEAK_DATA_VERSION) {
    return { status: "unsupported-version", version: parsed.version as number, raw };
  }
  if (!hasKeys(parsed, ["version", "data"]) || !validData(parsed.data)) {
    return { status: "invalid", reason: "schema", raw };
  }
  return { status: "valid", value: { version: PEAK_DATA_VERSION, data: parsed.data } };
}

export function encodePersistedData(data: PeakData): EncodeResult {
  if (!validData(data)) return { status: "invalid", reason: "schema" };
  return { status: "valid", raw: JSON.stringify({ version: PEAK_DATA_VERSION, data }) };
}
