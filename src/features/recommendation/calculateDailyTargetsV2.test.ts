import type { PlannedSession, TrainingDay } from "../../types";
import { dayWithSessions } from "../training/plannedSessions";
import { calculateDailyRecommendation, calculateLegacyRecommendation } from "./calculateDailyRecommendation";
import { calculateDailyTargetsV2, DAILY_V2_RULE_VERSION } from "./calculateDailyTargetsV2";
import type { DailyEngineInput, DailyEngineResult } from "./dailyEngineTypes";

const TODAY = "2026-11-16", TOMORROW = "2026-11-17";
const session = (id: string, type: PlannedSession["type"], durationMinutes: number | null, intensity: PlannedSession["intensity"] = "moderate"): PlannedSession =>
  ({ id, type, durationMinutes, intensity });
const plan = (sessions: PlannedSession[] = [], next: PlannedSession[] = []): TrainingDay[] => [dayWithSessions(TODAY, sessions), dayWithSessions(TOMORROW, next)];
function input(overrides: Partial<DailyEngineInput> = {}): DailyEngineInput {
  return {
    ruleVersion: DAILY_V2_RULE_VERSION, asOfDate: TODAY, timeZone: "Europe/Copenhagen",
    profileRevision: "profile-r1", inputRevision: "inputs-r1",
    profile: { weight: 80, goal: "maintain", activityLevel: "medium" },
    baseline: { method: "manual", maintenanceKcal: 2200, trainingBasis: "excludes-training", source: "user", revision: "baseline-r1" },
    trainingPlan: plan(), nonOverlapConfirmed: true, ...overrides,
  };
}
function targets(result: DailyEngineResult) {
  expect(result.status).toBe("ready");
  if (!result.targets) throw new Error(JSON.stringify(result.reasons));
  const t = result.targets;
  expect(t.energyKcal).toBeCloseTo(4 * t.proteinGrams + 4 * t.carbsGrams + 9 * t.fatGrams, 6);
  expect(t.fatGrams).toBeGreaterThanOrEqual(result.terms.fatMinGrams!);
  expect(t.fatGrams).toBeLessThanOrEqual(result.terms.fatMaxGrams!);
  expect(t.carbsGrams).toBeGreaterThanOrEqual(result.terms.carbsMinGrams!);
  return t;
}

