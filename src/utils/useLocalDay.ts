import { useEffect, useState } from "react";
import { AppState, Platform } from "react-native";
import { formatDateKey } from "./date";
import { startLocalDayClock } from "./localDayClock";

export function useLocalDay(): string {
  const [day, setDay] = useState(() => formatDateKey(new Date()));
  useEffect(() => startLocalDayClock(setDay, (refresh) => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    if (Platform.OS === "web") {
      const visible = () => { if (document.visibilityState === "visible") refresh(); };
      window.addEventListener("focus", refresh);
      document.addEventListener("visibilitychange", visible);
      return () => {
        subscription.remove();
        window.removeEventListener("focus", refresh);
        document.removeEventListener("visibilitychange", visible);
      };
    }
    return () => subscription.remove();
  }), []);
  return day;
}
