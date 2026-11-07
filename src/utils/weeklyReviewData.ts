import type { WeeklyReviewRecord, WeeklyReviewSettings, WeeklyReviewState } from "../types";
import { isDateKey } from "./date";
import { canonicalSnapshotJson, validStoredJsonObject } from "./recommendationSnapshots";
const object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === "string" && !!v.trim();
const number = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const keys = (v: Record<string, unknown>, expected: string[]) => Object.keys(v).length === expected.length && expected.every(k => Object.prototype.hasOwnProperty.call(v, k));
const positiveInteger = (v: unknown) => Number.isSafeInteger(v) && (v as number) > 0;
function dayOrdinal(date: string): number {
  const [y, m, d] = date.split("-").map(Number); const clock = new Date(0); clock.setUTCFullYear(y, m - 1, d); return clock.getTime() / 86400000;
}
const timestamp = (v: unknown) => { try { return typeof v === "string" && new Date(v).toISOString() === v; } catch { return false; } };

export function validWeeklyReviewSettings(v: unknown): v is WeeklyReviewSettings {
  if (!object(v) || !keys(v, ["mode", "baselineMethod", "nonTrainingActivity", "trainingBasis", "minimumKcal", "minimumConfirmed", "nonOverlapConfirmed", "locks"])) return false;
  if (!["conservative", "neutral", "aggressive"].includes(v.mode as string) || !["manual", "mifflin"].includes(v.baselineMethod as string) ||
    !(v.nonTrainingActivity === null || ["low", "medium", "high"].includes(v.nonTrainingActivity as string)) || !["excludes-training", "unknown"].includes(v.trainingBasis as string) ||
    typeof v.minimumConfirmed !== "boolean" || typeof v.nonOverlapConfirmed !== "boolean" ||
    !(v.minimumKcal === null || (number(v.minimumKcal) && v.minimumKcal > 0 && v.minimumKcal <= 10000)) ||
    !object(v.locks) || !keys(v.locks, ["energyKcal", "proteinGrams", "fatGrams", "carbsGrams"])) return false;
  return Object.values(v.locks).every(n => n === null || (number(n) && n >= 0));
}
export function validWeeklyReviewState(v: unknown): v is WeeklyReviewState {
  if (!object(v) || !keys(v, ["settings", "settingsRevision", "basis", "records"]) || !validWeeklyReviewSettings(v.settings) || !positiveInteger(v.settingsRevision) ||
    !object(v.basis) || !keys(v.basis, ["fingerprint", "revision", "baselineRevision", "offsetKcal", "acceptedDecisionId"]) ||
    !text(v.basis.fingerprint) || !text(v.basis.baselineRevision) || !positiveInteger(v.basis.revision) || !number(v.basis.offsetKcal) ||
    !(v.basis.acceptedDecisionId === null || text(v.basis.acceptedDecisionId)) || !Array.isArray(v.records)) return false;
  const ids = new Set<string>(), latest = new Map<string, WeeklyReviewRecord>(), accepted = new Set<string>();
  for (const r of v.records) {
    if (!object(r) || !keys(r, ["id", "reviewKey", "periodStart", "baselineRevision", "ruleVersion", "revision", "previousRevisionId", "createdAt", "status", "oldOffsetKcal", "proposedOffsetKcal", "input", "result"]) ||
      !text(r.id) || ids.has(r.id) || !text(r.reviewKey) || !isDateKey(r.periodStart) || (dayOrdinal(r.periodStart) + 3) % 7 !== 0 || !text(r.baselineRevision) || !text(r.ruleVersion) || !positiveInteger(r.revision) || !timestamp(r.createdAt) ||
      !["proposed", "accepted", "declined", "no-change", "insufficient", "review-needed", "locked", "constraints-conflict"].includes(r.status as string) ||
      !number(r.oldOffsetKcal) || !(r.proposedOffsetKcal === null || number(r.proposedOffsetKcal)) ||
      !validStoredJsonObject(r.input) || !validStoredJsonObject(r.result) || r.input.ruleVersion !== r.ruleVersion || r.input.periodStart !== r.periodStart ||
      !text(r.input.dailyRuleVersion) || r.reviewKey !== `${r.periodStart}|${r.baselineRevision}|${r.ruleVersion}|${r.input.dailyRuleVersion}` ||
      !isDateKey(r.input.asOfDate) || dayOrdinal(r.input.asOfDate) < dayOrdinal(r.periodStart) || dayOrdinal(r.input.asOfDate) >= dayOrdinal(r.periodStart) + 7 ||
      !object(r.input.basis) || r.input.basis.baselineRevision !== r.baselineRevision || r.input.basis.offsetKcal !== r.oldOffsetKcal || !text(r.input.timeZone) || !Array.isArray(r.result.reasons) ||
      !r.result.reasons.every(reason => object(reason) && text(reason.code)) || !Array.isArray(r.result.dataQualityFlags) || !r.result.dataQualityFlags.every(flag => typeof flag === "string")) return false;
    const previous = latest.get(r.reviewKey);
    if (r.revision !== (previous?.revision ?? 0) + 1 || r.previousRevisionId !== (previous?.id ?? null)) return false;
    if ((r.status === "proposed" || r.status === "accepted") && r.proposedOffsetKcal === null) return false;
    if ((r.status === "accepted" || r.status === "declined") && (!previous || previous.status !== "proposed" ||
      previous.oldOffsetKcal !== r.oldOffsetKcal || previous.proposedOffsetKcal !== r.proposedOffsetKcal ||
      canonicalSnapshotJson(previous.input) !== canonicalSnapshotJson(r.input))) return false;
    if (r.status === "accepted") {
      if (accepted.has(r.reviewKey) || r.result.appliedOffsetKcal !== r.proposedOffsetKcal || r.result.acceptedDecisionId !== r.id) return false;
      accepted.add(r.reviewKey);
    }
    ids.add(r.id); latest.set(r.reviewKey, r as WeeklyReviewRecord);
  }
  const basis = v.basis;
  if (basis.acceptedDecisionId === null) return basis.offsetKcal === 0;
  return v.records.some(r => r.id === basis.acceptedDecisionId && r.status === "accepted" && r.baselineRevision === basis.baselineRevision && r.proposedOffsetKcal === basis.offsetKcal);
}

export function weeklyReviewStateExtends(previous: WeeklyReviewState, next: unknown): boolean {
  if (!validWeeklyReviewState(next) || next.records.length < previous.records.length ||
    !previous.records.every((r, i) => canonicalSnapshotJson(r) === canonicalSnapshotJson(next.records[i]))) return false;
  if (next.basis.baselineRevision !== previous.basis.baselineRevision) {
    return next.basis.revision === previous.basis.revision + 1 && next.settingsRevision === previous.settingsRevision + 1 &&
      next.basis.offsetKcal === 0 && next.basis.acceptedDecisionId === null;
  }
  if (next.basis.fingerprint !== previous.basis.fingerprint || next.basis.revision !== previous.basis.revision) return false;
  if (next.basis.acceptedDecisionId === previous.basis.acceptedDecisionId) {
    if (next.basis.offsetKcal !== previous.basis.offsetKcal) return false;
  } else if (!next.records.slice(previous.records.length).some(r => r.id === next.basis.acceptedDecisionId && r.status === "accepted" && r.oldOffsetKcal === previous.basis.offsetKcal)) return false;
  const settingsChanged = canonicalSnapshotJson(next.settings) !== canonicalSnapshotJson(previous.settings);
  return next.settingsRevision === previous.settingsRevision + (settingsChanged ? 1 : 0);
}
