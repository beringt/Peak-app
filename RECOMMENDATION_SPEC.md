# Peak recommendations v2 — review draft

Status: specification for issue #38, not active app behavior. Product principles
were approved by the owner on 7 November 2026 (section 10.1). Numerical defaults
and unresolved domain decisions in section 10 still require review before their
dependent implementation.
Mathematical examples verify the proposed arithmetic, not individual effectiveness.
Population: adult recreational strength/endurance users; this is not a clinical,
pregnancy, adolescent or elite-event nutrition model.

Review summary: support multiple sessions per date and future program references;
keep planned and completed work separate; show estimates and missing inputs;
require acceptance for weekly changes; preserve locks and explain conflicts;
retain original data and historical rule versions. Numerical defaults below
remain proposals until the corresponding review gates are resolved.

## 1. Existing behavior and transition

Current legacy-v1 uses profile weight × 28/32/36, goal −300/0/+300 kcal,
training +150/+250/0, endpoint trend adjustment ±100, protein 1.8 g/kg and
fat 0.8 g/kg. It has no duration, robust trend or weekly decision history.
Keep it reproducible for existing snapshots; do not call its endpoint change a
weekly rate. Do not reinterpret old recommendations through v2.

V2 proposed rules below are tagged P (Peak product assumption) or S (sourced
method). A sourced method does not establish every surrounding parameter.
Unresolved decisions are explicit blockers, not invitations to guess constants.

## 2. Inputs, units and training structure

Required: explicit local asOfDate, ruleVersion, inputRevision, profile weight
in kg, goal and chosen baseline method. Reference weight is the saved profile
weight until the user explicitly updates it; log entries do not silently change
the baseline or macro reference weight each day.

Optional for estimated baseline: heightCm, ageYears and a user-selected Mifflin
equation variant (+5 or −161). Do not infer a coefficient from a gender label.
Skipping these fields is valid; offer a manual non-training maintenance baseline
or a clearly labelled legacy-v1 preview. Never substitute zero age/height.
Record profile/baseline revision and update time. Age is age at that revision;
do not infer birthdays or change historical input snapshots.

Distinguish:

- Program: versioned multiweek plan, phases and progression rules (future module).
- PlannedSession: stable ID, date, category, sport/activity, durationMinutes,
  intensity, and optional programId/programVersion/templateId references.
- CompletedSession: separate future record, optionally linked to a planned ID,
  containing actual work and completion state. Planned is never treated as actual.

One date can contain multiple planned sessions, including strength plus endurance.
An explicitly saved rest day has sessions=[]; unknown plan information is distinct.
Duration/intensity may be null on migrated records, never silently zero.
Detailed strength sets/reps/load/RIR and endurance intervals/pace/power belong to
later modules. V2 consumes normalized session summaries, not calories inferred
from sets/reps, nor a claim that all endurance sports have identical requirements.

All numeric inputs must be finite, with consistent units. Profile/form limits and
migration rules must preserve current records; narrower model eligibility must
not delete an otherwise valid saved profile. Missing/unsupported model inputs
produce needs-input, not fabricated personalized output.

## 3. Baseline and planned exercise

### Baseline (review gate D1)

S: Mifflin simplified REE = 10W + 6.25H − 5A + coefficient [S1].
The original sample was ages 19–78; outside that range this candidate does not
silently extrapolate. REE estimates resting expenditure, not total daily needs.

P: non-training maintenance B = REE × nonTrainingFactor, with proposed factors
low=1.2, medium=1.4, high=1.6. They describe routine activity outside recorded
training. These factors need domain review; old activityLevel is not automatically
mapped because it may already include exercise.

Alternative: B = user-supplied maintenance kcal excluding planned exercise.
An estimate that includes typical training cannot also receive exercise additions;
require clarification instead of double-counting. Do not guess its composition.
Carry source and revision for manual B. Manual input is not proof of measurement.

