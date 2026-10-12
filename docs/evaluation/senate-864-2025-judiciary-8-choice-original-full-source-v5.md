# #864 — 2025-03-12 Judiciary complete original vote-source proof (V5 protected comparison)

## Previously key-only in V2, but full original source proof already exists

The verified 1,452-original PDF V2 [protected comparison](./senate-864-all-1452-original-pdf-ocr-neon-parity-v2.md)
([run #38201074454](https://github.com/killjoy00/votepredict/actions/runs/38201074454),
[receipt #6117412541](https://github.com/killjoy00/votepredict/issues/864#issuecomment-6117412541))
could compare 152 candidate recorded rolls using independently retained per-person
name/choice SHA fingerprints. A *different* 2025 Judiciary candidate in the
initial 24-source OCR artifact contained only an external event key and **eight
named choices as a count**; V2 confirmed its stored source URL/hash/hearing date,
event key and eight-row count, but correctly **did not certify the named choice
identities or original tally**.

The source-only work had already provided more detail. Original archived public
source [run #38070395356](https://github.com/killjoy00/votepredict/actions/runs/38070395356),
on original PR #885 commit `66856e47ac48608a287f4264b36b6a077a721ec0`,
finished successfully, independently reacquired exactly the
[March 12, 2025 Judiciary original PDF](https://www.lrl.mn.gov/archive/minutes/senate/2025/jud/20250312/Jud_20250312_minutes.pdf)
and hashed its original PDF + OCR text. It published a distinct proof artifact
`11676168658`, named `senate-2025-judiciary-original-named-roll-source-proof`.

Independently checked source provenance (NO DB read in that source-only run):

| Proof | Independently pinned value |
| --- | --- |
| Original raw PDF SHA-256 | `0f272639ecf612217daa230794df31731428bbc665e6a2caa6dad26442c54f0a` |
| Original OCR text SHA-256 | `609bf8f2e212c88eb3e6a414d2eb352258486b24664b885eb92ee45a0be69728` |
| Original Actions archive ZIP SHA-256 | `841dc184b1596a2af00a7652910c31fa903cde258b85d3cdb4e0ff1d08aeb703` |
| Decoded proof JSON exact SHA-256 | `26f47dfa3b4cb45507fa9bf9e816a8f7ceb2d4db7ff2dc0bf780683141aa892b` |
| Original event | 2025-03-12 Judiciary, `7 YEA / 1 NAY`, **8 distinct** original named-choice SHA-256 tokens |

Those artifact SHA values were verified against the original successful Actions
archive retrieved by exact immutable artifact ID. The original source-only
workflow emitted **fingerprints only**: no normalized senator names, original
OCR text, PDF contents, private database rows or identifiers in the output.
The source candidates remain parser observations, not a complete official
recorded vote census.

## Fixed one-candidate proof bridge

[`scripts/senate-864-2025-judiciary-full-source-proof-v5.ts`](../../scripts/senate-864-2025-judiciary-full-source-proof-v5.ts)
only accepts the exact independently pinned JSON bytes and PDF/OCR SHA,
March 12 official URL, original external event key, exact 7/1 source tally,
eight unique SHA-256 choice digests, and source-only non-serving flags.
It requires an exact *single* existing V2 key-only event within the fixed
207 recovered OCR source cohort and the full 1,452 source PDF set.
It upgrades **that original in-memory source proof only** from key/count to
a fully detailed candidate, making **153 candidate rolls / 989 source choice
hashes** independently comparable, and **zero key-only source candidates**.
It does **not alter persisted event or member-vote rows**, the ingestion
pipeline, service dates, predictions or publication-time cutoffs.

## Reviewed, first-attempt, protected read-only comparison

The [V5 one-shot workflow](../../.github/workflows/senate-864-2025-judiciary-full-original-neon-v5.yml)
uses the unique
`SENATE_864_JUDICIARY_2025_FULL_ORIGINAL_NEON_ONESHOT_20261012_V5`
marker on an exact reviewed **first-attempt main merge**.
On PRs it runs only source original SHA checks, synthetic tests and disposable
PostgreSQL `EXPLAIN` without `ANALYZE`; **the Neon secret is never exposed**.
Before the protected main step it requires all 20 existing independently
SHA-pinned original 2022–25 PDF/OCR metadata artifacts, and the additional
2025 source artifact by exact run/ID/digest. All **21** independent artifacts
are preflighted before secrets.

A separate main presecret job migrates **disposable** PostgreSQL *before*
`npm run check`, checks the same original source/event/member-vote SQL plan,
and runs the dependency audit. The protected job reuses the prior three
bounded `SELECT`s in one `REPEATABLE READ READ ONLY` transaction on the
previously identified **existing Neon default branch**, then explicitly
`ROLLBACK`s. All stored raw rows/names/choice values stay entirely in
memory in the protected job. A separate keyless step accepts **strict
allowlisted counts/enums only** and posts a sanitized issue #864 receipt.

**Exact decision boundary:** either all eight original 2025 Judiciary
fingerprints match eight stored choices in the same source/date/tally/key
and the report says `FULL_8_OF_8`, or it reports a truthful `HOLD`
(or fails closed on original/source/stored cohort drift). No eight-way match
is asserted *before the protected receipt exists*. The previously verified
2024 single original missing **YEA** side must remain unchanged; no row
can be silently repaired or relabeled.

The original all-PDF V2 result and the V4 protected YEA-side receipt
([run #38262800243](https://github.com/killjoy00/votepredict/actions/runs/38262800243),
[receipt #6126317993](https://github.com/killjoy00/votepredict/issues/864#issuecomment-6126317993))
remain the frozen baselines.

## Permanent holds

No *official all-actions denominator* or 2021 print-only meeting census
is proven. The 2022 printed/electronic collections may differ; 141 indexed
electronic meetings have no linked original minutes PDF. Member service
dates, actual deployed live app database branch, original publication-as-of,
other evidence tracks and historical eligibility are not certified. The
2024 missing-YEA named person's identity and any repair remain unproven.
No finance, forecasting, training, serving, deployment, scheduler, 2027
or database write is authorized. Parent issue #864 must remain **OPEN**.

**Status:** full original source proof verified, but 2025 original-to-stored
individual-fingerprint parity is pending a reviewed successful V5 protected
run and its exact keyless issue receipt.