test.each([
  { name: "maintenance rest", goal: "maintain", sessions: [], expected: [2200, 144, 64, 262], exercise: 0, offset: 0, cmin: 0 },
  { name: "lose strength", goal: "lose", sessions: [session("strength", "strength", 60)], expected: [2300, 160, 64, 271], exercise: 320, offset: -220, cmin: 0 },
  { name: "gain strength", goal: "gain", sessions: [session("strength", "strength", 60)], expected: [2630, 160, 64, 353.5], exercise: 320, offset: 110, cmin: 0 },
  { name: "endurance", goal: "maintain", sessions: [session("cycle", "endurance", 60)], expected: [2760, 144, 64, 402], exercise: 560, offset: 0, cmin: 400 },
  { name: "long endurance", goal: "maintain", sessions: [session("long", "endurance", 120)], expected: [3320, 144, 74, 519.5], exercise: 1120, offset: 0, cmin: 480 },
  { name: "mixed", goal: "maintain", sessions: [session("strength", "strength", 60), session("cycle", "endurance", 60)], expected: [3080, 160, 69, 454.75], exercise: 880, offset: 0, cmin: 400 },
] as const)("golden scenario: $name", scenario => {
  const result = calculateDailyTargetsV2(input({ profile: { weight: 80, goal: scenario.goal, activityLevel: "medium" }, trainingPlan: plan([...scenario.sessions]) }));
  const t = targets(result);
  expect([t.energyKcal, t.proteinGrams, t.fatGrams, t.carbsGrams]).toEqual(scenario.expected);
  expect(result.terms).toMatchObject({ baselineKcal: 2200, proposedExerciseKcal: scenario.exercise, proposedGoalOffsetKcal: scenario.offset, carbsMinGrams: scenario.cmin });
});
test("manual maintenance above Mifflin is authoritative and is not silently replaced", () => {
  const result = calculateDailyTargetsV2(input({
    profile: { weight: 80, goal: "maintain", activityLevel: "low", baselineInputs: { heightCm: 180, ageYears: 30, equationVariant: "plus5", manualMaintenanceKcal: 3500, targetRatePercentPerWeek: 0 } },
    baseline: { method: "manual", maintenanceKcal: 3500, trainingBasis: "excludes-training", source: "user-known-maintenance", revision: "manual-r2" },
  }));
  expect(targets(result)).toEqual({ energyKcal: 3500, proteinGrams: 144, fatGrams: 78, carbsGrams: 555.5 });
  expect(result.terms).toMatchObject({ baselineKcal: 3500, restingKcal: null, baselineSource: "user-known-maintenance", baselineRevision: "manual-r2" });
  expect(result.reasons.some(r => r.code === "estimated-baseline-selected")).toBe(false);
});
test("Mifflin uses explicitly selected non-training activity, not legacy activityLevel", () => {
  const result = calculateDailyTargetsV2(input({
    profile: { weight: 80, goal: "maintain", activityLevel: "high", baselineInputs: { heightCm: 180, ageYears: 30, equationVariant: "plus5", manualMaintenanceKcal: 3500, targetRatePercentPerWeek: 0 } },
    baseline: { method: "mifflin", nonTrainingActivity: "medium", trainingBasis: "excludes-training", source: "user-selected-estimate", revision: "estimate-r1" },
  }));
  expect(result.terms).toMatchObject({ restingKcal: 1780, baselineKcal: 2492 });
  expect(targets(result).energyKcal).toBe(2490);
});
test.each(["includes-training", "unknown"] as const)("manual baseline composition %s must be clarified, never double-counted", trainingBasis => {
  const result = calculateDailyTargetsV2(input({ baseline: { ...input().baseline!, trainingBasis } }));
  expect(result.status).toBe("needs-input"); expect(result.targets).toBeNull();
  expect(result.reasons[0].code).toBe("baseline-training-composition-unresolved");
});
test("missing selected manual value does not fall back to an estimate", () => {
  const result = calculateDailyTargetsV2(input({ baseline: { ...input().baseline!, maintenanceKcal: null } }));
  expect(result.status).toBe("needs-input"); expect(result.targets).toBeNull();
  expect(result.reasons[0].code).toBe("manual-maintenance-missing");
});
test.each([
  { baseline: null }, { profile: null }, { trainingPlan: [] },
  { baseline: { method: "mifflin" as const, nonTrainingActivity: "medium" as const, trainingBasis: "excludes-training" as const, source: "estimate", revision: "r1" } },
  { trainingPlan: plan([session("unknown-duration", "strength", null)]) },
  { trainingPlan: plan([session("unknown-intensity", "endurance", 60, null)]) },
  { nonOverlapConfirmed: false, trainingPlan: plan([session("a", "strength", 60), session("b", "endurance", 60)]) },
])("missing inputs do not fabricate v2 targets: %j", overrides => {
  const result = calculateDailyTargetsV2(input(overrides));
  expect(result.status).toBe("needs-input"); expect(result.targets).toBeNull();
  expect(result.dataQualityFlags.length).toBeGreaterThan(0);
});
test("legacy migration unknown session details are not inferred", () => {
  const result = calculateDailyTargetsV2(input({ trainingPlan: [{ date: TODAY, type: "strength" }] }));
  expect(result.status).toBe("needs-input");
  expect(result.reasons.find(r => r.code === "session-details-missing")?.inputRecordIds).toEqual([`legacy:${TODAY}`]);
});
test("legacy preview is explicitly versioned and never replaces v2 targets", () => {
  const legacyFallback = { trainingType: "rest" as const, weightTrend: { direction: "stable" as const, changeKg: 0, hasEnoughData: false } };
  const data = input({ baseline: null, legacyFallback });
  const result = calculateDailyTargetsV2(data);
  expect(result.status).toBe("needs-input"); expect(result.targets).toBeNull();
  expect(result.legacyPreview).toEqual(calculateLegacyRecommendation({ profile: data.profile, ...legacyFallback }));
  expect(result.legacyPreview?.recommendation).toEqual(calculateDailyRecommendation({ profile: data.profile, ...legacyFallback }));
  expect(calculateDailyTargetsV2(input({ baseline: null })).legacyPreview).toBeNull();
});
test.each([
  { locks: { proteinGrams: 160 }, expected: [2200, 160, 64, 246] },
  { locks: { carbsGrams: 280 }, expected: [2200, 144, 56, 280] },
  { locks: { fatGrams: 60 }, expected: [2200, 144, 60, 271] },
  { locks: { energyKcal: 2200, proteinGrams: 160, fatGrams: 64, carbsGrams: 246 }, expected: [2200, 160, 64, 246] },
])("macro locks remain exact: $locks", ({ locks, expected }) => {
  const t = targets(calculateDailyTargetsV2(input({ locks })));
  expect([t.energyKcal, t.proteinGrams, t.fatGrams, t.carbsGrams]).toEqual(expected);
});
test("fractional carb lock preserves canonical residual fat and energy", () => {
  const t = targets(calculateDailyTargetsV2(input({ locks: { carbsGrams: 280.1 } })));
  expect(t.carbsGrams).toBe(280.1); expect(t.fatGrams).toBeCloseTo((2200 - 576 - 4 * 280.1) / 9, 12);
});
test.each([
  { energyKcal: 2200, proteinGrams: 160, fatGrams: 80, carbsGrams: 300 },
  { proteinGrams: 200 }, { fatGrams: 48 }, { carbsGrams: 1000 }, { energyKcal: 0 },
])("infeasible locks never get overridden or patched with new targets: %j", locks => {
  const result = calculateDailyTargetsV2(input({ locks }));
  expect(result.status).toBe("constraints-conflict"); expect(result.targets).toBeNull();
});
test("an energy lock holds proposed exercise/weekly/goal contributions", () => {
  const result = calculateDailyTargetsV2(input({ profile: { ...input().profile!, goal: "lose" }, trainingPlan: plan([session("lift", "strength", 60)]),
    locks: { energyKcal: 2200 }, acceptedWeeklyOffset: { kcal: -110, decisionId: "review-1", baselineRevision: "baseline-r1", ruleVersion: DAILY_V2_RULE_VERSION } }));
  expect(targets(result).energyKcal).toBe(2200);
  expect(result.terms).toMatchObject({ proposedGoalOffsetKcal: -220, proposedExerciseKcal: 320, proposedWeeklyOffsetKcal: -110, unlockedEnergyKcal: 2190 });
  for (const code of ["goal-offset", "exercise-contribution", "accepted-weekly-contribution"]) {
    expect(result.reasons.find(r => r.code === code)).toMatchObject({ appliedDelta: { amount: 0, unit: "kcal/day" }, heldReason: "energy-locked" });
  }
});
test("accepted offset is consumed absolutely and never compounded by repeat calculation", () => {
  const data = input({ acceptedWeeklyOffset: { kcal: -110, decisionId: "review-1", baselineRevision: "baseline-r1", ruleVersion: DAILY_V2_RULE_VERSION } });
  const first = calculateDailyTargetsV2(data);
  expect(targets(first)).toEqual({ energyKcal: 2090, proteinGrams: 144, fatGrams: 64, carbsGrams: 234.5 });
  expect(calculateDailyTargetsV2(data)).toEqual(first);
  expect(data.acceptedWeeklyOffset!.kcal).toBe(-110);
});
test("offset provenance cannot silently transfer to a different baseline/rule revision", () => {
  const result = calculateDailyTargetsV2(input({ acceptedWeeklyOffset: { kcal: -110, decisionId: "review-1", baselineRevision: "old-baseline", ruleVersion: DAILY_V2_RULE_VERSION } }));
  expect(result.status).toBe("needs-input"); expect(result.targets).toBeNull();
});
test("long tomorrow reallocates once at fixed calories/protein", () => {
  const result = calculateDailyTargetsV2(input({ trainingPlan: plan([], [session("long", "endurance", 120)]) }));
  expect(targets(result)).toEqual({ energyKcal: 2200, proteinGrams: 144, fatGrams: 53, carbsGrams: 286.75 });
  expect(result.terms).toMatchObject({ prePreparationCarbsGrams: 262, prePreparationFatGrams: 64, achievedPreparationCarbsGrams: 286.75 });
  expect(result.terms.requestedPreparationCarbsGrams).toBeCloseTo(288.2, 12);
  const repeated = calculateDailyTargetsV2(input({ trainingPlan: plan([], [session("a", "endurance", 120), session("b", "endurance", 120)]) }));
  expect(repeated.targets).toEqual(result.targets);
  expect(repeated.reasons.filter(r => r.code.startsWith("preparation-"))).toHaveLength(1);
});
test("two short tomorrow sessions are not one long session", () => {
  expect(targets(calculateDailyTargetsV2(input({ trainingPlan: plan([], [session("a", "endurance", 60), session("b", "endurance", 60)]) }))).carbsGrams).toBe(262);
});
test("preparation holds macro locks, with no hidden calorie bonus", () => {
  const result = calculateDailyTargetsV2(input({ trainingPlan: plan([], [session("long", "endurance", 120)]), locks: { fatGrams: 64 } }));
  expect(targets(result)).toEqual({ energyKcal: 2200, proteinGrams: 144, fatGrams: 64, carbsGrams: 262 });
  expect(result.reasons.find(r => r.code === "preparation-held")?.heldReason).toBe("macro-locked");
});
test("preparation is partial when the fat floor is already reached", () => {
  const result = calculateDailyTargetsV2(input({ baseline: { ...input().baseline!, maintenanceKcal: 3000 }, trainingPlan: plan([], [session("long", "endurance", 120)]) }));
  const t = targets(result);
  expect(t.energyKcal).toBe(3000); expect(t.fatGrams).toBe(67);
  expect(result.reasons.some(r => r.code === "preparation-partial")).toBe(true);
});
test("unknown tomorrow is disclosed without fabricating preparation", () => {
  const result = calculateDailyTargetsV2(input({ trainingPlan: [dayWithSessions(TODAY, [])] }));
  expect(targets(result).carbsGrams).toBe(262);
  expect(result.dataQualityFlags).toContain("tomorrow-preparation-unknown");
});
test.each([
  { ruleVersion: "unknown" }, { asOfDate: "2026-02-29" }, { asOfDate: "9999-12-31" },
  { locks: { energyKcal: NaN } }, { trainingPlan: plan([session("too-long", "endurance", 241)]) },
  { trainingPlan: plan([session("a", "strength", 240), session("b", "endurance", 121)]) },
  { trainingPlan: plan([session("same", "strength", 60)], [session("same", "endurance", 60)]) },
  { baseline: { ...input().baseline!, maintenanceKcal: Infinity } },
])("unsupported inputs are explained and never clipped: %j", overrides => {
  const result = calculateDailyTargetsV2(input(overrides));
  expect(result.status).toBe("outside-model"); expect(result.targets).toBeNull();
});
test("same input/version is deterministic, does not mutate frozen input and reads no current clock", () => {
  const data = input({ trainingPlan: plan([session("strength", "strength", 60)], [session("long", "endurance", 120)]) });
  function freeze(value: unknown) {
    if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  }
  freeze(data); const before = JSON.stringify(data);
  const clock = jest.spyOn(Date, "now").mockImplementation(() => { throw Error("implicit clock"); });
  try {
    const first = calculateDailyTargetsV2(data);
    expect(calculateDailyTargetsV2(data)).toEqual(first);
    expect(JSON.stringify(data)).toBe(before);
  } finally { clock.mockRestore(); }
});
test.each([["2026-12-31", "2027-01-01"], ["2028-02-28", "2028-02-29"], ["2026-03-28", "2026-03-29"]])("next-day preparation uses calendar dates: %s", (today, tomorrow) => {
  const result = calculateDailyTargetsV2(input({ asOfDate: today, trainingPlan: [dayWithSessions(today, []), dayWithSessions(tomorrow, [session("long", "endurance", 120)])] }));
  expect(targets(result).carbsGrams).toBe(286.75);
});

