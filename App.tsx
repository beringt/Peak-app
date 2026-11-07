import { SafeAreaView, StatusBar, StyleSheet } from "react-native";

import { WeightLogScreen } from "./src/features/weight/WeightLogScreen";

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <WeightLogScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },
});
