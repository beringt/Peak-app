import type { PeakData, WeeklyReviewSettings } from "../types";
import { createLocalPersistence } from "./localPersistence";
import { createDataExport } from "./dataExport";
import { decodePersistedData, encodePersistedData } from "./persistedData";
import { validWeeklyReviewState } from "./weeklyReviewData";
import { getRecommendationSnapshot } from "./recommendationSnapshots";
import { captureLegacyRecommendation } from "../features/recommendation/captureRecommendation";
import { currentWeeklyDailyPreview, currentWeeklyReview, decideWeeklyReview, evaluateAndStoreWeeklyReview, saveWeeklySettings, DEFAULT_WEEKLY_SETTINGS } from "../features/recommendation/weeklyReview";

const context = { localDate: "2026-11-16", generatedAt: "2026-11-16T12:00:00.000Z", timeZone: "Europe/Copenhagen" };
const confirmed = { reliableWeights: true, followedTargets: true };
const settings = (): WeeklyReviewSettings => ({ ...DEFAULT_WEEKLY_SETTINGS, trainingBasis: "excludes-training", minimumKcal: 1700, minimumConfirmed: true, locks: { ...DEFAULT_WEEKLY_SETTINGS.locks } });
function source(): PeakData {
  return { profile: { weight: 80, goal: "maintain", activityLevel: "medium", baselineInputs: { heightCm: null, ageYears: null, equationVariant: null, manualMaintenanceKcal: 2200, targetRatePercentPerWeek: 0 } },
    trainingPlan: [{ date: context.localDate, type: "rest", sessions: [] }], weightEntries: Array.from({ length: 14 }, (_, i) => ({ id: `day-${i + 2}`, date: `2026-11-${String(i + 2).padStart(2, "0")}`, weightKg: i < 7 ? 80 : 80.4 })) };
}
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function storageMock(rawValue: string | null) {
  let raw = rawValue;
  return { read: jest.fn(async () => raw), write: jest.fn(async (value: string) => { raw = value; }), remove: jest.fn(async () => { raw = null; }) };
}

