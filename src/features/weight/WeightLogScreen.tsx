import { useRef, useState } from "react";
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { WeightEntry } from "../../types";
import { formatDateKey } from "../../utils/date";
import { calculateWeightTrend } from "./calculateWeightTrend";
import { newestWeightMeasurements, validateWeightMeasurement } from "./weightHistory";
import type { WeightMeasurement } from "./weightHistory";

type WeightLogScreenProps = {
  weightEntries: WeightEntry[];
  onAdd: (measurement: WeightMeasurement) => void;
  onUpdate: (id: string, measurement: WeightMeasurement) => void;
  onDelete: (id: string) => void;
};

export function WeightLogScreen({ weightEntries, onAdd, onUpdate, onDelete }: WeightLogScreenProps) {
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(() => formatDateKey(new Date()));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const scroll = useRef<ScrollView>(null);

  function resetForm() {
    setWeight("");
    setDate(formatDateKey(new Date()));
    setEditingId(null);
    setErrorMessage("");
    scroll.current?.scrollTo({ y: 0, animated: true });
  }

  function saveWeight() {
    const result = validateWeightMeasurement(weight, date, formatDateKey(new Date()));
    if (!result.valid) {
      setErrorMessage(result.error);
      return;
    }
    if (editingId === null) onAdd(result.measurement);
    else onUpdate(editingId, result.measurement);
    resetForm();
  }

  function edit(entry: WeightEntry) {
    setEditingId(entry.id);
    setWeight(String(entry.weightKg));
    setDate(entry.date);
    setDeletingId(null);
    setErrorMessage("");
    scroll.current?.scrollTo({ y: 0, animated: true });
  }

  const recentEntries = newestWeightMeasurements(weightEntries);
  const trend = calculateWeightTrend(weightEntries);

  return (
    <ScrollView ref={scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Text style={styles.title}>Weight Log</Text>
      <View style={styles.card}>
        <Text style={styles.heading}>{editingId === null ? "Add Measurement" : "Edit Measurement"}</Text>
        <Text style={styles.label}>Weight (kg)</Text>
        <TextInput
          accessibilityLabel="Weight in kg"
          style={styles.input}
          value={weight}
          onChangeText={(value) => { setWeight(value); setErrorMessage(""); }}
          keyboardType="decimal-pad"
        />
        <Text style={styles.label}>Measurement date (YYYY-MM-DD)</Text>
        <TextInput
          accessibilityLabel="Measurement date"
          accessibilityHint="Enter today or an earlier date as year-month-day."
          style={styles.input}
          value={date}
          onChangeText={(value) => { setDate(value); setErrorMessage(""); }}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="YYYY-MM-DD"
        />
        <Button title={editingId === null ? "Add Weight" : "Save Measurement"} onPress={saveWeight} />
        {editingId !== null ? <Button title="Cancel Edit" onPress={resetForm} /> : null}
        {errorMessage ? <Text accessibilityRole="alert">{errorMessage}</Text> : null}
      </View>
      {recentEntries.map((entry) => (
        <View key={entry.id} style={styles.card}>
          <Text>{entry.date}</Text>
          <Text>{entry.weightKg} kg</Text>
          <Button
            title="Edit"
            accessibilityLabel={"Edit " + entry.weightKg + " kg on " + entry.date}
            onPress={() => edit(entry)}
          />
          <Button
            title="Delete"
            accessibilityLabel={"Delete " + entry.weightKg + " kg on " + entry.date}
            onPress={() => setDeletingId(entry.id)}
          />
          {deletingId === entry.id ? (
            <View>
              <Text accessibilityRole="alert">Delete {entry.weightKg} kg recorded on {entry.date}?</Text>
              <Button title="Confirm Delete" color="#B91C1C" onPress={() => {
                onDelete(entry.id);
                setDeletingId(null);
                if (editingId === entry.id) resetForm();
              }} />
              <Button title="Cancel Delete" onPress={() => setDeletingId(null)} />
            </View>
          ) : null}
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
  heading: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    color: "#111827",
  },
  input: {
    borderWidth: 1,
    borderColor: "#6B7280",
    borderRadius: 8,
    padding: 12,
    fontSize: 20,
    color: "#111827",
    marginBottom: 12,
  },
});
