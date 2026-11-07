import type { WeightEntry } from "../../types";
import { isDateKey } from "../../utils/date";
import { parseWeight } from "../../utils/weight";

export type WeightMeasurement = Pick<WeightEntry, "date" | "weightKg">;
export type WeightInputResult =
  | { valid: true; measurement: WeightMeasurement }
  | { valid: false; error: string };

export function validateWeightMeasurement(weight: string, date: string, today: string): WeightInputResult {
  const weightKg = parseWeight(weight);
  if (weightKg === null) return { valid: false, error: "Enter a valid weight in kg." };
  const dateValue = date.trim();
  if (!isDateKey(dateValue)) return { valid: false, error: "Enter a valid date as YYYY-MM-DD." };
  if (dateValue > today) return { valid: false, error: "Measurement date cannot be in the future." };
  return { valid: true, measurement: { date: dateValue, weightKg } };
}

export function addWeightMeasurement(entries: WeightEntry[], measurement: WeightMeasurement): WeightEntry[] {
  const base = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  const existing = new Set(entries.map((entry) => entry.id));
  let id = base;
  let suffix = 0;
  while (existing.has(id)) id = base + "-" + (++suffix);
  return [...entries, { id, date: measurement.date, weightKg: measurement.weightKg }];
}

export function editWeightMeasurement(
  entries: WeightEntry[], id: string, measurement: WeightMeasurement
): WeightEntry[] {
  return entries.map((entry) => entry.id === id
    ? { ...entry, date: measurement.date, weightKg: measurement.weightKg } : entry);
}

export function deleteWeightMeasurement(entries: WeightEntry[], id: string): WeightEntry[] {
  return entries.filter((entry) => entry.id !== id);
}

export function newestWeightMeasurements(entries: WeightEntry[]): WeightEntry[] {
  // Array position is the creation order, including after a persisted round trip.
  // IDs are opaque and edits preserve position, so ties never rely on parsing IDs.
  return entries.map((entry, index) => ({ entry, index }))
    .sort((a, b) => b.entry.date.localeCompare(a.entry.date) || b.index - a.index)
    .map(({ entry }) => entry);
}
