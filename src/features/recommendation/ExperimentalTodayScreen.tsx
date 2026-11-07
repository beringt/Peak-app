import { useState } from "react";
import { Button, ScrollView, StyleSheet, Text, View } from "react-native";
import type { PeakData } from "../../types";
import type { SnapshotContext } from "../../utils/recommendationSnapshots";
import type { PersistenceSnapshot } from "../../utils/localPersistence";
import { sessionsForDay } from "../training/plannedSessions";
import { readCurrentExperimentalToday, readSavedExperimentalToday } from "./todayRecommendation";
import { displayNumber, explainDailyReason } from "./recommendationReasons";
import { currentWeeklyReview, weeklyPeriodStart } from "./weeklyReview";

export type TodayDestination = "profile" | "training" | "weight" | "review" | "data";
type Props = { data: PeakData; context: SnapshotContext; saveStatus: PersistenceSnapshot["saveStatus"];
  onOpen: (destination: TodayDestination) => void; onExisting: () => void };
export function ExperimentalTodayScreen({ data, context, saveStatus, onOpen, onExisting }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const history = (data.recommendationSnapshots ?? []).filter(s => s.channel === "experimental").slice(-5).reverse();
  const selected = selectedId ? data.recommendationSnapshots?.find(s => s.id === selectedId) ?? null : null;
  const view = selectedId ? readSavedExperimentalToday(selected) : readCurrentExperimentalToday(data, context);
  const historical = selectedId !== null;
  const currentReview = historical ? null : currentWeeklyReview(data, context.localDate);
  const result = view?.result, request = view?.input;
  const day = request?.trainingPlan.find(d => d.date === view!.snapshot.localDate);
  const sessions = day ? sessionsForDay(day) : null;
  const evidence = request?.weightEvidence;
  const decision = request?.acceptedWeeklyOffset ? data.weeklyReview?.records.find(r => r.id === request.acceptedWeeklyOffset!.decisionId) : null;
  function contribution(code: string, fallback: number | null | undefined) {
    const reason = result?.reasons.find(r => r.code === code);
    const proposed = reason?.values.proposedKcal ?? (typeof reason?.values.roundedEnergyKcal === "number" && typeof reason.values.unroundedEnergyKcal === "number" ? reason.values.roundedEnergyKcal - reason.values.unroundedEnergyKcal : fallback);
    return `${displayNumber(reason?.appliedDelta?.amount ?? fallback)} kcal${reason?.heldReason ? ` (held; proposed ${displayNumber(proposed)} kcal)` : ""}`;
  }
  return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.title}>Experimental Today</Text>
    <Text style={styles.help}>A voluntary test of the new model. Compare with the existing calculation; it is not yet the default.</Text>
    {historical ? <View style={styles.card}><Text style={styles.label}>Saved historical record — not today's current targets</Text><Button title="Return to current experimental result" onPress={() => setSelectedId(null)} /></View> : null}
    {!data.profile && !historical ? <View style={styles.card}><Text>Save your profile before using the experimental view.</Text><Button title="Complete Profile" onPress={() => onOpen("profile")} /></View> : null}
    {!view ? <Text style={styles.help}>{historical ? "This stored format cannot be displayed here. Its original payload remains in Export Data." : data.profile ? "Preparing a matching saved result. Older targets are held until the current inputs are captured." : "No experimental targets have been calculated."}</Text> : <>
      <Text style={styles.help}>For {view.snapshot.localDate}. Saved {view.snapshot.generatedAt}; revision {view.snapshot.revision}.</Text>
      {(saveStatus === "saving" || saveStatus === "error") ? <Text accessibilityRole="alert">Device save is pending or failed. Check the status and retry above before relying on persistence.</Text> : null}
      <View style={styles.card}>
        {result!.targets ? <>
          <Text style={styles.label}>Experimental targets</Text>
          <Text style={styles.target}>Energy: {displayNumber(result!.targets.energyKcal)} kcal/day</Text>
          <Text>Approximately {Math.round(result!.targets.proteinGrams)} g protein · {Math.round(result!.targets.carbsGrams)} g carbohydrate · {Math.round(result!.targets.fatGrams)} g fat.</Text>
          <Text style={styles.help}>Canonical values are retained in the export; display grams are rounded.</Text>
        </> : <><Text style={styles.label}>Experimental targets held</Text><Text>Missing or unsupported inputs, or conflicting constraints, prevent a new target. Previous targets have not been substituted.</Text><Button title="Use existing calculation" onPress={onExisting} /></>}
        {result!.reasons.map((r, i) => { const message = explainDailyReason(r); return message ? <Text key={i} style={styles.help}>{message}</Text> : null; })}
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Why these targets?</Text>
        <Text>{request!.baseline?.method === "manual" ? "Your manual non-training maintenance" : request!.baseline ? "Estimated non-training maintenance" : "Maintenance not confirmed"}: {displayNumber(result!.terms.baselineKcal)} kcal/day.</Text>
        <Text style={styles.help}>{request!.baseline?.method === "manual" ? "Your chosen number is used even when higher than the equation estimate. Planned training is separate." : request!.baseline ? "An equation and your selected activity outside training provide an estimate, not a measurement." : "Select the baseline you intend to test; no maintenance value has been guessed."}</Text>
        {result!.terms.restingKcal !== null ? <Text>Resting estimate: {displayNumber(result!.terms.restingKcal)} kcal/day, with outside-training factor {displayNumber(result!.reasons.find(r => r.code === "estimated-baseline-selected")?.values.nonTrainingFactor)}.</Text> : null}
        <Text>Goal: {request!.profile?.goal ?? "not saved"}.</Text>
        <Text>Goal contribution: {contribution("goal-offset", result!.terms.proposedGoalOffsetKcal)}</Text>
        <Text>Planned training contribution: {contribution("exercise-contribution", result!.terms.proposedExerciseKcal)}</Text>
        <Text>Accepted weekly contribution: {contribution("accepted-weekly-contribution", result!.terms.proposedWeeklyOffsetKcal)}</Text>
        {result!.reasons.some(r => r.code === "energy-rounding") ? <Text>Rounding contribution: {contribution("energy-rounding", null)}</Text> : null}
        {request!.reviewSettings ? <Text style={styles.help}>Saved weekly mode: {request!.reviewSettings.mode}. This controls future reviews, not a new automatic daily change.</Text> : null}
        {Object.entries(request!.locks ?? {}).filter(([, value]) => value != null).map(([key, value]) => <Text key={key}>Lock — {{ energyKcal: "energy (kcal/day)", proteinGrams: "protein (g/day)", fatGrams: "fat (g/day)", carbsGrams: "carbohydrate (g/day)" }[key]}: {displayNumber(value)}</Text>)}
        {request!.baselineConfirmed === false ? <Text style={styles.help}>Save or reconfirm the baseline in Weekly Review. An earlier adjustment is not reused for a changed profile or baseline.</Text> : null}
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Saved plan for {view.snapshot.localDate}</Text>
        {sessions === null ? <Text>Plan unknown. Save a plan or explicit rest day.</Text> : sessions.length === 0 ? <Text>Explicit rest day.</Text> : sessions.map((session, index) => <Text key={session.id} style={styles.help}>Session {index + 1}: {session.type}; {session.durationMinutes === null ? "duration unknown" : `${displayNumber(session.durationMinutes)} minutes`}; intensity {session.intensity ?? "unknown"}.</Text>)}
        <Text style={styles.help}>Planned work is an estimate; completed activity and food intake have not been imported.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Observed weight evidence</Text>
        {evidence ? <>
          <Text>{evidence.previous.startDate}–{evidence.previous.endDate}: {evidence.previous.days.length}/7 measurement days.</Text>
          <Text>{evidence.recent.startDate}–{evidence.recent.endDate}: {evidence.recent.days.length}/7 measurement days.</Text>
          {evidence.status === "ready" ? <Text>Observed rate: {typeof evidence.observedKgPerWeek === "number" ? Number(evidence.observedKgPerWeek.toFixed(2)).toFixed(2) : "unknown"} kg/week.</Text> : <Text>Trend held: {evidence.status.replaceAll("-", " ")}.</Text>}
          {evidence.reasons.map((r, i) => <Text key={i} style={styles.help}>{r.code === "insufficient-days" ? "At least four distinct measurement days are needed in each completed week." : r.code === "stale-weights" ? "The most recent included measurement is too old for this cutoff." : r.code === "wide-same-day-range" ? "Same-day measurements differ widely and need review; none have been discarded." : "The stored weight evidence needs review; original measurements are retained."}</Text>)}
        </> : <Text>No weight evidence was stored with this older record.</Text>}
        <Text style={styles.help}>Observed change does not establish its cause. Weight evidence does not automatically change targets; a weekly adjustment is included only after acceptance.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Weekly control</Text>
        {request!.acceptedWeeklyOffset ? <Text>Accepted adjustment: {displayNumber(request!.acceptedWeeklyOffset.kcal)} kcal/day{decision ? ` from review ${decision.periodStart}` : ""}. It is an absolute offset, not added again on each visit.</Text> : <Text>No accepted adjustment is used in this record.</Text>}
        {!historical ? <Text style={styles.help}>Current review cutoff: {weeklyPeriodStart(context.localDate)}. {currentReview ? `Saved status: ${currentReview.status.replaceAll("-", " ")}.` : "No review saved for this period and baseline."} Review and accept or decline changes in Weekly Review.</Text> : <Text style={styles.help}>This shows the decision stored with this record, not a new review of old data.</Text>}
      </View>
    </>}
    <View style={styles.card}>
      <Text style={styles.label}>Complete inputs or control a change</Text>
      <Button title="Edit Profile" onPress={() => onOpen("profile")} />
      <Button title="Edit Training" onPress={() => onOpen("training")} />
      <Button title="Review Weights" onPress={() => onOpen("weight")} />
      <Button title="Open Weekly Controls" onPress={() => onOpen("review")} />
    </View>
    {history.length ? <View style={styles.card}><Text style={styles.label}>Recent saved experimental records</Text><Text style={styles.help}>Latest five shown; the full history remains in Export Data. Reading an old record never recalculates it.</Text>
      {history.map(s => <Button key={s.id} title={`View saved ${s.localDate} revision ${s.revision}`} onPress={() => setSelectedId(s.id)} />)}
      <Button title="Open Data and Export" onPress={() => onOpen("data")} />
    </View> : null}
  </ScrollView>;
}
const styles = StyleSheet.create({ container: { flexGrow: 1, padding: 20 }, title: { fontSize: 26, fontWeight: "700", marginBottom: 12 },
  card: { padding: 16, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, backgroundColor: "white", marginVertical: 8 },
  label: { fontSize: 18, fontWeight: "600", marginBottom: 10 }, target: { fontSize: 22, fontWeight: "600", marginBottom: 10 }, help: { lineHeight: 23, marginVertical: 8 } });
