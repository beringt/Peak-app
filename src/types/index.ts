export type ProfileInputs = {
  heightCm: number | null;
  ageYears: number | null;
  equationVariant: "plus5" | "minus161" | null;
  manualMaintenanceKcal: number | null;
  targetRatePercentPerWeek: number | null;
};

export type UserProfile = {
  baselineInputs?: ProfileInputs | null;
  weight: number;
  goal: "lose" | "maintain" | "gain";
  activityLevel: "low" | "medium" | "high";
};

export type PlannedSession = {
  id: string;
  type: "strength" | "endurance";
  durationMinutes: number | null;
  intensity: "low" | "moderate" | "high" | null;
};

export type TrainingDay = {
  // Absent only for legacy days: adapt to a stable-ID session with unknown details.
  sessions?: PlannedSession[];
  date: string;
  type: "strength" | "endurance" | "rest";
};

export type TrainingType = TrainingDay["type"];

export type WeightEntry = {
  id: string;
  date: string;
  weightKg: number;
};

export type PeakData = {
  profile: UserProfile | null;
  trainingPlan: TrainingDay[];
  weightEntries: WeightEntry[];
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
