import type { PeakData, StoredJsonObject, WeeklyReviewRecord, WeeklyReviewSettings, WeeklyReviewState } from "../../types";
import type { SnapshotContext } from "../../utils/recommendationSnapshots";
import { canonicalSnapshotJson, getRecommendationSnapshot, snapshotJson, validSnapshotContext } from "../../utils/recommendationSnapshots";
import { validWeeklyReviewSettings } from "../../utils/weeklyReviewData";
import { isDateKey } from "../../utils/date";
import { calculateWeightEvidence } from "../weight/calculateWeightEvidence";
import { calculateDailyTargetsV2, DAILY_V2_RULE_VERSION } from "./calculateDailyTargetsV2";
import type { DailyEngineInput } from "./dailyEngineTypes";

export const WEEKLY_RULE_VERSION = "weekly-v1-draft";
export const DEFAULT_WEEKLY_SETTINGS: WeeklyReviewSettings = {
  mode: "neutral", baselineMethod: "manual", nonTrainingActivity: null, trainingBasis: "unknown",
  minimumKcal: null, minimumConfirmed: false, nonOverlapConfirmed: false,
  locks: { energyKcal: null, proteinGrams: null, fatGrams: null, carbsGrams: null },
};
export type ReviewConfirmations = { reliableWeights: boolean; followedTargets: boolean };
const modeRules = { conservative: { percent: 0.025, cap: 100 }, neutral: { percent: 0.05, cap: 150 }, aggressive: { percent: 0.075, cap: 200 } };
const roundTo10 = (n: number) => 10 * Math.floor(n / 10 + 0.5 + 8 * Number.EPSILON * Math.max(1, n / 10));
function calendar(date: string): Date {
  if (!isDateKey(date)) throw new RangeError("Invalid local review date.");
  const [year, month, day] = date.split("-").map(Number); const clock = new Date(0);
  clock.setUTCFullYear(year, month - 1, day); return clock;
}
export function weeklyPeriodStart(date: string): string {
  const clock = calendar(date); clock.setUTCDate(clock.getUTCDate() - (clock.getUTCDay() + 6) % 7);
  const monday = clock.toISOString().slice(0, 10);
  if (!isDateKey(monday) || monday < "0001-01-15") throw new RangeError("Review date needs 14 representable prior dates.");
  return monday;
}
export function weeklyBasisFingerprint(data: PeakData, settings: WeeklyReviewSettings): string {
  return canonicalSnapshotJson({ profile: data.profile, baselineMethod: settings.baselineMethod,
    nonTrainingActivity: settings.nonTrainingActivity, trainingBasis: settings.trainingBasis, dailyRuleVersion: DAILY_V2_RULE_VERSION, weeklyRuleVersion: WEEKLY_RULE_VERSION });
}

export function saveWeeklySettings(data: PeakData, settings: WeeklyReviewSettings, resetConfirmed: boolean): PeakData {
  if (!data.profile) throw new RangeError("Save a profile first.");
  if (!validWeeklyReviewSettings(settings)) throw new RangeError("Invalid review settings.");
  const fingerprint = weeklyBasisFingerprint(data, settings);
  const old = data.weeklyReview;
  const changedBasis = !!old && old.basis.fingerprint !== fingerprint;
  if (changedBasis && (old!.basis.acceptedDecisionId !== null || old!.basis.offsetKcal !== 0) && !resetConfirmed) throw new RangeError("Baseline or goal changed. Confirm resetting the experimental offset first.");
  if (old && !changedBasis && canonicalSnapshotJson(old.settings) === canonicalSnapshotJson(settings)) return data;
  const revision = !old ? 1 : changedBasis ? old.basis.revision + 1 : old.basis.revision;
  const basis = !old || changedBasis ? { fingerprint, revision, baselineRevision: `weekly-baseline:${revision}`, offsetKcal: 0, acceptedDecisionId: null } : old.basis;
  return { ...data, weeklyReview: { settings: JSON.parse(JSON.stringify(settings)), settingsRevision: (old?.settingsRevision ?? 0) + 1, basis, records: old?.records ?? [] } };
}

