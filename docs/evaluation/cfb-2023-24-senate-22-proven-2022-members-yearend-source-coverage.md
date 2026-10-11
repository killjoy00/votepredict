# Minnesota Senate 2023–2024 CFB original year-end report version source coverage

Issue **#864**, campaign-finance **public-source evidence only**. Observed 2026-10-11 from authenticated original Minnesota Campaign Finance and Public Disclosure Board (CFB) candidate-reports viewer and downloaded PDF bodies. This is **not** a statewide filing-obligation census, a 2023/2024 Senate membership census, a historical public-by reconstruction, or a source-to-production transaction import.

## Scope and independent identity rules

The bounded source panel contains **22 independently proved actual Minnesota senators serving in 2022**, with confirmed official CFB principal committee registrations in the sampled district range (2022 Senate districts **14–30 and 32–36**). The earlier SD31 historical identity is unresolved and excluded. Their official **2024-segment candidate viewer** reports-tab responses supply 2023 and 2024 year-end report version references. Report year 2023 or 2024 **does not prove** the politician remained a serving senator at that future date. A CFB viewer version index **does not prove** a separate PDF binary, legally owed filing, original publication date, or financial transaction row.

Original CFB PDFs were independently verified against the real 2022-serving person's committee registration, printed Senate district, report name, covered period and Board receipt using source byte SHA-256; amendments were joined to a previously independently SHA-authenticated original version and also verified from their own PDF first page. **A held first-page identity is never promoted merely because the report viewer returned a valid PDF.**

## Precisely bounded version accounting

| Report year | Official original YE version refs | Source-authenticated unique original YE PDFs | Original source identity holds | Official amended YE version refs | Source-authenticated unique amended YE PDFs | Amended source identity holds | Duplicate amended viewer-to-PDF aliases |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2023 | 22 | 21 | 1 | 10 | 9 | 1 | 0 |
| 2024 | 22 | 22 | 0 | 17 | 16 | 0 | 1 |
| **Both years** | **44** | **43** | **1** | **27** | **25** | **1** | **1** |

**68** unique actual original and amended finance PDF binary SHA-256 fingerprints in these 2023/24 samples: **30 from 2023** (21 originals + 9 amendments) and **38 from 2024** (22 originals + 16 amendments). All 68 distinct authenticated binaries were rejoined across the four original CFB source PDF ledgers and verified to have **no duplicate SHA across the original/amendment cohorts**. The 2023/24 version-reference queue has no remaining **unacquired** original or amended version IDs **within this precisely sampled 22-committee 2024-segment reports-tab inventory**. It would be incorrect to infer a statewide or statutory denominator from that statement.

| Evidence cohort | Official source CFB version references | Distinct authentic PDF bodies | Non-authentic source identity holds | Viewer-index aliases | Proof |
| --- | ---: | ---: | ---: | ---: | --- |
| First 14 2022-serving senators' 2023–24 originals | 28 | 28 | 0 | 0 | [Original source ledger](source-proof/cfb-2023-24-verified-served-28-original-yearend-pdfs.psv) |
| Eight separately recovered 2022-serving senators' 2023–24 originals | 16 | 15 | 1 | 0 | [Recovered original PDFs](source-proof/cfb-2023-24-eight-more-16-original-yearend-pdf-source-ledger.psv) |
| First cohort's 2023–24 amendments | 16 | 14 | 1 | 1 | [Amendment original PDF ledger](source-proof/cfb-2023-24-parent-authenticated-16-amendment-pdf-source-ledger.psv) |
| Eight separately recovered 2022-serving senators' 2023–24 amendments | 11 | 11 | 0 | 0 | [Eleven original amended PDFs](source-proof/cfb-2023-24-eight-verified-senators-11-amended-original-pdf-source-ledger.psv) |

## Confirmed exceptions: keep source identity and version index separate

**Andrew R. Lang, 2023 original YE, `17994:23:pcc:YE:0:0`: HOLD.** Official-source PDF SHA `34022e5691aca08f318436ecbc30a1b3e2d5a32c2ad11a19ee0d64fb77443aba` (381,617 bytes). The text contains the expected registration digits elsewhere, but no matching printed `Registration Number:` field in the first 6,500 normalized characters, the Senate district header does not match SD16, and the Board receipt `2023-12-29` predates the claimed reporting end `2023-12-31`. These facts do **not** authenticate a 2023 original YE filing.

**Aric Putnam, 2023 YE amended index 1, `18430:23:pcc:YE:0:1`: HOLD.** Official-source PDF SHA `5da25294735f3b7b62608755df926b38917a69aaf90b13c9999396de0d710c54` (149,845 bytes). The district matches SD14 and covered period/Board receipt `2024-04-04` are consistent with a later 2023 YE report, but first-page printed committee registration remains unverified. The expected registration digits occur elsewhere in extracted text. Neither occurrence nor a correct official viewer API ID alone authenticates the printed first-page registration. This **is not** an authenticated amended finance form.

**Aric Putnam, 2024 YE amendment indices 1 and 2: one PDF, two official viewer IDs.** `18430:24:pcc:YE:0:1` and `18430:24:pcc:YE:0:2` both return identical PDF SHA `ff7e8200925b80a6983b00ac17c7dfe1b6a9be746c7754b0055a7dc94dbb5f03`, 30,355 bytes, Board received `2025-04-10`. Preserve both official reference IDs, count **one** authenticated amended form.

A separate read-only [GET/POST structural analysis](source-proof/cfb-2023-24-two-held-original-source-get-post-identity-diagnostics.psv) verified that both held CFB source bodies are byte-identical via the official GET and POST methods. This excludes a simple retrieval-method mismatch but **does not** resolve either identity HOLD.

## Historical clocks and next original public-source research

Original PDF Board receipt is not necessarily the actual CFB public publication date. Nor does a report appearing in a 2026 retrieval prove that it existed in the public feed by an earlier 2021–25 forecasting cutoff. Statutory due dates, applicable committee registration/termination/exemption predicates and any statewide **legally required** report count must be established independently from original applicable law, filing instructions, public histories and dated records; the proof above has no such denominator. Other actual 2022-serving Minnesota senators outside the 22-case cohort and 2025 actual special senators must be audited on their own original records. The original two held PDFs require structural/manual first-page identity investigation without fabricating a committee filing. Do not infer source finance rows in any prediction database without separate exact source-to-row reconciliation and as-of proof.

All research here remains metadata-only and historical; no production database read or write, training, model, serving, scheduler, Vercel/Neon production action, candidate contact, or 2027 program is authorized. **Keep issue #864 open.**

## Source chain

The original source checkpoints are [28 original PDFs](source-proof/cfb-2023-24-verified-served-28-original-yearend-source-checkpoint.json), [15 + held original PDF](source-proof/cfb-2023-24-eight-more-16-original-pdf-source-checkpoint.json), [14 + alias + held amendment PDFs](source-proof/cfb-2023-24-parent-authenticated-16-amendment-source-checkpoint.json), and [11 original amendment PDFs](source-proof/cfb-2023-24-eight-verified-senators-11-amendment-original-source-checkpoint.json). Exact CFB viewer references, source bytes, original parent SHA and unverified historical-publication status remain separately recorded in each proof ledger.