test("infeasible default macros return an explicit shortfall without raising energy", () => {
  const result = calculateDailyTargetsV2(input({ baseline: { ...input().baseline!, maintenanceKcal: 1000 } }));
  expect(result.status).toBe("constraints-conflict"); expect(result.targets).toBeNull();
  expect(result.reasons.find(r => r.code === "macro-allocation-infeasible")?.values).toMatchObject({ energyKcal: 1000, requiredMinimumKcal: 1008, shortfallKcal: 8 });
});
test("partial minute durations use continuous tiers split at 60 and above 90", () => {
  for (const [minutes, cmin] of [[59.5, 240], [60, 400], [90, 400], [90.5, 480]]) {
    const result = calculateDailyTargetsV2(input({ baseline: { ...input().baseline!, maintenanceKcal: 3000 }, trainingPlan: plan([session("endurance", "endurance", minutes)]) }));
    targets(result);
    expect(result.terms.carbsMinGrams).toBe(cmin);
  }
});
test("all-locked macros accept only the specified energy tolerance", () => {
  expect(calculateDailyTargetsV2(input({ locks: { energyKcal: 2200 + 0.5e-6, proteinGrams: 144, fatGrams: 64, carbsGrams: 262 } })).status).toBe("ready");
  expect(calculateDailyTargetsV2(input({ locks: { energyKcal: 2200 + 2e-6, proteinGrams: 144, fatGrams: 64, carbsGrams: 262 } })).status).toBe("constraints-conflict");
});
test("invalid nonfinite diagnostic values are JSON-safe and no targets are emitted", () => {
  const result = calculateDailyTargetsV2(input({ baseline: { ...input().baseline!, maintenanceKcal: Infinity } }));
  expect(result.targets).toBeNull();
  expect(result.reasons[0].values.maintenanceKcal).toBe("Infinity");
  expect(JSON.parse(JSON.stringify(result))).toEqual(result);
});
test("returned targets satisfy independent macro/energy bounds across a model-input grid", () => {
  for (const weight of [60, 80, 100]) for (const B of [1800, 2200, 3000])
    for (const type of ["strength", "endurance"] as const) for (const minutes of [30, 60, 90, 120]) {
      const result = calculateDailyTargetsV2(input({ profile: { weight, goal: "maintain", activityLevel: "medium" },
        baseline: { ...input().baseline!, maintenanceKcal: B }, trainingPlan: plan([session("grid", type, minutes)]) }));
      if (result.status === "ready") {
        const t = targets(result);
        expect(t.proteinGrams).toBeGreaterThanOrEqual(1.2 * weight);
        expect(t.proteinGrams).toBeLessThanOrEqual(2.2 * weight);
        expect(t.energyKcal).toBe(10 * Math.floor((B + (type === "strength" ? 4 : 7) * weight * minutes / 60) / 10 + 0.5));
      } else {
        expect(result.status).toBe("constraints-conflict"); expect(result.targets).toBeNull();
      }
    }
});


