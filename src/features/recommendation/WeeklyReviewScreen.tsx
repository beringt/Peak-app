import { useEffect, useRef, useState } from "react";
import type { ComponentRef } from "react";
import { Button, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { PeakData, StoredJson, StoredJsonObject, WeeklyReviewSettings } from "../../types";
import type { PersistenceSnapshot } from "../../utils/localPersistence";
import type { SnapshotContext } from "../../utils/recommendationSnapshots";
import { canonicalSnapshotJson } from "../../utils/recommendationSnapshots";
import type { ReviewConfirmations } from "./weeklyReview";
import { currentWeeklyDailyPreview, currentWeeklyReview, DEFAULT_WEEKLY_SETTINGS, weeklyBasisFingerprint, weeklyPeriodStart } from "./weeklyReview";

const messages: Record<string, string> = {
  "baseline-or-goal-changed": "Your profile or baseline changed. Save settings with reset confirmation before reviewing.",
  "daily-inputs-or-constraints-unresolved": "Complete the experimental inputs or resolve conflicting targets first.",
  "fourteen-day-history-required": "At least 14 days of measurement history before the review cutoff are required.",
  "weight-evidence-not-ready": "The weight evidence is not ready for an adjustment.",
  "reliability-and-adherence-confirmation-required": "Confirm reliable measurements and reasonable adherence for this review period.",
  "tomorrow-preparation-unknown": "Tomorrow's plan is incomplete; this preview includes no carbohydrate preparation adjustment.",
  "energy-lock-preserved": "Energy is locked; the saved weekly adjustment is held for this preview.",
  "preparation-held": "Carbohydrate preparation is held because a macro target is locked.",
  "preparation-partial": "Carbohydrate preparation is limited by the model's fat floor.",
  "energy-locked": "The energy target is locked. A weekly change is held.",
  "within-target-tolerance": "The observed rate is close enough to your target. Keep the current adjustment.",
  "adjustment-cap-reached": "The cumulative adjustment limit has been reached.",
  "lower-bound-review-required": "A reviewed lower bound is missing or the proposal falls below it. The change is held.",
  "proposed-targets-infeasible": "The proposed change cannot satisfy all target constraints. Resolve the conflict before applying it.",
  "adjustment-accepted": "Accepted for the experimental model only; it does not change Today.",
  "proposal-declined": "Declined. The experimental adjustment has not changed.",
  "manual-acceptance-required": "This is a proposal. Nothing changes until you accept it.",
  "profile-outside-model": "Your saved profile is outside this experimental model's range. Keep using the existing calculator or review the profile inputs.",
  "estimated-baseline-outside-model": "The equation inputs are outside the experimental age, height or activity ranges.",
  "manual-maintenance-outside-model": "Manual maintenance must be greater than 0 and at most 10,000 kcal/day.",
  "nonpositive-energy": "The energy target must be greater than zero. Review or remove the energy lock.",
  "existing-offset-outside-cap-reset-required": "The saved adjustment exceeds the current cap and needs an explicit baseline reset.",
  "target-rate-outside-model": "Review the saved target rate in Profile; the test limit is 0–0.5% per week.",
  "session-bounds-or-shape": "Review session durations and day totals in Training before calculating targets.",
  "manual-maintenance-missing": "Enter your manual maintenance intake in Profile first.",
  "baseline-training-composition-unresolved": "Clarify that your maintenance baseline excludes planned training energy.",
  "estimated-baseline-inputs-missing": "The estimate needs height, age, an optional equation selection and non-training activity.",
  "today-plan-unknown": "Save today's training plan, including an explicit rest day when appropriate.",
  "session-details-missing": "Add missing duration and intensity in Training.",
  "session-non-overlap-unconfirmed": "Confirm that today's multiple planned sessions do not overlap.",
  "macro-allocation-infeasible": "Calories and macro minimums cannot all be met. Targets have been held.",
  "macro-constraints-conflict": "Locked targets and macro requirements conflict. No replacement targets are applied.",
  "protein-outside-domain": "The locked protein target is outside this experimental model's range.",
  "insufficient-days": "At least four measurement days are required in each completed week.",
  "stale-weights": "A measurement on Saturday or Sunday before the Monday cutoff is required.",
  "wide-same-day-range": "Some same-day measurements differ widely. Review them in Weight first.",
};
const object = (value: StoredJson | undefined): StoredJsonObject => value && typeof value === "object" && !Array.isArray(value) ? value : {};
const format = (value: StoredJson | undefined) => typeof value === "number" ? Number(value.toFixed(2)).toFixed(2) : "unknown";
function Check({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: value }} aria-checked={value}
    onPress={() => onChange(!value)} style={styles.option}><Text>{value ? "✓ " : "□ "}{label}</Text></Pressable>;
}
function Choices({ label, value, options, onChange }: { label: string; value: string | null; options: Array<[string | null, string]>; onChange: (v: string | null) => void }) {
  return <View accessibilityRole="radiogroup" accessibilityLabel={label}>
    <Text style={styles.label}>{label}</Text>
    {options.map(([v, text]) => <Pressable key={v ?? "unknown"} accessibilityRole="radio" accessibilityLabel={text}
      accessibilityState={{ checked: value === v }} aria-checked={value === v} onPress={() => onChange(v)}
      style={[styles.option, value === v && styles.selected]}><Text>{value === v ? "✓ " : ""}{text}</Text></Pressable>)}
  </View>;
}

