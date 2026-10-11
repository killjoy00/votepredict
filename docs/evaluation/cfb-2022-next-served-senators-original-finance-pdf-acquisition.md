# #864 Finance Track A — new 2022 Senate-serving candidates' original reports (SD13–24)

This is a **new source-acquisition cohort**, not the existing [24 original 2022 PDFs from SD1–12](source-proof/cfb-2022-senate-24-original-ce-pdf-source-checkpoint.json). Research exclusively individuals independently proven to have **actually served** in the Minnesota Senate; exclude even election candidates who never served. Do not conflate a general-election winner with pre-election prediction knowledge.

## What the new acquisition verifies

The [PR-only workflow](../../.github/workflows/cfb-2022-served-d13-24-original-ce.yml) retrieves and checks all of the following independent public originals before downloading a named individual's PDFs:

1. Original November 8, 2022 Secretary of State **Senate general-result bytes** (previous independent SHA-256 proof `eb898024…`, all 67 districts). The winning result is used **only for retrospective identity selection**, never as a 2022 as-of predictive feature.
2. Original official [LRL Senate service directory](https://www.lrl.mn.gov/legdb/senate_dir) HTML with its actual 2026 acquisition timestamp. Candidate must be unique against official service identity and have actual SD-specific **2023** Senate service, not merely a winner-list appearance.
3. Twelve original CFB Senate district candidate roster HTML pages, **2022 viewer segment**, for SD13–24. Exactly one CFB candidate label must match the independent SOS winner by district and defensible given/family-name identity.
4. Previously hash-pinned [494 registration ID index](source-proof/cfb-2021-25-senate-district-registration-source-checkpoint.json), [396 original CFB reports-tab API source-response ledger](source-proof/cfb-2021-24-senate-396-original-viewer-source-observations.psv), and previously authenticated [SD1–12 report ledger](source-proof/cfb-2022-senate-24-original-ce-pdf-headers.psv). A matched registration must have a documented original-version 2022 **C** and/or **E** reference, must appear in the original 270-registration 2022 viewer segment, and must not duplicate a previously verified PDF.
5. Live original reports-tab API snapshot with **unchanged SHA-256** from the pinned 2026 source ledger and the exact matching PDF version key. Independently acquire each *actual* source PDF, verify PDF magic/binary hash and original first-page principal campaign committee, Senate district, registration, report covered-through and Board receipt.
6. Independently authenticated original [2022 CFB Senate/House disclosure calendar](https://cfb.mn.gov/pdf/publications/elections/candidate_packets/2022/House_2022.pdf) (previous official original binary SHA-256 `3fd62638…`). Pre-primary C: coverage ends July 18, due July 25. Pre-general E: coverage ends October 24, due October 31.

All extracted original PDF content is ephemeral. Output is **metadata-only**: in-scope senator identity, source URLs/hashes, original acquisition timestamps, report coverage and received dates, statutory due date, conservative legal not-before bound and tight booleans about parser diagnostics. It contains **no donors, payments, financial amounts, report text, home addresses, raw election result rows or never-served candidate names**.

A skipped district means **source, service, registration, or reference matching was not established by this bounded research**, never that no campaign, filing, report or service existed. Source HTTP failures retain a dated bounded diagnostic. All original publication/public-by dates remain **unknown** unless independently corroborated; legal eligibility floors are NOT proof of actual historical publication. A report viewer's amendment index zero does not independently authenticate an unamended checkbox.

## Scope, acceptance and follow-up

The source run may select **fewer than twelve** actual served members and **fewer than twenty-four** reports when original person/registration/pdfs do not match; it never fills missing cases with non-serving candidates. The PR source job fails closed on an unsuccessful selected original PDF, changed original API source or unverifiable calendar. The GitHub metadata artifact expires after 30 days and should be pinned in a short follow-up source-checkpoint PR after source success.

Track B (legal filing requirements, historic committee registration/termination, nonfilers) remains **separate** and must not prevent acquisition. This cohort does not certify a statewide filer/report denominator, historic public-by availability, financial row ingestion/completeness or production evidence eligibility. No credentialed Neon/Vercel access, model/serving changes, backfill, scheduler or 2027 expansion. [Issue #864](https://github.com/killjoy00/votepredict/issues/864) stays **OPEN**.
