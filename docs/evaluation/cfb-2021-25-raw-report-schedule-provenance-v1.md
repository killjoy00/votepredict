# #864 CFB raw schedule provenance: transaction-to-disclosure linkage

**Scope:** Existing Minnesota Senate candidate committee disclosures, 2021–2025, from the 830 official indexed version identities (813 distinct SHA-256 PDF bodies). This is an additive source collection lane. Independent expenditures remain a separate family and **never** inherit a candidate committee report.

## Source basis and provenance

The version IDs, official source URLs, expected full-PDF byte lengths and original government SHA-256 hashes come from migration 0014 and the immutable V41/V46 ledger. Capture rejects a byte mismatch or non-CFB host. The first verified body for a SHA is cached in `cfb_finance_pdf_body_captures`; amended aliases that have identical bytes reuse the body but retain their own version identities.

`cfb_finance_report_schedule_pages` keeps raw extracted page text and original page numbering. `cfb_finance_report_schedule_captures` stores each report version's report-period values when visibly printed, original/amended designation, complete raw extracted report/schedule text, fetch timestamp and extraction status. `cfb_finance_report_schedule_entries` stores candidate transaction lines with a page/line locator, printed date and amount and raw line. Source data stay in protected Neon, never in GitHub logs or issue comments.

`cfb_finance_report_transaction_links` is keyed by **version + candidate-finance family + committee registration + transaction year + existing canonical `rowKey`**. Exact linkage requires the relevant contribution/expenditure schedule section and a single printed entry jointly containing the existing bulk row's transaction date, amount and full counterparty. A date and name found anywhere in the report are insufficient. If multiple schedule entries fit a row, or multiple canonical keys compete for a single entry, the result is explicitly ambiguous. Otherwise it is unmatched. The same canonical row may link to original and amended versions independently; same-body aliases are not collapsed.

`cfb_finance_bulk_archive_row_observations` separately records only previous exact archived-bulk-row evidence with a matching immutable bulk source SHA. It is **not** proof of membership in a PDF version and never changes `published_at`, `asOfEligible` or historical dating assumptions.

This parser intentionally favors precision over recall. It does not assume every PDF layout is machine-readable. Scanned PDFs enter the OCR-needed backlog; split-line layouts may remain unmatched even when the report contains the transaction. No handwriting review, Isaacson-total guesses, donor influence analysis or forecast features are in scope.

## Running and resuming

A PR runs no-secret synthetic matching tests and schema/constraint checks against ephemeral localhost PostgreSQL (all fixtures rolled back). On an independently checked, first-attempt main merge carrying `SENATE_864_CFB_RAW_SCHEDULE_LINKS_V1`, a protected GitHub Actions job verifies the existing VotePredict Neon project/default branch/primary and migration checksums, creates only the additive finance provenance tables, and processes up to 830 still-unprocessed versions. It prioritizes 2025 and committee-years with existing candidate transactions; failures remain retryable. Rows and body captures are idempotent. Any future reviewed main merge containing the same marker can resume the remaining backlog; no manual workflow dispatch or new credentials are required.

The protected runner reports **only aggregate integers**: current finance evidence copies and distinct canonical transaction keys; verified body captures, report extractions, OCR backlog and remaining reports; exact links and distinct linked keys; ambiguous/unmatched report–transaction pairs; and independently archived bulk-row observations. No donor/vendor names, source URLs, original rows, committee IDs, or financial amounts go into public artifacts.

The original V48 audit's 58,555 eligible evidence copies without version references is **not** the unique transaction count. All production counts must be read from the protected post-backfill receipt and must not be fabricated from the original audit.

## Existing data/serving boundaries

No changes are made to `source_documents`, `evidence_items`, candidate finance bulk extracts, eligibility metadata, `published_at`, source-date confidence, other agents' raw collectors, model weights, forecasts, or serving. A transaction date is not a disclosure date; a verified PDF body and match proves present-day report containment only, not when that exact original/amended body first became public.
