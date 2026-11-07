import { calculateWeightTrend } from "./calculateWeightTrend";

const entry = { id: "1", date: "2026-04-29", weightKg: 80 };

test.each([{ entries: [] }, { entries: [entry] }])("returns unknown without two entries: $entries", ({ entries }) => {
  expect(calculateWeightTrend(entries)).toEqual({
    direction: "unknown", changeKg: 0, hasEnoughData: false,
  });
});

test.each([
  { weightKg: 80.2, direction: "up", changeKg: 0.2 },
  { weightKg: 79.8, direction: "down", changeKg: -0.2 },
  { weightKg: 80.1, direction: "stable", changeKg: 0.1 },
  { weightKg: 79.9, direction: "stable", changeKg: -0.1 },
  { weightKg: 80, direction: "stable", changeKg: 0 },
  { weightKg: 80.56, direction: "up", changeKg: 0.6 },
  { weightKg: 79.44, direction: "down", changeKg: -0.6 },
])("calculates $direction with change $changeKg kg", ({ weightKg, direction, changeKg }) => {
  expect(calculateWeightTrend([
    entry, { id: "2", date: "2026-04-30", weightKg },
  ])).toEqual({ direction, changeKg, hasEnoughData: true });
});

test("uses chronological endpoints without changing the input order", () => {
  const entries = [
    { id: "3", date: "2026-05-01", weightKg: 80.5 },
    entry,
    { id: "2", date: "2026-04-30", weightKg: 90 },
  ];
  const originalOrder = [...entries];
  expect(calculateWeightTrend(entries)).toEqual({
    direction: "up", changeKg: 0.5, hasEnoughData: true,
  });
  expect(entries).toEqual(originalOrder);
});
