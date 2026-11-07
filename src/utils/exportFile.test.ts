jest.mock("react-native", () => ({ Platform: { OS: "ios" } }));
jest.mock("expo-file-system", () => ({
  cacheDirectory: "cache/",
  EncodingType: { UTF8: "utf8" },
  writeAsStringAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));
jest.mock("expo-sharing", () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));

import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { exportFile } from "./exportFile";

beforeEach(() => {
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined);
  jest.mocked(FileSystem.writeAsStringAsync).mockResolvedValue(undefined);
  jest.mocked(FileSystem.deleteAsync).mockResolvedValue(undefined);
});
afterEach(() => jest.resetAllMocks());

test("writes JSON to cache, shares it and removes the temporary file", async () => {
  expect(await exportFile('{"version":1}')).toBe("share-closed");
  const uri = jest.mocked(FileSystem.writeAsStringAsync).mock.calls[0][0];
  expect(uri).toMatch(/^cache\/peak-export-\d+\.json$/);
  expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(uri, '{"version":1}', { encoding: "utf8" });
  expect(Sharing.shareAsync).toHaveBeenCalledWith(uri, expect.objectContaining({ mimeType: "application/json", UTI: "public.json" }));
  expect(FileSystem.deleteAsync).toHaveBeenCalledWith(uri, { idempotent: true });
});

test("unavailable sharing fails without creating a file", async () => {
  jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);
  await expect(exportFile("{}")).rejects.toThrow("unavailable");
  expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
});

test.each(["write", "share"])("cleans up when %s fails", async (failure) => {
  if (failure === "write") jest.mocked(FileSystem.writeAsStringAsync).mockRejectedValueOnce(new Error("write"));
  else jest.mocked(Sharing.shareAsync).mockRejectedValueOnce(new Error("share"));
  await expect(exportFile("{}")).rejects.toThrow(failure);
  expect(FileSystem.deleteAsync).toHaveBeenCalledTimes(1);
});

test("cleanup failure is reported instead of claiming complete success", async () => {
  jest.mocked(FileSystem.deleteAsync).mockRejectedValueOnce(new Error("cleanup"));
  await expect(exportFile("{}")).rejects.toThrow("cleanup");
});
