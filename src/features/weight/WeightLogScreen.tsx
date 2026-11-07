import { useState } from "react";
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { WeightEntry } from "../../types";
import { formatDateKey } from "../../utils/date";
import { calculateWeightTrend } from "./calculateWeightTrend";

type WeightLogScreenProps = {
  weightEntries: WeightEntry[];
  onAdd: (entry: WeightEntry) => void;
};

export function WeightLogScreen({ weightEntries, onAdd }: WeightLogScreenProps) {
  const [weight, setWeight] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  function addWeight() {
    const parsedWeight = Number(weight.trim().replace(",", "."));
    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0 || parsedWeight > 500) {
      setErrorMessage("Enter a valid weight in kg.");
      return;
    }

    const entry: WeightEntry = {
      id: Date.now().toString(),
      date: formatDateKey(new Date()),
      weightKg: parsedWeight,
    };
    onAdd(entry);
    setWeight("");
    setErrorMessage("");
  }

  const recentEntries = [...weightEntries].sort(
    (a, b) => b.date.localeCompare(a.date) || Number(b.id) - Number(a.id)
  );
  const trend = calculateWeightTrend(weightEntries);

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Weight Log</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Weight (kg)</Text>
        <TextInput
          accessibilityLabel="Weight in kg"
          style={styles.input}
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
        />
        <Button title="Add Weight" onPress={addWeight} />
        {errorMessage ? <Text accessibilityRole="alert">{errorMessage}</Text> : null}
      </View>
      {recentEntries.map((entry) => (
        <View key={entry.id} style={styles.card}>
          <Text>{entry.date}</Text>
          <Text>{entry.weightKg} kg</Text>
        </View>
      ))}
      <Text accessibilityLiveRegion="polite">Trend: {trend.direction}</Text>
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
  label: {
    color: "#6B7280",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#6B7280",
    borderRadius: 8,
    padding: 12,
    fontSize: 20,
    color: "#111827",
  },
});
