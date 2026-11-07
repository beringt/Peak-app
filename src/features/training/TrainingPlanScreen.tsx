import { useState } from "react";
import { Button, ScrollView, StyleSheet, Text, View } from "react-native";

import type { TrainingDay, TrainingType } from "../../types";
import { visibleTrainingPlan } from "./rollingPlan";

const trainingLabels: Record<TrainingDay["type"], string> = {
  strength: "Strength",
  endurance: "Endurance",
  rest: "Rest",
};

type TrainingPlanScreenProps = {
  savedPlan: TrainingDay[];
  onSave: (plan: TrainingDay[]) => void;
  today: string;
};

export function TrainingPlanScreen({ savedPlan, onSave, today }: TrainingPlanScreenProps) {
  const [edits, setEdits] = useState<Record<string, TrainingType>>({});
  const [submittedDay, setSubmittedDay] = useState<string | null>(null);
  const trainingPlan = visibleTrainingPlan(savedPlan, today, edits);

  function selectTraining(date: string, type: TrainingDay["type"]) {
    setEdits((current) => ({ ...current, [date]: type }));
    setSubmittedDay(null);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Training Plan</Text>
      {trainingPlan.map((day) => (
        <View key={day.date} style={styles.card}>
          <Text style={styles.date}>{day.date}</Text>
          <View style={styles.buttons}>
            {(["strength", "endurance", "rest"] as const).map((type) => (
              <Button
                key={type}
                title={trainingLabels[type]}
                onPress={() => selectTraining(day.date, type)}
              />
            ))}
          </View>
          <Text>Selected: {day.type}</Text>
        </View>
      ))}
      <Button
        title="Save Training Plan"
        onPress={() => {
          onSave(trainingPlan);
          setEdits({});
          setSubmittedDay(today);
        }}
      />
      {submittedDay === today ? (
        <Text accessibilityLiveRegion="polite">Training plan submitted. Check the device save status above.</Text>
      ) : null}
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
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  date: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  buttons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
});
