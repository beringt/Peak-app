import type { PeakData, WeeklyReviewSettings } from "../../types";
import type { SnapshotContext } from "../../utils/recommendationSnapshots";
import { validWeeklyReviewState } from "../../utils/weeklyReviewData";
import { calculateWeeklyReview, currentWeeklyDailyPreview, currentWeeklyReview, decideWeeklyReview, DEFAULT_WEEKLY_SETTINGS,
  evaluateAndStoreWeeklyReview, saveWeeklySettings, weeklyPeriodStart } from "./weeklyReview";

export const reviewContext: SnapshotContext = { localDate: "2026-11-16", generatedAt: "2026-11-16T12:00:00.000Z", timeZone: "Europe/Copenhagen" };
export const confirmed = { reliableWeights: true, followedTargets: true };
export const reviewSettings = (): WeeklyReviewSettings => ({ ...DEFAULT_WEEKLY_SETTINGS, trainingBasis: "excludes-training", minimumKcal: 1700,
  minimumConfirmed: true, nonOverlapConfirmed: true, locks: { ...DEFAULT_WEEKLY_SETTINGS.locks } });
function dates(start: string, count: number) {
  const day = new Date(start + "T12:00:00Z");
  return Array.from({ length: count }, (_, i) => { const d = new Date(day); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); });
}
export function reviewSource(recent = 80.4, goal: "lose" | "maintain" | "gain" = "maintain"): PeakData {
  return { profile: { weight: 80, goal, activityLevel: "medium", baselineInputs: { heightCm: 180, ageYears: 30, equationVariant: "plus5", manualMaintenanceKcal: 2200, targetRatePercentPerWeek: goal === "maintain" ? 0 : null } },
    trainingPlan: dates("2026-11-16", 7).map(date => ({ date, type: "rest", sessions: [] })),
    weightEntries: [...dates("2026-11-02", 7).map(date => ({ id: date, date, weightKg: 80 })), ...dates("2026-11-09", 7).map(date => ({ id: date, date, weightKg: recent }))] };
}
const setup = (recent = 80.4, goal: "lose" | "maintain" | "gain" = "maintain", settings = reviewSettings()) => saveWeeklySettings(reviewSource(recent, goal), settings, false);
function proposed(data = setup()) { return evaluateAndStoreWeeklyReview(data, confirmed, reviewContext); }
function accept(data: PeakData) { return decideWeeklyReview(data, currentWeeklyReview(data, reviewContext.localDate)!.id, "accept", confirmed, reviewContext); }