### Exercise (review gate D2)

S/P approximation: netExerciseKcal = max(MET−1, 0) × W × minutes/60.
MET is a population estimate, not an individual measurement. Subtracting 1 MET
is the proposed correction for rest already represented in the baseline; it does
not eliminate uncertainty about displaced routine activity.

Candidate coarse mappings, all requiring review:

| Category | Low | Moderate | High |
| --- | ---: | ---: | ---: |
| Strength | 3.5 | 5 | 6 |
| Endurance | 5 | 8 | 10 |

The Compendium lists specific activities, not this universal category table [S2].
For example, 5 MET corresponds to some resistance work and 8 MET to some cycling
work, not every moderate session. A sport-specific activity code may later replace
a coarse estimate; store its source/version. No wearable estimate is added again.

Sum net additions for non-overlapping sessions. Reject overlapping time blocks
when times exist; where only durations exist, require a user-reviewed non-overlap
assumption. Proposed duration domain: 1–240 min/session and ≤360 min/day; outside
it return outside-model rather than clipping a long workout into a smaller one.
Unknown category/duration/intensity prevents a complete v2 energy estimate for
that day; a legacy preview remains available with a missing-data reason.

## 4. Goals, energy and macro constraints

P candidate initial goal offsets: maintain=0, lose=−10% of B, gain=+5% of B.
Target rates for feedback are signed kg/week: maintain=0; proposed defaults
lose=−0.25% of W/week, gain=+0.125% of W/week. User-selected absolute rates may
not exceed 0.5% of W/week in this pilot model. These are draft product limits,
not promises of outcome or universal clinical safety limits (D3).

Do not convert a requested kg rate through a fixed 7,700 kcal/kg rule. The initial
offset is a starting heuristic; observed response and adherence need review.
Body-weight response is dynamic [S4]; Peak does not implement the NIDDK model.

Unlocked E = roundTo10(B + goalOffset + appliedWeeklyOffset + netExerciseKcal).
roundTo10(x)=10×floor(x/10+0.5), for nonnegative x. Do not round intermediate
energy terms. A user energy lock fixes E exactly and disables automatic energy
changes; show proposed exercise/weekly contributions as held, never applied.
Nonpositive E is blocked.

P defaults: protein = round(2.0W) g on days with any strength session, otherwise
round(1.8W) g. This is a candidate allocation within an athletic context [S3],
not evidence that every strength day requires a protein increase. Proposed
protein domain is 1.2W–2.2W g; locks outside it require domain review, not clipping.
S5 reports a group-level protein-response breakpoint around 1.6 g/kg/day during
resistance training; it does not establish a daily strength/rest switch or an
individual optimum. Do not present higher protein targets as automatically better.

P fat preference = round(0.8W) g. Candidate bounds:
Fmin=ceil(max(0.6W, 0.20E/9)), Fmax=floor(0.35E/9) g.
These are proposed model constraints, not a nutritional adequacy assessment.

P carbohydrate minimum Cmin:

- No endurance: 0 in this allocation solver, not a recommendation to eat zero.
- Total planned endurance 1–59 min: 3W g.
- 60–90 min: 5W g.
- More than 90 min: 6W g.

These steps deliberately expose a simplified training-fuelling assumption for
review (D4); they are not established from type/duration alone by the cited
position statement. A long session is one continuous endurance session >90 min;
several short sessions may increase the daily tier without qualifying as a long
session tomorrow.

Allocation with fixed E and default/locked P:

1. If C and F are both unlocked, choose F nearest the preference within
   [Fmin, min(Fmax, floor((E−4P−4Cmin)/9))]. If the interval is empty, block.
   C=(E−4P−9F)/4.
2. If only F is locked, preserve it and solve C from remaining energy.
3. If only C is locked, preserve it and solve F=(E−4P−4C)/9.
4. If C and F are locked, their energy plus 4P must equal E within 10^-6 kcal.
5. Validate P/F domains, C≥Cmin and nonnegative values after solving. If invalid,
   return constraints-conflict with the conflicting values and shortfall.

