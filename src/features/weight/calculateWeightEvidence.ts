import type { WeightEntry } from "../../types";
import { isDateKey } from "../../utils/date";

export type DailyWeightMedian = {
  date: string;
  medianKg: number;
  recordIds: string[];
  minimumKg: number;
  maximumKg: number;
  wideRange: boolean;
};

export type WeightEvidenceWindow = {
  startDate: string;
  endDate: string;
  days: DailyWeightMedian[];
  meanKg: number | null;
  centreDayOrdinal: number | null;
};

export type WeightEvidence = {
  ruleVersion: "weight-evidence-v1";
  asOfDate: string;
  status: "ready" | "insufficient-data" | "stale-data" | "review-needed";
  reasons: Array<{
    code: "insufficient-days" | "stale-weights" | "wide-same-day-range";
    window: "previous" | "recent" | null;
    dates: string[];
    recordIds: string[];
  }>;
  previous: WeightEvidenceWindow;
  recent: WeightEvidenceWindow;
  latestIncludedDate: string | null;
  changeKg: number | null;
  observedKgPerWeek: number | null;
};

const DAY_MS = 86400000;

// UTC is used solely as a calendar-day index: no local elapsed-hour arithmetic.
function ordinal(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const clock = new Date(0);
  clock.setUTCFullYear(year, month - 1, day);
  clock.setUTCHours(0, 0, 0, 0);
  return clock.getTime() / DAY_MS;
}
const dateKey = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);

function windowSummary(start: number, end: number, days: DailyWeightMedian[]): WeightEvidenceWindow {
  const included = days.filter(day => day.date >= dateKey(start) && day.date <= dateKey(end));
  return {
    startDate: dateKey(start), endDate: dateKey(end), days: included,
    meanKg: included.length ? included.reduce((sum, day) => sum + day.medianKg, 0) / included.length : null,
    centreDayOrdinal: included.length ? included.reduce((sum, day) => sum + ordinal(day.date), 0) / included.length : null,
  };
}

/** Pure evidence for the 14 completed dates before D; no goal or calorie decisions. */
export function calculateWeightEvidence(entries: readonly WeightEntry[], asOfDate: string): WeightEvidence {
  if (!isDateKey(asOfDate) || asOfDate < "0001-01-15") {
    throw new RangeError("asOfDate must be a valid local date with 14 supported prior dates.");
  }
  const cutoff = ordinal(asOfDate);
  const grouped = new Map<string, WeightEntry[]>();
  const ids = new Set<string>();
  for (const entry of entries) {
    if (!isDateKey(entry.date) || !Number.isFinite(entry.weightKg) || entry.weightKg <= 0 ||
      entry.weightKg > 500 || !entry.id.trim() || ids.has(entry.id)) {
      throw new RangeError("Weight evidence requires valid measurements with unique IDs.");
    }
    ids.add(entry.id);
    if (entry.date < dateKey(cutoff - 14) || entry.date >= asOfDate) continue;
    const group = grouped.get(entry.date) ?? [];
    group.push(entry);
    grouped.set(entry.date, group);
  }
  const days: DailyWeightMedian[] = [...grouped].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([date, group]) => {
      const values = group.map(entry => entry.weightKg).sort((a, b) => a - b);
      const middle = Math.floor(values.length / 2);
      const medianKg = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
      const rangeKg = values[values.length - 1] - values[0];
      const thresholdKg = 0.02 * medianKg;
      // Subtracting decimal weights can amplify representation error. Ignore only
      // a few floating-point units at the input scale, not a measurement tolerance.
      const roundingErrorKg = 4 * Number.EPSILON * Math.max(values[values.length - 1], thresholdKg);
      return {
        date, medianKg, recordIds: group.map(entry => entry.id).sort(),
        minimumKg: values[0], maximumKg: values[values.length - 1],
        wideRange: rangeKg - thresholdKg > roundingErrorKg,
      };
    });
  const previous = windowSummary(cutoff - 14, cutoff - 8, days);
  const recent = windowSummary(cutoff - 7, cutoff - 1, days);
  const reasons: WeightEvidence["reasons"] = [];
  for (const [name, window] of [["previous", previous], ["recent", recent]] as const) {
    if (window.days.length < 4) reasons.push({
      code: "insufficient-days", window: name, dates: window.days.map(day => day.date),
      recordIds: window.days.flatMap(day => day.recordIds),
    });
  }
  const latestIncludedDate = days[days.length - 1]?.date ?? null;
  if (latestIncludedDate !== null && latestIncludedDate < dateKey(cutoff - 2)) {
    reasons.push({ code: "stale-weights", window: null, dates: [latestIncludedDate],
      recordIds: days[days.length - 1].recordIds });
  }
  const wideDays = days.filter(day => day.wideRange);
  if (wideDays.length) reasons.push({ code: "wide-same-day-range", window: null,
    dates: wideDays.map(day => day.date), recordIds: wideDays.flatMap(day => day.recordIds) });
  const sufficient = previous.days.length >= 4 && recent.days.length >= 4;
  const changeKg = sufficient ? recent.meanKg! - previous.meanKg! : null;
  const observedKgPerWeek = changeKg === null ? null : changeKg * 7 / (recent.centreDayOrdinal! - previous.centreDayOrdinal!);
  const status = !sufficient ? "insufficient-data" : reasons.some(reason => reason.code === "stale-weights")
    ? "stale-data" : wideDays.length ? "review-needed" : "ready";
  return { ruleVersion: "weight-evidence-v1", asOfDate, status, reasons,
    previous, recent, latestIncludedDate, changeKg, observedKgPerWeek };
}
