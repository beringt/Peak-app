import type {
  DailyRecommendation,
  TrainingType,
  UserProfile,
  WeightTrend,
} from "../../types";
import {
  ACTIVITY_CALORIES_PER_KG,
  CARB_CALORIES_PER_GRAM,
  FAT_CALORIES_PER_GRAM,
  FAT_GRAMS_PER_KG,
  GOAL_CALORIE_ADJUSTMENT,
  PROTEIN_CALORIES_PER_GRAM,
  PROTEIN_GRAMS_PER_KG,
  TRAINING_CALORIE_ADJUSTMENT,
  TREND_CALORIE_ADJUSTMENT,
} from "./recommendationConstants";

export type CalculateDailyRecommendationInput = {
  profile: UserProfile | null;
  trainingType: TrainingType;
  weightTrend: WeightTrend;
};

const trainingTexts: Record<TrainingType, string> = {
  strength: "Strength day: train as planned and keep intensity moderate to high.",
  endurance: "Endurance day: complete the planned session and prioritize carbohydrates.",
  rest: "Rest day: focus on recovery, steps, hydration, and sleep.",
};

export function calculateDailyRecommendation(
  input: CalculateDailyRecommendationInput
): DailyRecommendation | null {
  const { profile, trainingType, weightTrend } = input;
  if (profile === null) {
    return null;
  }

  // The existing profile calls the moderate activity level "medium".
  const activity = profile.activityLevel === "medium" ? "moderate" : profile.activityLevel;
  const baseCalories = profile.weight * ACTIVITY_CALORIES_PER_KG[activity];
  let trendAdjustment = 0;

  if (weightTrend.hasEnoughData) {
    if (weightTrend.direction === "up" && profile.goal !== "gain") {
      trendAdjustment = -TREND_CALORIE_ADJUSTMENT;
    } else if (weightTrend.direction === "down" && profile.goal !== "lose") {
      trendAdjustment = TREND_CALORIE_ADJUSTMENT;
    }
  }

  const calories = Math.round((
    baseCalories +
    GOAL_CALORIE_ADJUSTMENT[profile.goal] +
    TRAINING_CALORIE_ADJUSTMENT[trainingType] +
    trendAdjustment
  ) / 10) * 10;
  const proteinGrams = Math.round(profile.weight * PROTEIN_GRAMS_PER_KG);
  const fatGrams = Math.round(profile.weight * FAT_GRAMS_PER_KG);
  const carbsGrams = Math.max(0, Math.round((
    calories -
    proteinGrams * PROTEIN_CALORIES_PER_GRAM -
    fatGrams * FAT_CALORIES_PER_GRAM
  ) / CARB_CALORIES_PER_GRAM));

  return {
    calories,
    macros: { proteinGrams, carbsGrams, fatGrams },
    trainingType,
    trainingRecommendation: trainingTexts[trainingType],
  };
}

/** Explicit version wrapper; the existing UI continues to call the unchanged v1 helper. */
export function calculateLegacyRecommendation(input: CalculateDailyRecommendationInput) {
  return { ruleVersion: "legacy-v1" as const, recommendation: calculateDailyRecommendation(input) };
}
