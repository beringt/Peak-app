import type { PeakData, ProfileInputs } from "../types";
import { decodePersistedData, encodePersistedData } from "./persistedData";
import { createLocalPersistence } from "./localPersistence";
import { createDataExport } from "./dataExport";
import { calculateDailyRecommendation } from "../features/recommendation/calculateDailyRecommendation";

const legacy: PeakData = {
  profile: { weight: 80, goal: "lose", activityLevel: "medium" },
  trainingPlan: [{ date: "2026-11-07", type: "strength" }],
  weightEntries: [{ id: "old-b", date: "2026-11-07", weightKg: 80.2 }, { id: "old-a", date: "2026-11-07", weightKg: 80 }],
};
const inputs: ProfileInputs = { heightCm: 180, ageYears: 30, equationVariant: "plus5", manualMaintenanceKcal: 2400, targetRatePercentPerWeek: 0.25 };
const tick = () => new Promise<void>(resolve => setImmediate(resolve));

test("migrates a v1 fixture purely, preserving IDs/order, profile and unknown optional inputs", () => {
  const raw = JSON.stringify({ version: 1, data: legacy });
  expect(decodePersistedData(raw)).toEqual({ status: "valid", value: { version: 2, data: legacy } });
  expect(JSON.parse(raw).version).toBe(1);
  expect(decodePersistedData(JSON.stringify({ version: 1, data: { profile: null, trainingPlan: [], weightEntries: [] } }))).toMatchObject({ status: "valid", value: { version: 2 } });
});

test("loads v1 without rewriting the original; explicit save writes v2; reload/export/reset include new fields", async () => {
  let raw: string | null = JSON.stringify({ version: 1, data: legacy });
  const original = raw;
  const storage = { read: jest.fn(async () => raw), write: jest.fn(async (next: string) => { raw = next; }), remove: jest.fn(async () => { raw = null; }) };
  const app = createLocalPersistence(storage);
  await app.load();
  expect(raw).toBe(original);
  expect(storage.write).not.toHaveBeenCalled();
  app.update(data => ({ ...data, profile: { ...data.profile!, baselineInputs: inputs } }));
  await tick();
  expect(JSON.parse(raw!).version).toBe(2);
  const reload = createLocalPersistence(storage);
  await reload.load();
  const data = reload.getSnapshot().data;
  expect(data).toEqual({ ...legacy, profile: { ...legacy.profile!, baselineInputs: inputs } });
  expect(JSON.parse(createDataExport(data)).data).toEqual(data);
  expect(await reload.reset()).toBe(true);
  expect(raw).toBeNull();
  const afterReset = createLocalPersistence(storage);
  await afterReset.load();
  expect(afterReset.getSnapshot().data).toEqual({ profile: null, trainingPlan: [], weightEntries: [] });
});

test("failed migration leaves the original untouched and blocks writes", async () => {
  const raw = JSON.stringify({ version: 1, data: { ...legacy, profile: { ...legacy.profile, unexpected: 1 } } });
  const storage = { read: jest.fn(async () => raw), write: jest.fn(async () => {}), remove: jest.fn(async () => {}) };
  const app = createLocalPersistence(storage);
  await app.load();
  app.update(() => legacy);
  app.retrySave();
  expect(app.getSnapshot().phase).toBe("invalid-data");
  expect(storage.write).not.toHaveBeenCalled();
  expect(await storage.read()).toBe(raw);
});

test.each([
  { heightCm: 99 }, { ageYears: 30.5 }, { equationVariant: "male" },
  { manualMaintenanceKcal: Infinity }, { manualMaintenanceKcal: 0 },
  { targetRatePercentPerWeek: 0.6 }, { unexpected: true },
])("rejects invalid v2 inputs %j before encoding", change => {
  expect(encodePersistedData({ ...legacy, profile: { ...legacy.profile!, baselineInputs: { ...inputs, ...change } } } as unknown as PeakData).status).toBe("invalid");
});

test("v1 cannot contain silently accepted v2 fields; v2 accepts skipped inputs", () => {
  const data = { ...legacy, profile: { ...legacy.profile!, baselineInputs: null } };
  expect(decodePersistedData(JSON.stringify({ version: 1, data })).status).toBe("invalid");
  expect(decodePersistedData(JSON.stringify({ version: 2, data })).status).toBe("valid");
});


test("optional inputs do not activate the future recommendation rules", () => {
  const base = { profile: legacy.profile!, trainingType: "strength" as const,
    weightTrend: { direction: "stable" as const, changeKg: 0, hasEnoughData: true } };
  expect(calculateDailyRecommendation({ ...base, profile: { ...legacy.profile!, baselineInputs: inputs } }))
    .toEqual(calculateDailyRecommendation(base));
});

test("failed first v2 write retains original v1 data; retry persists all new inputs", async () => {
  let stored = JSON.stringify({ version: 1, data: legacy });
  const original = stored;
  const storage = {
    read: jest.fn(async () => stored),
    write: jest.fn(async (raw: string) => { stored = raw; }), remove: jest.fn(async () => {}),
  };
  storage.write.mockRejectedValueOnce(new Error("disk unavailable"));
  const app = createLocalPersistence(storage);
  await app.load();
  app.update(data => ({ ...data, profile: { ...data.profile!, baselineInputs: inputs } }));
  await tick();
  expect(app.getSnapshot().saveStatus).toBe("error");
  expect(stored).toBe(original);
  app.retrySave();
  await tick();
  expect(app.getSnapshot().saveStatus).toBe("saved");
  expect(decodePersistedData(stored)).toMatchObject({ status: "valid", value: { version: 2, data: { profile: { baselineInputs: inputs } } } });
});
