import type { TrainingDay } from "../../types";
import { decodePersistedData, encodePersistedData } from "../../utils/persistedData";
import { getTodayTrainingType } from "./getTodayTrainingType";
import { mergeVisibleTrainingPlan, visibleTrainingPlan } from "./rollingPlan";

const saved: TrainingDay[] = [
  { date: "2026-11-01", type: "strength" },
  { date: "2026-11-07", type: "endurance" },
  { date: "2026-11-08", type: "strength" },
  { date: "2026-12-01", type: "endurance" },
];

test("shows seven dates, retains saved choices and defaults new dates to rest", () => {
  const plan = visibleTrainingPlan(saved, "2026-11-07");
  expect(plan.map((day) => day.date)).toEqual([
    "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10",
    "2026-11-11", "2026-11-12", "2026-11-13",
  ]);
  expect(plan.map((day) => day.type)).toEqual([
    "endurance", "strength", "rest", "rest", "rest", "rest", "rest",
  ]);
});

test("rolling forward retains overlap and excludes past dates from the view", () => {
  const plan = visibleTrainingPlan(saved, "2026-11-08");
  expect(plan[0]).toEqual({ date: "2026-11-08", type: "strength" });
  expect(plan[6]).toEqual({ date: "2026-11-14", type: "rest" });
  expect(plan).toHaveLength(7);
  expect(plan.some((day) => day.date === "2026-11-07")).toBe(false);
});

test.each([
  { start: "2026-12-29", end: "2027-01-04" },
  { start: "2028-02-27", end: "2028-03-04" },
  { start: "2026-03-27", end: "2026-04-02" },
  { start: "2026-10-23", end: "2026-10-29" },
])("handles calendar boundaries from $start to $end", ({ start, end }) => {
  const plan = visibleTrainingPlan([], start);
  expect(plan[0].date).toBe(start);
  expect(plan[6].date).toBe(end);
  expect(new Set(plan.map((day) => day.date)).size).toBe(7);
});

test("edits remain drafts and overlapping draft choices survive a rollover", () => {
  const edits = { "2026-11-07": "rest", "2026-11-08": "endurance" } as const;
  expect(visibleTrainingPlan(saved, "2026-11-07", edits)[0].type).toBe("rest");
  expect(getTodayTrainingType(saved, "2026-11-07")).toBe("endurance");
  expect(visibleTrainingPlan(saved, "2026-11-08", edits)[0].type).toBe("endurance");
  expect(getTodayTrainingType(saved, "2026-11-08")).toBe("strength");
});

test("merges a week without deleting past or distant future saved days", () => {
  const original = saved.map((day) => ({ ...day }));
  const visible = visibleTrainingPlan(saved, "2026-11-07", { "2026-11-07": "rest" });
  const merged = mergeVisibleTrainingPlan(saved, visible, "2026-11-07");
  expect(merged.find((day) => day.date === "2026-11-01")).toEqual(saved[0]);
  expect(merged.find((day) => day.date === "2026-12-01")).toEqual(saved[3]);
  expect(merged.find((day) => day.date === "2026-11-07")?.type).toBe("rest");
  expect(merged).toHaveLength(9);
  expect(new Set(merged.map((day) => day.date)).size).toBe(9);
  expect(saved).toEqual(original);
});

test("a save racing midnight cannot overwrite yesterday with a stale draft", () => {
  const yesterdayView = visibleTrainingPlan(saved, "2026-11-07", {
    "2026-11-07": "rest", "2026-11-08": "endurance",
  });
  const merged = mergeVisibleTrainingPlan(saved, yesterdayView, "2026-11-08");
  expect(merged.find((day) => day.date === "2026-11-07")?.type).toBe("endurance");
  expect(merged.find((day) => day.date === "2026-11-08")?.type).toBe("endurance");
  expect(merged.find((day) => day.date === "2026-12-01")).toEqual(saved[3]);
});

test("history and overlapping selections survive persistence and another week save", () => {
  const first = mergeVisibleTrainingPlan(saved, visibleTrainingPlan(saved, "2026-11-07"), "2026-11-07");
  const encoded = encodePersistedData({ profile: null, trainingPlan: first, weightEntries: [] });
  if (encoded.status !== "valid") throw new Error("Invalid fixture");
  const decoded = decodePersistedData(encoded.raw);
  if (decoded.status !== "valid") throw new Error("Invalid fixture");
  const restored = decoded.value.data.trainingPlan;
  const second = mergeVisibleTrainingPlan(restored, visibleTrainingPlan(restored, "2026-11-10"), "2026-11-10");
  for (const day of first) expect(second.find((item) => item.date === day.date)).toEqual(day);
  expect(getTodayTrainingType(restored, "2026-11-08")).toBe("strength");
  expect(getTodayTrainingType(restored, "2027-01-01")).toBe("rest");
});
