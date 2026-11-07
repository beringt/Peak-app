# Local data contract (version 1)

This prepares issue #21; it does not save data or change the running app.

The JSON envelope is `{ version: 1, data: { profile, trainingPlan, weightEntries } }`.
Use the existing profile and entry field names from `src/types/index.ts`.
An empty installation is represented by a null profile and two empty arrays.
Arrays preserve their order and every record; decoding never sorts, repairs,
discards records or substitutes defaults.

Dates are valid local calendar keys, YYYY-MM-DD (years 0001–9999), not timestamps.
Historical and future plan dates are accepted. One training day per date is allowed.
Weight IDs are nonblank unique strings independent of measurement dates; multiple
weights may share a date. An ID is not interpreted as a timestamp.
Weights must be finite and positive. Weight entries retain the existing 500 kg
limit. Profile validation retains the current positive-weight rule; changing that
rule consistently is part of #22, not an implicit migration in this issue.

## Explicit decoding and encoding outcomes

- Only a missing storage key (`read()` returns null) yields `missing`.
- A complete version-1 payload yields `valid`.
- Malformed JSON yields `invalid` with reason `json`.
- Missing fields, unknown fields, invalid values, duplicate identities, or invalid
  version metadata yield `invalid` with reason `schema`.
- Other positive safe-integer versions yield `unsupported-version` even if their
  data shape differs from version 1.
- Invalid/unsupported decoding retains the original raw string. Treat that string
  as user data; do not put it in logs or telemetry.
- Encoding validates before serializing, so NaN/Infinity or invalid data cannot
  silently become JSON null. Invalid input yields `invalid` instead of a payload.

There is no pre-existing persisted format, so version 1 has no legacy migration.
Unversioned JSON is invalid; do not infer a schema or silently convert it.
For future schema changes, increment the version, add explicit sequential
migrations with fixtures for every supported prior version, validate the result,
and preserve the original until migration and a replacement write succeed.
Do not downgrade unsupported newer data. Unknown fields are rejected rather than
silently dropped; schema extensions require an explicit version/migration policy.

## Storage boundary for #21

`PeakStorage` only reads/writes/removes raw strings asynchronously. It has no
platform dependency, default data, global state, storage key or implementation.
Adapters must reject read/write/delete errors; null means absent, not failed.
The caller must handle hydration, write ordering, migration, error UI and retry.
Never automatically overwrite invalid/unsupported data with empty state.
Reset must require an explicit user action, including for unreadable data.
The interface does not claim encryption or transactional guarantees.
