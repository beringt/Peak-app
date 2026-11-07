import type { PeakData, RecommendationSnapshot, TrainingDay, WeeklyReviewSettings, WeightEntry } from "../../types";
import type { SnapshotContext } from "../../utils/recommendationSnapshots";
import { canonicalSnapshotJson, getRecommendationSnapshot } from "../../utils/recommendationSnapshots";
import { calculateWeightEvidence } from "../weight/calculateWeightEvidence";
import type { WeightEvidence } from "../weight/calculateWeightEvidence";
import { sessionsForDay, validSessions } from "../training/plannedSessions";
import { captureExperimentalRecommendation, captureLegacyRecommendation } from "./captureRecommendation";
import { DAILY_V2_RULE_VERSION } from "./calculateDailyTargetsV2";
import type { DailyEngineInput, DailyEngineResult } from "./dailyEngineTypes";
import { weeklyBasisFingerprint, weeklyDailyInput } from "./weeklyReview";

export type TodayExperimentalInput = DailyEngineInput & {
  weightEntries: readonly WeightEntry[];
  weightEvidence?: WeightEvidence;
  reviewSettings: WeeklyReviewSettings | null;
  baselineConfirmed: boolean;
};
function sourceInput(data: PeakData, context: SnapshotContext): TodayExperimentalInput {
  const liveId = getRecommendationSnapshot(data.recommendationSnapshots ?? [], context.localDate)?.id ?? "unrecorded";
  const state = data.weeklyReview;
  const baselineConfirmed = !!state && state.basis.fingerprint === weeklyBasisFingerprint(data, state.settings);
  const inputRevision = `${liveId}:settings-${state?.settingsRevision ?? 0}:reviews-${state?.records.length ?? 0}`;
  const request: DailyEngineInput = baselineConfirmed ? weeklyDailyInput(data, context, inputRevision) : {
    ruleVersion: DAILY_V2_RULE_VERSION, asOfDate: context.localDate, timeZone: context.timeZone,
    profileRevision: liveId, inputRevision, profile: data.profile, baseline: null,
    trainingPlan: data.trainingPlan, nonOverlapConfirmed: state?.settings.nonOverlapConfirmed ?? null,
    locks: state?.settings.locks,
  };
  return { ...request, weightEntries: data.weightEntries, reviewSettings: state?.settings ?? null, baselineConfirmed };
}

/** One source commit, both streams; no v2 capture until explicit opt-in. */
export function captureTodayRecommendations(data: PeakData, context: SnapshotContext, experimental: boolean): PeakData {
  const live = captureLegacyRecommendation(data, context);
  if (!experimental || live.profile === null) return live;
  const request = { ...sourceInput(live, context), weightEvidence: calculateWeightEvidence(live.weightEntries, context.localDate) };
  return captureExperimentalRecommendation(live, request, context);
}
const object = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Read the original payload only. Unsupported old formats stay preserved/exportable. */
export function readSavedExperimentalToday(snapshot: RecommendationSnapshot | null) {
  if (!snapshot || snapshot.channel !== "experimental" || snapshot.ruleVersion !== DAILY_V2_RULE_VERSION) return null;
  const detached: RecommendationSnapshot = JSON.parse(JSON.stringify(snapshot));
  const { input, result } = detached;
  if (!Array.isArray(input.trainingPlan) || !input.trainingPlan.every(day => object(day) &&
    typeof day.date === "string" && ["strength", "endurance", "rest"].includes(day.type as string) && validSessions(sessionsForDay(day as TrainingDay))) ||
    !object(result.terms) || !Array.isArray(result.sessionEstimates) || !Array.isArray(result.reasons) ||
    !result.reasons.every(r => object(r) && typeof r.code === "string" && object(r.values)) || !Array.isArray(result.dataQualityFlags)) return null;
  const evidence = input.weightEvidence;
  if (evidence !== undefined && (!object(evidence) || !object(evidence.previous) || !object(evidence.recent) ||
    !Array.isArray(evidence.previous.days) || !Array.isArray(evidence.recent.days) ||
    typeof evidence.previous.startDate !== "string" || typeof evidence.previous.endDate !== "string" ||
    typeof evidence.recent.startDate !== "string" || typeof evidence.recent.endDate !== "string" ||
    !["ready", "insufficient-data", "stale-data", "review-needed"].includes(evidence.status as string) ||
    !Array.isArray(evidence.reasons) || !evidence.reasons.every(r => object(r) && typeof r.code === "string"))) return null;
  return { snapshot: detached, input: input as unknown as TodayExperimentalInput, result: result as unknown as DailyEngineResult };
}

/** Source comparison prevents showing an old target against newly edited inputs. */
export function readCurrentExperimentalToday(data: PeakData, context: SnapshotContext) {
  const saved = getRecommendationSnapshot(data.recommendationSnapshots ?? [], context.localDate, "experimental");
  if (!saved) return null;
  const storedSource = { ...saved.input }; delete storedSource.weightEvidence;
  // JSON removes undefined optional properties, matching the stored input contract.
  const expected = JSON.parse(JSON.stringify(sourceInput(data, context)));
  if (saved.timeZone !== context.timeZone || canonicalSnapshotJson(storedSource) !== canonicalSnapshotJson(expected)) return null;
  return readSavedExperimentalToday(saved);
}
