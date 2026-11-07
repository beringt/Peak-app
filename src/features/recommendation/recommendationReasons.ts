import type { DailyEngineReason } from "./dailyEngineTypes";
export const displayNumber = (n: unknown) => typeof n === "number" && Number.isFinite(n) ? String(Number(n.toFixed(2))) : "unknown";

/** Fixed explanations from saved reason codes/values, never generated causal claims. */
export function explainDailyReason(reason: DailyEngineReason): string | null {
  const v = reason.values;
  switch (reason.code) {
    case "profile-missing": return "Save your profile first.";
    case "baseline-selection-missing": return "Choose or reconfirm your maintenance source in Weekly Review.";
    case "manual-maintenance-missing": return "Enter your manual maintenance intake in Profile.";
    case "baseline-training-composition-unresolved": return "Clarify whether your maintenance includes training. Exercise is not added until the baseline excludes it.";
    case "estimated-baseline-inputs-missing": return "The equation needs height, age and your voluntary equation choice in Profile, plus activity outside training in Weekly Review.";
    case "today-plan-unknown": return "Save today's training plan, including an explicit rest day when appropriate.";
    case "session-details-missing": return "A saved session has unknown duration or intensity. Complete it in Training.";
    case "session-non-overlap-unconfirmed": return "Confirm in Weekly Review that your multiple planned sessions do not overlap.";
    case "accepted-offset-needs-review": return "The accepted adjustment belongs to another baseline or model. Review it before using it.";
    case "macro-allocation-infeasible": return `The experimental macro minimums do not fit ${displayNumber(v.energyKcal)} kcal. The model's minimum allocation is ${displayNumber(v.requiredMinimumKcal)} kcal. No replacement targets are applied.`;
    case "macro-constraints-conflict": return "Saved locks conflict with energy or macro constraints. Review the locks in Weekly Review; none have been overridden.";
    case "protein-outside-domain": return `Locked protein (${displayNumber(v.proteinGrams)} g) is outside this test's range (${displayNumber(v.minimumGrams)}–${displayNumber(v.maximumGrams)} g).`;
    case "nonpositive-energy": return "Energy must be greater than zero. Review the energy lock or adjustment.";
    case "energy-lock-preserved": return `Saved energy lock: ${displayNumber(v.energyKcal)} kcal. Proposed goal, training and weekly energy changes are held.`;
    case "preparation-held": return "Tomorrow's carbohydrate preparation is held because fat or carbohydrate is locked.";
    case "preparation-applied": return `Carbohydrate was reallocated for tomorrow's long endurance session, without adding calories. The achieved target is ${displayNumber(v.achievedCarbsGrams)} g.`;
    case "preparation-partial": return `Preparation for tomorrow is limited by the model's fat floor: ${displayNumber(v.achievedCarbsGrams)} g carbohydrate, against a request of ${displayNumber(v.requestedCarbsGrams)} g.`;
    case "tomorrow-preparation-unknown": return "Tomorrow's plan or endurance duration is unknown. No carbohydrate preparation is assumed.";
    case "profile-outside-model": return "Your saved profile is outside this experimental model's range. The original data is retained.";
    case "estimated-baseline-outside-model": return "The equation inputs are outside this model's supported ranges.";
    case "manual-maintenance-outside-model": return "Manual maintenance must be greater than zero and at most 10,000 kcal/day.";
    case "session-bounds-or-shape": return "Review session details: 1–240 minutes per session and at most 360 known minutes per day.";
    case "baseline-provenance-missing": return "The maintenance source needs to be confirmed before calculation.";
    case "invalid-lock": return "A saved lock is invalid. Review it in Weekly Review.";
    default: return null;
  }
}
