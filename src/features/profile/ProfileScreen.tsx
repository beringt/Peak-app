import { useState } from "react";
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { UserProfile } from "../../types";

const goalLabels: Record<UserProfile["goal"], string> = {
  lose: "Lose Weight",
  maintain: "Maintain Weight",
  gain: "Gain Weight",
};

const activityLabels: Record<UserProfile["activityLevel"], string> = {
  low: "Low Activity",
  medium: "Moderate Activity",
  high: "High Activity",
};

export function ProfileScreen() {
  const [weight, setWeight] = useState("80");
  const [goal, setGoal] = useState<UserProfile["goal"]>("maintain");
  const [activityLevel, setActivityLevel] =
    useState<UserProfile["activityLevel"]>("medium");
  const [savedProfile, setSavedProfile] = useState<UserProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");

  function saveProfile() {
    const parsedWeight = Number(weight.trim().replace(",", "."));
    setConfirmationMessage("");

    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      setErrorMessage("Enter a valid weight in kg.");
      return;
    }

    const profile: UserProfile = { weight: parsedWeight, goal, activityLevel };
    setSavedProfile(profile);
    setErrorMessage("");
    setConfirmationMessage("Profile saved.");
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>My Profile</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Weight (kg)</Text>
        <TextInput
          accessibilityLabel="Weight in kg"
          style={styles.input}
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Goal</Text>
        {(["lose", "maintain", "gain"] as const).map((option) => (
          <Button
            key={option}
            title={{ lose: "Lose", maintain: "Maintain", gain: "Gain" }[option]}
            onPress={() => setGoal(option)}
            accessibilityState={{ selected: goal === option }}
          />
        ))}
        <Text>Selected: {goalLabels[goal]}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Activity Level</Text>
        {(["low", "medium", "high"] as const).map((option) => (
          <Button
            key={option}
            title={{ low: "Low", medium: "Medium", high: "High" }[option]}
            onPress={() => setActivityLevel(option)}
            accessibilityState={{ selected: activityLevel === option }}
          />
        ))}
        <Text>Selected: {activityLabels[activityLevel]}</Text>
      </View>
      <Button title="Save Profile" onPress={saveProfile} />
      {errorMessage ? <Text accessibilityRole="alert">{errorMessage}</Text> : null}
      {confirmationMessage ? <Text accessibilityLiveRegion="polite">{confirmationMessage}</Text> : null}
      {savedProfile ? (
        <View style={styles.card}>
          <Text style={styles.label}>Saved Profile</Text>
          <Text style={styles.value}>{savedProfile.weight} kg</Text>
          <Text>{goalLabels[savedProfile.goal]}</Text>
          <Text>{activityLabels[savedProfile.activityLevel]}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 24,
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
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 6,
  },
  value: {
    fontSize: 20,
    fontWeight: "600",
    color: "#111827",
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
