import type { PeakData } from "../types";
import { createDataExport } from "./dataExport";

const data: PeakData = {
  profile: { weight: 80, goal: "maintain", activityLevel: "medium" },
  trainingPlan: [{ date: "2026-01-01", type: "strength" }, { date: "2026-11-07", type: "rest" }],
  weightEntries: [{ id: "a", date: "2026-11-07", weightKg: 80 }, { id: "b", date: "2026-11-07", weightKg: 81 }],
};

test("exports every saved record, schema version and UTC export time without mutation", () => {
  const before = JSON.stringify(data);
  expect(JSON.parse(createDataExport(data, new Date("2026-11-07T12:00:00Z")))).toEqual({
    version: 2, exportedAt: "2026-11-07T12:00:00.000Z", data,
  });
  expect(JSON.stringify(data)).toBe(before);
});

test("can export an empty installation", () => {
  const empty = { profile: null, trainingPlan: [], weightEntries: [] };
  expect(JSON.parse(createDataExport(empty)).data).toEqual(empty);
});

test("invalid data or date causes an explicit error rather than a lossy export", () => {
  expect(() => createDataExport({ ...data, profile: { ...data.profile!, weight: NaN } })).toThrow();
  expect(() => createDataExport(data, new Date("invalid"))).toThrow();
});