export function weeklyDailyInput(data: PeakData, context: SnapshotContext, inputRevision: string, offset?: { kcal: number; decisionId: string }): DailyEngineInput {
  const state = data.weeklyReview;
  if (!state) throw new RangeError("Save review settings first.");
  const { settings, basis } = state;
  const selectedOffset = offset ?? (basis.acceptedDecisionId ? { kcal: basis.offsetKcal, decisionId: basis.acceptedDecisionId } : null);
  return {
    asOfDate: context.localDate, timeZone: context.timeZone, ruleVersion: DAILY_V2_RULE_VERSION,
    profileRevision: `${basis.baselineRevision}:profile`, inputRevision, profile: data.profile,
    baseline: { method: settings.baselineMethod, source: settings.baselineMethod === "manual" ? "manual-profile" : "user-selected-estimate",
      revision: basis.baselineRevision, trainingBasis: settings.trainingBasis,
      maintenanceKcal: data.profile?.baselineInputs?.manualMaintenanceKcal ?? null, nonTrainingActivity: settings.nonTrainingActivity },
    trainingPlan: data.trainingPlan, nonOverlapConfirmed: settings.nonOverlapConfirmed, locks: settings.locks,
    acceptedWeeklyOffset: selectedOffset ? { ...selectedOffset, baselineRevision: basis.baselineRevision, ruleVersion: DAILY_V2_RULE_VERSION } : null,
  };
}
export function currentWeeklyDailyPreview(data: PeakData, context: SnapshotContext) {
  const state = data.weeklyReview;
  if (!state || state.basis.fingerprint !== weeklyBasisFingerprint(data, state.settings)) return null;
  const sourceId = getRecommendationSnapshot(data.recommendationSnapshots ?? [], context.localDate)?.id ?? "unrecorded-preview";
  return calculateDailyTargetsV2(weeklyDailyInput(data, context, `${sourceId}:settings-${state.settingsRevision}:decisions-${state.records.length}`));
}
function reviewKey(period: string, state: WeeklyReviewState): string {
  return `${period}|${state.basis.baselineRevision}|${WEEKLY_RULE_VERSION}|${DAILY_V2_RULE_VERSION}`;
}