test("a carbohydrate-tier jump may be infeasible and must not silently raise calories", () => {
  const result = calculateDailyTargetsV2(input({ trainingPlan: plan([session("threshold", "endurance", 90.5)]) }));
  expect(result.status).toBe("constraints-conflict");
  expect(result.targets).toBeNull();
  expect(result.terms).toMatchObject({ appliedEnergyKcal: 3040, carbsMinGrams: 480 });
});


test("decimal percentage arithmetic does not shrink a fat bound at an integer boundary", () => {
  const result = calculateDailyTargetsV2(input({ locks: { energyKcal: 1980, fatGrams: 77 } }));
  expect(result.terms.fatMaxGrams).toBe(77);
  expect(targets(result).fatGrams).toBe(77);
  const outside = calculateDailyTargetsV2(input({ locks: { energyKcal: 1980, fatGrams: 77.000000001 } }));
  expect(outside.status).toBe("constraints-conflict"); expect(outside.targets).toBeNull();
});

test("the voluntarily selected minus161 equation is calculated explicitly", () => {
  const result = calculateDailyTargetsV2(input({
    profile: { ...input().profile!, baselineInputs: { heightCm: 180, ageYears: 30, equationVariant: "minus161", manualMaintenanceKcal: null, targetRatePercentPerWeek: 0 } },
    baseline: { method: "mifflin", nonTrainingActivity: "medium", trainingBasis: "excludes-training", source: "user-selection", revision: "r2" },
  }));
  expect(result.terms.restingKcal).toBe(1614);
  expect(result.terms.baselineKcal).toBeCloseTo(2259.6, 10);
  expect(targets(result).energyKcal).toBe(2260);
});
test("missing equation variant is not inferred; out-of-domain age is not extrapolated", () => {
  const baseline = { method: "mifflin" as const, nonTrainingActivity: "medium" as const, trainingBasis: "excludes-training" as const, source: "user-selection", revision: "r2" };
  const profile = { ...input().profile!, baselineInputs: { heightCm: 180, ageYears: 30, equationVariant: null, manualMaintenanceKcal: null, targetRatePercentPerWeek: 0 } };
  expect(calculateDailyTargetsV2(input({ profile, baseline })).status).toBe("needs-input");
  expect(calculateDailyTargetsV2(input({ profile: { ...profile, baselineInputs: { ...profile.baselineInputs, ageYears: 18, equationVariant: "plus5" } }, baseline })).status).toBe("outside-model");
});
test("manual input limit is explicit and independent of the formula estimate", () => {
  expect(targets(calculateDailyTargetsV2(input({ baseline: { ...input().baseline!, maintenanceKcal: 10000 } }))).energyKcal).toBe(10000);
  expect(calculateDailyTargetsV2(input({ baseline: { ...input().baseline!, maintenanceKcal: 10000.1 } })).status).toBe("outside-model");
});
