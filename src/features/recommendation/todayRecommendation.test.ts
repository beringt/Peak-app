import type { PeakData } from "../../types";
import { captureTodayRecommendations, readCurrentExperimentalToday, readSavedExperimentalToday } from "./todayRecommendation";
import { DEFAULT_WEEKLY_SETTINGS, currentWeeklyReview, decideWeeklyReview, evaluateAndStoreWeeklyReview, saveWeeklySettings } from "./weeklyReview";
import { getRecommendationSnapshot } from "../../utils/recommendationSnapshots";
import { createLocalPersistence } from "../../utils/localPersistence";
import { createDataExport } from "../../utils/dataExport";
import { explainDailyReason } from "./recommendationReasons";
import * as dailyEngine from "./calculateDailyTargetsV2";

const context = { localDate: "2026-11-16", generatedAt: "2026-11-16T12:00:00.000Z", timeZone: "Europe/Copenhagen" };
const confirmed = { reliableWeights: true, followedTargets: true };
function source(): PeakData {
  return { profile: { weight: 80, goal: "maintain", activityLevel: "medium", baselineInputs: { heightCm: null, ageYears: null, equationVariant: null, manualMaintenanceKcal: 3500, targetRatePercentPerWeek: 0 } },
    trainingPlan: [{ date: context.localDate, type: "rest", sessions: [] }],
    weightEntries: Array.from({ length: 14 }, (_, i) => ({ id: `day${i}`, date: `2026-11-${String(i + 2).padStart(2, "0")}`, weightKg: i < 7 ? 80 : 80.4 })) };
}
const settings = () => ({ ...DEFAULT_WEEKLY_SETTINGS, trainingBasis: "excludes-training" as const, minimumKcal: 1700, minimumConfirmed: true, locks: { ...DEFAULT_WEEKLY_SETTINGS.locks } });
const setup = () => saveWeeklySettings(source(), settings(), false);
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test("existing mode does not activate or capture v2 and opt-in produces a distinct stored stream", () => {
  const old = captureTodayRecommendations(setup(), context, false);
  expect(old.recommendationSnapshots).toHaveLength(1);
  expect(old.recommendationSnapshots![0].ruleVersion).toBe("legacy-v1");
  const opted = captureTodayRecommendations(old, context, true);
  expect(opted.recommendationSnapshots).toHaveLength(2);
  const read = readCurrentExperimentalToday(opted, context)!;
  expect(read.result.targets!.energyKcal).toBe(3500);
  expect(read.input.baseline?.method).toBe("manual");
  expect(read.input.weightEvidence!.observedKgPerWeek).toBeCloseTo(0.4, 12);
  expect(getRecommendationSnapshot(opted.recommendationSnapshots!, context.localDate)!.result.targets).toMatchObject({ energyKcal: 2460 });
});
test("unchanged captures, switching modes and restart do not duplicate experimental records", () => {
  const data = captureTodayRecommendations(setup(), context, true);
  expect(captureTodayRecommendations(data, { ...context, generatedAt: "2026-11-16T13:00:00.000Z" }, true)).toBe(data);
  expect(captureTodayRecommendations(data, context, false)).toBe(data);
  const reload = JSON.parse(JSON.stringify(data)) as PeakData;
  expect(captureTodayRecommendations(reload, context, true)).toBe(reload);
});
test("missing baseline has no invented v2 targets and an explicit path to the existing model", () => {
  const data = captureTodayRecommendations(source(), context, true), read = readCurrentExperimentalToday(data, context)!;
  expect(read.result.status).toBe("needs-input"); expect(read.result.targets).toBeNull();
  expect(read.result.reasons.map(explainDailyReason)).toContain("Choose or reconfirm your maintenance source in Weekly Review.");
  expect(getRecommendationSnapshot(data.recommendationSnapshots!, context.localDate)!.result.targets).toMatchObject({ energyKcal: 2460 });
});
test("profile change holds stale targets until a new source-matching snapshot is captured", () => {
  const data = captureTodayRecommendations(setup(), context, true), old = data.recommendationSnapshots![1];
  const changed = { ...data, profile: { ...data.profile!, weight: 82 } };
  expect(readCurrentExperimentalToday(changed, context)).toBeNull();
  const fresh = captureTodayRecommendations(changed, context, true);
  expect(readCurrentExperimentalToday(fresh, context)!.result.targets).toBeNull(); // baseline needs reconfirmation
  expect(fresh.recommendationSnapshots![1]).toEqual(old);
});
test("draft plan/weight changes become traced inputs after capture, without automatic weekly adjustment", () => {
  const data = captureTodayRecommendations(setup(), context, true), original = JSON.stringify(data.recommendationSnapshots);
  const changed: PeakData = { ...data, trainingPlan: [{ date: context.localDate, type: "strength", sessions: [{ id: "lift", type: "strength", durationMinutes: 60, intensity: "moderate" }] }],
    weightEntries: [...data.weightEntries, { id: "today", date: context.localDate, weightKg: 90 }] };
  const captured = captureTodayRecommendations(changed, context, true), read = readCurrentExperimentalToday(captured, context)!;
  expect(read.result.terms.proposedExerciseKcal).toBe(320);
  expect(read.result.targets!.energyKcal).toBe(3820);
  expect(read.result.terms.proposedWeeklyOffsetKcal).toBe(0);
  expect(read.input.weightEntries).toHaveLength(15);
  expect(JSON.stringify(data.recommendationSnapshots)).toBe(original);
});
test("accepted weekly decisions affect the experimental result once and never replace v1", () => {
  let data = evaluateAndStoreWeeklyReview(setup(), confirmed, context);
  data = decideWeeklyReview(data, currentWeeklyReview(data, context.localDate)!.id, "accept", confirmed, context);
  data = captureTodayRecommendations(data, context, true);
  const read = readCurrentExperimentalToday(data, context)!;
  expect(read.result.targets!.energyKcal).toBe(3350);
  expect(read.input.acceptedWeeklyOffset!.kcal).toBe(-150);
  expect(captureTodayRecommendations(data, context, true)).toBe(data);
  expect(getRecommendationSnapshot(data.recommendationSnapshots!, context.localDate)!.result.targets).toMatchObject({ energyKcal: 2460 });
});
test("locks and conflicting combinations are stored/explained without replacing targets", () => {
  let data = setup(); data = saveWeeklySettings(data, { ...settings(), locks: { ...settings().locks, energyKcal: 2200 } }, false);
  data = captureTodayRecommendations(data, context, true);
  expect(readCurrentExperimentalToday(data, context)!.result.targets!.energyKcal).toBe(2200);
  const changed = saveWeeklySettings(data, { ...settings(), locks: { energyKcal: 2200, proteinGrams: 160, fatGrams: 80, carbsGrams: 300 } }, false);
  const conflict = readCurrentExperimentalToday(captureTodayRecommendations(changed, context, true), context)!;
  expect(conflict.result.status).toBe("constraints-conflict"); expect(conflict.result.targets).toBeNull();
  expect(conflict.result.reasons.map(explainDailyReason).some(message => message?.includes("Saved locks conflict"))).toBe(true);
});
test("old-day reads retain original inputs/result, are detached and never invoke a calculator", () => {
  const data = captureTodayRecommendations(setup(), context, true);
  const old = data.recommendationSnapshots![1], before = JSON.stringify(old);
  const nextContext = { ...context, localDate: "2026-11-17", generatedAt: "2026-11-17T12:00:00.000Z" };
  const next = captureTodayRecommendations({ ...data, weightEntries: [] }, nextContext, true);
  const calculator = jest.spyOn(dailyEngine, "calculateDailyTargetsV2").mockImplementation(() => { throw new Error("Historical calculator replay"); });
  try {
    const read = readSavedExperimentalToday(next.recommendationSnapshots!.find(s => s.id === old.id)!)!;
    expect(read.snapshot.localDate).toBe("2026-11-16"); expect(read.result.targets!.energyKcal).toBe(3500);
    read.result.targets!.energyKcal = 1;
    expect(JSON.stringify(old)).toBe(before);
    expect(next.recommendationSnapshots![1]).toEqual(old);
  } finally { calculator.mockRestore(); }
});
test("unsupported saved format is held instead of recalculating it", () => {
  const data = captureTodayRecommendations(setup(), context, true), bad = JSON.parse(JSON.stringify(data.recommendationSnapshots![1]));
  delete bad.result.terms;
  expect(readSavedExperimentalToday(bad)).toBeNull();
  const old = JSON.parse(JSON.stringify(data.recommendationSnapshots![1])); delete old.input.weightEvidence;
  expect(readSavedExperimentalToday(old)!.input.weightEvidence).toBeUndefined();
});
test("both stream revisions persist together, failures retry the same IDs, export/reset keep their semantics", async () => {
  let raw: string | null = JSON.stringify({ version: 5, data: captureTodayRecommendations(setup(), context, true) });
  const original = raw;
  const storage = { read: jest.fn(async () => raw), write: jest.fn(async (next: string) => { raw = next; }), remove: jest.fn(async () => { raw = null; }) };
  const app = createLocalPersistence(storage); await app.load();
  storage.write.mockRejectedValueOnce(new Error("quota"));
  app.update(data => captureTodayRecommendations({ ...data, weightEntries: [...data.weightEntries, { id: "new", date: context.localDate, weightKg: 81 }] }, context, true));
  await tick(); expect(app.getSnapshot().saveStatus).toBe("error"); expect(raw).toBe(original);
  const ids = app.getSnapshot().data.recommendationSnapshots!.map(s => s.id);
  app.retrySave(); await tick(); expect(app.getSnapshot().saveStatus).toBe("saved");
  const restarted = createLocalPersistence(storage); await restarted.load();
  expect(restarted.getSnapshot().data.recommendationSnapshots!.map(s => s.id)).toEqual(ids);
  expect(JSON.parse(createDataExport(restarted.getSnapshot().data)).data.recommendationSnapshots.map((s: { id: string }) => s.id)).toEqual(ids);
  await restarted.reset(); expect(raw).toBeNull();
  restarted.update(data => captureTodayRecommendations(data, context, true)); await tick(); expect(raw).toBeNull();
});


