import type { PeakData } from "../types";
import type { PeakStorage } from "./persistedData";
import { decodePersistedData, encodePersistedData } from "./persistedData";
import { createLocalPersistence } from "./localPersistence";

function data(weight = 80): PeakData {
  return {
    profile: { weight, goal: "maintain", activityLevel: "medium" },
    trainingPlan: [{ date: "2026-11-07", type: "strength" }],
    weightEntries: [{ id: "one", date: "2026-11-07", weightKg: 80 }],
  };
}
function raw(value: PeakData): string {
  const encoded = encodePersistedData(value);
  if (encoded.status !== "valid") throw new Error("Invalid test data");
  return encoded.raw;
}
function storageMock(): jest.Mocked<PeakStorage> {
  return {
    read: jest.fn().mockResolvedValue(null),
    write: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test("waits for hydration, blocks early edits and never writes empty startup data", async () => {
  const storage = storageMock();
  const read = deferred<string | null>();
  storage.read.mockReturnValue(read.promise);
  const app = createLocalPersistence(storage);
  const loading = app.load();
  app.update(() => data(90));
  expect(app.getSnapshot().phase).toBe("loading");
  expect(storage.write).not.toHaveBeenCalled();
  read.resolve(raw(data()));
  await loading;
  expect(app.getSnapshot().data).toEqual(data());
  expect(app.getSnapshot().phase).toBe("ready");
  expect(storage.write).not.toHaveBeenCalled();
});

test("a fresh installation is ready without writing defaults", async () => {
  const storage = storageMock();
  const app = createLocalPersistence(storage);
  await app.load();
  expect(app.getSnapshot().data).toEqual({ profile: null, trainingPlan: [], weightEntries: [] });
  expect(app.getSnapshot().saveStatus).toBe("idle");
  expect(storage.write).not.toHaveBeenCalled();
});

test("repeated initialization shares a read and never rehydrates over edits", async () => {
  const storage = storageMock();
  const app = createLocalPersistence(storage);
  await Promise.all([app.load(), app.load()]);
  app.update(() => data());
  await app.load();
  expect(storage.read).toHaveBeenCalledTimes(1);
  expect(app.getSnapshot().data).toEqual(data());
  await settle();
});

test.each([false, true])("read failure is retryable, including synchronous failure=%s", async (sync) => {
  const storage = storageMock();
  if (sync) storage.read.mockImplementationOnce(() => { throw new Error("unavailable"); });
  else storage.read.mockRejectedValueOnce(new Error("unavailable"));
  const app = createLocalPersistence(storage);
  await app.load();
  expect(app.getSnapshot().phase).toBe("read-error");
  app.update(() => data());
  expect(storage.write).not.toHaveBeenCalled();
  storage.read.mockResolvedValue(raw(data(81)));
  await app.load();
  expect(app.getSnapshot().data).toEqual(data(81));
  expect(app.getSnapshot().phase).toBe("ready");
});

test.each([
  { stored: "{broken", phase: "invalid-data" },
  { stored: '{"version":1,"data":{}}', phase: "invalid-data" },
  { stored: '{"version":3,"data":{"future":"keep"}}', phase: "unsupported-version" },
])("protects $phase data from edits, retries and autosaving", async ({ stored, phase }) => {
  const storage = storageMock();
  storage.read.mockResolvedValue(stored);
  const app = createLocalPersistence(storage);
  await app.load();
  expect(app.getSnapshot().phase).toBe(phase);
  app.update(() => data());
  app.retrySave();
  await app.load();
  expect(app.getSnapshot().phase).toBe(phase);
  expect(storage.write).not.toHaveBeenCalled();
  expect(storage.remove).not.toHaveBeenCalled();
  storage.read.mockResolvedValue(raw(data()));
  await app.load();
  expect(app.getSnapshot().phase).toBe("ready");
});

test("serializes writes and coalesces rapid edits to the newest complete state", async () => {
  const storage = storageMock();
  const first = deferred<void>();
  storage.write.mockReturnValueOnce(first.promise);
  const app = createLocalPersistence(storage);
  await app.load();
  app.update(() => data(81));
  app.update((current) => ({ ...current, profile: { ...current.profile!, weight: 82 } }));
  app.update((current) => ({ ...current, weightEntries: [...current.weightEntries,
    { id: "two", date: "2026-11-08", weightKg: 82 }] }));
  expect(storage.write).toHaveBeenCalledTimes(1);
  expect(app.getSnapshot().saveStatus).toBe("saving");
  first.resolve();
  await settle();
  expect(storage.write).toHaveBeenCalledTimes(2);
  const result = decodePersistedData(storage.write.mock.calls[1][0]);
  expect(result.status).toBe("valid");
  if (result.status !== "valid") throw new Error("Invalid saved data");
  expect(result.value.data.profile?.weight).toBe(82);
  expect(result.value.data.weightEntries).toHaveLength(2);
  expect(app.getSnapshot().saveStatus).toBe("saved");
});

test("does not report saved until the latest pending write completes", async () => {
  const storage = storageMock();
  const first = deferred<void>();
  const second = deferred<void>();
  storage.write.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const app = createLocalPersistence(storage);
  await app.load();
  app.update(() => data(81));
  app.update(() => data(82));
  first.resolve();
  await settle();
  expect(app.getSnapshot().saveStatus).toBe("saving");
  second.resolve();
  await settle();
  expect(app.getSnapshot().saveStatus).toBe("saved");
});

test("a write failure preserves latest in-memory edits and retry saves those edits", async () => {
  const storage = storageMock();
  const first = deferred<void>();
  storage.write.mockReturnValueOnce(first.promise);
  const app = createLocalPersistence(storage);
  await app.load();
  app.update(() => data(81));
  app.update(() => data(82));
  first.reject(new Error("quota"));
  await settle();
  expect(app.getSnapshot().saveStatus).toBe("error");
  expect(app.getSnapshot().data).toEqual(data(82));
  expect(storage.write).toHaveBeenCalledTimes(1);
  app.retrySave();
  await settle();
  expect(storage.write).toHaveBeenLastCalledWith(raw(data(82)));
  expect(app.getSnapshot().saveStatus).toBe("saved");
});

test("new committed edits retry the latest data after a write failure", async () => {
  const storage = storageMock();
  storage.write.mockRejectedValueOnce(new Error("quota"));
  const app = createLocalPersistence(storage);
  await app.load();
  app.update(() => data());
  await settle();
  app.update(() => data(83));
  await settle();
  expect(storage.write).toHaveBeenLastCalledWith(raw(data(83)));
  expect(app.getSnapshot().saveError).toBeNull();
});

test("rejects invalid outgoing data and never writes a lossy payload", async () => {
  const storage = storageMock();
  const app = createLocalPersistence(storage);
  await app.load();
  app.update(() => data(NaN));
  app.retrySave();
  expect(app.getSnapshot().saveError).toBe("validation");
  expect(storage.write).not.toHaveBeenCalled();
  app.update(() => data());
  await settle();
  expect(app.getSnapshot().saveStatus).toBe("saved");
});

test("an older successful write cannot clear a newer validation error", async () => {
  const storage = storageMock();
  const pending = deferred<void>();
  storage.write.mockReturnValueOnce(pending.promise);
  const app = createLocalPersistence(storage);
  await app.load();
  app.update(() => data());
  app.update(() => data(NaN));
  pending.resolve();
  await settle();
  expect(app.getSnapshot().saveError).toBe("validation");
  expect(app.getSnapshot().saveStatus).toBe("error");
  expect(storage.write).toHaveBeenCalledTimes(1);
});

test("a new app instance restores previously committed data", async () => {
  let stored: string | null = null;
  const storage: PeakStorage = {
    read: async () => stored,
    write: async (value) => { stored = value; },
    remove: async () => { stored = null; },
  };
  const first = createLocalPersistence(storage);
  await first.load();
  first.update(() => data());
  await settle();
  const second = createLocalPersistence(storage);
  await second.load();
  expect(second.getSnapshot().data).toEqual(data());
});

test("reset waits for a pending write, discards queued saves and cannot resurrect data", async () => {
  let stored: string | null = raw(data());
  const pending = deferred<void>();
  const storage = storageMock();
  storage.read.mockImplementation(async () => stored);
  storage.write.mockImplementation(async (value) => { await pending.promise; stored = value; });
  storage.remove.mockImplementation(async () => { stored = null; });
  const app = createLocalPersistence(storage);
  await app.load();
  app.update(() => data(81));
  app.update(() => data(82));
  const reset = app.reset();
  app.update(() => data(83));
  app.retrySave();
  expect(app.getSnapshot().phase).toBe("resetting");
  expect(storage.remove).not.toHaveBeenCalled();
  pending.resolve();
  expect(await reset).toBe(true);
  await settle();
  expect(storage.write).toHaveBeenCalledTimes(1);
  expect(storage.remove).toHaveBeenCalledTimes(1);
  expect(stored).toBeNull();
  expect(app.getSnapshot().data).toEqual({ profile: null, trainingPlan: [], weightEntries: [] });
  const restarted = createLocalPersistence(storage);
  await restarted.load();
  expect(restarted.getSnapshot().data).toEqual(app.getSnapshot().data);
  app.update(() => data(85));
  await settle();
  expect(stored).toBe(raw(data(85)));
});

test("reset can drain a failed write before deleting and blocks retry writes", async () => {
  const storage = storageMock();
  const pending = deferred<void>();
  storage.write.mockReturnValueOnce(pending.promise);
  const app = createLocalPersistence(storage);
  await app.load();
  app.update(() => data());
  const reset = app.reset();
  pending.reject(new Error("write failed"));
  expect(await reset).toBe(true);
  app.retrySave();
  expect(storage.write).toHaveBeenCalledTimes(1);
  expect(app.getSnapshot().phase).toBe("ready");
  expect(app.getSnapshot().saveError).toBeNull();
});

test("deletion failure retains session data, blocks edits and can retry safely", async () => {
  const storage = storageMock();
  storage.read.mockResolvedValue(raw(data()));
  storage.remove.mockRejectedValueOnce(new Error("remove failed"));
  const app = createLocalPersistence(storage);
  await app.load();
  expect(await app.reset()).toBe(false);
  expect(app.getSnapshot().phase).toBe("reset-error");
  expect(app.getSnapshot().data).toEqual(data());
  app.update(() => data(90));
  app.retrySave();
  await app.load();
  expect(storage.write).not.toHaveBeenCalled();
  expect(app.getSnapshot().data).toEqual(data());
  expect(await app.reset()).toBe(true);
  expect(app.getSnapshot().phase).toBe("ready");
  expect(app.getSnapshot().data.profile).toBeNull();
});

test("a late hydration result cannot repopulate an explicitly reset app", async () => {
  const storage = storageMock();
  const read = deferred<string | null>();
  storage.read.mockReturnValueOnce(read.promise);
  const app = createLocalPersistence(storage);
  const load = app.load();
  await settle();
  expect(await app.reset()).toBe(true);
  read.resolve(raw(data()));
  await load;
  expect(app.getSnapshot().phase).toBe("ready");
  expect(app.getSnapshot().data.profile).toBeNull();
  expect(storage.write).not.toHaveBeenCalled();
});

test("reset shares concurrent calls and clears even unsupported saved data explicitly", async () => {
  const storage = storageMock();
  storage.read.mockResolvedValue('{"version":99,"future":"keep"}');
  const pending = deferred<void>();
  storage.remove.mockReturnValueOnce(pending.promise);
  const app = createLocalPersistence(storage);
  await app.load();
  expect(app.getSnapshot().phase).toBe("unsupported-version");
  const first = app.reset();
  const second = app.reset();
  expect(first).toBe(second);
  pending.resolve();
  expect(await first).toBe(true);
  expect(storage.remove).toHaveBeenCalledTimes(1);
  expect(app.getSnapshot().data.profile).toBeNull();
});
