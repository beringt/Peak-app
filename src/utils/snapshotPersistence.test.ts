import type { PeakData } from "../types";
import { captureLegacyRecommendation } from "../features/recommendation/captureRecommendation";
import { getRecommendationSnapshot } from "./recommendationSnapshots";
import type { SnapshotContext } from "./recommendationSnapshots";
import { createLocalPersistence } from "./localPersistence";
import { createDataExport } from "./dataExport";
import { decodePersistedData, encodePersistedData } from "./persistedData";

const context: SnapshotContext = { localDate: "2026-11-16", generatedAt: "2026-11-16T12:00:00.000Z", timeZone: "Europe/Copenhagen" };
const source = (): PeakData => ({ profile: { weight: 80, goal: "maintain", activityLevel: "medium" },
  trainingPlan: [{ date: context.localDate, type: "strength" }],
  weightEntries: [{ id: "original", date: "2026-11-15", weightKg: 80 }] });
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test.each([1, 2, 3, 4])("v%s migrates without invented history or eager writes; explicit capture writes v5", async version => {
  let raw: string | null = JSON.stringify({ version, data: source() });
  const original = raw;
  const storage = { read: jest.fn(async () => raw), write: jest.fn(async (next: string) => { raw = next; }), remove: jest.fn(async () => { raw = null; }) };
  const app = createLocalPersistence(storage); await app.load();
  expect(raw).toBe(original); expect(storage.write).not.toHaveBeenCalled();
  expect(app.getSnapshot().data.recommendationSnapshots).toBeUndefined();
  app.update(data => captureLegacyRecommendation(data, context)); await tick();
  expect(app.getSnapshot().saveStatus).toBe("saved");
  expect(JSON.parse(raw!).version).toBe(5);
  const reload = createLocalPersistence(storage); await reload.load();
  const data = reload.getSnapshot().data;
  expect(data.recommendationSnapshots).toHaveLength(1);
  expect(data.profile).toEqual(source().profile); expect(data.trainingPlan).toEqual(source().trainingPlan);
  expect(data.weightEntries).toEqual(source().weightEntries);
  expect(JSON.parse(createDataExport(data)).data).toEqual(data);
  const writes = storage.write.mock.calls.length;
  reload.update(current => captureLegacyRecommendation(current, { ...context, generatedAt: "2026-11-16T15:00:00.000Z" })); await tick();
  expect(storage.write).toHaveBeenCalledTimes(writes);
  expect(await reload.reset()).toBe(true); expect(raw).toBeNull();
  const afterReset = createLocalPersistence(storage); await afterReset.load();
  expect(afterReset.getSnapshot().data.recommendationSnapshots).toBeUndefined();
});
test("source changes and snapshot revision persist in one payload; failed write preserves original and retry does not duplicate", async () => {
  const first = captureLegacyRecommendation(source(), context);
  const encoded = encodePersistedData(first); if (encoded.status !== "valid") throw Error("fixture invalid");
  let raw = encoded.raw; const original = raw;
  const storage = { read: jest.fn(async () => raw), write: jest.fn(async (next: string) => { raw = next; }), remove: jest.fn(async () => {}) };
  const app = createLocalPersistence(storage); await app.load();
  storage.write.mockRejectedValueOnce(new Error("quota"));
  app.update(data => captureLegacyRecommendation({ ...data, profile: { ...data.profile!, weight: 82 } }, context)); await tick();
  expect(app.getSnapshot().saveStatus).toBe("error"); expect(raw).toBe(original);
  expect(app.getSnapshot().data.recommendationSnapshots).toHaveLength(2);
  app.update(data => captureLegacyRecommendation(data, context)); await tick();
  expect(app.getSnapshot().saveStatus).toBe("error"); expect(storage.write).toHaveBeenCalledTimes(1);
  app.retrySave(); await tick();
  expect(app.getSnapshot().saveStatus).toBe("saved");
  const stored = JSON.parse(raw).data as PeakData;
  expect(stored.profile!.weight).toBe(82); expect(stored.recommendationSnapshots).toHaveLength(2);
  expect(getRecommendationSnapshot(stored.recommendationSnapshots!, context.localDate)!.input.profile).toMatchObject({ weight: 82 });
  expect(stored.recommendationSnapshots![0]).toEqual(first.recommendationSnapshots![0]);
});
test("unchanged reads retain historical output literally without invoking a calculator", async () => {
  const data = captureLegacyRecommendation(source(), context);
  data.recommendationSnapshots![0].result.targets = { energyKcal: 1234, proteinGrams: 12, carbsGrams: 34, fatGrams: 56 };
  const raw = JSON.stringify({ version: 4, data });
  const decoded = decodePersistedData(raw);
  expect(decoded.status).toBe("valid");
  const storage = { read: jest.fn(async () => raw), write: jest.fn(async () => {}), remove: jest.fn(async () => {}) };
  const app = createLocalPersistence(storage); await app.load();
  expect(getRecommendationSnapshot(app.getSnapshot().data.recommendationSnapshots!, context.localDate)!.result.targets).toEqual({ energyKcal: 1234, proteinGrams: 12, carbsGrams: 34, fatGrams: 56 });
  app.update(current => captureLegacyRecommendation(current, context));
  expect(storage.write).not.toHaveBeenCalled();
});
test.each(["old-version-history", "broken-chain", "unknown-root-field"])("invalid migration %s preserves original and blocks writes", async variant => {
  const data = captureLegacyRecommendation(source(), context);
  if (variant === "broken-chain") data.recommendationSnapshots![0].previousRevisionId = "missing";
  const raw = JSON.stringify({ version: variant === "old-version-history" ? 3 : 4,
    data: variant === "unknown-root-field" ? { ...data, extra: true } : data });
  const storage = { read: jest.fn(async () => raw), write: jest.fn(async () => {}), remove: jest.fn(async () => {}) };
  const app = createLocalPersistence(storage); await app.load();
  expect(app.getSnapshot().phase).toBe("invalid-data"); app.update(() => source()); app.retrySave();
  expect(storage.write).not.toHaveBeenCalled(); expect(await storage.read()).toBe(raw);
});
test("failed reset retains recommendation history and retry removes it", async () => {
  const data = captureLegacyRecommendation(source(), context);
  let raw: string | null = JSON.stringify({ version: 4, data });
  const storage = { read: jest.fn(async () => raw), write: jest.fn(async (value: string) => { raw = value; }), remove: jest.fn(async () => { raw = null; }) };
  storage.remove.mockRejectedValueOnce(new Error("unavailable"));
  const app = createLocalPersistence(storage); await app.load();
  expect(await app.reset()).toBe(false); expect(app.getSnapshot().data).toEqual(data); expect(raw).not.toBeNull();
  expect(await app.reset()).toBe(true); expect(raw).toBeNull();
  expect(app.getSnapshot().data).toEqual({ profile: null, trainingPlan: [], weightEntries: [] });
});


