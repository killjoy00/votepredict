# #864 — 298 exact 2021–25 official CFB report versions across 51 verified serving-senator committees (V19)

**Owner-selected research scope:** official committee identity, original and amended exact report versions, complete original PDF content fingerprint, reporting period, Board receipt and independently authenticated historical public-by if recovered. **Excluded:** statewide legally owed/received filing-duty denominator/nonfilers, bulk finance source-transaction comparisons, older stored filing-derived eligibility repairs, outside contact, private DB/production changes, forecasts/serving/training, schedules, 2027.

## Independently source-authenticated new result

The [298-row exact CFB PDF-version permanent ledger](source-proof/cfb-2021-25-51-actually-serving-principals-298-exact-report-version-pdfs-v19.psv) consolidates previous independently authenticated V12 229 → V16 255 → V19 298 official viewer version references, without rewriting earlier source proof. [V19 source-only reconstruction](../../scripts/audit-cfb-864-298-exact-reports-51-serving-principals-v19.mjs) regenerates every entry from previous original CFB PDF source ledgers and the newly acquired 43 original CFB report versions. It verifies full official PDF hashes, source viewer SHA, exact committee registration, original/amended version index, reporting period, Board receipt, original disclosure calendar dates and authenticity/hold/alias statuses.

| Report year | Original refs | Amended refs | Authenticated unique original PDF SHA256 | Source identity holds | Identical-PDF viewer-ID aliases |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2021 | 17 | 13 | 29 | 1 | 0 |
| 2022 | 91 | 43 | 133 | 0 | 1 |
| 2023 | 35 | 19 | 49 | 5 | 0 |
| 2024 | 35 | 25 | 58 | 0 | 2 |
| 2025 | 12 | 8 | 19 | 0 | 1 |
| **TOTAL** | **190** | **108** | **288** | **6** | **4** |

**298 official version IDs ≠ 298 distinct signed source PDFs.** Six source first-page committee-registration identity HOLDS and four aliases of separately authenticated exact byte-identical PDFs leave **288 distinct independently original-source-authenticated PDF bodies**. Not a complete statewide census of legally required/received filings.

### New original 2023–24 annual report PDF full-body proof

The [V18 source acquisition](cfb-2023-24-thirteen-serving-senators-yearend-version-pdf-v18.md) used original CFB candidate committee IDs verified against 2021–25 official actual Senate service. Exactly **13 new** independently verified serving-senator registrations were selected for ordinary 2023/24 original and amended year-end PDF acquisition. Two separate original-CFB-government full-PDF source runs independently reproduced the **same 43 version references, full SHA256 binary hashes and source API SHA**:

- [First 43 original full PDF acquisition](https://github.com/killjoy00/votepredict/actions/runs/38455766999)
- [Second 43 original full PDF acquisition](https://github.com/killjoy00/votepredict/actions/runs/38456123723)

[Permanent 43-reference source PDF metadata](source-proof/cfb-2023-24-thirteen-served-43-original-amended-yearend-pdfs-v18.psv) and [independent 13 viewer API + full-PDF repeated-proof checkpoint](source-proof/cfb-2023-24-13-serving-original-amended-source-checkpoint-v18.json) prove: **25 original PDF binaries, 14 amended distinct PDF binaries, one byte-identical indexed alias, three first-page committee registration identity holds**. None of the 39 new authentic distinct SHA256 bodies duplicates the earlier 249 original-source-authenticated PDFs.

New original first-page registration-source HOLDS: **Kelly Morrison 18809:23:pcc:YE:0:0 and 18809:23:pcc:YE:0:1**, **Bill Lieske 18910:23:pcc:YE:0:1**. All three CFB PDF source binaries have SHA/size and original reporting period, Board received and Senate district diagnostics, but **the strict printed committee registration extraction fails**. Neither page's date nor district verifies the exact CFB registered form. Their strict report period, Board received and source-specific legal floor stay blank/unknown in the V19 certified report row; partial diagnostic is preserved separately in V18 checkpoint. They are not declared absent or nonfiling.

Three older source identity HOLDS remain Aric Putnam 2021 first amendment (18430:21:pcc:YE:0:1), Andrew Lang 2023 original (17994:23:pcc:YE:0:0), Aric Putnam 2023 first amendment (18430:23:pcc:YE:0:1).

The four official index aliases are John Hoffman 2022 second-to-first amendment (17319), Aric Putnam 2024 second-to-first amendment (18430), Erin Maye Quade 2024 third-to-second amendment (18724), and Michael Holmstrom Jr 2025 first amended viewer index returning the same signed binary as the 2025 original index (19229). These are **official ID references**, not additional distinct financial PDFs.

## Senator-by-senator actual-serving coverage versus statutory filings

The original Minnesota Legislative Reference Library service directory and special service/oath original sources independently prove **95 different people served Minnesota Senate at some point in 2021–2025**, without claiming every person continuously served on every day. The complete permanent [95-person PDF version coverage crosswalk](source-proof/cfb-2021-25-95-serving-senators-51-source-authentic-CFB-report-principals-v19.psv) now identifies **51** serving senators with a separately full source-authenticated CFB registered principal committee and at least one source-verified original or amended PDF version, up from 38. There are **44 people not yet covered by the selected fully authenticated PDF version ledger**. This is NOT evidence they failed to file, had no committee, were not registered, or legally owed any specific report. [V17 official candidate selector archive](cfb-2021-25-95-served-senators-official-CFB-registration-crosswalk-v17.md) independently identified CFB candidate registry registration leads for all original 57 not in V16 PDF evidence cohort: 52 exact original CFB first/name and serving-district matches and 5 first-name identity HOLDS. The 13 added here are a verified PDF subset of those leads.

**Historical exact public-by remains 0 of 298 proven, meaning UNKNOWN for all; not absence of publication.** A later 2026 fetch of a full signed government PDF, Board receipt, original filing due day and Minn. Stat. 10A.20 subd.1b 8 AM next-day nonpublicity gate do NOT prove when that exact full original or amended PDF was anonymously accessible in a historical vote-time window. Earlier [legacy original government URL alternative Wayback/CDX pilot](cfb-2021-25-exact-pdf-legacy-host-publicby-v13.md) found 13 exact query empty valid listings and 5 network/index holds but zero independently timestamped full original source SHA matches; limited URL search is not proof the original was absent from the web.

## Replay instructions and unfinished owner-requested work

For purely local, read-only reproducible verification:

    node --import tsx --test tests/cfb-864-298-version-51-senator-report-ledger-v19.test.mjs
    node --import tsx scripts/audit-cfb-864-298-exact-reports-51-serving-principals-v19.mjs

The PR-only [V19 offline source verifier](../../.github/workflows/senate-864-cfb-298-official-report-version-v19.yml) recomputes all 298 version IDs and the 95 serving-member report coverage from the independently source-audited originals; 288 genuine distinct signed PDFs, six held form identities, four duplicate version aliases and no historically falsely inferred public-by.

The in-scope remaining work: original CFB report PDF original/amended version acquisition for the **44** actual-serving senators not yet in the selected source ledger; specifically independently prove the **five CFB registration name variant holds** and **six exact PDF first-page registration holds** if original proof becomes available, and find independently dated copies of the *exact full original source PDF bytes* to establish a historical public-by upper bound. Do NOT reopen the user-excluded statutory owed/received filing-duty denominator, candidate bulk transaction comparison or legacy stored eligibility repairs. No contact, protected/production DB, predictive/model, scheduler or 2027 work. Issue #864 stays OPEN.
