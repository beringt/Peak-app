import { formatDateKey, getNextSevenDateKeys } from "./date";

afterEach(() => jest.useRealTimers());

test("formats the specified date as YYYY-MM-DD", () => {
  expect(formatDateKey(new Date("2026-04-29T12:00:00Z"))).toBe("2026-04-29");
});

test("uses the local calendar date and pads month and day", () => {
  expect(formatDateKey(new Date(2026, 0, 2, 0, 30))).toBe("2026-01-02");
});

test("returns today and six following dates across a year boundary", () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 11, 29, 12));
  expect(getNextSevenDateKeys()).toEqual([
    "2026-12-29", "2026-12-30", "2026-12-31", "2027-01-01",
    "2027-01-02", "2027-01-03", "2027-01-04",
  ]);
});

test("includes leap day", () => {
  jest.useFakeTimers().setSystemTime(new Date(2028, 1, 27, 12));
  expect(getNextSevenDateKeys()).toEqual([
    "2028-02-27", "2028-02-28", "2028-02-29", "2028-03-01",
    "2028-03-02", "2028-03-03", "2028-03-04",
  ]);
});