Unresolved conflicts produce no replacement targets: never override a lock,
raise energy silently, or clamp negative carbs to disguise infeasibility.
Previous targets may be displayed only as a clearly dated previous result.

Canonical values preserve the energy equation; do not round solved residuals.
P and default F are whole grams; C may have quarter grams. Solved F under a C
lock may be fractional. Display grams rounded to whole numbers with approximate
labelling; the stored canonical values drive calculations. Display rounding is
not applied back to a user lock. Protein/carbs use 4 kcal/g, fat 9 kcal/g.

## 5. Preparation for tomorrow's long session (D4)

Candidate, not full race carbohydrate-loading guidance:
If tomorrow has a qualifying >90 min endurance session, request +10% of today's
solved C while keeping E and P fixed. If C or F is locked, hold this reallocation
and explain the lock. Otherwise:

requestedC=1.10×C; requestedF=ceil((E−4P−4requestedC)/9).
newF=clamp(requestedF, Fmin, currentF); newC=(E−4P−9newF)/4.
If requestedF<Fmin, report preparation-partial with requested and achieved change.
Never reduce fat below Fmin to satisfy preparation. Do not add another energy
bonus for the same preparation rule. Session-day energy is handled in section 3.
Multiple long sessions tomorrow trigger the rule once. No hourly fuelling advice
is generated by this candidate.

## 6. Weight evidence and weekly review (D5)

Raw measurements/IDs remain intact. For each local date, use median weight
(middle value, or mean of middle two) to avoid giving frequently weighed days
more influence. Exclude future dates relative to the explicit cutoff, not by
deleting records. Missing days are absent, never zero or forward-filled.

For review date D, compare complete windows [D−14,D−8] and [D−7,D−1].
Require ≥4 distinct measurement dates in each window and latest date ≥D−2.
Mean the daily medians within each window. Let each window's centre be the
mean local calendar-day ordinal of observed dates, not milliseconds since epoch.
observedKgPerWeek=(recentMean−previousMean)×7/(recentCentre−previousCentre).
Keep full precision until display; display change/rate to 2 decimals.
Tolerance=max(0.05 kg/week, 0.0005W kg/week). Keep the deadband smaller than the
default gain target so a flat trend is not automatically treated as on-target.

Data-quality flags include insufficient-days, stale-weights and wide-same-day-range.
Proposed wide-range threshold: (max−min)>0.02×dailyMedian. Keep the median and
raw records, show the flag, and suppress numeric adjustment proposals until the
measurements are reviewed. Do not silently discard outliers or diagnose their cause.

Cadence: evaluate on/after local Monday for that Monday's fixed cutoff D, once
there are 14 prior days of history. A late opening uses that Monday, not a rolling
new review for every day. No future clock/background execution is assumed.

Numeric proposals also require confirmation that measurements are reliable and
prior targets were followed reasonably. No/unknown adherence gives review-needed,
not a new calorie reduction; phase 2 has no measured food-intake evidence.
Weight change alone cannot identify why the user is progressing or plateauing.

Candidate feedback modes (affect review step, not the goal offset):

| Mode | Step as % of fixed B | Per-review cap |
| --- | ---: | ---: |
| Conservative | 2.5% | 100 kcal/day |
| Neutral | 5% | 150 kcal/day |
| Aggressive | 7.5% | 200 kcal/day |

step=roundTo10(min(modePercent×B, cap)).
error=observedKgPerWeek−targetKgPerWeek.
If abs(error)≤tolerance, propose no change. Positive error proposes −step;
negative error proposes +step, regardless of goal label.
offsetCap=10×floor(0.10B/10).
newAbsoluteOffset=clamp(oldOffset+signedStep, −offsetCap, +offsetCap).
These modes/caps are experimental product choices requiring review, not sourced
claims of optimal adaptation.

