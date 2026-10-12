# #864 — 2024 one-missing-named-choice original tally-side diagnostic V3

## What V2 independently proved

The successful [read-only full original PDF V2 audit](./senate-864-all-1452-original-pdf-ocr-neon-parity-v2.md)
([run #38201074454](https://github.com/killjoy00/votepredict/actions/runs/38201074454),
[receipt #6117412541](https://github.com/killjoy00/votepredict/issues/864#issuecomment-6117412541))
matched **all 1,452 original 2022–25 electronic committee Minutes PDF byte SHA-256 digests**
to the stored original source documents, and exactly matched **151 of 152**
candidate recorded-roll events for which original individual choice hashes and
original YEA/NAY tallies were independently retained. One **2024** candidate
roll has **10 original choice identity hashes**, **9 stored**, an **exact
9-hash intersection** and **zero extra stored** choice hashes. This means
**one original named-choice fingerprint is absent**, not ten absent persisted
choices. A separate 2025 roll remains external-key/count-only: its original
tally and per-member identity fingerprints are **not** proven.

Neither government PDF hash equality nor parser candidates prove the original
committee-vote and meeting universe is complete.

## New bounded V3 question: can the missing *side* be classified?

The additional [pure comparator](../../src/evidence/senate-864-source-db-sanitized-compare.ts)
can classify only this **single missing original named choice *side*** if all
of the following hold in the already verified source-to-stored relation:

- The independently retained original PDF SHA, hearing date and committee
  metadata exactly equal the stored source; the original roll external key,
  numeric tally and event date match exactly; there is exactly one stored event.
- The source SHA multiset has exactly one more choice token than the stored
  multiset; *every other* stored choice SHA appears in the original multiset,
  including multiplicity; there are zero extra stored fingerprints.
- All nine stored choices on this roll retain non-null membership identities,
  and the original YEA/NAY tally differs from the stored choice values by
  exactly one **YEA**, or exactly one **NAY**, but not both.

The report gives only `YEA`, `NAY` or **`HOLD`**, and fixed numeric
hash-intersection and member-resolution counts. A changed vote, substituted
stored name/choice, inconsistent tally, missing stored membership, or any
other original/DB cohort drift **cannot be misrepresented as a known side**.
A side result **does not identify a person**; the original proof artifact
contains only digests for that roll, not a reversible stored member roster.

## Protected execution boundary

[The one-time review workflow](../../.github/workflows/senate-864-single-choice-tally-side-readonly-v3.yml)
requires the unique `SENATE_864_SINGLE_CHOICE_TALLY_SIDE_ONESHOT_20261012_V3`
marker on a first-attempt *reviewed main merge*. A PR can perform only same-repo
synthetic tests, disposable migrations/`EXPLAIN` **without ANALYZE**, and
the original SHA-preflight. **No PR job has the Neon management key.**

The original government source universe is fixed to the **same 4 original
indexed source artifacts and 16 independently preserved OCR artifacts** from
the earlier V2 protected comparison. The separate pre-secret main job runs
`npm run check`, migrations/`EXPLAIN` on disposable PostgreSQL and a
dependency audit. The source preflight verifies original metadata artifact
SHA-256s before packaging them for the protected job; the protected job
reverifies original SHA proofs, then reuses the exact same three
unchanged bounded SELECTs for original source documents, vote events, and
named choices on the **existing VotePredict default Neon branch**.
The protected step runs a `REPEATABLE READ READ ONLY` transaction and
explicitly `ROLLBACK`s before allowing strictly allowlisted numeric and
enumerated output. A separate keyless job checks the output fields before
posting a sanitized issue #864 receipt.

The V3 result must independently match **all previously frozen V2 counts
and by-year values**; a changed stored cohort, unexpected roll count,
different original PDF, different digest intersection, or unexpected
private output causes **HOLD**, not silent acceptance. No row-level
exports or database repair, forecasts, serving features, data migrations,
training, deployments or 2027 behavior are authorized.

**Status:** code and test instrumentation only until an exact-main protected
run and its sanitized receipt are verified. Do not describe a YEA/NAY side
as an observed production fact before that receipt exists.

## Still explicitly not resolved

The missing person, reason for omission, whether the extraction is itself
exhaustive, member service/office dates, actual live deployed database binding,
2025 key-only original source identities, 2021 print Minutes, print/electronic
differences in 2022, 141 indexed electronic meetings without a linked Minutes
PDF, all context motions, historical eligibility and all source-family
completeness remain open. No data mutation is authorized. Parent #864 stays open.
