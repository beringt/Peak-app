import { useEffect, useState, useSyncExternalStore } from "react";
import { Button, StatusBar, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { ProfileScreen } from "./src/features/profile/ProfileScreen";
import { DataScreen } from "./src/features/profile/DataScreen";
import { DailyRecommendationScreen } from "./src/features/recommendation/DailyRecommendationScreen";
import { TrainingPlanScreen } from "./src/features/training/TrainingPlanScreen";
import { WeightLogScreen } from "./src/features/weight/WeightLogScreen";
import { createLocalPersistence } from "./src/utils/localPersistence";
import { deviceStorage } from "./src/utils/deviceStorage";
import { useLocalDay } from "./src/utils/useLocalDay";
import { formatDateKey } from "./src/utils/date";
import { mergeVisibleTrainingPlan } from "./src/features/training/rollingPlan";
import type { PeakData } from "./src/types";
import { WeeklyReviewScreen } from "./src/features/recommendation/WeeklyReviewScreen";
import { decideWeeklyReview, evaluateAndStoreWeeklyReview, saveWeeklySettings } from "./src/features/recommendation/weeklyReview";
import { captureTodayRecommendations } from "./src/features/recommendation/todayRecommendation";
import { ExperimentalTodayScreen } from "./src/features/recommendation/ExperimentalTodayScreen";
import { addWeightMeasurement, deleteWeightMeasurement, editWeightMeasurement } from "./src/features/weight/weightHistory";

export default function App() {
  return <SafeAreaProvider><PeakApp /></SafeAreaProvider>;
}

function PeakApp() {
  const today = useLocalDay();
  const activeTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [activeScreen, setActiveScreen] = useState<"today" | "profile" | "training" | "weight" | "data" | "review">("today");
  const [todayMode, setTodayMode] = useState<"existing" | "experimental">("existing");
  const [persistence] = useState(() => createLocalPersistence(deviceStorage));
  const saved = useSyncExternalStore(persistence.subscribe, persistence.getSnapshot, persistence.getSnapshot);
  useEffect(() => { void persistence.load(); }, [persistence]);
  const { profile, trainingPlan, weightEntries } = saved.data;
  function snapshotContext() {
    const clock = new Date();
    return { localDate: formatDateKey(clock), generatedAt: clock.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  }
  function updateData(change: (data: PeakData) => PeakData) {
    persistence.update(data => captureTodayRecommendations(change(data), snapshotContext(), todayMode === "experimental"));
  }
  useEffect(() => {
    if (saved.phase === "ready") persistence.update(data => captureTodayRecommendations(data, snapshotContext(), todayMode === "experimental"));
  }, [persistence, saved.phase, today, profile, trainingPlan, weightEntries, todayMode, saved.data.weeklyReview, activeTimeZone]);
  function weeklyAction(change: (data: PeakData) => PeakData): string | null {
    try { updateData(change); return null; } catch (error) { return error instanceof Error ? error.message : "Review could not be completed."; }
  }
  async function resetData() {
    const success = await persistence.reset();
    if (success) { setTodayMode("existing"); setActiveScreen("today"); }
    return success;
  }

  if (saved.phase !== "ready") {
    const messages = {
      loading: "Loading your saved data…",
      "read-error": "Your saved data could not be loaded. Please try again.",
      "invalid-data": "Your saved data could not be read. It has been kept unchanged.",
      "unsupported-version": "Your saved data needs a different app version. It has been kept unchanged.",
      resetting: "Resetting your data…",
      "reset-error": "Could not confirm deletion. Your session has been kept. Retry the reset below.",
    };
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.storageNotice}>
          <Text accessibilityLiveRegion="polite">{messages[saved.phase]}</Text>
          {saved.phase !== "loading" && saved.phase !== "resetting" && saved.phase !== "reset-error" ? <Button title="Retry loading" onPress={() => { void persistence.load(); }} /> : null}
        </View>
        {saved.phase !== "loading" ? <DataScreen data={saved.data} exportAllowed={false} resetting={saved.phase === "resetting"} onReset={resetData} /> : null}
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
      <Button title="Weekly Review (Experimental)" onPress={() => setActiveScreen("review")} />
      <Button title="Data" onPress={() => setActiveScreen("data")} />
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
      {activeScreen === "today" ? <>
        <View style={styles.todayChoice}>
          <Button title="Existing Today" onPress={() => setTodayMode("existing")} />
          <Button title="Experimental Today" onPress={() => setTodayMode("experimental")} />
          <Text>Selected: {todayMode}. Restart returns to the existing calculation.</Text>
        </View>
        {todayMode === "existing" ? <DailyRecommendationScreen today={today} profile={profile} trainingPlan={trainingPlan} weightEntries={weightEntries} /> :
          <ExperimentalTodayScreen data={saved.data} context={snapshotContext()} saveStatus={saved.saveStatus} onOpen={setActiveScreen} onExisting={() => setTodayMode("existing")} />}
      </> : null}
      {activeScreen === "profile" ? (
        <ProfileScreen savedProfile={profile} saveStatus={saved.saveStatus} onSave={(value) => updateData((data) => ({ ...data, profile: value }))} />
      ) : null}
      {activeScreen === "training" ? (
        <TrainingPlanScreen today={today} savedPlan={trainingPlan} onSave={(value) => updateData((data) => ({
          ...data, trainingPlan: mergeVisibleTrainingPlan(data.trainingPlan, value, formatDateKey(new Date())),
        }))} />
      ) : null}
      {activeScreen === "weight" ? (
        <WeightLogScreen
          today={today}
          weightEntries={weightEntries}
          onAdd={(value) => updateData((data) => ({
            ...data, weightEntries: addWeightMeasurement(data.weightEntries, value),
          }))}
          onUpdate={(id, value) => updateData((data) => ({
            ...data, weightEntries: editWeightMeasurement(data.weightEntries, id, value),
          }))}
          onDelete={(id) => updateData((data) => ({
            ...data, weightEntries: deleteWeightMeasurement(data.weightEntries, id),
          }))}
        />
      ) : null}
      {activeScreen === "review" ? <WeeklyReviewScreen data={saved.data} context={snapshotContext()} saveStatus={saved.saveStatus}
        onSettings={(settings, reset) => weeklyAction(data => saveWeeklySettings(data, settings, reset))}
        onEvaluate={confirmations => weeklyAction(data => evaluateAndStoreWeeklyReview(data, confirmations, snapshotContext()))}
        onDecision={(id, action, confirmations) => weeklyAction(data => decideWeeklyReview(data, id, action, confirmations, snapshotContext()))} /> : null}
      {activeScreen === "data" ? (
        <DataScreen
          data={saved.data}
          exportAllowed={saved.saveStatus === "idle" || saved.saveStatus === "saved"}
          resetting={false}
          onReset={resetData}
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
  todayChoice: { paddingHorizontal: 12, paddingVertical: 6 },
  storageNotice: {
    padding: 12,
  },
});