test.each(["drop", "rewrite", "mutate"])("ordinary updates cannot %s existing history; confirmed reset is the removal path", async mode => {
  const data = captureLegacyRecommendation(source(), context);
  const original = JSON.stringify({ version: 4, data });
  let raw: string | null = original;
  const storage = { read: jest.fn(async () => raw), write: jest.fn(async (value: string) => { raw = value; }), remove: jest.fn(async () => { raw = null; }) };
  const app = createLocalPersistence(storage); await app.load();
  app.update(current => {
    if (mode === "drop") return { ...current, recommendationSnapshots: [] };
    if (mode === "mutate") { current.recommendationSnapshots![0].result.targets = { energyKcal: 1 }; return current; }
    return { ...current, recommendationSnapshots: [{ ...current.recommendationSnapshots![0], result: { ...current.recommendationSnapshots![0].result, targets: { energyKcal: 1 } } }] };
  });
  await tick();
  expect(app.getSnapshot().saveStatus).toBe("error"); expect(app.getSnapshot().saveError).toBe("validation");
  expect(app.getSnapshot().data.recommendationSnapshots).toEqual(data.recommendationSnapshots);
  expect(raw).toBe(original); expect(storage.write).not.toHaveBeenCalled();
  expect(await app.reset()).toBe(true); expect(raw).toBeNull();
});