test.each([["2026-11-16", "2026-11-16"], ["2026-11-18", "2026-11-16"], ["2026-11-22", "2026-11-16"], ["2027-01-01", "2026-12-28"], ["2028-02-29", "2028-02-28"], ["2026-03-29", "2026-03-23"]])("fixed Monday for %s is %s", (day, expected) => expect(weeklyPeriodStart(day)).toBe(expected));
test("golden maintenance scenario proposes -110 once with exact evidence, bounds and previews", () => {
  const record = calculateWeeklyReview(setup(), confirmed, reviewContext);
  expect(record.status).toBe("proposed"); expect(record.oldOffsetKcal).toBe(0); expect(record.proposedOffsetKcal).toBe(-110);
  expect(record.result).toMatchObject({ baselineKcal: 2200, targetKgPerWeek: 0, toleranceKgPerWeek: 0.05, stepKcal: 110, offsetCapKcal: 220,
    dailyBefore: { targets: { energyKcal: 2200 } }, dailyAfterPreview: { targets: { energyKcal: 2090, proteinGrams: 144, fatGrams: 64, carbsGrams: 234.5 } } });
  expect(record.result.observedKgPerWeek).toBeCloseTo(0.4, 12);
});
test.each([["conservative", 60], ["neutral", 110], ["aggressive", 170]] as const)("%s mode uses step %s at B2200", (mode, step) => {
  const record = calculateWeeklyReview(setup(80.4, "maintain", { ...reviewSettings(), mode }), confirmed, reviewContext);
  expect(record.result.stepKcal).toBe(step); expect(record.proposedOffsetKcal).toBe(-step);
});
test("higher manual maintenance is authoritative and per-review caps still apply", () => {
  const raw = reviewSource(); raw.profile!.baselineInputs!.manualMaintenanceKcal = 3500;
  const record = calculateWeeklyReview(saveWeeklySettings(raw, reviewSettings(), false), confirmed, reviewContext);
  expect(record.result).toMatchObject({ baselineKcal: 3500, stepKcal: 150, offsetCapKcal: 350 });
  expect(record.proposedOffsetKcal).toBe(-150);
});
test.each([
  { goal: "maintain", recent: 80, target: 0, status: "no-change", offset: 0 },
  { goal: "lose", recent: 79.8, target: -0.2, status: "no-change", offset: 0 },
  { goal: "lose", recent: 80, target: -0.2, status: "proposed", offset: -110 },
  { goal: "lose", recent: 79.6, target: -0.2, status: "proposed", offset: 110 },
  { goal: "gain", recent: 80, target: 0.1, status: "proposed", offset: 110 },
  { goal: "gain", recent: 80.1, target: 0.1, status: "no-change", offset: 0 },
  { goal: "gain", recent: 80.4, target: 0.1, status: "proposed", offset: -110 },
] as const)("goal comparison: $goal, recent=$recent", ({ goal, recent, target, status, offset }) => {
  const record = calculateWeeklyReview(setup(recent, goal), confirmed, reviewContext);
  expect(record.status).toBe(status); expect(record.result.targetKgPerWeek).toBeCloseTo(target, 12); expect(record.proposedOffsetKcal).toBe(offset);
});
test("a saved custom rate, including explicit zero, takes precedence over defaults", () => {
  const raw = reviewSource(79.6, "lose"); raw.profile!.baselineInputs!.targetRatePercentPerWeek = 0.5;
  const record = calculateWeeklyReview(saveWeeklySettings(raw, reviewSettings(), false), confirmed, reviewContext);
  expect(record.status).toBe("no-change"); expect(record.result.targetKgPerWeek).toBe(-0.4);
  const zero = reviewSource(80, "gain"); zero.profile!.baselineInputs!.targetRatePercentPerWeek = 0;
  expect(calculateWeeklyReview(saveWeeklySettings(zero, reviewSettings(), false), confirmed, reviewContext).status).toBe("no-change");
});
test("representation error at the deadband boundary does not create an adjustment, but a real excess does", () => {
  expect(calculateWeeklyReview(setup(79.85, "lose"), confirmed, reviewContext).status).toBe("no-change");
  expect(calculateWeeklyReview(setup(79.850000001, "lose"), confirmed, reviewContext).status).toBe("proposed");
});
test.each([{ reliableWeights: false, followedTargets: true }, { reliableWeights: true, followedTargets: false }])("manual confirmation gates %j", confirmations => {
  const record = calculateWeeklyReview(setup(), confirmations, reviewContext);
  expect(record.status).toBe("review-needed"); expect(record.proposedOffsetKcal).toBeNull();
});
test("sparse, stale and noisy data cannot propose unsupported changes", () => {
  for (const kind of ["sparse", "stale", "noisy"]) {
    const data = setup();
    if (kind === "sparse") data.weightEntries = data.weightEntries.slice(-1);
    if (kind === "stale") data.weightEntries = data.weightEntries.filter(e => e.date < "2026-11-14");
    if (kind === "noisy") data.weightEntries.push({ id: "outlier", date: "2026-11-15", weightKg: 100 });
    const record = calculateWeeklyReview(data, confirmed, reviewContext);
    expect(record.status).toBe(kind === "noisy" ? "review-needed" : "insufficient"); expect(record.proposedOffsetKcal).toBeNull();
  }
});
test("late-week readings do not shift the fixed Monday evidence cutoff", () => {
  const data = setup();
  data.weightEntries = data.weightEntries.filter(e => e.date < "2026-11-14");
  data.weightEntries.push({ id: "tuesday", date: "2026-11-17", weightKg: 80.4 });
  const record = calculateWeeklyReview(data, confirmed, { ...reviewContext, localDate: "2026-11-18", generatedAt: "2026-11-18T12:00:00.000Z" });
  expect(record.periodStart).toBe("2026-11-16"); expect(record.status).toBe("insufficient");
});
test("manual reductions need a reviewed lower bound, while equation mode uses its provisional REE guard", () => {
  const settings = { ...reviewSettings(), minimumKcal: null, minimumConfirmed: false };
  expect(calculateWeeklyReview(setup(80.4, "maintain", settings), confirmed, reviewContext).status).toBe("review-needed");
  const estimated = setup(80.4, "maintain", { ...settings, baselineMethod: "mifflin", nonTrainingActivity: "medium" });
  expect(calculateWeeklyReview(estimated, confirmed, reviewContext).status).toBe("proposed");
});
test("training calories cannot disguise a rest-day target below the reviewed guard", () => {
  const data = setup(80.4, "lose", { ...reviewSettings(), minimumKcal: 2000 });
  data.trainingPlan[0] = { date: "2026-11-16", type: "strength", sessions: [{ id: "lift", type: "strength", durationMinutes: 60, intensity: "moderate" }] };
  const record = calculateWeeklyReview(data, confirmed, reviewContext);
  expect(record.status).toBe("review-needed"); expect(record.result.proposedRestEnergyKcal).toBe(1870);
});
test("energy locks hold weekly changes and macro conflicts are exposed without overriding locks", () => {
  expect(calculateWeeklyReview(setup(80.4, "maintain", { ...reviewSettings(), locks: { ...reviewSettings().locks, energyKcal: 2200 } }), confirmed, reviewContext).status).toBe("locked");
  const data = setup(80.4, "maintain", { ...reviewSettings(), locks: { ...reviewSettings().locks, proteinGrams: 160, carbsGrams: 260 } });
  const record = calculateWeeklyReview(data, confirmed, reviewContext);
  expect(record.status).toBe("constraints-conflict");
  expect(record.result).toMatchObject({ dailyBefore: { status: "ready" }, dailyAfterPreview: { status: "constraints-conflict", targets: null } });
});
test("evaluation and acceptance are idempotent across repeated calls and JSON restart", () => {
  const proposal = proposed(); expect(evaluateAndStoreWeeklyReview(proposal, confirmed, reviewContext)).toBe(proposal);
  const proposalId = currentWeeklyReview(proposal, reviewContext.localDate)!.id;
  const applied = accept(proposal);
  expect(applied.weeklyReview!.basis.offsetKcal).toBe(-110); expect(applied.weeklyReview!.records).toHaveLength(2);
  expect(validWeeklyReviewState(applied.weeklyReview)).toBe(true);
  expect(decideWeeklyReview(applied, proposalId, "accept", confirmed, reviewContext)).toBe(applied);
  expect(evaluateAndStoreWeeklyReview(applied, confirmed, reviewContext)).toBe(applied);
  const restarted = JSON.parse(JSON.stringify(applied)) as PeakData;
  expect(decideWeeklyReview(restarted, proposalId, "accept", confirmed, reviewContext)).toBe(restarted);
  expect(currentWeeklyDailyPreview(restarted, reviewContext)?.targets?.energyKcal).toBe(2090);
});
test("a declined proposal changes no offset and repeated decline creates no duplicate", () => {
  const proposal = proposed(), id = currentWeeklyReview(proposal, reviewContext.localDate)!.id;
  const declined = decideWeeklyReview(proposal, id, "decline", { reliableWeights: false, followedTargets: false }, reviewContext);
  expect(declined.weeklyReview!.basis.offsetKcal).toBe(0); expect(declined.weeklyReview!.records).toHaveLength(2);
  expect(decideWeeklyReview(declined, id, "decline", confirmed, reviewContext)).toBe(declined);
  expect(validWeeklyReviewState(declined.weeklyReview)).toBe(true);
});
test("changed weights, settings or day require a new preview before acceptance", () => {
  const original = proposed(), id = currentWeeklyReview(original, reviewContext.localDate)!.id;
  const changedWeights = { ...original, weightEntries: [...original.weightEntries, { id: "later", date: "2026-11-16", weightKg: 80.5 }] };
  expect(() => decideWeeklyReview(changedWeights, id, "accept", confirmed, reviewContext)).toThrow(/Evaluate again/);
  const changedSettings = saveWeeklySettings(original, { ...reviewSettings(), mode: "aggressive" }, false);
  expect(() => decideWeeklyReview(changedSettings, id, "accept", confirmed, reviewContext)).toThrow(/Evaluate again/);
  expect(() => decideWeeklyReview(original, id, "accept", confirmed, { ...reviewContext, localDate: "2026-11-17" })).toThrow(/Evaluate again/);
});
test("changing mode after acceptance cannot produce a second adjustment in the period", () => {
  const accepted = accept(proposed());
  const changed = saveWeeklySettings(accepted, { ...reviewSettings(), mode: "aggressive" }, false);
  expect(evaluateAndStoreWeeklyReview(changed, confirmed, reviewContext)).toBe(changed);
  expect(changed.weeklyReview!.basis.offsetKcal).toBe(-110);
});
test("profile/goal changes hold the old offset until explicit reset while retaining all decisions", () => {
  const accepted = accept(proposed());
  const changed: PeakData = { ...accepted, profile: { ...accepted.profile!, goal: "lose", baselineInputs: { ...accepted.profile!.baselineInputs!, targetRatePercentPerWeek: null } } };
  expect(calculateWeeklyReview(changed, confirmed, reviewContext).status).toBe("review-needed");
  expect(currentWeeklyDailyPreview(changed, reviewContext)).toBeNull();
  expect(() => saveWeeklySettings(changed, reviewSettings(), false)).toThrow(/Confirm resetting/);
  const reset = saveWeeklySettings(changed, reviewSettings(), true);
  expect(reset.weeklyReview!.basis.offsetKcal).toBe(0); expect(reset.weeklyReview!.basis.baselineRevision).not.toBe(accepted.weeklyReview!.basis.baselineRevision);
  expect(reset.weeklyReview!.records).toEqual(accepted.weeklyReview!.records);
  expect(validWeeklyReviewState(reset.weeklyReview)).toBe(true);
});
test("different weeks may adjust once each until the cumulative cap is reached", () => {
  let data = accept(proposed());
  for (const [period, weight, expected] of [["2026-11-23", 80.8, -220], ["2026-11-30", 81.2, -220]] as const) {
    const newWeek = period === "2026-11-23" ? "2026-11-16" : "2026-11-23";
    data = { ...data, weightEntries: [...data.weightEntries, ...dates(newWeek, 7).map(date => ({ id: date, date, weightKg: weight }))],
      trainingPlan: [...data.trainingPlan.filter(d => d.date !== period), { date: period, type: "rest", sessions: [] }] };
    const context = { ...reviewContext, localDate: period, generatedAt: `${period}T12:00:00.000Z` };
    data = evaluateAndStoreWeeklyReview(data, confirmed, context);
    const record = currentWeeklyReview(data, period)!;
    if (record.status === "proposed") data = decideWeeklyReview(data, record.id, "accept", confirmed, context);
    else expect(record.status).toBe("no-change");
    expect(data.weeklyReview!.basis.offsetKcal).toBe(expected);
  }
  expect(validWeeklyReviewState(data.weeklyReview)).toBe(true);
});
test("pure evaluation does not mutate frozen data or read an implicit clock", () => {
  const data = setup(); const before = JSON.stringify(data);
  function freeze(v: unknown) { if (v && typeof v === "object") { Object.values(v).forEach(freeze); Object.freeze(v); } }
  freeze(data); const clock = jest.spyOn(Date, "now").mockImplementation(() => { throw Error("implicit clock"); });
  try { expect(calculateWeeklyReview(data, confirmed, reviewContext)).toEqual(calculateWeeklyReview(data, confirmed, reviewContext)); expect(JSON.stringify(data)).toBe(before); }
  finally { clock.mockRestore(); }
});


test("coverage within two windows is not a substitute for 14 elapsed days of history", () => {
  const data = setup(); data.weightEntries = data.weightEntries.filter(e => e.date >= "2026-11-05");
  const record = calculateWeeklyReview(data, confirmed, reviewContext);
  expect(record.status).toBe("insufficient"); expect(record.proposedOffsetKcal).toBeNull();
  expect(record.result.reasons).toContainEqual({ code: "fourteen-day-history-required", values: { oldestPriorMeasurementDate: "2026-11-05", requiredOnOrBefore: "2026-11-02" } });
});


test("unfinished zero-offset setup can be completed without a meaningless reset confirmation", () => {
  const initial = saveWeeklySettings(reviewSource(), { ...reviewSettings(), trainingBasis: "unknown" }, false);
  const completed = saveWeeklySettings(initial, reviewSettings(), false);
  expect(completed.weeklyReview!.basis.offsetKcal).toBe(0);
  expect(completed.weeklyReview!.basis.revision).toBe(2);
  expect(validWeeklyReviewState(completed.weeklyReview)).toBe(true);
});
