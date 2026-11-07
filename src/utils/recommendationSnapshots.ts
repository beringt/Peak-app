import type { RecommendationSnapshot, StoredJsonObject } from "../types";
import { isDateKey } from "./date";

export type SnapshotContext = { localDate: string; generatedAt: string; timeZone: string };
const record = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
function json(value: unknown, depth = 0): boolean {
  if (depth > 64) return false;
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(v => json(v, depth + 1));
  return record(value) && Object.values(value).every(v => json(v, depth + 1));
}
function validTargets(value: unknown): boolean {
  return record(value) && ["energyKcal", "proteinGrams", "fatGrams", "carbsGrams"]
    .every(k => typeof value[k] === "number" && Number.isFinite(value[k]));
}
export function validSnapshotContext(context: SnapshotContext): boolean {
  if (!isDateKey(context.localDate) || !text(context.timeZone) || typeof context.generatedAt !== "string") return false;
  try { return new Date(context.generatedAt).toISOString() === context.generatedAt; } catch { return false; }
}

/** Validate envelopes/chain/JSON, never recalculate historical nutritional results. */
export function validRecommendationSnapshots(value: unknown): value is RecommendationSnapshot[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  const latest = new Map<string, RecommendationSnapshot>();
  const keys = ["id", "localDate", "channel", "revision", "previousRevisionId", "generatedAt", "timeZone", "ruleVersion", "input", "result"];
  for (const item of value) {
    if (!record(item) || Object.keys(item).length !== keys.length || !keys.every(k => Object.prototype.hasOwnProperty.call(item, k)) ||
      !text(item.id) || ids.has(item.id) || !text(item.ruleVersion) ||
      !["live", "experimental"].includes(item.channel as string) || !Number.isSafeInteger(item.revision) || (item.revision as number) < 1 ||
      !validSnapshotContext(item as SnapshotContext) || !record(item.input) || !record(item.result) ||
      !json(item.input) || !json(item.result) || item.input.asOfDate !== item.localDate || item.input.timeZone !== item.timeZone ||
      item.result.ruleVersion !== item.ruleVersion ||
      (item.input.ruleVersion !== undefined && item.input.ruleVersion !== item.ruleVersion) ||
      (item.result.asOfDate !== undefined && item.result.asOfDate !== item.localDate) ||
      (item.result.timeZone !== undefined && item.result.timeZone !== item.timeZone) ||
      !["ready", "needs-input", "outside-model", "constraints-conflict"].includes(item.result.status as string) ||
      (item.result.status === "ready" ? !validTargets(item.result.targets) : item.result.targets !== null) ||
      !Array.isArray(item.result.reasons) || !item.result.reasons.every(r => record(r) && text(r.code)) ||
      !Array.isArray(item.result.dataQualityFlags) || !item.result.dataQualityFlags.every(f => typeof f === "string")) return false;
    const stream = `${item.localDate}:${item.channel}`;
    const prior = latest.get(stream);
    if (item.revision !== (prior?.revision ?? 0) + 1 || item.previousRevisionId !== (prior?.id ?? null)) return false;
    ids.add(item.id);
    latest.set(stream, item as RecommendationSnapshot);
  }
  return true;
}

/** JSON payloads stay opaque on read, including older/unknown rule versions. */
export function getRecommendationSnapshot(
  history: readonly RecommendationSnapshot[], localDate: string, channel: RecommendationSnapshot["channel"] = "live"
): RecommendationSnapshot | null {
  const stored = [...history].reverse().find(s => s.localDate === localDate && s.channel === channel);
  return stored ? JSON.parse(JSON.stringify(stored)) : null;
}

export function snapshotJson(value: unknown): StoredJsonObject {
  // JSON omits undefined optional fields, just as the storage contract does.
  function rejectNonfinite(v: unknown, depth = 0) {
    if (depth > 64) throw new RangeError("Snapshot payload is too deeply nested or cyclic.");
    if (typeof v === "number" && !Number.isFinite(v)) throw new RangeError("Snapshot payload must contain finite numbers.");
    if (v && typeof v === "object") Object.values(v).forEach(item => rejectNonfinite(item, depth + 1));
  }
  rejectNonfinite(value);
  const clone: unknown = JSON.parse(JSON.stringify(value));
  if (!record(clone) || !json(clone)) throw new RangeError("Snapshot payload must be a JSON object.");
  return clone as StoredJsonObject;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (record(value)) return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  return JSON.stringify(value);
}

export function recommendationHistoryHasPrefix(previous: readonly RecommendationSnapshot[], next: readonly RecommendationSnapshot[]): boolean {
  return validRecommendationSnapshots(next) && next.length >= previous.length && previous.every((item, index) => canonical(item) === canonical(next[index]));
}

/** Called before calculation; generation time is deliberately excluded from equality. */
export function snapshotInputUnchanged(history: readonly RecommendationSnapshot[], context: SnapshotContext,
  channel: RecommendationSnapshot["channel"], ruleVersion: string, input: StoredJsonObject): boolean {
  const latest = [...history].reverse().find(s => s.localDate === context.localDate && s.channel === channel);
  return !!latest && latest.ruleVersion === ruleVersion && latest.timeZone === context.timeZone && canonical(latest.input) === canonical(input);
}
export function appendRecommendationSnapshot(history: readonly RecommendationSnapshot[], context: SnapshotContext,
  channel: RecommendationSnapshot["channel"], ruleVersion: string, input: StoredJsonObject, result: StoredJsonObject): RecommendationSnapshot[] {
  if (!validSnapshotContext(context) || !validRecommendationSnapshots(history)) throw new RangeError("Invalid snapshot context or history.");
  const previous = [...history].reverse().find(s => s.localDate === context.localDate && s.channel === channel);
  const revision = (previous?.revision ?? 0) + 1;
  const base = `recommendation:${context.localDate}:${channel}:${revision}`;
  const ids = new Set(history.map(s => s.id));
  let id = base, suffix = 0;
  while (ids.has(id)) id = `${base}:${++suffix}`;
  const next = [...history, { id, localDate: context.localDate, channel, revision, previousRevisionId: previous?.id ?? null,
    generatedAt: context.generatedAt, timeZone: context.timeZone, ruleVersion, input: snapshotJson(input), result: snapshotJson(result) }];
  if (!validRecommendationSnapshots(next)) throw new RangeError("Invalid recommendation snapshot.");
  return next;
}


/** Stable structural comparison for JSON input/version records. */
export const canonicalSnapshotJson = canonical;
export const validStoredJsonObject = (value: unknown): value is StoredJsonObject => record(value) && json(value);
