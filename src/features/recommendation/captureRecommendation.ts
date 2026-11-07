import type { PeakData } from "../../types";
import type { SnapshotContext } from "../../utils/recommendationSnapshots";
import { appendRecommendationSnapshot, snapshotInputUnchanged, snapshotJson, validSnapshotContext } from "../../utils/recommendationSnapshots";
import { getTodayTrainingType } from "../training/getTodayTrainingType";
import { calculateWeightTrend } from "../weight/calculateWeightTrend";
import { calculateLegacyRecommendation } from "./calculateDailyRecommendation";
import { calculateDailyTargetsV2, DAILY_V2_RULE_VERSION } from "./calculateDailyTargetsV2";
import type { DailyEngineInput } from "./dailyEngineTypes";

/** Capture current v1 inputs and output atomically with the source-data commit. */
export function captureLegacyRecommendation(data: PeakData, context: SnapshotContext): PeakData {
  if (!validSnapshotContext(context)) throw new RangeError("Invalid snapshot context.");
  if (data.profile === null) return data;
  const history = data.recommendationSnapshots ?? [];
  const input = snapshotJson({ asOfDate: context.localDate, timeZone: context.timeZone,
    profile: data.profile, trainingPlan: data.trainingPlan, weightEntries: data.weightEntries });
  if (snapshotInputUnchanged(history, context, "live", "legacy-v1", input)) return data;
  const trainingType = getTodayTrainingType(data.trainingPlan, context.localDate);
  const weightTrend = calculateWeightTrend(data.weightEntries);
  const legacy = calculateLegacyRecommendation({ profile: data.profile, trainingType, weightTrend });
  const recommendation = legacy.recommendation!;
  const result = snapshotJson({ ruleVersion: legacy.ruleVersion, status: "ready",
    targets: { energyKcal: recommendation.calories, proteinGrams: recommendation.macros.proteinGrams,
      fatGrams: recommendation.macros.fatGrams, carbsGrams: recommendation.macros.carbsGrams },
    recommendation,
    reasons: [{ code: "legacy-v1-calculation", inputRecordIds: data.weightEntries.map(e => e.id),
      values: { weightKg: data.profile.weight, goal: data.profile.goal, activityLevel: data.profile.activityLevel,
        trainingType, trendDirection: weightTrend.direction, endpointChangeKg: weightTrend.changeKg, hasEnoughLegacyWeights: weightTrend.hasEnoughData } }],
    dataQualityFlags: [weightTrend.hasEnoughData ? "legacy-endpoint-trend" : "insufficient-legacy-weight-data"],
  });
  return { ...data, recommendationSnapshots: appendRecommendationSnapshot(history, context, "live", legacy.ruleVersion, input, result) };
}

/** Experimental v2 snapshots stay separate from the live v1 stream, including in optional Today views. */
export function captureExperimentalRecommendation(data: PeakData, request: DailyEngineInput, context: SnapshotContext): PeakData {
  if (!validSnapshotContext(context) || request.asOfDate !== context.localDate || request.timeZone !== context.timeZone || request.ruleVersion !== DAILY_V2_RULE_VERSION) {
    throw new RangeError("Experimental snapshot context/version mismatch.");
  }
  const history = data.recommendationSnapshots ?? [];
  const input = snapshotJson(request);
  if (snapshotInputUnchanged(history, context, "experimental", request.ruleVersion, input)) return data;
  const result = snapshotJson(calculateDailyTargetsV2(request));
  return { ...data, recommendationSnapshots: appendRecommendationSnapshot(history, context, "experimental", request.ruleVersion, input, result) };
}
