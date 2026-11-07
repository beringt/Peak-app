import type { WeightEntry, WeightTrend } from "../../types";

export function calculateWeightTrend(entries: WeightEntry[]): WeightTrend {
  if (entries.length < 2) {
    return { direction: "unknown", changeKg: 0, hasEnoughData: false };
  }

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const earliest = sorted[0];
  const latest = sorted[sorted.length - 1];
  const changeKg = Number((latest.weightKg - earliest.weightKg).toFixed(1));
  const direction = changeKg >= 0.2 ? "up" : changeKg <= -0.2 ? "down" : "stable";

  return { direction, changeKg, hasEnoughData: true };
}