type Props = {
  data: PeakData; context: SnapshotContext; saveStatus: PersistenceSnapshot["saveStatus"];
  onSettings: (settings: WeeklyReviewSettings, resetConfirmed: boolean) => string | null;
  onEvaluate: (confirmations: ReviewConfirmations) => string | null;
  onDecision: (id: string, action: "accept" | "decline", confirmations: ReviewConfirmations) => string | null;
};
export function WeeklyReviewScreen({ data, context, saveStatus, onSettings, onEvaluate, onDecision }: Props) {
  const [settings, setSettings] = useState<WeeklyReviewSettings>(() => JSON.parse(JSON.stringify(data.weeklyReview?.settings ?? DEFAULT_WEEKLY_SETTINGS)));
  const [minimum, setMinimum] = useState(String(settings.minimumKcal ?? ""));
  const [locks, setLocks] = useState<Record<keyof WeeklyReviewSettings["locks"], string>>({
    energyKcal: String(settings.locks.energyKcal ?? ""), proteinGrams: String(settings.locks.proteinGrams ?? ""),
    fatGrams: String(settings.locks.fatGrams ?? ""), carbsGrams: String(settings.locks.carbsGrams ?? ""),
  });
  const [reliable, setReliable] = useState(false), [followed, setFollowed] = useState(false), [reset, setReset] = useState(false);
  const [error, setError] = useState("");
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useEffect(() => { if (error) scroll.current?.scrollTo({ y: 0, animated: true }); }, [error]);
  const period = weeklyPeriodStart(context.localDate);
  useEffect(() => { setReliable(false); setFollowed(false); setReset(false); }, [period, data.profile, data.weightEntries]);
  useEffect(() => { setReset(false); }, [settings.baselineMethod, settings.nonTrainingActivity, settings.trainingBasis]);
  function optionalNumber(value: string): number | null {
    if (!value.trim()) return null;
    return /^\d+(?:[.,]\d+)?$/.test(value.trim()) ? Number(value.trim().replace(",", ".")) : NaN;
  }
  const parsed: WeeklyReviewSettings = { ...settings, minimumKcal: optionalNumber(minimum), locks: {
    energyKcal: optionalNumber(locks.energyKcal), proteinGrams: optionalNumber(locks.proteinGrams),
    fatGrams: optionalNumber(locks.fatGrams), carbsGrams: optionalNumber(locks.carbsGrams),
  } };
  const invalid = Object.values(parsed.locks).some(v => v !== null && (!Number.isFinite(v) || v < 0)) ||
    (parsed.minimumKcal !== null && (!Number.isFinite(parsed.minimumKcal) || parsed.minimumKcal <= 0 || parsed.minimumKcal > 10000));
  const dirty = invalid || !data.weeklyReview || canonicalSnapshotJson(parsed) !== canonicalSnapshotJson(data.weeklyReview.settings);
  const readyToAct = saveStatus !== "saving" && saveStatus !== "error" && !dirty;
  const confirmations = { reliableWeights: reliable, followedTargets: followed };
  const record = currentWeeklyReview(data, context.localDate), daily = currentWeeklyDailyPreview(data, context);
  const changedBasis = !!data.weeklyReview && data.weeklyReview.basis.fingerprint !== weeklyBasisFingerprint(data, data.weeklyReview.settings);
  const evidence = object(record?.result.evidence), previous = object(evidence.previous), recent = object(evidence.recent);
  const reasons = Array.isArray(record?.result.reasons) ? record.result.reasons : [];
  const proposalFresh = !!record && record.input.settingsRevision === data.weeklyReview?.settingsRevision &&
    record.input.asOfDate === context.localDate && record.input.timeZone === context.timeZone &&
    canonicalSnapshotJson({ profile: record.input.profile, trainingPlan: record.input.trainingPlan, weightEntries: record.input.weightEntries, basis: record.input.basis }) ===
    canonicalSnapshotJson({ profile: data.profile, trainingPlan: data.trainingPlan, weightEntries: data.weightEntries, basis: data.weeklyReview?.basis });

  return <ScrollView ref={scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
    <Text style={styles.title}>Weekly Review — Experimental</Text>
    <Text style={styles.help}>This test area does not change Today. Accepted adjustments affect only the experimental model. All changes require your acceptance.</Text>
    <Text style={styles.help}>Review cutoff: Monday {period}. The two completed weeks before that date are used, even if you open this later in the week.</Text>
    <Text style={styles.help}>This uses planned activity and your confirmations. Actual food and activity imports are not available. Weight alone cannot explain why results differ.</Text>
    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    {!data.profile ? <Text style={styles.help}>Save your Profile first.</Text> : null}
    <View style={styles.card}>
      <Choices label="Adjustment mode" value={settings.mode} options={[["conservative", "Conservative (up to 100 kcal/day per review)"], ["neutral", "Neutral (up to 150 kcal/day per review)"], ["aggressive", "Aggressive (up to 200 kcal/day per review)"]]}
        onChange={v => setSettings(s => ({ ...s, mode: v as WeeklyReviewSettings["mode"] }))} />
      <Text style={styles.help}>Target rate uses your saved Profile value. Leave it blank there to use a default; maintenance is 0.</Text>
      <Text style={styles.help}>Total adjustment is limited to ±10% of maintenance. Mode changes cannot repeat an already accepted weekly adjustment.</Text>
      <Choices label="Maintenance source" value={settings.baselineMethod} options={[["manual", "Use my manual maintenance"], ["mifflin", "Use the equation estimate"]]}
        onChange={v => setSettings(s => ({ ...s, baselineMethod: v as WeeklyReviewSettings["baselineMethod"] }))} />
      <Text style={styles.help}>Saved manual maintenance: {data.profile?.baselineInputs?.manualMaintenanceKcal ?? "not supplied"} kcal/day. Enter or edit it in Profile; it is never replaced by the equation when selected.</Text>
      {settings.baselineMethod === "mifflin" ? <Choices label="Activity outside training" value={settings.nonTrainingActivity} options={[[null, "Not specified"], ["low", "Low outside-training activity"], ["medium", "Medium outside-training activity"], ["high", "High outside-training activity"]]}
        onChange={v => setSettings(s => ({ ...s, nonTrainingActivity: v as WeeklyReviewSettings["nonTrainingActivity"] }))} /> : null}
      <Check label="My baseline excludes planned training energy" value={settings.trainingBasis === "excludes-training"}
        onChange={v => setSettings(s => ({ ...s, trainingBasis: v ? "excludes-training" : "unknown" }))} />
      <Text style={styles.label}>Reviewed lower bound (kcal/day, optional)</Text>
      <TextInput accessibilityLabel="Reviewed lower bound in kcal per day" keyboardType="decimal-pad" style={styles.input} value={minimum} onChangeText={value => { setMinimum(value); setSettings(s => ({ ...s, minimumConfirmed: false })); }} />
      <Text style={styles.help}>Greater than 0 and up to 10,000. A test guard, not a guarantee of a safe intake. Without a reviewed lower bound, manual-baseline reductions are held. Equation mode also uses its resting estimate as a provisional guard.</Text>
      <Check label="I have reviewed this lower bound for this test" value={settings.minimumConfirmed} onChange={v => setSettings(s => ({ ...s, minimumConfirmed: v }))} />
      <Check label="My multiple planned sessions do not overlap" value={settings.nonOverlapConfirmed} onChange={v => setSettings(s => ({ ...s, nonOverlapConfirmed: v }))} />
      <Text style={styles.label}>Optional target locks</Text>
      <Text style={styles.help}>Leave blank to unlock. Enter non-negative values. Conflicting locks hold the calculation; no lock is silently overridden.</Text>
      {([["energyKcal", "Energy lock (kcal/day)"], ["proteinGrams", "Protein lock (g/day)"], ["fatGrams", "Fat lock (g/day)"], ["carbsGrams", "Carbohydrate lock (g/day)"]] as const).map(([key, label]) => <View key={key}>
        <Text>{label}</Text><TextInput accessibilityLabel={label} keyboardType="decimal-pad" style={styles.input} value={locks[key]} onChangeText={value => setLocks({ ...locks, [key]: value })} />
      </View>)}
      <Check label="Confirm resetting the experimental adjustment if the baseline or goal changed" value={reset} onChange={setReset} />
      {dirty ? <Text style={styles.help}>Unsaved review settings. Save before evaluating or accepting.</Text> : null}
      <Button title="Save Review Settings" disabled={!data.profile || saveStatus === "saving"} onPress={() => {
        const message = invalid ? "Check numeric fields. Locks must be non-negative; the optional lower bound must be greater than 0 and at most 10,000." : onSettings(parsed, reset);
        setError(message ?? ""); if (!message) setReset(false);
      }} />
    </View>
    <View style={styles.card}>
      <Text style={styles.label}>Current experimental preview for {context.localDate}</Text>
      {changedBasis ? <Text>Profile or baseline changed. Confirm the reset when saving review settings.</Text> : daily?.targets ? <Text>
        {daily.targets.energyKcal} kcal/day; approximately {Math.round(daily.targets.proteinGrams)} g protein, {Math.round(daily.targets.fatGrams)} g fat and {Math.round(daily.targets.carbsGrams)} g carbohydrate.
      </Text> : <Text>Preview held. Complete the inputs or resolve constraints.</Text>}
      {daily?.reasons.filter(r => messages[r.code] && (daily.status !== "ready" || ["energy-lock-preserved", "preparation-held", "preparation-partial", "tomorrow-preparation-unknown"].includes(r.code))).map((r, i) => <Text key={i}>{messages[r.code]}</Text>)}
      <Text style={styles.help}>Saved experimental adjustment: {data.weeklyReview?.basis.offsetKcal ?? 0} kcal/day. This is separate from Today.</Text>
    </View>
    <View style={styles.card}>
      <Check label="The review-period weight measurements are reliable" value={reliable} onChange={setReliable} />
      <Check label="I reasonably followed the prior targets for this review period" value={followed} onChange={setFollowed} />
      <Button title="Evaluate Weekly Proposal" disabled={!readyToAct} onPress={() => setError(onEvaluate(confirmations) ?? "")} />
      {record ? <View>
        <Text style={styles.help}>Saved review: {record.periodStart}; {record.status.replaceAll("-", " ")}. Preview date: {String(record.input.asOfDate)}.</Text>
        {Array.isArray(record.input.priorRecommendationIds) ? <Text>Prior target records available: {record.input.priorRecommendationIds.length}/14 days. Missing records are not reconstructed; adherence still relies on your confirmation.</Text> : null}
        {Array.isArray(previous.days) && Array.isArray(recent.days) ? <Text>Measurement days: {previous.days.length}/7 in the previous week, {recent.days.length}/7 in the recent week.</Text> : null}
        {typeof record.result.baselineKcal === "number" ? <Text>Baseline used: {format(record.result.baselineKcal)} kcal/day. Step: {String(record.result.stepKcal)} kcal/day. Total cap: ±{String(record.result.offsetCapKcal)} kcal/day.</Text> : null}
        {typeof record.result.toleranceKgPerWeek === "number" ? <Text>No-change tolerance: approximately ±{format(record.result.toleranceKgPerWeek)} kg/week around the target.</Text> : null}
        {typeof record.result.targetKgPerWeek === "number" ? <Text>Target: {format(record.result.targetKgPerWeek)} kg/week. Observed: {format(record.result.observedKgPerWeek)} kg/week.</Text> : null}
        {record.proposedOffsetKcal !== null ? <Text>{record.status === "proposed" ? "Proposed" : "Recorded candidate"} daily change: {record.proposedOffsetKcal - record.oldOffsetKcal} kcal/day; total adjustment {record.proposedOffsetKcal} kcal/day.</Text> : null}
        {reasons.map((r, i) => <Text key={i}>{messages[String(object(r).code)] ?? "Review the inputs and experimental limits before changing targets."}</Text>)}
        {Array.isArray(evidence.reasons) ? evidence.reasons.map((r, i) => <Text key={i}>{messages[String(object(r).code)] ?? "Weight data needs review."}</Text>) : null}
        {record.status === "accepted" ? <Text style={styles.help}>{saveStatus === "saving" || saveStatus === "error" ? "Acceptance is pending device save. Check the status and retry above." : "Accepted for the experimental model only. This period will not be applied again; Today is unchanged."}</Text> : null}
        {record.status === "proposed" && !proposalFresh ? <Text>Inputs or settings changed since this proposal. Evaluate again before accepting.</Text> : null}
        <Button title="Accept Experimental Adjustment" disabled={!readyToAct || !reliable || !followed || !proposalFresh || record.status !== "proposed"} onPress={() => setError(onDecision(record.id, "accept", confirmations) ?? "")} />
        <Button title="Decline Proposal" disabled={!readyToAct || record.status !== "proposed"} onPress={() => setError(onDecision(record.id, "decline", confirmations) ?? "")} />
      </View> : <Text style={styles.help}>No review has been saved for this period and baseline.</Text>}
    </View>
  </ScrollView>;
}
const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20 }, title: { fontSize: 25, fontWeight: "700", marginBottom: 16 },
  card: { backgroundColor: "white", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 16, marginVertical: 8 },
  label: { fontSize: 17, fontWeight: "600", marginVertical: 8 }, help: { lineHeight: 23, marginVertical: 10 },
  input: { borderWidth: 1, borderColor: "#6B7280", borderRadius: 8, padding: 10, minHeight: 44, marginVertical: 8 },
  option: { padding: 12, minHeight: 44, borderWidth: 1, borderColor: "#6B7280", borderRadius: 8, marginVertical: 4 },
  selected: { backgroundColor: "#DBEAFE" },
});
