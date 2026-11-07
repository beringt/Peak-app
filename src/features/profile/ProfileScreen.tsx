import { useState } from "react";
import { Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import type { UserProfile } from "../../types";
import type { PersistenceSnapshot } from "../../utils/localPersistence";
import { parseWeight } from "../../utils/weight";

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

type ProfileScreenProps = {
  savedProfile: UserProfile | null;
  onSave: (profile: UserProfile) => void;
  saveStatus: PersistenceSnapshot["saveStatus"];
};

export function ProfileScreen({ savedProfile, onSave, saveStatus }: ProfileScreenProps) {
  const [weight, setWeight] = useState(String(savedProfile?.weight ?? 80));
  const [goal, setGoal] = useState<UserProfile["goal"]>(savedProfile?.goal ?? "maintain");
  const [activityLevel, setActivityLevel] =
    useState<UserProfile["activityLevel"]>(savedProfile?.activityLevel ?? "medium");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const hasChanges = savedProfile === null ||
    parseWeight(weight) !== savedProfile.weight ||
    goal !== savedProfile.goal || activityLevel !== savedProfile.activityLevel;

  function editing() {
    setSubmitted(false);
    setErrorMessage("");
  }

  function saveProfile() {
    const parsedWeight = parseWeight(weight);
    setSubmitted(false);

    if (parsedWeight === null) {
      setErrorMessage("Enter a valid weight in kg.");
      return;
    }

    const profile: UserProfile = { weight: parsedWeight, goal, activityLevel };
    onSave(profile);
    setErrorMessage("");
    setSubmitted(true);
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{savedProfile ? "Edit Profile" : "Set Up Your Profile"}</Text>
      <Text style={styles.help}>
        {savedProfile
          ? "Edit your details, then save to update your daily targets."
          : "These are suggested starting values. Check your details and save to get your daily targets."}
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Weight (kg)</Text>
        <TextInput
          accessibilityLabel="Weight in kg"
          style={styles.input}
          value={weight}
          onChangeText={(value) => { editing(); setWeight(value); }}
          keyboardType="decimal-pad"
          accessibilityHint="Enter a weight greater than zero and up to 500 kilograms."
        />
        <Text style={styles.help}>Greater than 0 and up to 500 kg.</Text>
      </View>

      <View style={styles.card} accessibilityRole="radiogroup" accessibilityLabel="Goal">
        <Text style={styles.label}>Goal</Text>
        {(["lose", "maintain", "gain"] as const).map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityLabel={{ lose: "Lose", maintain: "Maintain", gain: "Gain" }[option]}
            onPress={() => { editing(); setGoal(option); }}
            accessibilityState={{ checked: goal === option }}
            aria-checked={goal === option}
            style={({ pressed }) => [
              styles.option, goal === option && styles.selectedOption, pressed && styles.pressedOption,
            ]}
          >
            <Text style={[styles.optionText, goal === option && styles.selectedText]}>
              {goal === option ? "✓ " : ""}{{ lose: "Lose", maintain: "Maintain", gain: "Gain" }[option]}
            </Text>
          </Pressable>
        ))}
        <Text>Selected: {goalLabels[goal]}</Text>
      </View>

      <View style={styles.card} accessibilityRole="radiogroup" accessibilityLabel="Activity Level">
        <Text style={styles.label}>Activity Level</Text>
        {(["low", "medium", "high"] as const).map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityLabel={{ low: "Low", medium: "Medium", high: "High" }[option]}
            onPress={() => { editing(); setActivityLevel(option); }}
            accessibilityState={{ checked: activityLevel === option }}
            aria-checked={activityLevel === option}
            style={({ pressed }) => [
              styles.option, activityLevel === option && styles.selectedOption, pressed && styles.pressedOption,
            ]}
          >
            <Text style={[styles.optionText, activityLevel === option && styles.selectedText]}>
              {activityLevel === option ? "✓ " : ""}{{ low: "Low", medium: "Medium", high: "High" }[option]}
            </Text>
          </Pressable>
        ))}
        <Text>Selected: {activityLabels[activityLevel]}</Text>
      </View>
      {hasChanges ? <Text style={styles.help}>Unsaved changes. Save to apply them.</Text> : null}
      <Button title="Save Profile" onPress={saveProfile} disabled={saveStatus === "saving"} />
      {errorMessage ? <Text accessibilityRole="alert">{errorMessage}</Text> : null}
      {submitted ? (
        <Text accessibilityLiveRegion="polite" style={styles.help}>
          {saveStatus === "saving" ? "Saving profile…" :
            saveStatus === "error" ? "Profile could not be saved on this device. Retry saving above." :
            saveStatus === "saved" ? "Profile saved on this device." : ""}
        </Text>
      ) : null}
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
  help: {
    fontSize: 16,
    lineHeight: 24,
    color: "#374151",
    marginBottom: 12,
  },
  option: {
    minHeight: 44,
    justifyContent: "center",
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#6B7280",
    borderRadius: 8,
  },
  selectedOption: {
    backgroundColor: "#1D4ED8",
    borderColor: "#1D4ED8",
  },
  optionText: {
    fontSize: 16,
    color: "#111827",
  },
  selectedText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  pressedOption: {
    opacity: 0.75,
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
