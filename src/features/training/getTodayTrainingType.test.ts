import { getTodayTrainingType } from "./getTodayTrainingType";

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 3, 29, 12));
});
afterEach(() => jest.useRealTimers());

test("defaults an empty plan to rest", () => {
  expect(getTodayTrainingType([])).toBe("rest");
});

test("defaults to rest when only other dates are saved", () => {
  expect(getTodayTrainingType([{ date: "2026-04-30", type: "strength" }])).toBe("rest");
});

test.each(["strength", "endurance", "rest"] as const)(
  "returns today's saved %s type",
  (type) => {
    expect(getTodayTrainingType([
      { date: "2026-04-28", type: "endurance" },
      { date: "2026-04-29", type },
    ])).toBe(type);
  }
);
