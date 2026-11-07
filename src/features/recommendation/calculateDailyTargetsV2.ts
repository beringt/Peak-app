import { isDateKey } from "../../utils/date";
import { sessionsForDay, validSessions } from "../training/plannedSessions";
import { calculateDailyRecommendation } from "./calculateDailyRecommendation";
import type { DailyEngineInput, DailyEngineReason, DailyEngineResult, DailyEngineTargets } from "./dailyEngineTypes";

export const DAILY_V2_RULE_VERSION = "peak-v2-draft" as const;
const MET = { strength: { low: 3.5, moderate: 5, high: 6 }, endurance: { low: 5, moderate: 8, high: 10 } };
const ACTIVITY = { low: 1.2, medium: 1.4, high: 1.6 };
// Correct representation noise only when a discrete floor/ceiling is at an
// integer boundary; do not round canonical residuals or user locks.
const snapIntegerBoundary = (n: number) => Math.abs(n - Math.round(n)) <= 8 * Number.EPSILON * Math.max(1, Math.abs(n)) ? Math.round(n) : n;
const floor = (n: number) => Math.floor(snapIntegerBoundary(n));
const ceil = (n: number) => Math.ceil(snapIntegerBoundary(n));
const roundTo10 = (n: number) => 10 * floor(n / 10 + 0.5);
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const present = (text: unknown): text is string => typeof text === "string" && text.trim().length > 0;
const ENERGY_EPSILON = 1e-6;

function tomorrowKey(today: string): string {
  const [year, month, day] = today.split("-").map(Number);
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day + 1);
  return calendar.toISOString().slice(0, 10);
}

