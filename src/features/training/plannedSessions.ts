import type { PlannedSession, TrainingDay } from "../../types";
import { getNextSevenDateKeys } from "../../utils/date";

/** Deterministic, lossless adapter for v1/v2 days; no duration/intensity inferred. */
export function sessionsForDay(day: TrainingDay): PlannedSession[] {
  if (day.sessions !== undefined) return day.sessions;
  return day.type === "rest" ? [] : [{
    id: `legacy:${day.date}`, type: day.type, durationMinutes: null, intensity: null,
  }];
}

export function dayWithSessions(date: string, sessions: PlannedSession[]): TrainingDay {
  // The existing calculator continues to use one category: the first saved session.
  return { date, type: sessions[0]?.type ?? "rest", sessions };
}

export function parseDuration(value: string): number | null | "invalid" {
  if (!value.trim()) return null;
  if (!/^\d+(?:[.,]\d+)?$/.test(value.trim())) return "invalid";
  const minutes = Number(value.trim().replace(",", "."));
  return Number.isFinite(minutes) && minutes >= 1 && minutes <= 240 ? minutes : "invalid";
}

export function validSessions(value: unknown): value is PlannedSession[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  let minutes = 0;
  for (const item of value) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return false;
    const keys = Object.keys(item);
    if (keys.length !== 4 || !["id", "type", "durationMinutes", "intensity"].every(k => Object.prototype.hasOwnProperty.call(item, k))) return false;
    if (typeof item.id !== "string" || !item.id.trim() || ids.has(item.id) ||
      !["strength", "endurance"].includes(item.type) ||
      ![null, "low", "moderate", "high"].includes(item.intensity)) return false;
    ids.add(item.id);
    if (item.durationMinutes !== null) {
      if (typeof item.durationMinutes !== "number" || !Number.isFinite(item.durationMinutes) ||
        item.durationMinutes < 1 || item.durationMinutes > 240) return false;
      minutes += item.durationMinutes;
    }
  }
  return minutes <= 360;
}

/** Null means unknown, not a confirmed short session. */
export function isLongEndurance(session: PlannedSession): boolean | null {
  if (session.type !== "endurance") return false;
  return session.durationMinutes === null ? null : session.durationMinutes > 90;
}

export function longEnduranceTomorrow(plan: TrainingDay[], today: string): boolean | null {
  const tomorrow = getNextSevenDateKeys(new Date(today + "T12:00:00"))[1];
  const day = plan.find(d => d.date === tomorrow);
  if (!day) return null;
  const flags = sessionsForDay(day).map(isLongEndurance);
  return flags.includes(true) ? true : flags.includes(null) ? null : false;
}
