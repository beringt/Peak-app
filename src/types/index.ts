export type UserProfile = {
  weight: number;
  goal: "lose" | "maintain" | "gain";
  activityLevel: "low" | "medium" | "high";
};

export type TrainingDay = {
  date: string;
  type: "strength" | "endurance" | "rest";
};

export type TrainingType = TrainingDay["type"];

export type WeightEntry = {
  id: string;
  date: string;
  weightKg: number;
};

export type WeightTrend = {
  direction: "down" | "up" | "stable" | "unknown";
  changeKg: number;
  hasEnoughData: boolean;
};

export type Recommendation = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  trainingRecommendation: string;
};

export type DailyRecommendation = {
  calories: number;
  macros: {
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
  };
  trainingType: TrainingType;
  trainingRecommendation: string;
};
