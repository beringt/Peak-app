import type { UserProfile, WeightTrend } from "../../types";
import { calculateDailyRecommendation } from "./calculateDailyRecommendation";

// The current profile uses weight/medium rather than the issue's weightKg/moderate.
const profile: UserProfile = { weight: 80, goal: "maintain", activityLevel: "medium" };
const stableTrend: WeightTrend = {
  direction: "stable", changeKg: 0, hasEnoughData: true,
};

test("returns null for a missing profile", () => {
  expect(calculateDailyRecommendation({
    profile: null, trainingType: "rest", weightTrend: stableTrend,
  })).toBeNull();
});

test("matches the 80 kg maintenance example", () => {
  expect(calculateDailyRecommendation({
    profile, trainingType: "rest", weightTrend: stableTrend,
  })).toEqual({
    calories: 2560,
    macros: { proteinGrams: 144, carbsGrams: 352, fatGrams: 64 },
    trainingType: "rest",
    trainingRecommendation: "Rest day: focus on recovery, steps, hydration, and sleep.",
  });
});

test("calculates lose/rest with a stable trend", () => {
  expect(calculateDailyRecommendation({
    profile: { ...profile, goal: "lose" }, trainingType: "rest", weightTrend: stableTrend,
  })).toEqual({
    calories: 2260,
    macros: { proteinGrams: 144, carbsGrams: 277, fatGrams: 64 },
    trainingType: "rest",
    trainingRecommendation: "Rest day: focus on recovery, steps, hydration, and sleep.",
  });
});

test("calculates gain/strength with a down trend", () => {
  expect(calculateDailyRecommendation({
    profile: { ...profile, goal: "gain" }, trainingType: "strength",
    weightTrend: { direction: "down", changeKg: -0.5, hasEnoughData: true },
  })).toEqual({
    calories: 3110,
    macros: { proteinGrams: 144, carbsGrams: 490, fatGrams: 64 },
    trainingType: "strength",
    trainingRecommendation: "Strength day: train as planned and keep intensity moderate to high.",
  });
});

test("calculates maintain/endurance with an up trend", () => {
  expect(calculateDailyRecommendation({
    profile, trainingType: "endurance",
    weightTrend: { direction: "up", changeKg: 0.5, hasEnoughData: true },
  })).toEqual({
    calories: 2710,
    macros: { proteinGrams: 144, carbsGrams: 390, fatGrams: 64 },
    trainingType: "endurance",
    trainingRecommendation: "Endurance day: complete the planned session and prioritize carbohydrates.",
  });
});

test("does not adjust calories without enough trend data", () => {
  expect(calculateDailyRecommendation({
    profile, trainingType: "rest",
    weightTrend: { direction: "up", changeKg: 0.5, hasEnoughData: false },
  })?.calories).toBe(2560);
});

test("uses low and high activity multipliers", () => {
  expect(calculateDailyRecommendation({
    profile: { ...profile, activityLevel: "low" }, trainingType: "rest", weightTrend: stableTrend,
  })?.calories).toBe(2240);
  expect(calculateDailyRecommendation({
    profile: { ...profile, activityLevel: "high" }, trainingType: "rest", weightTrend: stableTrend,
  })?.calories).toBe(2880);
});

test("rounds calories to tens and macros to whole grams", () => {
  expect(calculateDailyRecommendation({
    profile: { ...profile, weight: 83.4 }, trainingType: "rest", weightTrend: stableTrend,
  })?.macros).toEqual({ proteinGrams: 150, carbsGrams: 367, fatGrams: 67 });
  expect(calculateDailyRecommendation({
    profile: { ...profile, weight: 83.4 }, trainingType: "rest", weightTrend: stableTrend,
  })?.calories).toBe(2670);
});

test("never returns negative carbohydrates", () => {
  expect(calculateDailyRecommendation({
    profile: { weight: 10, goal: "lose", activityLevel: "medium" },
    trainingType: "rest", weightTrend: stableTrend,
  })?.macros.carbsGrams).toBe(0);
});
