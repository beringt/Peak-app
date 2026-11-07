import type { WeightEntry } from "../../types";
import { calculateWeightEvidence } from "./calculateWeightEvidence";

function dates(start: string, length: number): string[] {
  const clock = new Date(start + "T12:00:00Z");
  return Array.from({ length }, (_, index) => {
    const day = new Date(clock); day.setUTCDate(day.getUTCDate() + index);
    return day.toISOString().slice(0, 10);
  });
}
function measurements(start: string, count: number, kg: number): WeightEntry[] {
  return dates(start, count).map(date => ({ id: `${date}:${kg}`, date, weightKg: kg }));
}
const cutoff = "2026-11-16";
const full = (recent = 80.4) => [...measurements("2026-11-02", 7, 80), ...measurements("2026-11-09", 7, recent)];

test.each([80, 80.4, 79.6])("calculates plateau/up/down using window means for %s", recentKg => {
  const result = calculateWeightEvidence(full(recentKg), cutoff);
  expect(result.status).toBe("ready");
  expect(result.reasons).toEqual([]);
  expect(result.previous).toMatchObject({ startDate: "2026-11-02", endDate: "2026-11-08", meanKg: 80 });
  expect(result.recent).toMatchObject({ startDate: "2026-11-09", endDate: "2026-11-15" });
  expect(result.recent.centreDayOrdinal! - result.previous.centreDayOrdinal!).toBe(7);
  expect(result.changeKg).toBeCloseTo(recentKg - 80, 12);
  expect(result.observedKgPerWeek).toBeCloseTo(recentKg - 80, 12);
});
test("gaps use actual mean calendar-date centres, not a fixed 7-day gap or zeros", () => {
  const entries = [...measurements("2026-11-02", 4, 80), ...measurements("2026-11-12", 4, 80.4)];
  const result = calculateWeightEvidence(entries, cutoff);
  expect(result.status).toBe("ready");
  expect(result.previous.days).toHaveLength(4); expect(result.recent.days).toHaveLength(4);
  expect(result.recent.centreDayOrdinal! - result.previous.centreDayOrdinal!).toBe(10);
  expect(result.observedKgPerWeek).toBeCloseTo(0.28, 12);
});
test("takes odd/even daily medians without overweighting duplicate dates", () => {
  const entries = full(80).filter(entry => entry.date !== "2026-11-15");
  entries.push(...[79.9, 80, 80.1].map((kg, i) => ({ id: `odd${i}`, date: "2026-11-15", weightKg: kg })));
  entries.push(...[79.9, 80.1].map((kg, i) => ({ id: `even${i}`, date: "2026-11-14", weightKg: kg })));
  // Remove the original Nov 14 single measurement to exercise an even-sized day.
  const result = calculateWeightEvidence(entries.filter(e => e.id !== "2026-11-14:80"), cutoff);
  expect(result.status).toBe("ready");
  expect(result.recent.days).toHaveLength(7);
  expect(result.recent.days[5].medianKg).toBe(80);
  expect(result.recent.days[6].medianKg).toBe(80);
  expect(result.observedKgPerWeek).toBe(0);
});
test.each([{ entries: [] }, { entries: measurements("2026-11-15", 1, 80) }, { entries: [
  ...measurements("2026-11-02", 3, 80), ...measurements("2026-11-12", 4, 80),
] }])("sparse data cannot fabricate a rate", ({ entries }) => {
  const result = calculateWeightEvidence(entries, cutoff);
  expect(result.status).toBe("insufficient-data");
  expect(result.observedKgPerWeek).toBeNull(); expect(result.changeKg).toBeNull();
  expect(result.reasons.some(reason => reason.code === "insufficient-days")).toBe(true);
});
test("many readings on one day still count as one measurement day", () => {
  const entries = Array.from({ length: 20 }, (_, i) => ({ id: String(i), date: "2026-11-15", weightKg: 80 }));
  const result = calculateWeightEvidence(entries, cutoff);
  expect(result.recent.days).toHaveLength(1); expect(result.status).toBe("insufficient-data");
});
test("D-2 satisfies freshness, D-3 is stale even with sufficient coverage", () => {
  const stale = calculateWeightEvidence([...measurements("2026-11-02", 7, 80), ...measurements("2026-11-09", 5, 80.4)], cutoff);
  expect(stale.status).toBe("stale-data");
  expect(stale.latestIncludedDate).toBe("2026-11-13");
  expect(stale.reasons).toContainEqual({ code: "stale-weights", window: null, dates: ["2026-11-13"], recordIds: ["2026-11-13:80.4"] });
  const fresh = calculateWeightEvidence([...measurements("2026-11-02", 7, 80), ...measurements("2026-11-09", 6, 80.4)], cutoff);
  expect(fresh.status).toBe("ready");
});
test("same-day outliers retain their median, source IDs and full-precision diagnostic rate but require review", () => {
  const entries = full(80).filter(entry => entry.date !== "2026-11-15");
  entries.push(...[80, 80.1, 100].map((kg, i) => ({ id: `outlier${i}`, date: "2026-11-15", weightKg: kg })));
  const result = calculateWeightEvidence(entries, cutoff);
  expect(result.status).toBe("review-needed");
  expect(result.observedKgPerWeek).toBeCloseTo(1 / 70, 12);
  expect(result.recent.days[6]).toMatchObject({ medianKg: 80.1, minimumKg: 80, maximumKg: 100, wideRange: true, recordIds: ["outlier0", "outlier1", "outlier2"] });
  expect(result.reasons[0]).toMatchObject({ code: "wide-same-day-range", dates: ["2026-11-15"], recordIds: ["outlier0", "outlier1", "outlier2"] });
});
test("exactly 2% same-day range is allowed; a larger range is flagged", () => {
  for (const [high, flag] of [[50.5, false], [50.51, true]] as const) {
    const entries = full(50).filter(e => e.date !== "2026-11-15");
    entries.push({ id: "low", date: "2026-11-15", weightKg: 49.5 }, { id: "high", date: "2026-11-15", weightKg: high });
    expect(calculateWeightEvidence(entries, cutoff).recent.days[6].wideRange).toBe(flag);
  }
});
test("a singleton outlier is retained rather than silently filtered or diagnosed", () => {
  const entries = full(80).map(e => e.date === "2026-11-15" ? { ...e, weightKg: 100 } : e);
  const result = calculateWeightEvidence(entries, cutoff);
  expect(result.recent.days[6].medianKg).toBe(100);
  expect(result.reasons).toEqual([]); // No cross-day outlier rule has been approved.
  expect(result.observedKgPerWeek).toBeCloseTo(20 / 7, 12);
});
test("future, current-day and out-of-window readings cannot alter completed-window evidence", () => {
  const entries = full();
  const result = calculateWeightEvidence(entries, cutoff);
  expect(calculateWeightEvidence([...entries, ...measurements("2026-11-16", 3, 100), ...measurements("2026-10-01", 3, 40)], cutoff)).toEqual(result);
});
test("is order-independent, deterministic and does not mutate frozen measurements", () => {
  const entries = full();
  entries.push({ id: "extra", date: "2026-11-15", weightKg: 80.2 });
  const before = JSON.stringify(entries);
  entries.forEach(Object.freeze); Object.freeze(entries);
  const result = calculateWeightEvidence(entries, cutoff);
  expect(calculateWeightEvidence([...entries].reverse(), cutoff)).toEqual(result);
  expect(JSON.stringify(entries)).toBe(before);
});
test.each([
  ["2026-12-21", "2027-01-04"], ["2028-02-17", "2028-03-02"],
  ["2026-03-22", "2026-04-05"], ["2026-10-18", "2026-11-01"],
  ["0099-12-22", "0100-01-05"],
])("uses calendar dates across boundaries %s to %s", (start, asOf) => {
  const allDates = dates(start, 14);
  const entries = allDates.map((date, i) => ({ id: date, date, weightKg: i < 7 ? 80 : 80.4 }));
  const result = calculateWeightEvidence(entries, asOf);
  expect(result.status).toBe("ready");
  expect(result.recent.centreDayOrdinal! - result.previous.centreDayOrdinal!).toBe(7);
  expect(result.observedKgPerWeek).toBeCloseTo(0.4, 12);
});
test.each(["2026-02-29", "2026-1-01", "invalid", "0001-01-14"])("rejects invalid/unsupported cutoff %s", cutoff => {
  expect(() => calculateWeightEvidence([], cutoff)).toThrow(RangeError);
});
test("invalid measurements and duplicate IDs are rejected without fabricating evidence", () => {
  for (const entries of [[{ id: "bad", date: "2026-11-15", weightKg: NaN }], [{ id: "bad", date: "2026-02-29", weightKg: 80 }], [full()[0], full()[0]]]) {
    expect(() => calculateWeightEvidence(entries, cutoff)).toThrow(RangeError);
  }
});
