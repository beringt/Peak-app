import type { PeakData, RecommendationSnapshot } from "../../types";
import { captureExperimentalRecommendation, captureLegacyRecommendation } from "./captureRecommendation";
import { DAILY_V2_RULE_VERSION } from "./calculateDailyTargetsV2";
import type { DailyEngineInput } from "./dailyEngineTypes";
import { calculateDailyTargetsV2 } from "./calculateDailyTargetsV2";
import { appendRecommendationSnapshot, getRecommendationSnapshot, snapshotJson, validRecommendationSnapshots } from "../../utils/recommendationSnapshots";
import type { SnapshotContext } from "../../utils/recommendationSnapshots";

const context: SnapshotContext = { localDate: "2026-11-16", generatedAt: "2026-11-16T12:00:00.000Z", timeZone: "Europe/Copenhagen" };
function source(): PeakData {
  return { profile: { weight: 80, goal: "maintain", activityLevel: "medium" },
    trainingPlan: [{ date: context.localDate, type: "rest" }],
    weightEntries: [{ id: "earlier", date: "2026-11-10", weightKg: 80 }, { id: "recent", date: "2026-11-15", weightKg: 80.4 }] };
}
function request(): DailyEngineInput {
  return { asOfDate: context.localDate, timeZone: context.timeZone, ruleVersion: DAILY_V2_RULE_VERSION,
    profileRevision: "profile-1", inputRevision: "input-1", profile: source().profile,
    baseline: { method: "manual", maintenanceKcal: 3500, source: "user", revision: "manual-1", trainingBasis: "excludes-training" },
    trainingPlan: source().trainingPlan, nonOverlapConfirmed: true };
}
function latest(data: PeakData, channel: "live" | "experimental" = "live") {
  return getRecommendationSnapshot(data.recommendationSnapshots ?? [], context.localDate, channel)!;
}

