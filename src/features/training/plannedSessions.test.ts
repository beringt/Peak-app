import type { PeakData, PlannedSession, TrainingDay } from "../../types";
import { dayWithSessions, isLongEndurance, longEnduranceTomorrow, parseDuration, sessionsForDay, validSessions } from "./plannedSessions";
import { mergeVisibleTrainingPlan, visibleTrainingPlan } from "./rollingPlan";
import { getTodayTrainingType } from "./getTodayTrainingType";
import { decodePersistedData, encodePersistedData } from "../../utils/persistedData";
import { createDataExport } from "../../utils/dataExport";
import { createLocalPersistence } from "../../utils/localPersistence";

const session = (id: string, type: PlannedSession["type"], minutes: number | null): PlannedSession =>
  ({ id, type, durationMinutes: minutes, intensity: null });
const today = "2026-11-07";

test.each([1, 90, 90.5, 240])("accepts duration %s", minutes => expect(parseDuration(String(minutes))).toBe(minutes));
test.each(["0", "240.1", "-1", "NaN", "Infinity", "1e2", "60min"])("rejects duration %s", text => expect(parseDuration(text)).toBe("invalid"));
test("blank is unknown and comma decimals are accepted", () => {
  expect(parseDuration(" ")).toBeNull(); expect(parseDuration(" 90,5 ")).toBe(90.5);
});
test("legacy migration adapter provides stable IDs with unknown inputs, and rest is empty", () => {
  const day: TrainingDay = { date: today, type: "strength" };
  const before = JSON.stringify(day);
  expect(sessionsForDay(day)).toEqual([session(`legacy:${today}`, "strength", null)]);
  expect(sessionsForDay(day)).toEqual(sessionsForDay(day));
  expect(sessionsForDay({ date: today, type: "rest" })).toEqual([]);
  expect(JSON.stringify(day)).toBe(before);
});
test("validates per-session and combined day limits, preserving unknowns", () => {
  expect(validSessions([session("a", "strength", 240), session("b", "endurance", 120)])).toBe(true);
  expect(validSessions([session("a", "strength", 240), session("b", "endurance", 120.1)])).toBe(false);
  expect(validSessions([session("a", "endurance", 241)])).toBe(false);
  expect(validSessions([session("a", "strength", null), session("b", "endurance", 240)])).toBe(true);
  expect(validSessions([session("a", "strength", 60), session("a", "endurance", 60)])).toBe(false);
});
test("long means one continuous endurance session >90, not summed short sessions", () => {
  const date = "2026-11-08";
  expect(isLongEndurance(session("a", "strength", 120))).toBe(false);
  expect(isLongEndurance(session("a", "endurance", 90))).toBe(false);
  expect(isLongEndurance(session("a", "endurance", 90.1))).toBe(true);
  expect(longEnduranceTomorrow([dayWithSessions(date, [session("a", "endurance", 60), session("b", "endurance", 60)])], today)).toBe(false);
  expect(longEnduranceTomorrow([dayWithSessions(date, [session("a", "endurance", 120)])], today)).toBe(true);
  expect(longEnduranceTomorrow([dayWithSessions(date, [session("a", "endurance", null)])], today)).toBeNull();
  expect(longEnduranceTomorrow([], today)).toBeNull();
  expect(longEnduranceTomorrow([dayWithSessions(date, [])], today)).toBe(false);
});
test("tomorrow classification follows local year/leap boundaries", () => {
  expect(longEnduranceTomorrow([dayWithSessions("2027-01-01", [session("new-year", "endurance", 120)])], "2026-12-31")).toBe(true);
  expect(longEnduranceTomorrow([dayWithSessions("2028-02-29", [session("leap", "endurance", 120)])], "2028-02-28")).toBe(true);
});
test("mixed sessions survive view, rollover, history-preserving save and serialization", () => {
  const saved = [dayWithSessions("2026-11-01", [session("history", "endurance", 120)]),
    dayWithSessions(today, [session("strength", "strength", 60), session("cycle", "endurance", 90)]),
    dayWithSessions("2026-12-01", [session("future", "strength", null)])];
  const before = JSON.stringify(saved);
  const visible = visibleTrainingPlan(saved, today);
  expect(visible[0]).toEqual(saved[1]);
  const merged = mergeVisibleTrainingPlan(saved, visible, today);
  const encoded = encodePersistedData({ profile: null, trainingPlan: merged, weightEntries: [] });
  if (encoded.status !== "valid") throw Error("invalid fixture");
  const decoded = decodePersistedData(encoded.raw);
  if (decoded.status !== "valid") throw Error("invalid fixture");
  expect(decoded.value.data.trainingPlan).toEqual(merged);
  expect(JSON.parse(createDataExport(decoded.value.data)).data.trainingPlan).toEqual(merged);
  expect(JSON.stringify(saved)).toBe(before);
  expect(getTodayTrainingType(saved, today)).toBe("strength");
  const next = mergeVisibleTrainingPlan(merged, visibleTrainingPlan(merged, "2026-11-08"), "2026-11-08");
  for (const day of saved) expect(next.find(d => d.date === day.date)).toEqual(day);
});
test.each([1, 2])("v%s migration retains original raw/history and saves session details only after editing", async version => {
  const original: PeakData = { profile: null, trainingPlan: [{ date: today, type: "strength" }, { date: "2026-11-08", type: "rest" }], weightEntries: [{ id: "old", date: today, weightKg: 80 }] };
  let raw: string | null = JSON.stringify({ version, data: original });
  const before = raw;
  const storage = { read: jest.fn(async () => raw), write: jest.fn(async (value: string) => { raw = value; }), remove: jest.fn(async () => { raw = null; }) };
  const app = createLocalPersistence(storage); await app.load();
  expect(raw).toBe(before); expect(storage.write).not.toHaveBeenCalled();
  const day = app.getSnapshot().data.trainingPlan[0];
  const adapted = sessionsForDay(day);
  app.update(data => ({ ...data, trainingPlan: [dayWithSessions(today, adapted), data.trainingPlan[1]] }));
  await new Promise<void>(resolve => setImmediate(resolve));
  expect(JSON.parse(raw!).version).toBe(4);
  const reloaded = createLocalPersistence(storage); await reloaded.load();
  expect(sessionsForDay(reloaded.getSnapshot().data.trainingPlan[0])).toEqual(adapted);
  expect(reloaded.getSnapshot().data.weightEntries).toEqual(original.weightEntries);
  await reloaded.reset(); expect(raw).toBeNull();
});
test("malformed schema and duplicate session identities block persistence", () => {
  const day = dayWithSessions(today, [session("same", "strength", 60)]);
  const other = dayWithSessions("2026-11-08", [session("same", "endurance", 60)]);
  const data = { profile: null, trainingPlan: [day, other], weightEntries: [] };
  expect(encodePersistedData(data).status).toBe("invalid");
  for (const change of [{ type: "rest" }, { sessions: [{ ...session("a", "strength", 60), intensity: "hard" }] }, { sessions: [{ ...session("a", "strength", 60), extra: true }] }]) {
    const raw = JSON.stringify({ version: 3, data: { ...data, trainingPlan: [{ ...day, ...change }] } });
    expect(decodePersistedData(raw)).toEqual({ status: "invalid", reason: "schema", raw });
  }
  expect(decodePersistedData(JSON.stringify({ version: 2, data: { ...data, trainingPlan: [day] } })).status).toBe("invalid");
});

test("a midnight save keeps yesterday's saved session IDs and applies overlapping drafts only", () => {
  const yesterday = dayWithSessions(today, [session("yesterday", "strength", 60)]);
  const tomorrow = dayWithSessions("2026-11-08", [session("tomorrow", "endurance", 90)]);
  const saved = [yesterday, tomorrow];
  const view = visibleTrainingPlan(saved, today).map(day =>
    day.date === today ? dayWithSessions(day.date, []) :
    day.date === tomorrow.date ? dayWithSessions(day.date, [{ ...sessionsForDay(day)[0], durationMinutes: 120 }]) : day);
  const merged = mergeVisibleTrainingPlan(saved, view, "2026-11-08");
  expect(merged.find(day => day.date === today)).toEqual(yesterday);
  expect(merged.find(day => day.date === tomorrow.date)?.sessions).toEqual([session("tomorrow", "endurance", 120)]);
});
