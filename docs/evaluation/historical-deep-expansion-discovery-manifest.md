# Historical Deep expansion discovery manifest

## Purpose

The 24-event expansion cohort was frozen before archive source discovery. The source crawl is a separate artifact. This manifest freezes the other side of the historical Deep experiment: the chamber-wide pre-vote Quick member probabilities and support fields for exactly those 24 already-selected vote events.

It does not collect evidence, use floor outcomes, apply Deep impact, change production targeting, write to the database, or call a live research model.

## Frozen cohort lineage

`data/evaluation/historical-deep-expansion-discovery-lineage-v1.json` pins the same immutable cohort artifact used by source discovery:

- workflow run `34726851111`;
- artifact `10307649483`;
- head SHA `2b2c143a96a21bd61da7d5932a13ae0133707c95`;
- artifact SHA-256 `7b1cc8e6f7628f73b3f5a444078301c11cf466c617eeeea5cd636b5d600917b2`.

The workflow verifies the artifact digest before it is sent to the authenticated production-only evaluator.

## Outcome-blind reconstruction

The evaluator reruns the existing strict historical Quick replay and addresses only the cohort's exact frozen `voteEventId` rows.

For each event it verifies:

1. source-derived `externalKey`, session, chamber, bill identifier, and date still match the frozen cohort;
2. Quick target-version and member-model lineage still match the cohort;
3. the event remains strictly replayable;
4. `live-current` and `need-only` are recomputed only after all member `actualOutcome` fields have been removed from the selector input;
5. both recomputed 12-person target arrays exactly match the target arrays frozen before archive source discovery.

The metadata query deliberately selects no `passed`, yea/nay total, or member-choice field.

## Manifest contents

For every chamber member in every selected event the artifact stores only pre-vote forecasting information needed by deterministic Deep extraction and later replay:

- stable membership and legislator IDs;
- member name, party, district/title metadata;
- frozen Quick yes probability or cannot-predict reason;
- Quick evidence quality and support components;
- whether the member belongs to the frozen current-target or candidate-target set.

Each case also retains the strict prior-day `asOf`, bill/chamber identity, source-derived stable event key, Quick target-version/model lineage, and a chamber-wide discovery request.

The workflow rejects the artifact if any object contains `actualOutcome`, `actualYes`, `passed`, `yeaCount`, or `nayCount`, or if any selected event no longer has exactly 12 current and 12 candidate targets.

## Production isolation

The operation is authenticated, production-only, read-only, and exists solely because the historical Quick runtime needs production database context. The workflow waits until the **exact main SHA** containing the evaluator is `READY` in Vercel production before invoking it.

No serving forecast path consumes this artifact.

## Next stage

Once this manifest and the separate official archive source bundle are both frozen, deterministic committee-roll-call extraction can run entirely offline. Only after extracted candidates are frozen should a later official outcome snapshot be joined for scoring and the unchanged `logit-evidence-v1` impact replay.
