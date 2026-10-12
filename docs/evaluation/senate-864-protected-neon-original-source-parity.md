# #864 — Protected original committee Minutes PDF-to-stored Neon identity reconciliation

This is **not** an ingestion/backfill or a prediction change. It extends the successful
[existing-key V5](https://github.com/killjoy00/votepredict/issues/864#issuecomment-6116826026)
**read-only grouped-count** baseline to source-specific parity inside a fresh protected
`REPEATABLE READ READ ONLY` transaction, using the **existing VotePredict GitHub Neon key**.
The original V5 counts are permanently copied, with strict scope guards, into
[source-proof/senate-864-v5-protected-neon-seven-family-baseline.json](./source-proof/senate-864-v5-protected-neon-seven-family-baseline.json).
The V5 count coincidence (1,452 / 1,452) is not an identity proof.

## Exact original public-source cohort

Original LRL source run
[#38066441841](https://github.com/killjoy00/votepredict/actions/runs/38066441841)
created four immutable-source metadata artifact ZIPs, all separately pinned by
ZIP digest and JSON SHA in
[source-proof/senate-2022-25-committee-original-minutes-source-ledger.json](./source-proof/senate-2022-25-committee-original-minutes-source-ledger.json).
The protected job downloads **exactly those historical-run artifacts** and validates
each extracted metadata JSON file SHA-256 and historical year/counts *before*
selecting any Neon connection. No fresh web replay or raw PDF is used.

| Official electronic source year | Original PDF URLs | Independently original PDF-byte hashed | Original PDFs without usable source text/hash in pinned action manifest |
|---|---:|---:|---:|
| 2022 | 325 | 204 | 121 |
| 2023 | 454 | 432 | 22 |
| 2024 | 258 | 245 | 13 |
| 2025 | 415 | 364 | 51 |
| **Total** | **1,452** | **1,245** | **207** |

There are 1,451 linked meetings, since one original indexed 2023 hearing links two PDFs.
The 207 missing original PDF-body hashes in the pinned *parser artifact* remain
**source-document verification holds**, not null stored rows and not proof of a missing
document. Do not interpret them as the absence of recorded votes. A newer source
recovery must be separately authenticated and pinned before use.

## In-transaction comparison, never a private export

The one-shot [workflow](../../.github/workflows/senate-864-source-to-neon-parity.yml)
runs same-repository PR safety tests, then compiles its three immutable
SELECTs with `EXPLAIN` **without** `ANALYZE` on disposable PostgreSQL after actual
migrations. The exact main commit must independently pass that gate, the full
`npm run check`, production dependency audit and original SHA manifest preflight
**before** the protected key can be accessed. A unique merge-commit marker
authorizes precisely one first-attempt protected main-run. Pull requests have no
Neon credentials.

The protected job authenticates the **existing VotePredict** default branch and
database and proves the selected session has `transaction_read_only=on`.
Its only private data access is fixed, bounded:

1. Senate committee-minute source document id, original URL, recorded hash and meeting/committee metadata (at most 2,200).
2. Committee vote event id, source reference, exact external key, hearing day, yea/nay tally (at most 600).
3. Committee individual member choice, source normalized name and associated membership id (at most 4,000).

The comparison joins public original PDF identity, SHA-256 of **raw source PDF bytes**
(the ingestion uses the same `pdf.contentSha256`), exact committee and meeting date,
source-recognized event external keys/tallies and per-choice
`sha256(choice + ':' + normalizedName)`. Individual names are only used in memory.
The original PDF parser's recognized candidate rolls and name tokens are **not**
a complete official roll-call denominator. A stored database event not recognized
by the older source parser is **a review discrepancy, not automatically a false event**.

The source comparator returns **fixed numeric counts only**: original URLs found,
stored duplicates/extras, SHA/date/committee mismatches, precise recognized roll
matches and original named tokens matching a non-null stored membership.
`ROLLBACK` must complete before the sanitized result may leave the protected job.
A separate **keyless** job posts strictly validated numeric counts to #864.
No raw database rows/URLs/names/donations/PDF bodies are uploaded as artifacts or
issue comments. A failed SHA preflight, query/truncation, transaction, reconciliation,
or rollback is **HOLD**, not zero-match data.

## Interpretation and remaining separate holds

This comparison includes **2022–2025 original electronic minute PDF URLs** only.
The 2021 print-only collection, possible 2022 print/electronic differences, electronic
index's 141 unlinked meeting entries, any missing officially documented motion,
and the source parser's unrecognized actions remain unresolved. It does **not** scan
`evidence_items` for voice/unanimous/result-only context actions; those must be
compared separately using a bounded source-specific index strategy. A non-null
stored membership ID does not itself establish the correct historical term identity.
The Neon project/default branch is not yet independently tied to the deployed
production application's active connection.

Campaign-finance statutory report release dates, finance transaction proof,
campaign-site office/capture dating and named media quotations also need their
own source-specific comparisons. None of this authorizes data modification,
forecast eligibility, or closure of #864.

**Status:** the V5 prior snapshot is verified; this exact source comparison is
implemented and pending independently passing CI and a newly successful protected
run. This document must not be revised to report actual parity without quoting
the sanitized protected receipt for that exact run.
