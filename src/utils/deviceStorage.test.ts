jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import { deviceStorage, PEAK_STORAGE_KEY } from "./deviceStorage";

afterEach(() => jest.resetAllMocks());

test("reads and writes only the app's key", async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValue("original");
  expect(await deviceStorage.read()).toBe("original");
  await deviceStorage.write("replacement");
  expect(AsyncStorage.getItem).toHaveBeenCalledWith(PEAK_STORAGE_KEY);
  expect(AsyncStorage.setItem).toHaveBeenCalledWith(PEAK_STORAGE_KEY, "replacement");
  expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
});

test("distinguishes an absent key from failed reads and writes", async () => {
  jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("read"));
  expect(await deviceStorage.read()).toBeNull();
  await expect(deviceStorage.read()).rejects.toThrow("read");
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error("write"));
  await expect(deviceStorage.write("data")).rejects.toThrow("write");
});

test("exposes key-scoped removal without masking deletion failures", async () => {
  await deviceStorage.remove();
  expect(AsyncStorage.removeItem).toHaveBeenCalledWith(PEAK_STORAGE_KEY);
  jest.mocked(AsyncStorage.removeItem).mockRejectedValueOnce(new Error("remove"));
  await expect(deviceStorage.remove()).rejects.toThrow("remove");
});
