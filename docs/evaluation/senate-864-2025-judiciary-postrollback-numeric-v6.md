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

## Verified V6 protected outcome (supersedes the former 2025 key-only hold)

The distinct [first-attempt V6 source-to-stored audit run #38270466090](https://github.com/killjoy00/votepredict/actions/runs/38270466090)
succeeded on exact reviewed main commit
`57b3248dca1ad406cda739c531ba9f2edbe5bca6`.
The separate keyless reporter succeeded and posted
[issue #864 receipt #6127418525](https://github.com/killjoy00/votepredict/issues/864#issuecomment-6127418525),
reporting `FULL_8_OF_8` and `COMPLETE`. The nonidentifying immutable
regression-checked result is preserved in
[`source-proof/senate-864-2025-judiciary-eight-of-eight-v6-protected-receipt.json`](./source-proof/senate-864-2025-judiciary-eight-of-eight-v6-protected-receipt.json).

The independently SHA-verified March 12, 2025 Judiciary original roll has
**7 YEA / 1 NAY** and **8 of 8 exact original named-choice digests
matching stored choices**. All **33 of 33** fully detailed original 2025
candidate rolls match, with **305 of 305** original named-choice fingerprints
on fully matching rolls. Across the pinned 2022–25 electronic original
sources, **1,452 of 1,452** original PDF hashes match, **152 of 153**
detailed candidate rolls match and **979 of 989** original named-choice
fingerprints occur on those fully matching rolls.

The sole discrepant 2024 roll remains exactly **10 original / 9 stored
choice fingerprints, 9 matching, one original YEA missing, zero extra
stored**. The aggregate original-side token shortfall is **one**, not ten:
the 10 original tokens on this roll are excluded from the full-roll-matched
fingerprint total of 979. The missing person and cause remain unidentified.

**Scope and safety:** The protected transaction was
`REPEATABLE READ READ ONLY` with explicit `ROLLBACK` and zero database
writes. No member names, private choice SHA digests, raw rows or source
URLs were exported; the existing Neon default branch is not independently
proven to be the database bound to the deployed app. Nothing here proves
a complete official all-meetings or all-motions census, historical
publication-as-of eligibility or permits a vote repair, forecast change
or issue closure. **Issue #864 remains OPEN.**

**Chronology:** V5 source proof passed, but its post-rollback strict receipt
returned a HOLD. V6 diagnosed that reporting ambiguity and established the
full 2025 8-of-8 database parity independently. Preserve the V5 held receipt
rather than retrospectively calling the earlier V5 run successful.
