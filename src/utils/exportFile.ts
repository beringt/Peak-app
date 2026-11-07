import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export async function exportFile(json: string): Promise<"download-requested" | "share-closed"> {
  const filename = "peak-export-" + Date.now() + ".json";
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const link = document.createElement("a");
    try {
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      return "download-requested";
    } finally {
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
  }
  if (!FileSystem.cacheDirectory || !await Sharing.isAvailableAsync()) {
    throw new Error("File sharing is unavailable on this device.");
  }
  const uri = FileSystem.cacheDirectory + filename;
  try {
    await FileSystem.writeAsStringAsync(uri, json, { encoding: FileSystem.EncodingType.UTF8 });
    await Sharing.shareAsync(uri, {
      mimeType: "application/json", UTI: "public.json", dialogTitle: "Export Peak data",
    });
    return "share-closed";
  } finally {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}
