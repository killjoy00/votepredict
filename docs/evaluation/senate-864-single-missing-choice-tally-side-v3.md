# #864 — 2024 one-missing-named-choice original tally-side diagnostic (V4 recovery)

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
requires the **new** unique `SENATE_864_SINGLE_CHOICE_TALLY_SIDE_ONESHOT_20261012_V4`
marker on a first-attempt *reviewed main merge*. A PR can perform only same-repo
synthetic tests, disposable migrations/`EXPLAIN` **without ANALYZE**, and
the original SHA-preflight. **No PR job has the Neon management key.**

The original government source universe is fixed to the **same 4 original
indexed source artifacts and 16 independently preserved OCR artifacts** from
the earlier V2 protected comparison. The separate pre-secret main job runs
disposable PostgreSQL **migrations before** `npm run check`, followed by
`EXPLAIN` (without `ANALYZE`) on that disposable database and a
dependency audit. The source preflight verifies original metadata artifact
SHA-256s before packaging them for the protected job; the protected job
reverifies original SHA proofs, then reuses the exact same three
unchanged bounded SELECTs for original source documents, vote events, and
named choices on the **existing VotePredict default Neon branch**.
The protected step runs a `REPEATABLE READ READ ONLY` transaction and
explicitly `ROLLBACK`s before allowing strictly allowlisted numeric and
enumerated output. A separate keyless job checks the output fields before
posting a sanitized issue #864 receipt.

The V4 result must independently match **all previously frozen V2 counts
and by-year values**; a changed stored cohort, unexpected roll count,
different original PDF, different digest intersection, or unexpected
private output causes **HOLD**, not silent acceptance. No row-level
exports or database repair, forecasts, serving features, data migrations,
training, deployments or 2027 behavior are authorized.

## V3 failure preserved and V4 recovery boundary

The first reviewed V3 one-shot merge, [PR #1219](https://github.com/killjoy00/votepredict/pull/1219),
was green on the PR's independent source, disposable SQL, full CI and regression
gates. Its [first-attempt main run #38261106387](https://github.com/killjoy00/votepredict/actions/runs/38261106387)
then passed the full 20-original-artifact SHA preflight but **failed before the
protected step**: the dedicated main-presecret job ran `npm run check`
*before* creating the disposable test schema. Exactly one of 2,785 tests
then failed because the local test-only relation `public.ingestion_runs`
was absent. The **protected Neon job was skipped**. There is **no source
YEA/NAY attribution from V3**. The intended keyless failure reporter also
failed to parse JavaScript because a literal apostrophe was unescaped. Thus
V3 produced neither a protected result nor an issue receipt; preserve the
held run as an observed negative, not an implicit pass.

V4 corrects the **main-only dependency order** to disposable
`npm run db:migrate` before `npm run check`, while retaining the
PR's prior green validations. It also repairs the keyless `github-script`
syntax and adds a **new offline test that compiles the reporter as an async
JavaScript function** and guards migrations/check/EXPLAIN ordering,
the exact unique V4 marker, private output and protected-job isolation.

## Protected V4 outcome — verified one missing YEA-side choice

The [V4 first-attempt protected run #38262800243](https://github.com/killjoy00/votepredict/actions/runs/38262800243)
succeeded on independently reviewed exact-main commit
`26110b8bc39f13cac70cacf3230cce9d1e436273`.
The separate keyless reporter completed successfully and posted the
[sanitized issue receipt #6126317993](https://github.com/killjoy00/votepredict/issues/864#issuecomment-6126317993).
The immutable numerical result is retained as
[`source-proof/senate-864-2024-one-missing-choice-yea-side-v4-protected-receipt.json`](./source-proof/senate-864-2024-one-missing-choice-yea-side-v4-protected-receipt.json).

The comparison reverified all **1,452 original PDF raw SHA-to-stored-source
matches**, all previously frozen V2 roll totals (**152 original detailed
candidate rolls**, **151 matching fully**) and the one 2024 mismatched roll.
That roll has **10 source named-choice SHA tokens**, **9 exact source/stored
named-choice intersections**, **1 source token absent**, **0 unexpected
stored tokens**, **9 non-null stored membership references** and **0 missing
stored membership references**. Its independently parsed original numeric
YEA/NAY tally differs from its nine matched persisted choices by **exactly
one YEA choice**.

**New verified finding: the one absent original choice token is on the
YEA side, not the NAY side.** This is *not* proof of the missing person's
identity, nor evidence of why the token was not persisted; names/digests,
identifying keys, URLs and raw private records were not exported. The
protected transaction was `REPEATABLE READ READ ONLY`, explicitly
`ROLLBACK`ed with zero writes. The authenticated database is the existing
Neon default branch, *not* independently proven to be the deployed app's
live DB binding.

V3 is still an explicit presecret **HOLD** with **no V3 protected result**,
as documented above. Neither V4 nor V2 establishes that parser-recognized
candidate rolls exhaust all official recorded votes or committee motions.
No vote repair, feature promotion, eligibility or full historical
completeness claim is authorized. Parent #864 remains OPEN.

## Still explicitly not resolved

The missing person, reason for omission, whether the extraction is itself
exhaustive, member service/office dates, actual live deployed database binding,
2025 key-only original source identities, 2021 print Minutes, print/electronic
differences in 2022, 141 indexed electronic meetings without a linked Minutes
PDF, all context motions, historical eligibility and all source-family
completeness remain open. No data mutation is authorized. Parent #864 stays open.
