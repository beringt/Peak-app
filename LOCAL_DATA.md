# Local data contract (version 1)

The app loads and saves this format through AsyncStorage at `@peak/local-data`.

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

## Storage boundary

`PeakStorage` only reads/writes/removes raw strings asynchronously. It has no
platform dependency, default data, global state, storage key or implementation.
Adapters must reject read/write/delete errors; null means absent, not failed.
The caller must handle hydration, write ordering, migration, error UI and retry.
Never automatically overwrite invalid/unsupported data with empty state.
Reset must require an explicit user action, including for unreadable data.
The interface does not claim encryption or transactional guarantees.

## Local persistence

App owns one persistence coordinator, not a global store. Screens mount only
after a successful read/validation or an explicitly missing key. Loading never
writes defaults. Read failures, invalid data and unsupported versions block editing
and offer retry without overwriting or deleting the stored value.

Only committed form saves and weight additions queue writes. Writes run one at
a time; while one runs, later changes coalesce into the newest full snapshot.
A failed write pauses the queue and shows an error. Retry saves the current
snapshot; subsequent edits also attempt to save the newest data. The app must
remain open until the device-save status confirms success. In-memory form
confirmation is separate from the app's device-save status.

AsyncStorage uses browser localStorage on web and platform storage on native.
It is not application-level encrypted storage, a cloud backup or multi-device sync.
Browser data is tied to the origin and browser profile: another Codespaces URL,
private browsing, clearing website data or browser eviction can make it unavailable.
Native data can be removed by clearing app data or uninstalling; backup behavior
depends on the platform. A crash/close before a write completes may lose that change.
Concurrent tabs/app instances are not synchronized or protected against conflicting
writes; use one instance for this pilot.

The adapter exposes remove for the future explicit reset flow; this issue adds
no automatic deletion, reset UI, import or migration of unversioned data.
