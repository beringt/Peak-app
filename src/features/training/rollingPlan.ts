import type { TrainingDay, TrainingType } from "../../types";
import { getNextSevenDateKeys } from "../../utils/date";

function visibleDates(today: string): string[] {
  // No Z suffix: these are local calendar days, not UTC instants.
  return getNextSevenDateKeys(new Date(today + "T12:00:00"));
}

export function visibleTrainingPlan(
  savedPlan: TrainingDay[], today: string, edits: Record<string, TrainingType> = {}
): TrainingDay[] {
  const saved = new Map(savedPlan.map((day) => [day.date, day]));
  return visibleDates(today).map((date) => edits[date] !== undefined
    ? { date, type: edits[date] }
    : saved.get(date) ?? { date, type: "rest" });
}

export function mergeVisibleTrainingPlan(
  savedPlan: TrainingDay[], displayedPlan: TrainingDay[], today: string
): TrainingDay[] {
  const allowed = new Set(visibleDates(today));
  const merged = new Map(savedPlan.map((day) => [day.date, day]));
  for (const day of displayedPlan) {
    if (allowed.has(day.date)) merged.set(day.date, { ...day });
  }
  return [...merged.values()].sort((a, b) => a.date.localeCompare(b.date));
}
