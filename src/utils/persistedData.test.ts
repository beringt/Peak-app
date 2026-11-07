import type { PeakData } from "../types";
import { decodePersistedData, encodePersistedData } from "./persistedData";

function example(): PeakData {
  return {
    profile: { weight: 80, goal: "maintain", activityLevel: "medium" },
    trainingPlan: [
      { date: "2026-11-09", type: "strength" },
      { date: "2026-11-08", type: "rest" },
    ],
    weightEntries: [
      { id: "measurement-b", date: "2026-11-08", weightKg: 80.2 },
      { id: "measurement-a", date: "2026-11-08", weightKg: 80 },
    ],
  };
}

function envelope(data: unknown, version: unknown = 1): string {
  return JSON.stringify({ version, data });
}

test("round-trips all saved data, order, IDs and multiple same-day weights", () => {
  const data = example();
  const before = JSON.stringify(data);
  const encoded = encodePersistedData(data);
  expect(encoded.status).toBe("valid");
  if (encoded.status !== "valid") throw new Error("Encoding failed");
  expect(decodePersistedData(encoded.raw)).toEqual({
    status: "valid", value: { version: 5, data },
  });
  expect(JSON.stringify(data)).toBe(before);
});

test("accepts an explicitly empty dataset", () => {
  const data = { profile: null, trainingPlan: [], weightEntries: [] };
  expect(decodePersistedData(envelope(data))).toEqual({
    status: "valid", value: { version: 5, data },
  });
});

test("only absent storage is missing", () => {
  expect(decodePersistedData(null)).toEqual({ status: "missing" });
});

test.each(["", " ", "{broken", "{", "undefined"])(
  "preserves malformed JSON instead of returning empty data: %j", (raw) => {
    expect(decodePersistedData(raw)).toEqual({ status: "invalid", reason: "json", raw });
  }
);

test.each(["null", "[]", "true", "42", '"text"', "{}", '{"data":{}}'])(
  "rejects an incomplete or nonobject envelope: %s", (raw) => {
    expect(decodePersistedData(raw)).toEqual({ status: "invalid", reason: "schema", raw });
  }
);

test.each([0, -1, 1.5, "1", null, 9007199254740992])(
  "rejects invalid version metadata %j", (version) => {
    const raw = envelope(example(), version);
    expect(decodePersistedData(raw)).toEqual({ status: "invalid", reason: "schema", raw });
  }
);

test.each([6, 99])("preserves unsupported version %i without assuming its data shape", (version) => {
  const raw = envelope({ newFormat: ["keep", "everything"] }, version);
  expect(decodePersistedData(raw)).toEqual({ status: "unsupported-version", version, raw });
});

test.each(["profile", "trainingPlan", "weightEntries"])("rejects missing %s", (key) => {
  const data: Record<string, unknown> = { ...example() };
  delete data[key];
  const raw = envelope(data);
  expect(decodePersistedData(raw)).toEqual({ status: "invalid", reason: "schema", raw });
});

test.each([
  { field: "profile", value: {} },
  { field: "profile", value: { weight: "80", goal: "maintain", activityLevel: "medium" } },
  { field: "profile", value: { weight: 0, goal: "maintain", activityLevel: "medium" } },
  { field: "profile", value: { weight: -1, goal: "maintain", activityLevel: "medium" } },
  { field: "profile", value: { weight: 80, goal: "cut", activityLevel: "medium" } },
  { field: "profile", value: { weight: 80, goal: "maintain", activityLevel: "moderate" } },
  { field: "trainingPlan", value: null },
  { field: "trainingPlan", value: [null] },
  { field: "trainingPlan", value: [{ date: "2026-11-08" }] },
  { field: "trainingPlan", value: [{ date: "2026-11-08", type: "run" }] },
  { field: "weightEntries", value: {} },
  { field: "weightEntries", value: [null] },
  { field: "weightEntries", value: [{ date: "2026-11-08", weightKg: 80 }] },
  { field: "weightEntries", value: [{ id: "", date: "2026-11-08", weightKg: 80 }] },
  { field: "weightEntries", value: [{ id: " ", date: "2026-11-08", weightKg: 80 }] },
  { field: "weightEntries", value: [{ id: 1, date: "2026-11-08", weightKg: 80 }] },
  { field: "weightEntries", value: [{ id: "a", date: "2026-11-08", weightKg: "80" }] },
  { field: "weightEntries", value: [{ id: "a", date: "2026-11-08", weightKg: 0 }] },
  { field: "weightEntries", value: [{ id: "a", date: "2026-11-08", weightKg: 500.1 }] },
])("rejects invalid $field: $value", ({ field, value }) => {
  const raw = envelope({ ...example(), [field]: value });
  expect(decodePersistedData(raw)).toEqual({ status: "invalid", reason: "schema", raw });
});

