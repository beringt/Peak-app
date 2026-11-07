import type { WeightEntry } from "../../types";
import { decodePersistedData, encodePersistedData } from "../../utils/persistedData";
import { calculateWeightTrend } from "./calculateWeightTrend";
import {
  addWeightMeasurement, deleteWeightMeasurement, editWeightMeasurement,
  newestWeightMeasurements, validateWeightMeasurement,
} from "./weightHistory";

afterEach(() => jest.restoreAllMocks());

test.each(["", " ", "0", "-1", "500.1", "Infinity", "abc"])(
  "rejects invalid measurement weight %j", (weight) => {
    expect(validateWeightMeasurement(weight, "2026-11-07", "2026-11-07")).toEqual({
      valid: false, error: "Enter a valid weight in kg.",
    });
  }
);

test.each(["", "2026-2-01", "2026-02-29", "1900-02-29", "2026-04-31",
  "2026-13-01", "0000-01-01", "2026-11-07T00:00:00Z"])(
  "rejects invalid calendar date %j", (date) => {
    expect(validateWeightMeasurement("80", date, "2026-11-07")).toEqual({
      valid: false, error: "Enter a valid date as YYYY-MM-DD.",
    });
  }
);

test("rejects tomorrow even when it is a valid calendar date", () => {
  expect(validateWeightMeasurement("80", "2026-11-08", "2026-11-07")).toEqual({
    valid: false, error: "Measurement date cannot be in the future.",
  });
});

test.each([
  { date: "2026-11-07", weight: "500", expected: 500 },
  { date: "2026-01-01", weight: " 80,5 ", expected: 80.5 },
  { date: "2024-02-29", weight: "0.1", expected: 0.1 },
  { date: "2000-02-29", weight: "80", expected: 80 },
])("accepts today/historical $date and $weight kg", ({ date, weight, expected }) => {
  expect(validateWeightMeasurement(weight, date, "2026-11-07")).toEqual({
    valid: true, measurement: { date, weightKg: expected },
  });
});

test("keeps multiple same-date measurements, even with identical ID entropy", () => {
  jest.spyOn(Date, "now").mockReturnValue(123);
  jest.spyOn(Math, "random").mockReturnValue(0);
  const measurement = { date: "2026-11-07", weightKg: 80 };
  const one = addWeightMeasurement([], measurement);
  const two = addWeightMeasurement(one, measurement);
  const three = addWeightMeasurement(two, measurement);
  expect(one).toHaveLength(1);
  expect(two).toHaveLength(2);
  expect(three).toHaveLength(3);
  expect(new Set(three.map((entry) => entry.id)).size).toBe(3);
  expect(three.every((entry) => entry.date === measurement.date)).toBe(true);
});

test("editing preserves identity, creation order, and unrelated records", () => {
  const entries: WeightEntry[] = [
    { id: "opaque-a", date: "2026-11-01", weightKg: 80 },
    { id: "opaque-b", date: "2026-11-02", weightKg: 81 },
  ];
  const original = entries.map((entry) => ({ ...entry }));
  const edited = editWeightMeasurement(entries, "opaque-a", { date: "2026-11-03", weightKg: 79 });
  expect(edited).toEqual([{ id: "opaque-a", date: "2026-11-03", weightKg: 79 }, entries[1]]);
  expect(edited[1]).toBe(entries[1]);
  expect(entries).toEqual(original);
});

test("deletes only the selected identity, leaving same-date/same-weight records", () => {
  const entries: WeightEntry[] = [
    { id: "one", date: "2026-11-07", weightKg: 80 },
    { id: "two", date: "2026-11-07", weightKg: 80 },
  ];
  expect(deleteWeightMeasurement(entries, "one")).toEqual([entries[1]]);
  expect(entries).toHaveLength(2);
  expect(deleteWeightMeasurement(entries, "missing")).toEqual(entries);
  expect(editWeightMeasurement(entries, "missing", { date: "2026-11-07", weightKg: 82 })).toEqual(entries);
});

test("sorts by date then latest creation, without interpreting IDs or mutating input", () => {
  const entries: WeightEntry[] = [
    { id: "999999", date: "2026-11-07", weightKg: 80 },
    { id: "old-date-added-last", date: "2026-11-01", weightKg: 79 },
    { id: "a", date: "2026-11-07", weightKg: 81 },
    { id: "b", date: "2026-11-06", weightKg: 80.5 },
  ];
  const original = [...entries];
  expect(newestWeightMeasurements(entries).map((entry) => entry.id)).toEqual([
    "a", "999999", "b", "old-date-added-last",
  ]);
  expect(entries).toEqual(original);
});

test("edited/deleted history round-trips with unchanged trend rules", () => {
  const entries: WeightEntry[] = [
    { id: "first", date: "2026-11-01", weightKg: 80 },
    { id: "last", date: "2026-11-07", weightKg: 80.5 },
  ];
  expect(calculateWeightTrend(entries).direction).toBe("up");
  const edited = editWeightMeasurement(entries, "last", { date: "2026-11-07", weightKg: 79.5 });
  expect(calculateWeightTrend(edited).direction).toBe("down");
  const encoded = encodePersistedData({ profile: null, trainingPlan: [], weightEntries: edited });
  if (encoded.status !== "valid") throw new Error("Invalid fixture");
  const restored = decodePersistedData(encoded.raw);
  if (restored.status !== "valid") throw new Error("Invalid fixture");
  expect(restored.value.data.weightEntries).toEqual(edited);
  expect(newestWeightMeasurements(restored.value.data.weightEntries)).toEqual([edited[1], edited[0]]);
  expect(calculateWeightTrend(deleteWeightMeasurement(edited, "last"))).toEqual({
    direction: "unknown", changeKg: 0, hasEnoughData: false,
  });
});
