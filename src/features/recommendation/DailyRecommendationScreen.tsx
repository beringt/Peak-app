import { ScrollView, StyleSheet, Text } from "react-native";

import type { TrainingDay, UserProfile, WeightEntry } from "../../types";
import { getTodayTrainingType } from "../training/getTodayTrainingType";
import { calculateWeightTrend } from "../weight/calculateWeightTrend";
import { calculateDailyRecommendation } from "./calculateDailyRecommendation";

type DailyRecommendationScreenProps = {
  profile: UserProfile | null;
  trainingPlan: TrainingDay[];
  weightEntries: WeightEntry[];
};

export function DailyRecommendationScreen(data: DailyRecommendationScreenProps) {
  const trainingType = getTodayTrainingType(data.trainingPlan);
  const weightTrend = calculateWeightTrend(data.weightEntries);
  const recommendation = calculateDailyRecommendation({
    profile: data.profile,
    trainingType,
    weightTrend,
  });

  if (recommendation === null) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Complete your profile first.</Text>
        <Text style={styles.text}>Go to Profile and save your weight, goal, and activity level.</Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Today</Text>
      <Text style={styles.text}>Calories: {recommendation.calories} kcal</Text>
      <Text style={styles.text}>Protein: {recommendation.macros.proteinGrams} g</Text>
      <Text style={styles.text}>Carbs: {recommendation.macros.carbsGrams} g</Text>
      <Text style={styles.text}>Fat: {recommendation.macros.fatGrams} g</Text>
      <Text style={styles.text}>Training: {recommendation.trainingType}</Text>
      <Text style={styles.text}>{recommendation.trainingRecommendation}</Text>
      <Text style={styles.trend}>Weight trend: {weightTrend.direction}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 20,
  },
  text: {
    fontSize: 18,
    color: "#111827",
    marginBottom: 12,
  },
  trend: {
    fontSize: 14,
    color: "#6B7280",
  },
});
