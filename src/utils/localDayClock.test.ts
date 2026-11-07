import { startLocalDayClock } from "./localDayClock";

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test("ticks exactly at local midnight, including a year boundary", () => {
  jest.setSystemTime(new Date(2026, 11, 31, 23, 59, 59, 500));
  const onDay = jest.fn();
  const stop = startLocalDayClock(onDay, () => () => {});
  expect(onDay).toHaveBeenLastCalledWith("2026-12-31");
  jest.advanceTimersByTime(499);
  expect(onDay).toHaveBeenCalledTimes(1);
  jest.advanceTimersByTime(1);
  expect(onDay).toHaveBeenLastCalledWith("2027-01-01");
  stop();
});

test("same-day polling does not notify consumers again", () => {
  jest.setSystemTime(new Date(2026, 10, 7, 12));
  const onDay = jest.fn();
  const stop = startLocalDayClock(onDay, () => () => {});
  jest.advanceTimersByTime(180_000);
  expect(onDay).toHaveBeenCalledTimes(1);
  stop();
});

test("resume immediately catches up after several suspended days", () => {
  jest.setSystemTime(new Date(2026, 10, 7, 12));
  const onDay = jest.fn();
  let resume!: () => void;
  const unsubscribe = jest.fn();
  const stop = startLocalDayClock(onDay, (refresh) => { resume = refresh; return unsubscribe; });
  jest.setSystemTime(new Date(2026, 10, 11, 9));
  resume();
  expect(onDay).toHaveBeenLastCalledWith("2026-11-11");
  expect(jest.getTimerCount()).toBe(1);
  stop();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

test("fallback detects a clock moving backwards without a resume event", () => {
  jest.setSystemTime(new Date(2026, 10, 7, 12));
  const onDay = jest.fn();
  const stop = startLocalDayClock(onDay, () => () => {});
  jest.setSystemTime(new Date(2026, 10, 6, 12));
  jest.advanceTimersByTime(60_000);
  expect(onDay).toHaveBeenLastCalledWith("2026-11-06");
  stop();
});

test("cleanup prevents callbacks even from a queued resume event", () => {
  jest.setSystemTime(new Date(2026, 10, 7, 12));
  const onDay = jest.fn();
  let resume!: () => void;
  const stop = startLocalDayClock(onDay, (refresh) => { resume = refresh; return () => {}; });
  stop();
  jest.setSystemTime(new Date(2026, 10, 8, 12));
  resume();
  jest.advanceTimersByTime(120_000);
  expect(onDay).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});
