import { SafeAreaView, StatusBar, StyleSheet } from "react-native";

import { TrainingPlanScreen } from "./src/features/training/TrainingPlanScreen";

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <TrainingPlanScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },
});
