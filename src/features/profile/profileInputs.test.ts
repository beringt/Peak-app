import { parseProfileInputs } from "./profileInputs";
import type { ProfileInputDraft } from "./profileInputs";
const blank: ProfileInputDraft = { heightCm: "", ageYears: "", manualMaintenanceKcal: "", targetRatePercentPerWeek: "", equationVariant: null };

test("optional values stay unknown; maintenance rate is explicitly zero", () => {
  expect(parseProfileInputs(blank, "maintain")).toEqual({ heightCm: null, ageYears: null, equationVariant: null, manualMaintenanceKcal: null, targetRatePercentPerWeek: 0 });
  expect(parseProfileInputs(blank, "lose")?.targetRatePercentPerWeek).toBeNull();
});
test.each([
  ["heightCm", "100"], ["heightCm", "250"], ["ageYears", "19"], ["ageYears", "78"],
  ["manualMaintenanceKcal", "0.1"], ["manualMaintenanceKcal", "10000"],
  ["targetRatePercentPerWeek", "0"], ["targetRatePercentPerWeek", "0,5"],
])("accepts approved boundary %s=%s", (field, value) => {
  expect(parseProfileInputs({ ...blank, [field]: value }, "gain")).not.toBeNull();
});
test.each([
  ["heightCm", "99.9"], ["heightCm", "250.1"], ["ageYears", "18"], ["ageYears", "79"], ["ageYears", "30.5"],
  ["manualMaintenanceKcal", "0"], ["manualMaintenanceKcal", "10001"],
  ["targetRatePercentPerWeek", "0.501"], ["targetRatePercentPerWeek", "-0.2"],
  ["heightCm", "180cm"], ["heightCm", "1e2"], ["heightCm", "Infinity"], ["heightCm", "0x80"],
])("rejects invalid draft %s=%s without changing it", (field, value) => {
  const draft = { ...blank, [field]: value };
  const before = JSON.stringify(draft);
  expect(parseProfileInputs(draft, "lose")).toBeNull();
  expect(JSON.stringify(draft)).toBe(before);
});
test("comma values work without selecting physiology or filling absent measurements", () => {
  expect(parseProfileInputs({ ...blank, manualMaintenanceKcal: " 2400,5 " }, "lose")).toMatchObject({ manualMaintenanceKcal: 2400.5, equationVariant: null, ageYears: null });
});