test("captures actual v1 inputs/targets/reasons with explicit generation and revision metadata", () => {
  const raw = source(); const before = JSON.stringify(raw);
  const data = captureLegacyRecommendation(raw, context);
  const saved = latest(data);
  expect(saved).toMatchObject({ localDate: context.localDate, channel: "live", revision: 1, previousRevisionId: null,
    generatedAt: context.generatedAt, timeZone: context.timeZone, ruleVersion: "legacy-v1" });
  expect(saved.input).toMatchObject({ profile: raw.profile, trainingPlan: raw.trainingPlan, weightEntries: raw.weightEntries });
  expect(saved.result).toMatchObject({ ruleVersion: "legacy-v1", status: "ready", targets: { energyKcal: 2460 },
    dataQualityFlags: ["legacy-endpoint-trend"] });
  expect(JSON.stringify(raw)).toBe(before);
  expect(validRecommendationSnapshots(data.recommendationSnapshots)).toBe(true);
});
test("no profile means no invented recommendation", () => {
  const data = { ...source(), profile: null };
  expect(captureLegacyRecommendation(data, context)).toBe(data);
});
test("generation time and property order do not duplicate unchanged input", () => {
  const data = captureLegacyRecommendation(source(), context);
  expect(captureLegacyRecommendation(data, { ...context, generatedAt: "2026-11-16T15:00:00.000Z" })).toBe(data);
  const reordered: PeakData = { ...data, profile: { activityLevel: "medium", goal: "maintain", weight: 80 } };
  expect(captureLegacyRecommendation(reordered, context)).toBe(reordered);
});
test.each(["profile", "trainingPlan", "weightEntries"] as const)("changed %s appends a revision and preserves old records", field => {
  const first = captureLegacyRecommendation(source(), context);
  const original = JSON.stringify(first.recommendationSnapshots);
  const changed: PeakData = field === "profile" ? { ...first, profile: { ...first.profile!, weight: 82 } } : field === "trainingPlan"
    ? { ...first, trainingPlan: [{ date: context.localDate, type: "strength" }] }
    : { ...first, weightEntries: first.weightEntries.filter(e => e.id !== "recent") };
  const second = captureLegacyRecommendation(changed, context);
  expect(second.recommendationSnapshots).toHaveLength(2);
  expect(JSON.stringify(first.recommendationSnapshots)).toBe(original);
  expect(latest(second)).toMatchObject({ revision: 2, previousRevisionId: latest(first).id });
  expect(second.recommendationSnapshots![0]).toEqual(first.recommendationSnapshots![0]);
});
test("changing A to B and back to A appends revisions instead of pointing to a stale first revision", () => {
  const a = captureLegacyRecommendation(source(), context);
  const b = captureLegacyRecommendation({ ...a, profile: { ...a.profile!, weight: 82 } }, context);
  const again = captureLegacyRecommendation({ ...b, profile: source().profile }, context);
  expect(latest(again).revision).toBe(3);
  expect(latest(again).previousRevisionId).toBe(latest(b).id);
});
test("next-day capture and later source corrections never rewrite prior days or fabricate missed days", () => {
  const first = captureLegacyRecommendation(source(), context);
  const nextContext = { ...context, localDate: "2026-11-18", generatedAt: "2026-11-18T11:00:00.000Z" };
  const next = captureLegacyRecommendation({ ...first, weightEntries: [] }, nextContext);
  expect(next.recommendationSnapshots).toHaveLength(2);
  expect(next.recommendationSnapshots![0]).toEqual(first.recommendationSnapshots![0]);
  expect(getRecommendationSnapshot(next.recommendationSnapshots!, "2026-11-17")).toBeNull();
  expect(next.recommendationSnapshots![1]).toMatchObject({ revision: 1, previousRevisionId: null });
});
test("reading history returns the saved result and a detached copy, without any calculator replay", () => {
  const data = captureLegacyRecommendation(source(), context);
  const read = latest(data);
  (read.result.targets as Record<string, unknown>).energyKcal = 1;
  (read.input.profile as Record<string, unknown>).weight = 999;
  expect(latest(data).result).toMatchObject({ targets: { energyKcal: 2460 } });
  expect(latest(data).input).toMatchObject({ profile: { weight: 80 } });
});
test("captured source objects are detached from subsequent caller mutation", () => {
  const data = source(); const saved = captureLegacyRecommendation(data, context);
  data.profile!.weight = 90; data.weightEntries[0].weightKg = 100;
  expect(latest(saved).input).toMatchObject({ profile: { weight: 80 }, weightEntries: [{ id: "earlier", date: "2026-11-10", weightKg: 80 }, { id: "recent", date: "2026-11-15", weightKg: 80.4 }] });
});
test("experimental snapshots preserve the exact v2 output and never replace the live stream", () => {
  const live = captureLegacyRecommendation(source(), context);
  const data = captureExperimentalRecommendation(live, request(), context);
  expect(data.recommendationSnapshots).toHaveLength(2);
  expect(latest(data)).toEqual(latest(live));
  expect(latest(data, "experimental").result).toEqual(calculateDailyTargetsV2(request()));
  expect(captureExperimentalRecommendation(data, request(), { ...context, generatedAt: "2026-11-16T15:00:00.000Z" })).toBe(data);
  const revised = captureExperimentalRecommendation(data, { ...request(), inputRevision: "input-2" }, context);
  expect(latest(revised, "experimental").revision).toBe(2);
  expect(latest(revised)).toEqual(latest(live));
});
test("blocked v2 results retain null targets, missing-data reasons and the exact inputs", () => {
  const data = captureExperimentalRecommendation(source(), { ...request(), baseline: null }, context);
  expect(latest(data, "experimental").result).toMatchObject({ status: "needs-input", targets: null, dataQualityFlags: ["baseline-selection-missing"] });
});
test("rule-version changes create a new revision but older/unknown stored rules remain readable", () => {
  const first = captureLegacyRecommendation(source(), context);
  const old = latest(first);
  const unknown = appendRecommendationSnapshot(first.recommendationSnapshots!, context, "live", "future-rule",
    { ...old.input, ruleVersion: "future-rule" }, { ...old.result, ruleVersion: "future-rule", extraRetainedField: { note: "never recompute" } });
  expect(getRecommendationSnapshot(unknown, context.localDate)!.result.extraRetainedField).toEqual({ note: "never recompute" });
  const now = captureLegacyRecommendation({ ...first, recommendationSnapshots: unknown }, context);
  expect(latest(now).revision).toBe(3);
  expect(now.recommendationSnapshots![1].ruleVersion).toBe("future-rule");
});
test.each([
  { localDate: "2026-02-29" }, { generatedAt: "bad" }, { timeZone: "" },
])("invalid metadata is rejected without mutating source/history", change => {
  const data = captureLegacyRecommendation(source(), context); const before = JSON.stringify(data);
  expect(() => captureLegacyRecommendation(data, { ...context, ...change })).toThrow(RangeError);
  expect(JSON.stringify(data)).toBe(before);
});
test("experimental context mismatches cannot store a misleading date/version", () => {
  expect(() => captureExperimentalRecommendation(source(), request(), { ...context, localDate: "2026-11-17" })).toThrow(RangeError);
  expect(() => captureExperimentalRecommendation(source(), { ...request(), ruleVersion: "other" }, context)).toThrow(RangeError);
});
test("invalid metadata chains, duplicate IDs, nonfinite payloads and version mismatches are rejected", () => {
  const first = captureLegacyRecommendation(source(), context).recommendationSnapshots!;
  const modified = (change: Partial<RecommendationSnapshot>) => [{ ...first[0], ...change }];
  expect(validRecommendationSnapshots(modified({ revision: 2 }))).toBe(false);
  expect(validRecommendationSnapshots(modified({ previousRevisionId: "missing" }))).toBe(false);
  expect(validRecommendationSnapshots([...first, first[0]])).toBe(false);
  expect(validRecommendationSnapshots(modified({ result: { ...first[0].result, ruleVersion: "wrong" } }))).toBe(false);
  expect(validRecommendationSnapshots(modified({ result: { ...first[0].result, targets: { energyKcal: Infinity } } }))).toBe(false);
  expect(() => snapshotJson({ number: NaN })).toThrow(RangeError);
});
