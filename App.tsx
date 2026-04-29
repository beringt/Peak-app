import { Text, View } from "react-native";

import type { UserProfile } from "./src/types";

const profile: UserProfile = {
  weight: 80,
  goal: "maintain",
  activityLevel: "medium",
};

export default function App() {
  return (
    <View>
      <Text>Peak MVP</Text>
      <Text>{profile.weight}</Text>
    </View>
  );
}
