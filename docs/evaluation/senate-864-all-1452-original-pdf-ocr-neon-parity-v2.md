# #864 — complete 1,452 original committee Minutes PDF SHA-to-stored-Neon read-only reconciliation (V2)

## Verified predecessor result (not an estimate)

The exact original-to-Neon V1 transaction [run #38199687178](https://github.com/killjoy00/votepredict/actions/runs/38199687178)
completed all three SELECTs inside an enforced `REPEATABLE READ READ ONLY` transaction,
explicitly `ROLLBACK`ed, and posted this independent
[sanitized result receipt](https://github.com/killjoy00/votepredict/issues/864#issuecomment-6117215492).
The complete result has been preserved in
[source-proof/senate-864-v1-protected-committee-source-db-parity-receipt.json](./source-proof/senate-864-v1-protected-committee-source-db-parity-receipt.json).

- Original Senate electronic minutes source URLs, 2022–2025: **1,452**.
  All **1,452** uniquely matched a stored minutes source URL; no missing, duplicate,
  or stored outside-cohort documents.
- Of the original **1,245** previously text-parsed independent government original
  PDF SHA-256s, **1,245** equal their exact stored source content SHA-256. Zero
  original PDF byte-hash/date/committee mismatches were reported.
- **134/135** originally recognized candidate roll-call events were exact source
  external-key/tally/hearing-date/choice-digest matches. The sole discrepancy is
  a **2024 named-choice roll**. Its source has **10 name-choice tokens**, all ten
  conservatively excluded from the fully matched token count; **not** ten
  independently missing persisted choices. The 2024 stored count is 227 choices,
  and the initial original embedded-text source manifest holds 228.
- No persisted in-scope committee event was found lacking a source link.
- **207** electronically indexed Minutes PDFs had originally little embedded text.
  They were already OCR-extracted in independent earlier research tracks.
  V1 checked their original URL and meeting date only, not their PDF SHA.

## New precise original source cohort

The 16 independent OCR JSON metadata artifacts from original source runs
[#38068730892](https://github.com/killjoy00/votepredict/actions/runs/38068730892),
[#38069432305](https://github.com/killjoy00/votepredict/actions/runs/38069432305),
[#38073521109](https://github.com/killjoy00/votepredict/actions/runs/38073521109),
and [#38075234242](https://github.com/killjoy00/votepredict/actions/runs/38075234242)
are retained in the original-source ledgers. This V2 program contains their **exact
artifact ID, original-run ID, JSON filename, and independently authenticated
SHA-256 digest**. It requires every JSON SHA to match **before touching Neon**;
it does not recontact LRL or recreate source material.

The fixed OCR proofs must correspond one-to-one to the exact 207 *original
source URL/meeting-day/committee* holds in the original four 2022–25 action
artifacts; matching only the OCR counts is not enough. Verified source distribution:
2022=121, 2023=22, 2024=13, 2025=51. The merged source contains exactly
**1,452 independent original raw PDF content hashes**; source hashes of OCR text
are **never** substituted for raw government PDF hashes.

The merged original source parser has **152 fully detailed candidate roll records**
with original external keys, numeric tallies and per-choice SHA-256 identity tokens.
A further **single 2025 Judiciary roll**, recovered in the eight-original second
OCR sample, has only an original external key and **8 named-choice *count* tokens**:
that source artifact never retained the original tally or the individual name-choice
fingerprints. V2 will check the stored source URL/hash/hearing date, event external
key and stored choice row **count** only, while keeping the tally/individual identity
unverified. Those 8 tokens are **NOT** counted as eight exact matching choices.

Across all government electronic original PDF parser observations the fixed source
candidate groups are 153 roll calls and 989 named-choice tokens. These do **not**
form an independently complete official denominator of all motions, recordings,
2021 print minutes, or meetings without linked Minutes PDFs.

## Enforced GitHub and Neon security

Use [the protected one-shot workflow](../../.github/workflows/senate-864-complete-ocr-source-neon-parity.yml)
only after independently passing same-repo PR tests and disposable PostgreSQL
migrations/`EXPLAIN` without `ANALYZE`. Its `main` pre-secret job must
re-run the full `npm run check` and dependency audit on the reviewed exact
main commit, then download and SHA-verify the exact 4 original plus 16 OCR
metadata artifacts. An authenticated new one-time merge marker cannot be used
from a pull request or a GitHub Actions rerun.

The protected job reuses the already working VotePredict **existing GitHub Neon
Management API key and correct Neon default branch**, not an unrelated project,
a new database or a new role. It executes only the same three previously reviewed
bounded source/event/member SELECTs, compares public source provenance and
private stored row attributes **inside the transaction in memory**, and explicitly
`ROLLBACK`s before exposing **only fixed sanitized numerical aggregates**.
Source URLs, names, normalized member names, choice digests, original PDF bodies,
private row IDs and credentials are not emitted.

The 2024 one-roll named-choice issue is decomposed into counts of original tokens,
persisted tokens, matched original-to-stored choice digest tokens, and unmatched
tokens. These numbers can establish whether a particular persisted choice token
is actually absent or mislabeled without exporting a senator's private row
identity. This is **diagnostic only**, with no live writes or feature promotion.

## Remaining holds, including if V2 returns 100% PDF hash parity

- The selected Neon **default branch** is not independently established as the
  actual deployed production app's current database.
- The independent official Senate committee corpus for 2021 is print-only;
  2022 print/electronic equivalence is not established.
- **141** meetings in the independent electronic 2022–25 index have no linked
  Minutes PDF; even the source parser's recognized actions within linked
  PDF sources are not an exhaustive official vote/motion denominator.
- Context-only voice/unanimous/result motion evidence-item rows and historical
  membership/date/identity joins still require a separate bounded audit.
- Finance filings/transactions, campaign-site source dates and speaker-attributed
  media context/quotes are separate original-source-to-Neon cohorts.
- No proof of historical exact public-by timestamp, forecast feature eligibility,
  live repair authorization, all-official-vote completeness or issue #864 closure.

**Status:** V1 is verified above. V2 must remain **UNVERIFIED** until its
new exact reviewed protected run and separately keyless sanitized issue
receipt actually succeed. Do not reinterpret the original raw source PDF hash
coverage as source completeness or live production audit coverage.