test.each(["2026-02-29", "1900-02-29", "2026-04-31", "2026-13-01", "2026-01-00",
  "0000-01-01", "2026-1-02", "2026-11-08T00:00:00Z"])(
  "rejects invalid local date %s in plans and weights", (date) => {
    for (const field of ["trainingPlan", "weightEntries"] as const) {
      const data = example();
      data[field][0].date = date;
      expect(decodePersistedData(envelope(data)).status).toBe("invalid");
    }
  }
);

test.each(["2000-02-29", "2028-02-29", "0001-01-01", "9999-12-31"])(
  "preserves valid calendar dates without timezone conversion: %s", (date) => {
    const data = example();
    data.trainingPlan[0].date = date;
    data.weightEntries[0].date = date;
    expect(decodePersistedData(envelope(data))).toEqual({
      status: "valid", value: { version: 5, data },
    });
  }
);

test("rejects duplicate weight IDs, even across different dates", () => {
  const data = example();
  data.weightEntries[1].id = data.weightEntries[0].id;
  data.weightEntries[1].date = "2026-11-01";
  expect(decodePersistedData(envelope(data)).status).toBe("invalid");
});

test("rejects duplicate training dates instead of choosing a winner", () => {
  const data = example();
  data.trainingPlan[1].date = data.trainingPlan[0].date;
  expect(decodePersistedData(envelope(data)).status).toBe("invalid");
});

test("rejects unknown fields at every level rather than silently dropping them", () => {
  const data = example();
  const variants = [
    { version: 1, data, extra: true },
    { version: 1, data: { ...data, extra: true } },
    { version: 1, data: { ...data, profile: { ...data.profile, extra: true } } },
    { version: 1, data: { ...data, trainingPlan: [{ ...data.trainingPlan[0], extra: true }] } },
    { version: 1, data: { ...data, weightEntries: [{ ...data.weightEntries[0], extra: true }] } },
  ];
  for (const variant of variants) {
    const raw = JSON.stringify(variant);
    expect(decodePersistedData(raw)).toEqual({ status: "invalid", reason: "schema", raw });
  }
});

test.each([NaN, Infinity, -Infinity])("refuses to encode nonfinite weight %s", (weight) => {
  const data = example();
  data.profile!.weight = weight;
  expect(encodePersistedData(data)).toEqual({ status: "invalid", reason: "schema" });
  data.profile!.weight = 80;
  data.weightEntries[0].weightKg = weight;
  expect(encodePersistedData(data)).toEqual({ status: "invalid", reason: "schema" });
});

test("encoding rejects invalid data rather than relying on TypeScript alone", () => {
  expect(encodePersistedData({} as PeakData)).toEqual({ status: "invalid", reason: "schema" });
});

test("preserves valid boundary values and existing positive profile weights", () => {
  const data = example();
  data.profile!.weight = 501;
  data.weightEntries[0].weightKg = 500;
  data.weightEntries[1].weightKg = 0.1;
  const encoded = encodePersistedData(data);
  if (encoded.status !== "valid") throw new Error("Encoding failed");
  expect(decodePersistedData(encoded.raw)).toEqual({
    status: "valid", value: { version: 5, data },
  });
});
