# #864: candidate website content as a historical prediction signal

Current verified state: **668 stored literal excerpts**, with the separately frozen v2 outcome experiment executed. See the [maintained ledger](senate-864-completion-ledger.md). The original v1 design and its later updates are retained below.

The hypothesis is **whether words observable on a candidate-owned campaign website before a vote improve prediction of a later vote**. The source observation is sufficient; this project does **not** require a subjective "verified policy position", proof of sincerity, a personal spoken quotation, or proof the described legislative action took place.

## Evidence handling

- **Site and speaker**: only use the existing authenticated campaign-owned source ledgers, reconciled against the 95 legislators who served in 2021–25.
- **Words**: retain the literal excerpt exactly as collected, rather than inventing support/opposition labels or reinterpreting it as a recorded vote.
- **Clock**: `archiveCapturedAt` is the independently observed copy date. For this historical research lane, stored `published_at` means **archive observation**, not the candidate's first publishing date. Only use a record when its observation timestamp is **strictly earlier than the vote's cutoff**; do not backdate copy from later captures.
- **Serving**: map an archived candidate copy to the actual person's identity; the read-only evaluation query joins later service sessions by stable legislator ID.
- **Deployment**: research evidence is `asOfEligible=true`, `experimentalWebsiteTextForHistoricalEvaluation=true`, but **`mechanicallyActionable=false` and `modelWeight=0`**. No existing Quick/Deep production model or feature weighting changes. An experimental evaluation must deliberately opt into this data.

## What changed from the over-conservative 72-page import

The 72 original-page records written in #1320 are **source provenance receipts**, not word-level research features; their original `asOfEligible=false` is appropriate for a receipt without the actual snippet. The correction is to import the **literal archived text as separate as-of research evidence**, with the archive observation date. The site receipts do not need to be rewritten, nor is a human policy-position certification needed.

The manifest's **1,285** is an aggregate research count, **not 1,285 itemized quotations**. All **29** on-repository ledgers contain **1,197** actual excerpt objects; **88** of the aggregate are not materialized there and are not fabricated. Of the 1,197 actual records, the minimal provenance join yields **616 ready**, including **398** linked to the independently rehashed 72 archived originals. **581** remain held for missing original URL/hash/archive-digest/observation linkage or unresolved person identity, rather than any subjective political classification.

The protected workflow writes only the **616** provenance-complete excerpts idempotently into the existing VotePredict Neon database after independent main CI and renewed original-source verification; it verifies every stored literal, target, archive timestamp, original URL/hash, and non-serving forecast flags by database read-back.

This enables a legitimate future experiment. It **does not demonstrate predictive lift** until the literal texts have been compared with later actual votes using a held-out, time-safe evaluation.


## October 19 structured identity correction

The old 55 person-hold labels were 52 schema/metadata-join defects plus 3 known
Louis McNutt excerpts outside the actually-serving Senate study. The corrected
`websiteExcerptPlan` reads explicit nested names and page-section IDs; it yields
668 source-ready records, 526 source-metadata holds and 3 scope exclusions, with
zero unknown people. See the [maintained ledger](senate-864-completion-ledger.md).
`websiteExcerptPlanV1` is retained only for the already imported 616 and frozen
protocol v1; all 616 records/keys remain exact. This code correction imports no
additional records and does not change the frozen experiment, serving or weights.

## October 19 verified import and isolated outcome experiment

The later #1477 protected execution inserted all 52 additions and exactly verified
**668 stored literal excerpts / 53 people / 69 original bodies**, with zero replay inserts.
The 616 v1 records and frozen protocol remain exact. There are 526 source-metadata holds,
3 known-person scope exclusions and zero unknown people.

A separate protocol v2 and outcome-free cohort commitment preceded #1478's isolated
outcome execution: 12,134 member/bill targets across 370 bills and 52 people, with strict
observation-before-local-midnight cutoffs and chronological 2021–22 / 2023 / 2024–25 splits.
The prespecified primary comparison found **no useful held-out improvement** from website
TF-IDF over historical party rates. Validation selected strongest shrinkage; test bill-macro
log loss was 1.0806929824 for text versus 1.0806926349 for party. The training-only overall
rate performed better at 0.5884604741. This limited website-only experiment does not decide
whether bill-conditioned text features can help a future, separately designed model.

See the [maintained ledger](senate-864-completion-ledger.md) for actual source/import/CI
receipts, full metrics and limitations. The v2 test is now examined; do not tune against it
and describe it as untouched. No serving weights, production training pipeline or earlier
immutable evaluation freeze changed.
