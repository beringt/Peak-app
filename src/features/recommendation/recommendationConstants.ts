export const ACTIVITY_CALORIES_PER_KG = {
  low: 28,
  moderate: 32,
  high: 36,
} as const;

export const GOAL_CALORIE_ADJUSTMENT = {
  lose: -300,
  maintain: 0,
  gain: 300,
} as const;

export const TRAINING_CALORIE_ADJUSTMENT = {
  strength: 150,
  endurance: 250,
  rest: 0,
} as const;

export const TREND_CALORIE_ADJUSTMENT = 100;
export const PROTEIN_GRAMS_PER_KG = 1.8;
export const FAT_GRAMS_PER_KG = 0.8;
export const PROTEIN_CALORIES_PER_GRAM = 4;
export const CARB_CALORIES_PER_GRAM = 4;
export const FAT_CALORIES_PER_GRAM = 9;
