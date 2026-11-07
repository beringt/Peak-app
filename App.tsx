import { useState } from "react";
import { Button, SafeAreaView, StatusBar, StyleSheet, View } from "react-native";

import { ProfileScreen } from "./src/features/profile/ProfileScreen";
import { DailyRecommendationScreen } from "./src/features/recommendation/DailyRecommendationScreen";
import { TrainingPlanScreen } from "./src/features/training/TrainingPlanScreen";
import { WeightLogScreen } from "./src/features/weight/WeightLogScreen";
import type { TrainingDay, UserProfile, WeightEntry } from "./src/types";

export default function App() {
  const [activeScreen, setActiveScreen] = useState<"today" | "profile" | "training" | "weight">("today");
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [trainingPlan, setTrainingPlan] = useState<TrainingDay[]>([]);
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.buttons}>
        {(["today", "profile", "training", "weight"] as const).map((screen) => (
          <Button
            key={screen}
            title={screen.charAt(0).toUpperCase() + screen.slice(1)}
            onPress={() => setActiveScreen(screen)}
          />
        ))}
      </View>
      {activeScreen === "today" ? (
        <DailyRecommendationScreen
          profile={profile}
          trainingPlan={trainingPlan}
          weightEntries={weightEntries}
        />
      ) : null}
      {activeScreen === "profile" ? (
        <ProfileScreen savedProfile={profile} onSave={setProfile} />
      ) : null}
      {activeScreen === "training" ? (
        <TrainingPlanScreen savedPlan={trainingPlan} onSave={setTrainingPlan} />
      ) : null}
      {activeScreen === "weight" ? (
        <WeightLogScreen
          weightEntries={weightEntries}
          onAdd={(entry) => setWeightEntries((entries) => [...entries, entry])}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
});
