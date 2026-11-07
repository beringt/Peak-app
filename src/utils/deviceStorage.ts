import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PeakStorage } from "./persistedData";

export const PEAK_STORAGE_KEY = "@peak/local-data";

export const deviceStorage: PeakStorage = {
  read: () => AsyncStorage.getItem(PEAK_STORAGE_KEY),
  write: (raw) => AsyncStorage.setItem(PEAK_STORAGE_KEY, raw),
  remove: () => AsyncStorage.removeItem(PEAK_STORAGE_KEY),
};