/** Preview only: fixed Monday evidence, no mutation, clock access or application. */
export function calculateWeeklyReview(data: PeakData, confirmations: ReviewConfirmations, context: SnapshotContext): WeeklyReviewRecord {
  if (!validSnapshotContext(context)) throw new RangeError("Invalid review context.");
  const state = data.weeklyReview;
  if (!state) throw new RangeError("Save review settings first.");
  const period = weeklyPeriodStart(context.localDate), key = reviewKey(period, state);
  const records = state.records.filter(r => r.reviewKey === key);
  const basisMatches = state.basis.fingerprint === weeklyBasisFingerprint(data, state.settings);
  const accepted = records.find(r => r.status === "accepted");
  if (basisMatches && accepted) return JSON.parse(JSON.stringify(accepted));
  const historyStart = calendar(period); historyStart.setUTCDate(historyStart.getUTCDate() - 14);
  const priorTargets = (data.recommendationSnapshots ?? []).filter(saved =>
    saved.localDate >= historyStart.toISOString().slice(0, 10) && saved.localDate < period && saved.result.status === "ready" && saved.result.targets !== null);
  const priorRecommendationIds = priorTargets.map(saved => saved.id);
  const priorRecommendationDays = new Set(priorTargets.map(saved => saved.localDate)).size;
  const priorRecommendationSources = priorTargets.map(saved => ({ id: saved.id, localDate: saved.localDate, channel: saved.channel, ruleVersion: saved.ruleVersion }));
  const rawInput = snapshotJson({ priorRecommendationIds, priorRecommendationDays, priorRecommendationSources, ruleVersion: WEEKLY_RULE_VERSION, dailyRuleVersion: DAILY_V2_RULE_VERSION, asOfDate: context.localDate, timeZone: context.timeZone, periodStart: period,
    profile: data.profile, trainingPlan: data.trainingPlan, weightEntries: data.weightEntries,
    settings: state.settings, settingsRevision: state.settingsRevision, basis: state.basis, confirmations });
  const last = records[records.length - 1];
  const same = !!last && last.status !== "declined" && canonicalSnapshotJson(last.input) === canonicalSnapshotJson(rawInput);
  const revision = same ? last.revision : (last?.revision ?? 0) + 1;
  const id = same ? last.id : `review:${key}:${revision}`;
  const record: WeeklyReviewRecord = { id, reviewKey: key, periodStart: period, baselineRevision: state.basis.baselineRevision,
    ruleVersion: WEEKLY_RULE_VERSION, revision, previousRevisionId: same ? last.previousRevisionId : last?.id ?? null,
    createdAt: same ? last.createdAt : context.generatedAt, status: "review-needed", oldOffsetKcal: state.basis.offsetKcal,
    proposedOffsetKcal: null, input: rawInput, result: { reasons: [], dataQualityFlags: ["manual-confirmations-only", "actual-intake-and-activity-not-imported", "followed-target-source-not-verified", ...(priorRecommendationDays < 14 ? ["prior-target-history-incomplete"] : [])] } };
  const reasons: StoredJsonObject[] = [];
  record.result.reasons = reasons;
  const stop = (status: WeeklyReviewRecord["status"], code: string, values: StoredJsonObject = {}) => {
    record.status = status; reasons.push({ code, values }); return record;
  };
  if (!basisMatches) return stop("review-needed", "baseline-or-goal-changed");
  if (!data.profile) return stop("review-needed", "profile-missing");
  const beforeRequest = weeklyDailyInput(data, context, id);
  const before = calculateDailyTargetsV2(beforeRequest);
  record.result.dailyBefore = snapshotJson(before);
  if (before.status !== "ready") return stop(before.status === "constraints-conflict" ? "constraints-conflict" : "review-needed", "daily-inputs-or-constraints-unresolved");
  const B = before.terms.baselineKcal!, W = data.profile.weight;
  const evidence = calculateWeightEvidence(data.weightEntries, period);
  record.result.evidence = snapshotJson(evidence);
  if (evidence.status !== "ready") return stop(evidence.status === "insufficient-data" || evidence.status === "stale-data" ? "insufficient" : "review-needed", "weight-evidence-not-ready", { evidenceStatus: evidence.status });
  const oldestPriorDate = data.weightEntries.map(e => e.date).filter(date => date < period).sort()[0] ?? null;
  record.result.oldestPriorMeasurementDate = oldestPriorDate;
  if (oldestPriorDate === null || oldestPriorDate > evidence.previous.startDate) return stop("insufficient", "fourteen-day-history-required", { oldestPriorMeasurementDate: oldestPriorDate, requiredOnOrBefore: evidence.previous.startDate });
  if (!confirmations.reliableWeights || !confirmations.followedTargets) return stop("review-needed", "reliability-and-adherence-confirmation-required");
  if (state.settings.locks.energyKcal !== null) return stop("locked", "energy-locked");
  const absoluteRate = data.profile.baselineInputs?.targetRatePercentPerWeek;
  if (absoluteRate != null && (!Number.isFinite(absoluteRate) || absoluteRate < 0 || absoluteRate > 0.5)) return stop("review-needed", "target-rate-outside-model");
  const target = data.profile.goal === "maintain" ? 0 : (data.profile.goal === "lose" ? -1 : 1) * W *
    (absoluteRate == null ? data.profile.goal === "lose" ? 0.0025 : 0.00125 : absoluteRate / 100);
  const tolerance = Math.max(0.05, 0.0005 * W), error = evidence.observedKgPerWeek! - target;
  const mode = modeRules[state.settings.mode];
  const step = roundTo10(Math.min(mode.percent * B, mode.cap));
  const cap = 10 * Math.floor(0.1 * B / 10 + 8 * Number.EPSILON * Math.max(1, 0.1 * B / 10));
  Object.assign(record.result, { baselineKcal: B, targetKgPerWeek: target, observedKgPerWeek: evidence.observedKgPerWeek,
    toleranceKgPerWeek: tolerance, errorKgPerWeek: error, mode: state.settings.mode, stepKcal: step, offsetCapKcal: cap });
  if (Math.abs(state.basis.offsetKcal) > cap) return stop("review-needed", "existing-offset-outside-cap-reset-required");
  // Account for representation error propagated from window means and centres,
  // without widening the product deadband by a measurement-sized tolerance.
  const centreGap = evidence.recent.centreDayOrdinal! - evidence.previous.centreDayOrdinal!;
  const epsilon = 16 * Number.EPSILON * Math.max(W, evidence.previous.meanKg!, evidence.recent.meanKg!, 1) * Math.max(1, 7 / centreGap);
  if (Math.abs(error) <= tolerance + epsilon) {
    record.proposedOffsetKcal = state.basis.offsetKcal; return stop("no-change", "within-target-tolerance");
  }
  const proposed = Math.max(-cap, Math.min(cap, state.basis.offsetKcal + (error > 0 ? -step : step)));
  record.proposedOffsetKcal = proposed;
  record.result.changeKcal = proposed - state.basis.offsetKcal;
  if (proposed === state.basis.offsetKcal) return stop("no-change", "adjustment-cap-reached");
  const knownMinimum = Math.max(before.terms.restingKcal ?? 0,
    state.settings.minimumConfirmed ? state.settings.minimumKcal ?? 0 : 0);
  const restEnergy = roundTo10(B + before.terms.proposedGoalOffsetKcal! + proposed);
  Object.assign(record.result, { lowerBoundKcal: knownMinimum || null, proposedRestEnergyKcal: restEnergy });
  if ((proposed < state.basis.offsetKcal && !knownMinimum) || (knownMinimum && restEnergy + 16 * Number.EPSILON * Math.max(restEnergy, knownMinimum) < knownMinimum)) {
    return stop("review-needed", "lower-bound-review-required", { proposedRestEnergyKcal: restEnergy, lowerBoundKcal: knownMinimum || null });
  }
  const after = calculateDailyTargetsV2(weeklyDailyInput(data, context, id, { kcal: proposed, decisionId: `preview:${id}` }));
  record.result.dailyAfterPreview = snapshotJson(after);
  if (after.status !== "ready") return stop(after.status === "constraints-conflict" ? "constraints-conflict" : "review-needed", "proposed-targets-infeasible");
  return stop("proposed", "manual-acceptance-required", { oldOffsetKcal: state.basis.offsetKcal, proposedOffsetKcal: proposed });
}