/** Experimental pure arithmetic; opt-in callers capture/display results separately from Existing Today. */
export function calculateDailyTargetsV2(input: DailyEngineInput): DailyEngineResult {
  const result: DailyEngineResult = {
    ruleVersion: input.ruleVersion, asOfDate: input.asOfDate, timeZone: input.timeZone,
    profileRevision: input.profileRevision, inputRevision: input.inputRevision,
    status: "outside-model", targets: null, legacyPreview: null,
    reasons: [], dataQualityFlags: [], sessionEstimates: [],
    terms: {
      restingKcal: null, baselineKcal: null, baselineSource: null, baselineRevision: null,
      proposedGoalOffsetKcal: null, proposedExerciseKcal: null, proposedWeeklyOffsetKcal: 0,
      unlockedEnergyKcal: null, appliedEnergyKcal: null,
      proteinMinGrams: null, proteinMaxGrams: null, fatMinGrams: null, fatMaxGrams: null, carbsMinGrams: null,
      prePreparationCarbsGrams: null, prePreparationFatGrams: null,
      requestedPreparationCarbsGrams: null, achievedPreparationCarbsGrams: null,
    },
  };
  const reason = (code: string, values: DailyEngineReason["values"] = {}, ids: string[] = [],
    appliedDelta: DailyEngineReason["appliedDelta"] = null, heldReason: string | null = null) => {
    const serializableValues = Object.fromEntries(Object.entries(values).map(([key, value]) =>
      [key, typeof value === "number" && !Number.isFinite(value) ? String(value) : value]));
    result.reasons.push({ code, values: serializableValues, inputRecordIds: [...ids], appliedDelta, heldReason });
  };
  function stop(status: DailyEngineResult["status"], code: string, values: DailyEngineReason["values"] = {}, ids: string[] = []): DailyEngineResult {
    result.status = status;
    reason(code, values, ids, null, code);
    if (status === "needs-input") result.dataQualityFlags.push(code);
    if (status === "needs-input" && input.profile && input.legacyFallback) {
      result.legacyPreview = { ruleVersion: "legacy-v1", recommendation: calculateDailyRecommendation({
        profile: input.profile, ...input.legacyFallback,
      }) };
      reason("legacy-preview-only", { version: "legacy-v1" }, [], null, "v2-inputs-incomplete");
    }
    return result;
  }
  if (input.ruleVersion !== DAILY_V2_RULE_VERSION) return stop("outside-model", "unsupported-rule-version");
  if (!isDateKey(input.asOfDate) || input.asOfDate === "9999-12-31" ||
    !present(input.timeZone) || !present(input.profileRevision) || !present(input.inputRevision)) {
    return stop("outside-model", "invalid-calculation-context");
  }
  const profile = input.profile;
  if (!profile) return stop("needs-input", "profile-missing");
  const W = profile.weight;
  if (!finite(W) || W <= 0 || W > 500 || !["lose", "maintain", "gain"].includes(profile.goal) ||
    !["low", "medium", "high"].includes(profile.activityLevel)) return stop("outside-model", "profile-outside-model");
  const baseline = input.baseline;
  if (!baseline) return stop("needs-input", "baseline-selection-missing");
  if (!present(baseline.source) || !present(baseline.revision)) return stop("needs-input", "baseline-provenance-missing");
  result.terms.baselineSource = baseline.source;
  result.terms.baselineRevision = baseline.revision;
  if (baseline.trainingBasis !== "excludes-training") {
    return stop("needs-input", "baseline-training-composition-unresolved", { trainingBasis: baseline.trainingBasis });
  }
  let B: number;
  if (baseline.method === "manual") {
    if (baseline.maintenanceKcal == null) return stop("needs-input", "manual-maintenance-missing");
    if (!finite(baseline.maintenanceKcal) || baseline.maintenanceKcal <= 0 || baseline.maintenanceKcal > 10000) {
      return stop("outside-model", "manual-maintenance-outside-model", { maintenanceKcal: baseline.maintenanceKcal });
    }
    B = baseline.maintenanceKcal;
    reason("manual-baseline-selected", { baselineKcal: B, source: baseline.source, revision: baseline.revision });
  } else if (baseline.method === "mifflin") {
    const values = profile.baselineInputs;
    if (!values || values.heightCm == null || values.ageYears == null || values.equationVariant == null || baseline.nonTrainingActivity == null) {
      return stop("needs-input", "estimated-baseline-inputs-missing", {
        heightCm: values?.heightCm ?? null, ageYears: values?.ageYears ?? null,
        equationVariant: values?.equationVariant ?? null, nonTrainingActivity: baseline.nonTrainingActivity ?? null,
      });
    }
    if (!finite(values.heightCm) || values.heightCm < 100 || values.heightCm > 250 ||
      !Number.isInteger(values.ageYears) || values.ageYears < 19 || values.ageYears > 78 ||
      !["plus5", "minus161"].includes(values.equationVariant) ||
      !["low", "medium", "high"].includes(baseline.nonTrainingActivity)) return stop("outside-model", "estimated-baseline-outside-model");
    const coefficient = values.equationVariant === "plus5" ? 5 : -161;
    const REE = 10 * W + 6.25 * values.heightCm - 5 * values.ageYears + coefficient;
    if (REE <= 0) return stop("outside-model", "nonpositive-resting-estimate", { restingKcal: REE });
    result.terms.restingKcal = REE;
    const factor = ACTIVITY[baseline.nonTrainingActivity];
    B = REE * factor;
    reason("estimated-baseline-selected", { weightKg: W, heightCm: values.heightCm, ageYears: values.ageYears,
      coefficient, nonTrainingFactor: factor, restingKcal: REE, baselineKcal: B, source: baseline.source, revision: baseline.revision });
  } else return stop("outside-model", "unsupported-baseline-method");
  result.terms.baselineKcal = B;

  const dates = new Set<string>();
  const ids = new Set<string>();
  for (const day of input.trainingPlan) {
    if (!isDateKey(day.date) || dates.has(day.date) || !["strength", "endurance", "rest"].includes(day.type)) return stop("outside-model", "invalid-training-plan");
    dates.add(day.date);
    const sessions = sessionsForDay(day);
    if (!validSessions(sessions) || (day.sessions !== undefined && day.type !== (sessions[0]?.type ?? "rest"))) {
      return stop("outside-model", "session-bounds-or-shape", { date: day.date,
        sessionCount: sessions.length, knownDurationMinutes: sessions.reduce((sum, s) => sum + (s.durationMinutes ?? 0), 0),
        maxAllowedSessionMinutes: 240, maxAllowedDayMinutes: 360,
      }, sessions.map(s => s.id));
    }
    for (const session of sessions) {
      if (ids.has(session.id)) return stop("outside-model", "duplicate-session-id", {}, [session.id]);
      ids.add(session.id);
    }
  }
  const today = input.trainingPlan.find(day => day.date === input.asOfDate);
  if (!today) return stop("needs-input", "today-plan-unknown");
  const sessions = sessionsForDay(today);
  if (sessions.length > 1 && input.nonOverlapConfirmed !== true) return stop("needs-input", "session-non-overlap-unconfirmed", {}, sessions.map(s => s.id));
  let exercise = 0;
  for (const session of sessions) {
    const met = session.intensity === null ? null : MET[session.type][session.intensity];
    const net = met === null || session.durationMinutes === null ? null : Math.max(met - 1, 0) * W * session.durationMinutes / 60;
    result.sessionEstimates.push({ ...session, date: today.date, met, netExerciseKcal: net });
    if (net === null) return stop("needs-input", "session-details-missing", { date: today.date, durationMinutes: session.durationMinutes, intensity: session.intensity }, [session.id]);
    exercise += net;
    reason("exercise-estimate", { date: today.date, weightKg: W, met: met!, durationMinutes: session.durationMinutes,
      netExerciseKcal: net, estimateSource: "peak-v2-draft-coarse-met" }, [session.id]);
  }
  result.terms.proposedExerciseKcal = exercise;
  const weekly = input.acceptedWeeklyOffset;
  if (weekly) {
    if (!finite(weekly.kcal) || !present(weekly.decisionId)) return stop("outside-model", "invalid-accepted-offset");
    if (weekly.baselineRevision !== baseline.revision || weekly.ruleVersion !== DAILY_V2_RULE_VERSION) return stop("needs-input", "accepted-offset-needs-review", { decisionId: weekly.decisionId });
    result.terms.proposedWeeklyOffsetKcal = weekly.kcal;
  }
  const locks = input.locks ?? {};
  for (const [key, value] of Object.entries(locks)) {
    if (!["energyKcal", "proteinGrams", "fatGrams", "carbsGrams"].includes(key) ||
      (value != null && (!finite(value) || value < 0))) return stop("outside-model", "invalid-lock", { field: key });
  }
  const goalOffset = B * ({ lose: -0.1, maintain: 0, gain: 0.05 }[profile.goal]);
  const energyBeforeRounding = B + goalOffset + result.terms.proposedWeeklyOffsetKcal + exercise;
  const unlockedEnergy = energyBeforeRounding > 0 ? roundTo10(energyBeforeRounding) : energyBeforeRounding;
  result.terms.proposedGoalOffsetKcal = goalOffset;
  result.terms.unlockedEnergyKcal = unlockedEnergy;
  const E = locks.energyKcal ?? unlockedEnergy;
  if (!finite(E) || E <= 0) return stop("constraints-conflict", "nonpositive-energy", { energyKcal: E });
  result.terms.appliedEnergyKcal = E;
  const energyHeld = locks.energyKcal != null ? "energy-locked" : null;
  reason("goal-offset", { goal: profile.goal, proposedKcal: goalOffset }, [], { amount: energyHeld ? 0 : goalOffset, unit: "kcal/day" }, energyHeld);
  reason("exercise-contribution", { proposedKcal: exercise }, sessions.map(s => s.id), { amount: energyHeld ? 0 : exercise, unit: "kcal/day" }, energyHeld);
  reason("accepted-weekly-contribution", { proposedKcal: result.terms.proposedWeeklyOffsetKcal, decisionId: weekly?.decisionId ?? null }, [],
    { amount: energyHeld ? 0 : result.terms.proposedWeeklyOffsetKcal, unit: "kcal/day" }, energyHeld);
  reason("energy-rounding", { unroundedEnergyKcal: energyBeforeRounding, roundedEnergyKcal: unlockedEnergy }, [],
    { amount: energyHeld ? 0 : unlockedEnergy - energyBeforeRounding, unit: "kcal/day" }, energyHeld);
  if (energyHeld) reason("energy-lock-preserved", { energyKcal: E, proposedUnlockedKcal: unlockedEnergy }, [], null, energyHeld);

  const P = locks.proteinGrams ?? Math.round((sessions.some(s => s.type === "strength") ? 2 : 1.8) * W);
  const Pmin = 1.2 * W, Pmax = 2.2 * W;
  const Fmin = ceil(Math.max(0.6 * W, 0.2 * E / 9)), Fmax = floor(0.35 * E / 9);
  const enduranceMinutes = sessions.filter(s => s.type === "endurance").reduce((sum, s) => sum + s.durationMinutes!, 0);
  const Cmin = enduranceMinutes === 0 ? 0 : enduranceMinutes < 60 ? 3 * W : enduranceMinutes <= 90 ? 5 * W : 6 * W;
  Object.assign(result.terms, { proteinMinGrams: Pmin, proteinMaxGrams: Pmax, fatMinGrams: Fmin, fatMaxGrams: Fmax, carbsMinGrams: Cmin });
  if (P < Pmin || P > Pmax) return stop("constraints-conflict", "protein-outside-domain", { proteinGrams: P, minimumGrams: Pmin, maximumGrams: Pmax });
  let F: number, C: number;
  if (locks.fatGrams == null && locks.carbsGrams == null) {
    const upperFat = Math.min(Fmax, floor((E - 4 * P - 4 * Cmin) / 9));
    if (Fmin > upperFat) return stop("constraints-conflict", "macro-allocation-infeasible", {
      energyKcal: E, proteinGrams: P, carbsMinGrams: Cmin, requiredMinimumKcal: 4 * P + 9 * Fmin + 4 * Cmin,
      shortfallKcal: Math.max(0, 4 * P + 9 * Fmin + 4 * Cmin - E), fatMinGrams: Fmin, fatMaxGrams: Fmax, feasibleFatMaxGrams: upperFat,
    });
    F = Math.min(upperFat, Math.max(Fmin, Math.round(0.8 * W)));
    C = (E - 4 * P - 9 * F) / 4;
  } else if (locks.fatGrams != null && locks.carbsGrams != null) {
    F = locks.fatGrams; C = locks.carbsGrams;
  } else if (locks.fatGrams != null) {
    F = locks.fatGrams; C = (E - 4 * P - 9 * F) / 4;
  } else {
    C = locks.carbsGrams!; F = (E - 4 * P - 4 * C) / 9;
  }
  const macroEnergy = 4 * P + 9 * F + 4 * C;
  if (!finite(F) || !finite(C) || F < Fmin || F > Fmax || C < Cmin || C < 0 || Math.abs(macroEnergy - E) > ENERGY_EPSILON) {
    return stop("constraints-conflict", "macro-constraints-conflict", { energyKcal: E, macroEnergyKcal: macroEnergy,
      energyDifferenceKcal: macroEnergy - E, proteinGrams: P, fatGrams: F, carbsGrams: C,
      fatMinGrams: Fmin, fatMaxGrams: Fmax, carbsMinGrams: Cmin, carbsShortfallGrams: Math.max(0, Cmin - C) });
  }
  reason("macro-allocation", { weightKg: W, energyKcal: E, proteinGrams: P, fatGrams: F, carbsGrams: C,
    enduranceMinutes, carbsMinGrams: Cmin, fatMinGrams: Fmin, fatMaxGrams: Fmax }, sessions.map(s => s.id));
  if (locks.proteinGrams != null || locks.fatGrams != null || locks.carbsGrams != null) {
    reason("macro-locks-preserved", { proteinGrams: locks.proteinGrams ?? null,
      fatGrams: locks.fatGrams ?? null, carbsGrams: locks.carbsGrams ?? null });
  }
  result.terms.prePreparationCarbsGrams = C;
  result.terms.prePreparationFatGrams = F;
  const nextDay = input.trainingPlan.find(day => day.date === tomorrowKey(input.asOfDate));
  const tomorrowSessions = nextDay ? sessionsForDay(nextDay) : null;
  const longSessions = tomorrowSessions?.filter(s => s.type === "endurance" && s.durationMinutes !== null && s.durationMinutes > 90) ?? [];
  if (longSessions.length) {
    const requestedC = 1.1 * C;
    result.terms.requestedPreparationCarbsGrams = requestedC;
    if (locks.fatGrams != null || locks.carbsGrams != null) {
      reason("preparation-held", { requestedCarbsGrams: requestedC, achievedCarbsGrams: C }, longSessions.map(s => s.id), { amount: 0, unit: "g/day" }, "macro-locked");
    } else {
      const requestedF = ceil((E - 4 * P - 4 * requestedC) / 9);
      const newF = Math.min(F, Math.max(Fmin, requestedF));
      const newC = (E - 4 * P - 9 * newF) / 4;
      reason(requestedF < Fmin ? "preparation-partial" : "preparation-applied", {
        requestedCarbsGrams: requestedC, achievedCarbsGrams: newC, fatMinGrams: Fmin,
        requestedFatGrams: requestedF, achievedFatGrams: newF,
      }, longSessions.map(s => s.id), { amount: newC - C, unit: "g/day" });
      F = newF; C = newC;
    }
    result.terms.achievedPreparationCarbsGrams = C;
  } else if (tomorrowSessions === null || tomorrowSessions.some(s => s.type === "endurance" && s.durationMinutes === null)) {
    result.dataQualityFlags.push("tomorrow-preparation-unknown");
    reason("tomorrow-preparation-unknown", { date: tomorrowKey(input.asOfDate) }, tomorrowSessions?.filter(s => s.type === "endurance").map(s => s.id) ?? [], null, "tomorrow-plan-incomplete");
  }
  const targets: DailyEngineTargets = { energyKcal: E, proteinGrams: P, fatGrams: F, carbsGrams: C };
  result.status = "ready";
  result.targets = targets;
  return result;
}
