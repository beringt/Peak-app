import type { DailyRecommendation, PlannedSession, TrainingDay, UserProfile, WeightTrend } from "../../types";

export type BaselineSelection = {
  method: "manual" | "mifflin";
  source: string;
  revision: string;
  trainingBasis: "excludes-training" | "includes-training" | "unknown";
  // Used only by the selected method. Manual values are never replaced by Mifflin.
  maintenanceKcal?: number | null;
  nonTrainingActivity?: "low" | "medium" | "high" | null;
};
export type TargetLocks = {
  energyKcal?: number | null;
  proteinGrams?: number | null;
  fatGrams?: number | null;
  carbsGrams?: number | null;
};
export type DailyEngineInput = {
  ruleVersion: string;
  asOfDate: string;
  timeZone: string;
  profileRevision: string;
  inputRevision: string;
  profile: UserProfile | null;
  baseline: BaselineSelection | null;
  trainingPlan: readonly TrainingDay[];
  nonOverlapConfirmed: boolean | null;
  locks?: TargetLocks;
  acceptedWeeklyOffset?: {
    kcal: number;
    decisionId: string;
    baselineRevision: string;
    ruleVersion: string;
  } | null;
  // Explicit, separately labelled v1 preview; never substituted for v2 targets.
  legacyFallback?: { trainingType: TrainingDay["type"]; weightTrend: WeightTrend } | null;
};
export type DailyEngineTargets = {
  energyKcal: number;
  proteinGrams: number;
  fatGrams: number;
  carbsGrams: number;
};
export type DailyEngineReason = {
  code: string;
  inputRecordIds: string[];
  values: Record<string, number | string | boolean | null>;
  appliedDelta: { amount: number; unit: "kcal/day" | "g/day" } | null;
  heldReason: string | null;
};
export type DailyEngineResult = {
  ruleVersion: string;
  asOfDate: string;
  timeZone: string;
  profileRevision: string;
  inputRevision: string;
  status: "ready" | "needs-input" | "outside-model" | "constraints-conflict";
  targets: DailyEngineTargets | null;
  legacyPreview: { ruleVersion: "legacy-v1"; recommendation: DailyRecommendation | null } | null;
  reasons: DailyEngineReason[];
  dataQualityFlags: string[];
  sessionEstimates: Array<{
    id: string; date: string; type: PlannedSession["type"];
    durationMinutes: number | null; intensity: PlannedSession["intensity"];
    met: number | null; netExerciseKcal: number | null;
  }>;
  terms: {
    restingKcal: number | null;
    baselineKcal: number | null;
    baselineSource: string | null;
    baselineRevision: string | null;
    proposedGoalOffsetKcal: number | null;
    proposedExerciseKcal: number | null;
    proposedWeeklyOffsetKcal: number;
    unlockedEnergyKcal: number | null;
    appliedEnergyKcal: number | null;
    proteinMinGrams: number | null;
    proteinMaxGrams: number | null;
    fatMinGrams: number | null;
    fatMaxGrams: number | null;
    carbsMinGrams: number | null;
    prePreparationCarbsGrams: number | null;
    prePreparationFatGrams: number | null;
    requestedPreparationCarbsGrams: number | null;
    achievedPreparationCarbsGrams: number | null;
  };
};