export function evaluateAndStoreWeeklyReview(data: PeakData, confirmations: ReviewConfirmations, context: SnapshotContext): PeakData {
  const record = calculateWeeklyReview(data, confirmations, context), state = data.weeklyReview!;
  const existing = state.records.find(r => r.id === record.id);
  if (existing && canonicalSnapshotJson(existing) === canonicalSnapshotJson(record)) return data;
  if (existing) throw new RangeError("The same inputs/version produced different results. Review the rule version before saving.");
  return { ...data, weeklyReview: { ...state, records: [...state.records, record] } };
}
export function decideWeeklyReview(data: PeakData, proposalId: string, action: "accept" | "decline",
  confirmations: ReviewConfirmations, context: SnapshotContext): PeakData {
  if (!validSnapshotContext(context)) throw new RangeError("Invalid review context.");
  const state = data.weeklyReview;
  if (!state) throw new RangeError("Save review settings first.");
  const key = reviewKey(weeklyPeriodStart(context.localDate), state);
  if (state.records.some(r => r.reviewKey === key && r.status === "accepted")) return data;
  const latest = [...state.records].reverse().find(r => r.reviewKey === key);
  if (action === "decline" && latest?.status === "declined" && latest.previousRevisionId === proposalId) return data;
  if (!latest || latest.id !== proposalId || latest.status !== "proposed") throw new RangeError("Evaluate a current proposal first.");
  if (action === "accept") {
    const checked = calculateWeeklyReview(data, confirmations, context);
    if (canonicalSnapshotJson(checked.input) !== canonicalSnapshotJson(latest.input) || canonicalSnapshotJson(checked.result) !== canonicalSnapshotJson(latest.result) || checked.status !== "proposed") {
      throw new RangeError("Review inputs changed. Evaluate again before accepting.");
    }
  }
  const revision = latest.revision + 1, id = `review:${key}:${revision}`;
  const record: WeeklyReviewRecord = { ...JSON.parse(JSON.stringify(latest)), id, revision, previousRevisionId: latest.id,
    createdAt: context.generatedAt, status: action === "accept" ? "accepted" : "declined",
    result: { ...latest.result,
      reasons: [...(latest.result.reasons as StoredJsonObject[]).filter(r => r.code !== "manual-acceptance-required"),
        { code: action === "accept" ? "adjustment-accepted" : "proposal-declined", values: { decisionId: id } }],
      action, appliedOffsetKcal: action === "accept" ? latest.proposedOffsetKcal : state.basis.offsetKcal,
      acceptedDecisionId: action === "accept" ? id : null } };
  return { ...data, weeklyReview: { ...state,
    basis: action === "accept" ? { ...state.basis, offsetKcal: latest.proposedOffsetKcal!, acceptedDecisionId: id } : state.basis,
    records: [...state.records, record] } };
}


export function currentWeeklyReview(data: PeakData, date: string): WeeklyReviewRecord | null {
  const state = data.weeklyReview; if (!state) return null;
  const key = reviewKey(weeklyPeriodStart(date), state);
  const records = state.records.filter(r => r.reviewKey === key);
  const stored = state.basis.fingerprint === weeklyBasisFingerprint(data, state.settings)
    ? records.find(r => r.status === "accepted") ?? records[records.length - 1] ?? null
    : records[records.length - 1] ?? null;
  return stored ? JSON.parse(JSON.stringify(stored)) : null;
}
