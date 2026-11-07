import type { ProfileInputs, UserProfile } from "../../types";

export const EMPTY_PROFILE_INPUTS: ProfileInputs = {
  heightCm: null, ageYears: null, equationVariant: null,
  manualMaintenanceKcal: null, targetRatePercentPerWeek: null,
};

export function validProfileInputs(value: unknown, goal: unknown): value is ProfileInputs {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const keys = Object.keys(EMPTY_PROFILE_INPUTS);
  if (Object.keys(v).length !== keys.length || !keys.every(k => Object.prototype.hasOwnProperty.call(v, k))) return false;
  const range = (n: unknown, min: number, max: number) =>
    n === null || (typeof n === "number" && Number.isFinite(n) && n >= min && n <= max);
  return range(v.heightCm, 100, 250) && range(v.ageYears, 19, 78) &&
    (v.ageYears === null || Number.isInteger(v.ageYears)) &&
    (v.equationVariant === null || v.equationVariant === "plus5" || v.equationVariant === "minus161") &&
    range(v.manualMaintenanceKcal, Number.MIN_VALUE, 10000) &&
    range(v.targetRatePercentPerWeek, 0, 0.5) &&
    (goal !== "maintain" || v.targetRatePercentPerWeek === 0);
}

export type ProfileInputDraft = {
  heightCm: string; ageYears: string; manualMaintenanceKcal: string;
  targetRatePercentPerWeek: string; equationVariant: ProfileInputs["equationVariant"];
};

export function parseProfileInputs(draft: ProfileInputDraft, goal: UserProfile["goal"]): ProfileInputs | null {
  function number(text: string): number | null {
    if (!text.trim()) return null;
    // Plain decimal input only: no exponent, hexadecimal or partial parses.
    return /^\d+(?:[.,]\d+)?$/.test(text.trim()) ? Number(text.trim().replace(",", ".")) : NaN;
  }
  const inputs: ProfileInputs = {
    heightCm: number(draft.heightCm), ageYears: number(draft.ageYears),
    manualMaintenanceKcal: number(draft.manualMaintenanceKcal),
    targetRatePercentPerWeek: goal === "maintain" ? 0 : number(draft.targetRatePercentPerWeek),
    equationVariant: draft.equationVariant,
  };
  return validProfileInputs(inputs, goal) ? inputs : null;
}
