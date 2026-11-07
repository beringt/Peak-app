import type { PeakData } from "../types";
import { encodePersistedData, PEAK_DATA_VERSION } from "./persistedData";

export function createDataExport(data: PeakData, exportedAt = new Date()): string {
  const encoded = encodePersistedData(data);
  if (encoded.status !== "valid" || !Number.isFinite(exportedAt.getTime())) {
    throw new Error("Data could not be exported.");
  }
  return JSON.stringify({
    version: PEAK_DATA_VERSION,
    exportedAt: exportedAt.toISOString(),
    data: JSON.parse(encoded.raw).data,
  }, null, 2);
}