test("v4 migration preserves current snapshots and does not invent weekly state; v5 exports and resets reviews", async () => {
  const data = captureLegacyRecommendation(source(), context);
  const raw = JSON.stringify({ version: 4, data });
  const storage = storageMock(raw), app = createLocalPersistence(storage); await app.load();
  expect(app.getSnapshot().data).toEqual(data); expect(app.getSnapshot().data.weeklyReview).toBeUndefined();
  expect(storage.write).not.toHaveBeenCalled();
  app.update(current => saveWeeklySettings(current, settings(), false)); await tick();
  app.update(current => evaluateAndStoreWeeklyReview(current, confirmed, context)); await tick();
  const stored = JSON.parse((await storage.read())!);
  expect(stored.version).toBe(5); expect(validWeeklyReviewState(stored.data.weeklyReview)).toBe(true);
  expect(stored.data.recommendationSnapshots).toEqual(data.recommendationSnapshots);
  expect(JSON.parse(createDataExport(app.getSnapshot().data)).data).toEqual(stored.data);
  expect(await app.reset()).toBe(true); expect(await storage.read()).toBeNull();
  const restart = createLocalPersistence(storage); await restart.load(); expect(restart.getSnapshot().data.weeklyReview).toBeUndefined();
});
test("accepted offset and decision persist atomically; failure/retry/restart never compounds", async () => {
  const ready = evaluateAndStoreWeeklyReview(saveWeeklySettings(captureLegacyRecommendation(source(), context), settings(), false), confirmed, context);
  const encoded = encodePersistedData(ready); if (encoded.status !== "valid") throw Error("invalid fixture");
  const storage = storageMock(encoded.raw), app = createLocalPersistence(storage); await app.load();
  const proposalId = currentWeeklyReview(app.getSnapshot().data, context.localDate)!.id;
  storage.write.mockRejectedValueOnce(new Error("quota"));
  app.update(data => captureLegacyRecommendation(decideWeeklyReview(data, proposalId, "accept", confirmed, context), context)); await tick();
  expect(app.getSnapshot().saveStatus).toBe("error"); expect(await storage.read()).toBe(encoded.raw);
  expect(app.getSnapshot().data.weeklyReview!.basis.offsetKcal).toBe(-110);
  const decisionId = app.getSnapshot().data.weeklyReview!.basis.acceptedDecisionId;
  app.update(data => decideWeeklyReview(data, proposalId, "accept", confirmed, context)); await tick();
  expect(app.getSnapshot().saveStatus).toBe("error"); expect(storage.write).toHaveBeenCalledTimes(1);
  app.retrySave(); await tick(); expect(app.getSnapshot().saveStatus).toBe("saved");
  const restart = createLocalPersistence(storage); await restart.load();
  const data = restart.getSnapshot().data;
  expect(data.weeklyReview!.basis).toMatchObject({ offsetKcal: -110, acceptedDecisionId: decisionId });
  expect(data.weeklyReview!.records).toHaveLength(2);
  const writes = storage.write.mock.calls.length;
  restart.update(current => evaluateAndStoreWeeklyReview(current, confirmed, context)); await tick();
  expect(storage.write).toHaveBeenCalledTimes(writes);
  expect(currentWeeklyDailyPreview(data, context)?.targets?.energyKcal).toBe(2090);
  expect(getRecommendationSnapshot(data.recommendationSnapshots!, context.localDate)?.result.targets).toMatchObject({ energyKcal: 2460 });
});
test("mode and lock settings persist while an accepted period stays immutable", async () => {
  let data = evaluateAndStoreWeeklyReview(saveWeeklySettings(source(), settings(), false), confirmed, context);
  data = decideWeeklyReview(data, currentWeeklyReview(data, context.localDate)!.id, "accept", confirmed, context);
  const oldRecords = JSON.stringify(data.weeklyReview!.records);
  const storage = storageMock(JSON.stringify({ version: 5, data })); const app = createLocalPersistence(storage); await app.load();
  app.update(current => saveWeeklySettings(current, { ...settings(), mode: "aggressive", locks: { ...settings().locks, energyKcal: 2200 } }, false)); await tick();
  expect(app.getSnapshot().saveStatus).toBe("saved");
  const restart = createLocalPersistence(storage); await restart.load();
  const current = restart.getSnapshot().data;
  expect(current.weeklyReview!.settings.mode).toBe("aggressive"); expect(JSON.stringify(current.weeklyReview!.records)).toBe(oldRecords);
  expect(current.weeklyReview!.basis.offsetKcal).toBe(-110);
  expect(currentWeeklyDailyPreview(current, context)?.targets?.energyKcal).toBe(2200);
});
test.each(["drop", "rewrite", "offset"])("ordinary updates cannot %s weekly decisions or apply an unlinked offset", async kind => {
  let data = evaluateAndStoreWeeklyReview(saveWeeklySettings(source(), settings(), false), confirmed, context);
  data = decideWeeklyReview(data, currentWeeklyReview(data, context.localDate)!.id, "accept", confirmed, context);
  const original = JSON.stringify({ version: 5, data }); const storage = storageMock(original), app = createLocalPersistence(storage); await app.load();
  app.update(current => kind === "drop" ? { ...current, weeklyReview: undefined } : kind === "rewrite" ? {
    ...current, weeklyReview: { ...current.weeklyReview!, records: [] },
  } : { ...current, weeklyReview: { ...current.weeklyReview!, basis: { ...current.weeklyReview!.basis, offsetKcal: -220 } } });
  await tick(); expect(app.getSnapshot().saveStatus).toBe("error"); expect(await storage.read()).toBe(original);
  expect(app.getSnapshot().data.weeklyReview).toEqual(data.weeklyReview);
});
test("explicit baseline reset is persisted without deleting old decisions", async () => {
  let data = evaluateAndStoreWeeklyReview(saveWeeklySettings(source(), settings(), false), confirmed, context);
  data = decideWeeklyReview(data, currentWeeklyReview(data, context.localDate)!.id, "accept", confirmed, context);
  const storage = storageMock(JSON.stringify({ version: 5, data })), app = createLocalPersistence(storage); await app.load();
  app.update(current => ({ ...current, profile: { ...current.profile!, weight: 82 } })); await tick();
  app.update(current => saveWeeklySettings(current, settings(), true)); await tick();
  expect(app.getSnapshot().saveStatus).toBe("saved");
  const stored = JSON.parse((await storage.read())!).data as PeakData;
  expect(stored.weeklyReview!.basis).toMatchObject({ offsetKcal: 0, acceptedDecisionId: null, revision: 2 });
  expect(stored.weeklyReview!.records).toEqual(data.weeklyReview!.records);
});
test("invalid v5 review state and v4 extensions preserve raw data and block migration writes", async () => {
  const data = saveWeeklySettings(source(), settings(), false);
  for (const version of [4, 5]) {
    const broken = JSON.parse(JSON.stringify(data)); if (version === 5) broken.weeklyReview.basis.offsetKcal = -110;
    const raw = JSON.stringify({ version, data: broken }), storage = storageMock(raw), app = createLocalPersistence(storage);
    await app.load(); expect(app.getSnapshot().phase).toBe("invalid-data"); app.update(() => source());
    expect(storage.write).not.toHaveBeenCalled(); expect(await storage.read()).toBe(raw);
    expect(decodePersistedData(raw).status).toBe("invalid");
  }
});
