import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
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
  if (!await Sharing.isAvailableAsync()) {
    throw new Error("File sharing is unavailable on this device.");
  }
  const file = new File(Paths.cache, filename);
  try {
    file.create();
    await file.write(json);
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/json", UTI: "public.json", dialogTitle: "Export Peak data",
    });
    return "share-closed";
  } finally {
    if (file.exists) await file.delete();
  }
}
