import { StyleSheet, Text, View } from "react-native";

import type { UserProfile } from "../../types";

const profile: UserProfile = {
  weight: 80,
  goal: "maintain",
  activityLevel: "medium",
};

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
  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Profile</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Current Weight</Text>
        <Text style={styles.value}>{profile.weight} kg</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Goal</Text>
        <Text style={styles.value}>{goalLabels[profile.goal]}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Activity Level</Text>
        <Text style={styles.value}>{activityLabels[profile.activityLevel]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
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
});
