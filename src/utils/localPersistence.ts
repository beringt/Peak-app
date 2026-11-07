import type { PeakData } from "../types";
import { decodePersistedData, encodePersistedData } from "./persistedData";
import type { PeakStorage } from "./persistedData";

type Phase = "loading" | "ready" | "read-error" | "invalid-data" | "unsupported-version" | "resetting" | "reset-error";
export type PersistenceSnapshot = {
  phase: Phase;
  data: PeakData;
  saveStatus: "idle" | "saving" | "saved" | "error";
  saveError: "write" | "validation" | null;
};

/** One app-owned instance. Writes are serial and coalesce to the newest full snapshot. */
export function createLocalPersistence(storage: PeakStorage) {
  let snapshot: PersistenceSnapshot = {
    phase: "loading",
    data: { profile: null, trainingPlan: [], weightEntries: [] },
    saveStatus: "idle",
    saveError: null,
  };
  const listeners = new Set<() => void>();
  let loadPromise: Promise<void> | null = null;
  let writing = false;
  let revision = 0;
  let savedRevision = 0;
  let latestRaw: string | null = null;
  let generation = 0;
  let pendingWrite: Promise<void> | null = null;
  let resetPromise: Promise<boolean> | null = null;

  function publish(change: Partial<PersistenceSnapshot>) {
    snapshot = { ...snapshot, ...change };
    listeners.forEach((listener) => listener());
  }

  function load(): Promise<void> {
    if (snapshot.phase === "resetting" || snapshot.phase === "reset-error") return Promise.resolve();
    if (loadPromise) return loadPromise;
    if (snapshot.phase === "ready") return Promise.resolve();
    publish({ phase: "loading" });
    const loadingGeneration = generation;
    loadPromise = Promise.resolve().then(async () => {
      try {
        const result = decodePersistedData(await storage.read());
        if (generation !== loadingGeneration) return;
        if (result.status === "valid") {
          publish({ phase: "ready", data: result.value.data });
        } else if (result.status === "missing") {
          publish({ phase: "ready" });
        } else {
          publish({ phase: result.status === "invalid" ? "invalid-data" : "unsupported-version" });
        }
      } catch {
        if (generation === loadingGeneration) publish({ phase: "read-error" });
      } finally {
        loadPromise = null;
      }
    });
    return loadPromise;
  }

  async function flush(): Promise<void> {
    if (writing || snapshot.phase !== "ready" || snapshot.saveError ||
      latestRaw === null || savedRevision === revision) return;
    writing = true;
    const writingRevision = revision;
    const raw = latestRaw;
    const writingGeneration = generation;
    pendingWrite = (async () => storage.write(raw))();
    try {
      await pendingWrite;
      if (generation !== writingGeneration) return;
      savedRevision = writingRevision;
      if (revision === writingRevision) publish({ saveStatus: "saved" });
    } catch {
      if (generation === writingGeneration) publish({ saveStatus: "error", saveError: snapshot.saveError ?? "write" });
    } finally {
      writing = false;
      pendingWrite = null;
      if (generation === writingGeneration && !snapshot.saveError && savedRevision !== revision) void flush();
    }
  }

  function update(change: (current: PeakData) => PeakData) {
    if (snapshot.phase !== "ready") return;
    const data = change(snapshot.data);
    const encoded = encodePersistedData(data);
    revision += 1;
    latestRaw = encoded.status === "valid" ? encoded.raw : null;
    publish({
      data,
      saveStatus: encoded.status === "valid" ? "saving" : "error",
      saveError: encoded.status === "valid" ? null : "validation",
    });
    void flush();
  }

  function retrySave() {
    if (snapshot.phase !== "ready" || snapshot.saveStatus !== "error") return;
    const encoded = encodePersistedData(snapshot.data);
    if (encoded.status !== "valid") return;
    latestRaw = encoded.raw;
    publish({ saveStatus: "saving", saveError: null });
    void flush();
  }

  /** Call only after explicit confirmation. Drain old writes before removing their key. */
  function reset(): Promise<boolean> {
    if (resetPromise) return resetPromise;
    generation += 1;
    latestRaw = null;
    const oldWrite = pendingWrite;
    publish({ phase: "resetting", saveStatus: "idle", saveError: null });
    resetPromise = Promise.resolve().then(async () => {
      try {
        await oldWrite?.catch(() => {});
        await storage.remove();
        revision = 0;
        savedRevision = 0;
        publish({
          phase: "ready",
          data: { profile: null, trainingPlan: [], weightEntries: [] },
          saveStatus: "idle",
          saveError: null,
        });
        return true;
      } catch {
        publish({ phase: "reset-error" });
        return false;
      } finally {
        resetPromise = null;
      }
    });
    return resetPromise;
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    load,
    update,
    retrySave,
    reset,
  };
}
