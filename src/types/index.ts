export type UserProfile = {
  weight: number;
  goal: "lose" | "maintain" | "gain";
  activityLevel: "low" | "medium" | "high";
};

export type TrainingDay = {
  date: string;
  type: "strength" | "endurance" | "rest";
};

export type WeightEntry = {
  date: string;
  weight: number;
};

export type Recommendation = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  trainingRecommendation: string;
};
