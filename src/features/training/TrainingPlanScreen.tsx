import { useRef, useState } from "react";
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { PlannedSession, TrainingDay } from "../../types";
import { visibleTrainingPlan } from "./rollingPlan";
import { dayWithSessions, isLongEndurance, longEnduranceTomorrow, parseDuration, sessionsForDay, validSessions } from "./plannedSessions";

type SessionDraft = Omit<PlannedSession, "durationMinutes"> & { duration: string };
const draftSession = ({ durationMinutes, ...session }: PlannedSession): SessionDraft =>
  ({ ...session, duration: durationMinutes === null ? "" : String(durationMinutes) });

type TrainingPlanScreenProps = {
  savedPlan: TrainingDay[];
  onSave: (plan: TrainingDay[]) => void;
  today: string;
};

export function TrainingPlanScreen({ savedPlan, onSave, today }: TrainingPlanScreenProps) {
  const [edits, setEdits] = useState<Record<string, SessionDraft[]>>({});
  const [submittedDay, setSubmittedDay] = useState<string | null>(null);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const days = visibleTrainingPlan(savedPlan, today);
  const drafts = (day: TrainingDay) => edits[day.date] ?? sessionsForDay(day).map(draftSession);
  const longTomorrow = longEnduranceTomorrow(savedPlan, today);

  function edit(day: TrainingDay, change: (sessions: SessionDraft[]) => SessionDraft[]) {
    setEdits(current => ({ ...current, [day.date]: change(current[day.date] ?? sessionsForDay(day).map(draftSession)) }));
    setSubmittedDay(null);
    setError("");
  }

  function add(day: TrainingDay, type: PlannedSession["type"]) {
    const used = new Set([
      ...savedPlan.flatMap(d => sessionsForDay(d).map(s => s.id)),
      ...Object.values(edits).flatMap(list => list.map(s => s.id)),
    ]);
    let id: string;
    do { id = `planned:${day.date}:${Date.now()}:${++sequence.current}`; } while (used.has(id));
    edit(day, list => [...list, { id, type, duration: "", intensity: null }]);
  }

  function save() {
    const plan: TrainingDay[] = [];
    for (const day of days) {
      const sessions: PlannedSession[] = [];
      for (const { duration, ...session } of drafts(day)) {
        const minutes = parseDuration(duration);
        if (minutes === "invalid") {
          setError(`${day.date}: enter 1–240 minutes per session, or leave duration blank.`);
          return;
        }
        sessions.push({ ...session, durationMinutes: minutes });
      }
      if (!validSessions(sessions)) {
        setError(`${day.date}: known durations must total no more than 360 minutes.`);
        return;
      }
      plan.push(dayWithSessions(day.date, sessions));
    }
    onSave(plan);
    setEdits({});
    setError("");
    setSubmittedDay(today);
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Text style={styles.title}>Training Plan</Text>
      <Text style={styles.help}>Plan one or more sessions per day. Blank duration and Unknown intensity mean information is missing, not zero effort. Details apply only after saving.</Text>
      <Text style={styles.help}>Today's targets still use the first saved session's category. Duration, intensity and additional sessions do not yet change calories. Listed sessions are separate, non-overlapping planned sessions.</Text>
      <Text style={styles.help}>Saved plan for tomorrow: {longTomorrow === true ? "long endurance session planned" : longTomorrow === null ? "long-session status unknown" : "no long endurance session planned"}.</Text>
      {days.map(day => {
        const sessions = drafts(day);
        const knownMinutes = sessions.reduce((sum, session) => {
          const minutes = parseDuration(session.duration);
          return sum + (typeof minutes === "number" ? minutes : 0);
        }, 0);
        return (
          <View key={day.date} style={styles.card}>
            <Text style={styles.date}>{day.date}</Text>
            <Text>Selected: {sessions[0]?.type ?? "rest"}</Text>
            <View style={styles.buttons}>
              <Button title="Add Strength" onPress={() => add(day, "strength")} />
              <Button title="Add Endurance" onPress={() => add(day, "endurance")} />
              <Button title="Rest" onPress={() => edit(day, () => [])} />
            </View>
            {sessions.length === 0 ? <Text style={styles.help}>Rest day. Save to confirm this choice.</Text> : null}
            {sessions.map((session, index) => {
              const patch = (change: Partial<SessionDraft>) => edit(day, list => list.map(s => s.id === session.id ? { ...s, ...change } : s));
              const parsed = parseDuration(session.duration);
              const long = parsed === "invalid" ? null : isLongEndurance({ ...session, durationMinutes: parsed });
              return (
                <View key={session.id} style={styles.session}>
                  <Text>Session {index + 1}: {session.type}{index === 0 ? " (category used by Today)" : ""}</Text>
                  <View style={styles.buttons}>
                    <Button title="Strength" onPress={() => patch({ type: "strength" })} />
                    <Button title="Endurance" onPress={() => patch({ type: "endurance" })} />
                  </View>
                  <TextInput accessibilityLabel={`Duration for session ${index + 1} on ${day.date}`}
                    accessibilityHint="Minutes, 1 to 240, or blank for unknown"
                    style={styles.input} value={session.duration} keyboardType="decimal-pad"
                    placeholder="Duration in minutes (optional)" onChangeText={duration => patch({ duration })} />
                  <Text>Intensity: {session.intensity ?? "unknown"}</Text>
                  <View style={styles.buttons}>
                    {([null, "low", "moderate", "high"] as const).map(intensity => (
                      <Button key={intensity ?? "unknown"} title={intensity ?? "Unknown"}
                        accessibilityLabel={`${intensity ?? "Unknown"} intensity for session ${index + 1} on ${day.date}`}
                        onPress={() => patch({ intensity })} />
                    ))}
                  </View>
                  {session.type === "endurance" ? <Text style={styles.help}>{parsed === "invalid" ? "Enter a valid duration." : long === null ? "Long-session status unknown." : long ? "Long endurance session (over 90 minutes)." : "Not a long endurance session."}</Text> : null}
                  <Button title="Remove Session" accessibilityLabel={`Remove session ${index + 1} on ${day.date}`}
                    onPress={() => edit(day, list => list.filter(s => s.id !== session.id))} />
                </View>
              );
            })}
            {sessions.length ? <Text style={styles.help}>Known duration: {knownMinutes} minutes (maximum 360/day). {sessions.filter(s => parseDuration(s.duration) === null).length} session(s) with unknown duration.</Text> : null}
          </View>
        );
      })}
      {Object.keys(edits).length ? <Text style={styles.help}>Unsaved training changes. Save to apply them.</Text> : null}
      <Button title="Save Training Plan" onPress={save} />
      {error ? <Text accessibilityRole="alert">{error}</Text> : null}
      {submittedDay === today ? <Text accessibilityLiveRegion="polite">Training plan submitted. Check the device save status above.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  date: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginBottom: 8,
  },
  input: { borderWidth: 1, borderColor: "#6B7280", borderRadius: 8, padding: 10, marginVertical: 8, minHeight: 44 },
  session: { borderTopWidth: 1, borderColor: "#E5E7EB", paddingTop: 12, marginTop: 12 },
  help: { marginVertical: 8, lineHeight: 22, color: "#374151" },
  buttons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "space-between",
    marginBottom: 8,
  },
});