test("changed time-zone metadata holds the old view until a new matching revision is captured", () => {
  const data = captureTodayRecommendations(setup(), context, true);
  const changed = { ...context, timeZone: "America/New_York" };
  expect(readCurrentExperimentalToday(data, changed)).toBeNull();
  const fresh = captureTodayRecommendations(data, changed, true);
  expect(readCurrentExperimentalToday(fresh, changed)!.snapshot.timeZone).toBe("America/New_York");
  expect(data.recommendationSnapshots![1].timeZone).toBe("Europe/Copenhagen");
});


test("weekly provenance retains both target streams without inferring which was followed", () => {
  const earlier = { ...context, localDate: "2026-11-15", generatedAt: "2026-11-15T12:00:00.000Z" };
  const raw = setup(); raw.trainingPlan.push({ date: earlier.localDate, type: "rest", sessions: [] });
  const data = captureTodayRecommendations(raw, earlier, true);
  const review = evaluateAndStoreWeeklyReview(data, confirmed, context).weeklyReview!.records[0];
  expect(review.input.priorRecommendationDays).toBe(1);
  expect(review.input.priorRecommendationSources).toEqual(expect.arrayContaining([
    expect.objectContaining({ localDate: earlier.localDate, channel: "live", ruleVersion: "legacy-v1" }),
    expect.objectContaining({ localDate: earlier.localDate, channel: "experimental", ruleVersion: "peak-v2-draft" }),
  ]));
  expect(review.result.dataQualityFlags).toContain("followed-target-source-not-verified");
});
