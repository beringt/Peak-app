import { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";

import type { UserProfile } from "../../types";

export default function ProfileScreen() {
  const [weight, setWeight] = useState("80");
  const [goal, setGoal] = useState<UserProfile["goal"]>("maintain");
  const [activityLevel, setActivityLevel] = useState<UserProfile["activityLevel"]>("medium");
  const [savedProfile, setSavedProfile] = useState<UserProfile | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");

  const handleSaveProfile = () => {
    const parsedWeight = Number(weight);

    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0 || parsedWeight > 500) {
      setErrorMessage("Enter a valid weight in kg.");
      setConfirmationMessage("");
      return;
    }

    const profile: UserProfile = {
      weight: parsedWeight,
      goal,
      activityLevel,
    };

    setSavedProfile(profile);
    setErrorMessage("");
    setConfirmationMessage("Profile saved.");
  };

  return (
    <View style={styles.container}>
      <Text>Weight (kg)</Text>
      <TextInput
        value={weight}
        onChangeText={setWeight}
        keyboardType="numeric"
        style={styles.input}
      />

      <Text>Goal</Text>
      <View style={styles.buttonRow}>
        <Button title="Lose" onPress={() => setGoal("lose")} />
        <Button title="Maintain" onPress={() => setGoal("maintain")} />
        <Button title="Gain" onPress={() => setGoal("gain")} />
      </View>

      <Text>Activity Level</Text>
      <View style={styles.buttonRow}>
        <Button title="Low" onPress={() => setActivityLevel("low")} />
        <Button title="Medium" onPress={() => setActivityLevel("medium")} />
        <Button title="High" onPress={() => setActivityLevel("high")} />
      </View>

      <Button title="Save Profile" onPress={handleSaveProfile} />

      {errorMessage ? <Text>{errorMessage}</Text> : null}
      {confirmationMessage ? <Text>{confirmationMessage}</Text> : null}

      {savedProfile ? (
        <View>
          <Text>Saved Profile</Text>
          <Text>Weight: {savedProfile.weight}</Text>
          <Text>Goal: {savedProfile.goal}</Text>
          <Text>Activity Level: {savedProfile.activityLevel}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 8,
  },
  input: {
    borderWidth: 1,
    padding: 8,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
});
