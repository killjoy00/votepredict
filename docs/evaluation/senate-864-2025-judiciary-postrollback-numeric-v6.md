# #864 — 2025 Judiciary original individual-choice parity V6: post-rollback numeric HOLD diagnosis

## Exact trigger for this bounded follow-up

The [first-attempt V5 protected run #38266959992](https://github.com/killjoy00/votepredict/actions/runs/38266959992)
followed [PR #1227](https://github.com/killjoy00/votepredict/pull/1227)
(reviewed SHA `ad60b857c2cb8e791b5ab1b97b22afe84bea9ee6`).
It successfully verified all **21 independently original-source metadata artifacts**,
completed the presecret full repository checks, reusable disposable PostgreSQL
migrations and `EXPLAIN` without `ANALYZE`, then executed the unchanged three
bounded `SELECT`s on the existing authenticated Neon default branch in one
`REPEATABLE READ READ ONLY` transaction and **explicitly ROLLBACKed**.

Its strict V5 *post-rollback result classifier* did **not** accept the
comparison, so it emitted **no 8-of-8 equality assertion**. The separate
keyless reporter posted the accurate [protected HOLD receipt
#6126911116](https://github.com/killjoy00/votepredict/issues/864#issuecomment-6126911116)
with phase `rolled_back`. That phase proves the transaction closed read-only;
it **does not** reveal which expected source/stored scalar failed. V5
must remain an explicit HOLD rather than be retrospectively relabeled success.

The independent 2025-03-12 Judiciary source-only proof
([run #38070395356](https://github.com/killjoy00/votepredict/actions/runs/38070395356),
immutable original artifact #11676168658)
still authenticates the original PDF SHA, OCR text SHA, proof ZIP and JSON SHA,
**7 YEA / 1 NAY**, and **8 distinct one-way original named-choice digests**.
This original-source verification does **not** itself prove that the eight
persisted database choices agree. The separate 2024 **single missing YEA-side
choice** remained proven by earlier [V4 protected receipt
#6126317993](https://github.com/killjoy00/votepredict/issues/864#issuecomment-6126317993).

## V6 asks only which aggregate reconciliation invariant failed

The new unique first-attempt-main marker is
`SENATE_864_JUDICIARY_2025_POSTROLLBACK_NUMERIC_ONESHOT_20261012_V6`.
The [V6 workflow](../../.github/workflows/senate-864-2025-judiciary-postrollback-v6.yml)
reuses precisely the same twenty original 2022–25 PDF and OCR metadata
artifacts plus the separately archived 2025 Judiciary eight-choice SHA proof,
all **21** independently verified before any key access. The original
source-universe and previous receipts remain immutable, with exactly
**1,452** independently hashed original PDF identities, **153** original
candidate named-roll proof events and **989** original named-choice digest
tokens. These numbers are the *parser-recognized* original candidate universe,
**not** the complete official minutes, all motions or recorded votes.

Main-only independent review requires an exact commit SHA, first `main`
attempt with the unique V6 marker, disposable PostgreSQL migrations **before**
full `npm run check`, an unchanged three-query `EXPLAIN` without analysis,
and the dependency audit. The protected job alone holds the existing Neon key;
PR jobs and the keyless issue reporter do not. The protected transaction is
explicit `REPEATABLE READ READ ONLY` followed by `ROLLBACK`.

The new [pure, regression-tested scalar classifier](../../scripts/audit-senate-864-2025-judiciary-postrollback-v6.ts)
can emit only an exact static whitelist of aggregate numeric counts, booleans
and `FULL_8_OF_8` or `HOLD` with one of the following bounded, nonidentifying
reason categories:

- Source/stored PDF or cohort aggregate drift from V2;
- Previously matched original roll/count baseline or separately verified
  single missing 2024 YEA-side anchor changed;
- Aggregated original-versus-stored 2025 roll event/tally/date mismatch;
- Aggregated name-choice SHA or stored membership-resolution mismatch;
- An otherwise unclassified discrepancy held for further source review.

Only a simultaneously verified 2025 **33/33 source-detailed candidate roll
matches**, **305/305 original choice digests on exactly matched rolls**,
unchanged 2024 YEA hold, all original 1,452 PDF parity, unchanged stored
committee source/event/choice cohort, exactly one known 2024 mismatched roll
and zero other error categories may produce `FULL_8_OF_8`.
All other bounded outcomes are explicit `HOLD`s. No per-senator/member name,
member key, original choice hash, source URL, raw private row or original text
may leave the protected step. A separate keyless reporter checks exact field
allowlists, type and value bounds before posting any issue #864 receipt.

## Existing untouched limits and run status

Neither V6 nor a source candidate count establishes the full 2021 printed
Senate minutes denominator; 2022 printed/electronic equivalence is unproved,
141 indexed electronic meetings lack linked minutes PDFs, some parser motion
contexts are uncertain, original historical member service dates and evidence
publication-as-of are unverified. The existing Neon default branch still is
not independently proven to be the deployed app live database. No historical
vote repair, migrations against Neon, private row export, serving/model
changes, scheduling, deployments or 2027 changes are authorized.
Keep #864 **OPEN**.

**Status:** V5 full 2025 original-source proof **verified**, exact database
fingerprint parity **HELD** as of the post-rollback V5 receipt. V6 is a
separately reviewed count-only diagnostic proposal until its distinct
main-only protected run and keyless issue receipt succeed.
