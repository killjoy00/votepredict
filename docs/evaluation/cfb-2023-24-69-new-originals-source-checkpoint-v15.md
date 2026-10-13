# #864 — targeted 69 original 2023–24 Senate year-end CFB report source-proof expansion (V15)

This is a **source-only 2023–2024 original PDF acquisition** for 35 previously source-observed principal Senate candidate committee registrations. It continues the verified V12 25-person, 229 official version-reference/223 authenticated PDF body baseline. It does not replace V12, rewrite finance records, imply an exact historical public-by date, or establish complete legal filing obligations.

## Why this tranche

A separate October 12 source rejoin of original official Legislative Reference Library Senate service facts and archived CFB Senate registration/report viewer acquisitions identified 95 people who served at least part of 2021–25 and 693 exact report-version references within the sampled historical election viewer segments. **464** of those references did not have a distinct original PDF in V12's selected source panel. **69** are previously unverified ordinary (non-special) original 2023/24 year-end report IDs with verified source-observed official CFB Senate registrations for principals serving in the corresponding report year: **34 in 2023, 35 in 2024**. The additional 2024 special-election annual original for Ann Johnson Stewart is deliberately not treated as an ordinary calendar-year YE original; special-election PDF types require their own period and calendar checks.

The permanent [35-registration target manifest](source-proof/cfb-2023-24-35-senators-69-yearend-original-source-targets-v15.psv) preserves exact principal identity, office district, original full official candidate-viewer API body SHA, selected report years, and a separate `reviewed_name_variant_same_office_district` marker for five previously identified historical name variants. Source identity of a report PDF (registration/district/period/receipt) does not independently resolve the nickname equivalence or establish every historical committee lifecycle.

## Independent official source gates

1. Recheck the original **396 exact CFB reports-tab source observations** against its repository-pinned original response-ledger SHA-256 and metadata, use only the 2024 viewer segment and the 35 specifically selected registration numbers.
2. Rebuild the **69 exact official IDs** (`registration:23|24:pcc:YE:0:0`), require every one in the source-verified viewer reference inventory, and reject any already in the V12 229-version PDF ledger.
3. In the PR-only source workflow, refresh the official candidate reports-tab endpoint and require **exact same original API SHA-256 and exact report reference** before any PDF fetch; hold drift or unavailable source, never fabricate a missing record.
4. Download the **complete** report PDF in ephemeral workflow memory through the established official CFB PDF viewer, validate PDF magic, full original byte SHA-256 and size, and parse the original first-page report type, committee registration, printed district, year-end coverage and Board receipt. The existing project strict year-end form-header parser classifies source anomalies as **HOLD**, not authenticated.
5. Preserve `boardReceivedOn`, applicable annual report due date (2023 YE due 2024-01-31; 2024 YE due 2025-01-31) and the conservative **not-before date** separately from `historicalPublicByOn=null`. Under [§10A.20 subd. 1b](https://www.revisor.mn.gov/statutes/2024/cite/10A.20), an ordinary report is nonpublic until **8 a.m. the day after it is due**. That legal boundary and a form's Board receipt do **not** demonstrate which exact original binary was publicly available at any historical vote cutoff. After-due amendments are not original filings and cannot be treated as if present in the original.
6. Retain all exact source failures and variant identity statuses; do **not** leak PDF body text, donor data, candidate contributions, financial row values, credentials, or non-serving candidate detail in artifact output.

## Executable work and acceptance

- [Source-only acquisition script](../../scripts/capture-cfb-864-69-new-2023-24-yearend-originals-v15.mjs)
- [Adversarial offline tests](../../tests/cfb-864-69-new-yearend-originals-v15.test.mjs)
- [Dedicated PR workflow](../../.github/workflows/senate-864-cfb-69-new-yearend-originals-v15.yml): `offline-fixed-source-identity-tests` then `live-original-pdf-source-only`
- Safe output: `artifacts/cfb-864-69-original-pdf-proof-v15.json`; only source metadata, enums, original source PDF SHA/size/receipt/yearend dates, and aggregate receipt. GitHub Actions source ZIP retention 30 days. **Do not count the live acquisition as successful before inspecting its actual result and artifact.**

Strict authenticated status requires exact official viewer provenance and all original PDF first-page checks. A tested HOLD due to HTTP/transport, PDF identity or date mismatch preserves the exact version ID and source check and does not count as a missing filing. No eligible historical publication proof or statutory obligation denominator is generated, and source PDFs are not uploaded.

## Next incremental stages

Upon independent source workflow review, pin the **actual** SHA/byte metadata for authenticated results in a new immutable output ledger, retaining held/alias cases; then acquire **amended versions whose original parents are authenticated**, compare report header and later receipts, and separately evaluate aggregate financial summaries where the full source original is accessible in an explicitly reviewed offline job. After 2023/24 groups, prioritize the much larger 2022 genuine serving-year report bodies; do not restart failing 2022 Common Crawl bulk CSV probes. Stop when a source route fails the same exact technical gate twice without a different method; do not relabel `UNKNOWN` as zero.

## Excluded

No private/production Neon, stored transaction parity, serving/forecast/model changes, backfills, scheduler, deployment, outreach, 2027 work, outside emails or public-office contacts. Parent issue #864 remains open. This is not a 95-person committee-year legal-filing denominator.