A proposal needs explicit acceptance; automatic application is off in this draft.
No decrease may be accepted below a known REE/model lower bound. If no reviewed
lower bound exists for a manual baseline, hold application as review-needed.
REE is not itself proof of a safe intake; this guard is provisional and cannot
replace the domain review of the operating envelope.

Review identity = local Monday + baselineRevision + ruleVersion. Store cutoff,
inputRevision, evidence, old/proposed absolute offset and proposed/accepted/
declined/no-change/insufficient status. One accepted review cannot apply twice.
Re-evaluation before acceptance may replace the proposal; after acceptance,
corrections are a new explicit revision, never another cumulative automatic step.
Persist accepted decision and its offset in one envelope write. Retry writes the
same decision, not another adjustment. Baseline/goal changes require a new
revision and explicit reset/review of the offset; preserve prior decisions.
Stale evidence suppresses new proposals; an existing accepted offset is not
silently undone or presented as a freshly validated decision.

## 7. Contract, provenance and deterministic behavior

Suggested logical contracts (not a commitment to new folders or global state):

    RecommendationInput:
      asOfDate, timeZone, ruleVersion, profileRevision, inputRevision
      profile, baselineMethod/value/source, plannedSessionsByDate
      weightEntries, acceptedReviewState, locks, reviewConfirmations
    RecommendationResult:
      status: ready | needs-input | outside-model | constraints-conflict
      canonicalTargets or null, baseline/goal/exercise/weekly/preparation terms
      reasons[], dataQualityFlags[], trainingSummaries[]
    Reason:
      code, inputRecordIds, observedValuesAndUnits, appliedDelta, heldReason
    RecommendationSnapshot:
      id, localDate, generatedAt, inputSnapshot, inputRevision
      ruleVersion, result, previousRevisionId

Date/time zone and generation time are supplied by the caller; pure functions
do not call Date.now, fetch, storage or randomness. Use calendar arithmetic across
DST. Do not invent a confidence percentage. Missing data gets an explicit reason.
Store full normalized inputs used in the calculation, including program/session
references and the coefficient source; textual reasons derive from these values.

Daily recomputation can change today's snapshot on committed inputs. Same
date/inputRevision/ruleVersion/acceptedReviewRevision is idempotent. An accepted
weekly offset is an input, not a side effect of recomputing daily targets.
Historical snapshots are immutable; explicit corrections append revisions.
Rule changes generate new-version results, never overwrite the original.

## 8. Arithmetic reference cases

All v2 cases below are draft fixtures, not prescriptions. Unless stated:
W=80 kg; manual non-training B=2200 kcal; maintain; no accepted weekly offset;
complete reviewed inputs; no locks; empty sessions means explicit rest.
P/F/C below are canonical grams, not rounded UI labels.

| Case | Energy terms → E | P | F | C | Expected state |
| --- | --- | ---: | ---: | ---: | --- |
| Maintenance/rest | 2200 → 2200 | 144 | 64 | 262 | ready |
| Lose + strength, 60 min at 5 MET | 2200−220+320 → 2300 | 160 | 64 | 271 | ready |
| Gain + same strength | 2200+110+320 → 2630 | 160 | 64 | 353.5 | ready |
| Endurance, 60 min at 8 MET | 2200+560 → 2760 | 144 | 64 | 402 | ready; Cmin=400 |
| Endurance, 120 min at 8 MET | 2200+1120 → 3320 | 144 | 74 | 519.5 | ready; Cmin=480 |
| Rest, long endurance tomorrow | 2200 → 2200 | 144 | 53 | 286.75 | ready; requested C=288.2 |
| Strength + endurance as above, same day | 2200+320+560 → 3080 | 160 | 69 | 454.75 | ready; two distinct sessions |
| Lock protein=160, rest | 2200 → 2200 | 160 | 64 | 246 | ready; lock preserved |
| Lock carbs=280, rest | 2200 → 2200 | 144 | 56 | 280 | ready; lock preserved |
| Lock P=160/F=80/C=300, E=2200 | locked macros require 2560 | — | — | — | constraints-conflict; no new targets |
| Unknown session duration | exercise term cannot be calculated | — | — | — | needs-input; no guessed zero |
| No baseline/optional REE inputs | no personal baseline | — | — | — | needs-input; labelled v1 preview allowed |

