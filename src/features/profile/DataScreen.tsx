import { useState } from "react";
import { Button, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PeakData } from "../../types";
import { createDataExport } from "../../utils/dataExport";
import { exportFile } from "../../utils/exportFile";

type DataScreenProps = {
  data: PeakData;
  exportAllowed: boolean;
  resetting: boolean;
  onReset: () => Promise<boolean>;
};

export function DataScreen({ data, exportAllowed, resetting, onReset }: DataScreenProps) {
  const [confirming, setConfirming] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function exportData() {
    setExporting(true);
    setMessage("");
    setError("");
    try {
      const outcome = await exportFile(createDataExport(data));
      setMessage(outcome === "download-requested"
        ? "Download requested. Check your downloads; if you cancelled, no file was saved."
        : "Share sheet closed. If you cancelled, no export was saved.");
    } catch {
      setError("Export could not be completed. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Your Data</Text>
      <View style={styles.card}>
        <Text style={styles.text}>Export your saved profile, training history, weight measurements and recommendation history as a JSON file.</Text>
        <Text style={styles.text}>Peak does not upload this file. You choose where to save or share it.</Text>
        <Button title={exporting ? "Exporting…" : "Export Data"} disabled={!exportAllowed || exporting || resetting} onPress={exportData} />
        {!exportAllowed && !resetting ? <Text style={styles.text}>Export is available after your data has loaded and all changes are saved.</Text> : null}
        {message ? <Text accessibilityLiveRegion="polite" style={styles.text}>{message}</Text> : null}
        {error ? <Text accessibilityRole="alert" style={styles.text}>{error}</Text> : null}
      </View>
      <View style={styles.card}>
        <Text style={styles.text}>Recommendation history retains the original inputs and results, including measurements you later edit or delete. Reset removes this history too.</Text>
        <Text style={styles.text}>Reset removes your profile, training history, weights and recommendation history from this app on this device. Exported files and data in other browsers or devices are not removed.</Text>
        {resetting ? <Text accessibilityLiveRegion="polite">Resetting data. Keep the app open…</Text> : confirming ? (
          <View>
            <Text accessibilityRole="alert" style={styles.text}>Permanently remove all Peak data from this device?</Text>
            <Button title="Confirm Reset" color="#B91C1C" disabled={exporting} onPress={async () => { await onReset(); }} />
            <Button title="Cancel Reset" onPress={() => setConfirming(false)} />
          </View>
        ) : <Button title="Reset Data" color="#B91C1C" disabled={exporting} onPress={() => { setMessage(""); setError(""); setConfirming(true); }} />}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20 },
  title: { fontSize: 28, fontWeight: "700", color: "#111827", marginBottom: 20 },
  card: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E5E7EB" },
  text: { fontSize: 16, lineHeight: 24, color: "#374151", marginBottom: 12 },
});
