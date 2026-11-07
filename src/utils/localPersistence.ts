import type { PeakData } from "../types";
import { decodePersistedData, encodePersistedData } from "./persistedData";
import type { PeakStorage } from "./persistedData";

type Phase = "loading" | "ready" | "read-error" | "invalid-data" | "unsupported-version";
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

  function publish(change: Partial<PersistenceSnapshot>) {
    snapshot = { ...snapshot, ...change };
    listeners.forEach((listener) => listener());
  }

  function load(): Promise<void> {
    if (loadPromise) return loadPromise;
    if (snapshot.phase === "ready") return Promise.resolve();
    publish({ phase: "loading" });
    loadPromise = Promise.resolve().then(async () => {
      try {
        const result = decodePersistedData(await storage.read());
        if (result.status === "valid") {
          publish({ phase: "ready", data: result.value.data });
        } else if (result.status === "missing") {
          publish({ phase: "ready" });
        } else {
          publish({ phase: result.status === "invalid" ? "invalid-data" : "unsupported-version" });
        }
      } catch {
        publish({ phase: "read-error" });
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
    try {
      await storage.write(raw);
      savedRevision = writingRevision;
      if (revision === writingRevision) publish({ saveStatus: "saved" });
    } catch {
      publish({ saveStatus: "error", saveError: snapshot.saveError ?? "write" });
    } finally {
      writing = false;
      if (!snapshot.saveError && savedRevision !== revision) void flush();
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

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    load,
    update,
    retrySave,
  };
}