Mifflin separate reference: W=80/H=180/A=30/+5 gives REE=1780;
factor 1.4 gives B=2492, maintenance/rest E=2490. This differs from manual
B=2200 and must not be substituted into the table.

Weight/review references (D=2026-11-16, all confirmations/guards satisfied):

- Seven daily medians of 80 in previous window, seven of 80.4 in recent window:
  centres 7 days apart, rate +0.4. Maintain target=0, tolerance=0.05:
  neutral proposal −110. Rest with accepted offset −110 gives E=2090,
  P=144/F=64/C=234.5. Reopen/recompute retains −110, never −220.
- Only four days/window: previous Nov 2–5 mean 80, recent Nov 12–15 mean 80.4:
  centres 10 days apart; normalized rate=+0.28 kg/week, not +0.4.
- Each day [79.9,80,80.1]: median=80, 14-day rate=0, maintain proposal no-change.
- One recent day [80,80.1,100], other 13 daily medians 80:
  recent mean=80.0142857143, rate=+0.0142857143; wide-range flag blocks a numeric
  proposal even though a median can be computed. Original records remain intact.
- Zero/one measurement or <4 days in a window: insufficient; no proposal.
  Most recent measurement older than D−2: stale; no proposal.
  Neither case changes valid daily baseline targets by pretending the trend is stable.
- Same +0.4 maintenance trend: conservative step=60, neutral=110,
  aggressive=170. Existing offset −200 with cap 220 proposes absolute −220,
  not −310. Decline or repeated application leaves the accepted state unchanged.

## 9. Compatibility, migration and verification

Version storage separately from ruleVersion. V1 profile/weights/plan, opaque IDs
and raw arrays must survive. Add nullable inputs rather than infer age, height,
activity outside training or duration. Legacy plan records can become stable-ID
session summaries with unknown added fields; explicit rest maps to an empty list.
Determine that migration in #39/#40, with fixtures and original-data preservation.
Do not create fake old recommendation snapshots: legacy history did not exist.

Manual entry and offline calculations remain possible. Every new entity must
participate in export and confirmed reset. Persist profile/plan/weights/reviews/
recommendations coherently so a reset or failed write cannot revive old state.
Tests must include known reference arithmetic, missing data, constraints,
multi-session overlap, DST/year boundaries, migration failure, weekly retries,
relaunch and corrections. Device/pilot review checks understanding and unexpected
behavior; green unit tests do not validate physiological effectiveness.

## 10. Review decisions and implementation gates

| Gate | Concrete proposal to review | Blocks until resolved |
| --- | --- | --- |
| D1 | Manual or optional Mifflin baseline; non-training activity factors; input/model domain | #39 and baseline part of #42 |
| D2 | Session structure, coarse MET mapping, duration/overlap assumptions and bounds | #40 and exercise part of #42 |
| D3 | Goal offsets, default/maximum target rates and lower-bound operating envelope | goal part of #39/#42 and #44 |
| D4 | Protein/fat/carbohydrate solver, locks and modest next-day preparation | macro part of #42, locks in #44 |
| D5 | Weight quality gates, cadence, tolerance, modes/caps and explicit acceptance | #41/#44 |
| D6 | Snapshot/revision policy, explanations and program/session references | #43/#45 |

