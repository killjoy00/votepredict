# #864 finance — tracing exact Board termination history for Drazkowski #18763 and Anderson #17362

**Read-only original-source inquiry, October 11, 2026.** This scope is Minnesota CFB campaign finance exclusively. The prior permanent original [22-person current viewer source matrix](source-proof/cfb-2023-24-22-committee-signed-board-contemporaneous-status-matrix.psv) independently authenticated Steve Drazkowski #18763 (2022 Senate district 20) and Bruce Douglas Anderson #17362 (SD29) as *currently labelled "Terminated" in the 2026 CFB candidate viewer*. That status does **not** date the legal registration end, identify a 2023/24 final report, or establish which historical year-end reports were owed.

## Original independently proven historical anchors

Both actual senators have original CFB 2023 and 2024 year-end financial-report PDF identities already acquired and authenticated in the immutable [71-version finance corpus](source-proof/cfb-2023-24-served-22-71-yearend-version-statutory-release-bounds.psv):

| Committee | 2023 YE original PDF, Board receipt | 2024 YE original PDF, Board receipt |
|---|---|---|
| Drazkowski #18763 | PDF SHA-256 `2a2cde28e5377721c3e1b3d6e77a68ace986b5e7168ee2106dbd9bee9709229d`, received January 26, 2024 | SHA-256 `c9a08472296629e40a485bc37a548501176981228d6f77a1203292ced299c15b`, received January 23, 2025 |
| Anderson #17362 | PDF SHA-256 `bb525cbc1b6c795e494ce0d354fa151d208000f4ff61353bfa4dffac270b643c`, received January 27, 2024 | SHA-256 `3d59319464c7a9335220abe8cc16f7e9b9e896445feb39e57b92ddbed76a3572`, received January 14, 2025 |

Original state Department of Revenue annual *political contribution refund* reports also independently list both exact registration-number/person pairs in their 2023 and 2024 retrospective tables (merged source proof PR #1147), but these are **refund observations, not original Board registration/termination events**.

The original [CFB §10A.243 voluntary termination instructions](https://register.cfb.mn.gov/filer-resources/complete-a-filing/campaign-finance-filings/termination/) require a final finance report after disposing of assets above the permitted threshold. Historical §10A.245 also allows administrative termination of **inactive** principal committees only with Board notice and the requisite waiting period (prior original statute source PR #1135). The current CFB candidate heading alone cannot distinguish these paths or fix their dates.

## Independent next source probe

The repeatable read-only [original candidate source workflow](../../.github/workflows/cfb-two-terminated-senate-original-2025-26-reports.yml) fetches the original current official HTML for **both** exact committee registrations, captures its SHA-256/bytes/current status, and independently acquires the original **2025/2026 CFB candidate reports-tab API** for each (entire returned exact version index and original API response SHA). It then fetches up to 16 original official report PDFs per committee, retaining only exact version key, full original binary SHA256, byte size and a conservative classification of original form text/receipt. No raw PDF, raw HTML, named donations, addresses or financial rows are persisted.

A checkbox label such as "Termination Report" printed on an UNCHECKED standardized filing form is **not evidence a final termination report was submitted**. The source validator deliberately returns **NULL** for a legal termination act/date even when those words occur in the PDF. A historically signed final Board report with clear selection and receipt, or official dated termination/acceptance record, must be separately authenticated before promoting any committee-status date. The report receipt and live 2026 display are not historical exact-version public-by evidence.

The original CFB 2023/24 **71 distinct references, 68 independently authenticated PDF bodies, two first-page identity HOLDS and one same-PDF alias** remain immutable. **0/71** historical exact report-version public-by proven. The **2023/24 committee-specific filing-duty denominator remains unknown**, irrespective of current status.

**No source data, production DB, model/training, serving, scheduler, 2027 scope, campaigning or candidate policy research. Keep umbrella issue #864 OPEN.**