import { useEffect, useState, useSyncExternalStore } from "react";
import { Button, SafeAreaView, StatusBar, StyleSheet, Text, View } from "react-native";

import { ProfileScreen } from "./src/features/profile/ProfileScreen";
import { DailyRecommendationScreen } from "./src/features/recommendation/DailyRecommendationScreen";
import { TrainingPlanScreen } from "./src/features/training/TrainingPlanScreen";
import { WeightLogScreen } from "./src/features/weight/WeightLogScreen";
import { createLocalPersistence } from "./src/utils/localPersistence";
import { deviceStorage } from "./src/utils/deviceStorage";
import { addWeightMeasurement, deleteWeightMeasurement, editWeightMeasurement } from "./src/features/weight/weightHistory";

export default function App() {
  const [activeScreen, setActiveScreen] = useState<"today" | "profile" | "training" | "weight">("today");
  const [persistence] = useState(() => createLocalPersistence(deviceStorage));
  const saved = useSyncExternalStore(persistence.subscribe, persistence.getSnapshot, persistence.getSnapshot);
  useEffect(() => { void persistence.load(); }, [persistence]);
  const { profile, trainingPlan, weightEntries } = saved.data;

  if (saved.phase !== "ready") {
    const messages = {
      loading: "Loading your saved data…",
      "read-error": "Your saved data could not be loaded. Please try again.",
      "invalid-data": "Your saved data could not be read. It has been kept unchanged.",
      "unsupported-version": "Your saved data needs a different app version. It has been kept unchanged.",
    };
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.storageNotice}>
          <Text accessibilityLiveRegion="polite">{messages[saved.phase]}</Text>
          {saved.phase !== "loading" ? <Button title="Retry loading" onPress={() => { void persistence.load(); }} /> : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.storageNotice}>
        <Text accessibilityLiveRegion="polite">
          {saved.saveStatus === "saving" ? "Saving on this device…" :
            saved.saveStatus === "error" ? (saved.saveError === "validation" ?
              "Changes contain invalid data and could not be saved on this device." :
              "Changes could not be saved on this device. Keep the app open and retry.") :
              saved.saveStatus === "saved" ? "Saved on this device." : "Data is stored on this device only."}
        </Text>
        {saved.saveStatus === "error" ? <Button title="Retry saving" onPress={persistence.retrySave} /> : null}
      </View>
      <View style={styles.buttons}>
        {(["today", "profile", "training", "weight"] as const).map((screen) => (
          <Button
            key={screen}
            title={screen.charAt(0).toUpperCase() + screen.slice(1)}
            onPress={() => setActiveScreen(screen)}
          />
        ))}
      </View>
      {activeScreen === "today" && profile === null ? (
        <View style={styles.storageNotice}>
          <Text>Start with your profile to get daily targets.</Text>
          <Button title="Set Up Profile" onPress={() => setActiveScreen("profile")} />
        </View>
      ) : null}
      {activeScreen === "today" ? (
        <DailyRecommendationScreen
          profile={profile}
          trainingPlan={trainingPlan}
          weightEntries={weightEntries}
        />
      ) : null}
      {activeScreen === "profile" ? (
        <ProfileScreen savedProfile={profile} saveStatus={saved.saveStatus} onSave={(value) => persistence.update((data) => ({ ...data, profile: value }))} />
      ) : null}
      {activeScreen === "training" ? (
        <TrainingPlanScreen savedPlan={trainingPlan} onSave={(value) => persistence.update((data) => ({ ...data, trainingPlan: value }))} />
      ) : null}
      {activeScreen === "weight" ? (
        <WeightLogScreen
          weightEntries={weightEntries}
          onAdd={(value) => persistence.update((data) => ({
            ...data, weightEntries: addWeightMeasurement(data.weightEntries, value),
          }))}
          onUpdate={(id, value) => persistence.update((data) => ({
            ...data, weightEntries: editWeightMeasurement(data.weightEntries, id, value),
          }))}
          onDelete={(id) => persistence.update((data) => ({
            ...data, weightEntries: deleteWeightMeasurement(data.weightEntries, id),
          }))}
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
  storageNotice: {
    padding: 12,
  },
});