Owner review chooses product behavior. Qualified sports-nutrition/domain review
must assess D1–D5 before broad activation; it is not implied by merging this draft.
In particular, weight-only feedback, low-energy situations and generic endurance
mapping need review. The proposal does not diagnose energy deficiency or infer
sleep/recovery. Those inputs and clinical decisions are outside this phase.
Until the relevant gates are settled, dependent issues may refine designs but
must not silently activate these numerical rules.

### 10.1 Owner-approved product principles — 7 November 2026

The owner approved an initial baseline refined over time, multiple sessions per
day with planned and completed work separate, at least two weeks of weight
observations for trend review, explicit user acceptance of weekly calorie
changes, and a foundation for later detailed strength/endurance programs.
This approval does not select every numerical default in D1–D5 or resolve the
exact profile fields, ranges and units required by #39 (subsequently approved below).

For #39 the owner subsequently approved optional height 100–250 cm, integer age
19–78 for the proposed equation, a voluntary +5/−161 coefficient selection,
manual non-training maintenance >0 to 10,000 kcal/day, and an unspecified or
0–0.5%/week target-rate magnitude (maintenance is 0). Inputs are stored now; they
do not activate the proposed baseline, target-rate or recommendation formulas.
Users may skip every additional input and retain the existing calculator.
This resolves the input-collection subset of D1/D3 for #39, not their numerical
recommendation defaults or the remaining domain review.

### 10.2 Actual data and evaluation

The owner requires actual activity and actual nutrition intake for a meaningful
evaluation of recommendations. Future sources include Apple Health for activity
and MyFitnessPal (if provider access permits) or Peak food logging for intake.
These integrations are future work; their availability is not assumed.

Keep recommended targets, planned work, completed activity and logged intake
separate. Weight change alone cannot establish adherence, explain a discrepancy,
or demonstrate recommendation effectiveness. Imported energy expenditure remains
an estimate; even a food log may be incomplete. Manual confirmation in the first
version supports a limited review, not verified adherence or causal conclusions.

Future evaluation must record source, observation time, covered dates and known
completeness. Missing activity/intake is unknown, never zero. Deduplicate records
across providers and match actual sessions to plans before replacing exercise
estimates; do not add both planned and actual energy for the same session or
add exercise again to a total expenditure that already includes it. Preserve
original records and the inputs used by each historical recommendation.

Example: a weight plateau with missing food logs must not be explained as proof
that the calorie target was too high. A planned ride plus an Apple Health record
for that ride represents one session, not two. These are requirements for later
integration/evaluation tasks, not permission to implement imports in #39.

## Sources and limits

- S1: [Mifflin et al., 1990, original study](https://pubmed.ncbi.nlm.nih.gov/2305711/).
  Supplies the REE equation and study population; not Peak's activity factors.
- S2: [2024 Adult Compendium: conditioning](https://pacompendium.com/conditioning-exercise/)
  and [cycling](https://pacompendium.com/bicycling/). Activity-specific MET values
  motivate approximations; the coarse category mapping remains a Peak assumption.
- S3: [Thomas, Erdman & Burke, 2016, professional position statement](https://pubmed.ncbi.nlm.nih.gov/26920240/).
  Supports individualized sport-nutrition planning; the retrieved abstract does
  not establish the candidate thresholds/macros in this document. Numerical
  settings require full guidance/domain review rather than attribution to an abstract.
- S4: [NIDDK: research behind the Body Weight Planner](https://www.niddk.nih.gov/research-funding/at-niddk/labs-branches/laboratory-biological-modeling/integrative-physiology-section/research/body-weight-planner).
  Describes a dynamic weight model; Peak does not implement it or its response predictions.
- S5: [Morton et al., original meta-analysis, 2018](https://pubmed.ncbi.nlm.nih.gov/28698222/).
  Resistance-training studies show a population-level plateau; the result is not
  a universal ceiling, a prescription for every athlete, or evidence for the
  candidate day-by-day protein rule.

Sources checked 7 November 2026. No quoted text or general ranges should be treated
as validation of the complete combined Peak model.
