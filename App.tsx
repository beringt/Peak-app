import { SafeAreaView, StatusBar, StyleSheet } from "react-native";

import { ProfileScreen } from "./src/features/profile/ProfileScreen";

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ProfileScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },
});
