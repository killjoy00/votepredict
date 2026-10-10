# #864 - official 2021-2024 Senate report-reference count checkpoint

The original Minnesota Campaign Finance Board candidate viewer was sampled on October 10, 2026. The audit shows **source-observed report-version references**, NOT a legally owed Senate filing denominator, actual independently authenticated PDF count, or historical public-by proof. The source selection, acquisition and classification were merged in [PR #944](https://github.com/killjoy00/votepredict/pull/944).

## Independent source verification

[One-time CFB run 38088965276](https://github.com/killjoy00/votepredict/actions/runs/38088965276) captured **396 of 396** official candidate reports-tab API responses without source failures: 270 registrations from original 2022 Senate election viewer selections and 126 from 2024, with **275 unique registration IDs**. These two-year segment viewers expose references for report years 2021/22 and 2023/24. Full exact-head CI and the corrected official source workflow both passed.

A separate first [CFB acquisition run 38088552174](https://github.com/killjoy00/votepredict/actions/runs/38088552174) independently obtained all 396 responses. We downloaded both original metadata artifacts and directly compared **396/396 matching original API response SHA-256 values** and **396/396 exact version key lists**, with **1,382** matching total document references. The first workflow stopped only for four ancillary affidavit documents that needed explicit classification; the follow-up clean run separated all four successfully.

| Reporting year | Original pcc version references | Amended pcc versions | Total pcc version references | Registrations with matching-year refs |
|---|---:|---:|---:|---:|
| 2021 | 165 | 70 | 235 | 165 of 270 scoped |
| 2022 | 524 | 247 | 771 | 254 of 270 scoped |
| 2023 | 118 | 51 | 169 | 118 of 126 scoped |
| 2024 | 134 | 69 | 203 | 121 of 126 scoped |
| **Total versions** | **941** | **437** | **1,378** | *Never sum year-cohort registrations as unique committees* |

Period detail for **original-version reference keys only**: 2021 YE 165; 2022 YE 253, pre-primary C 146, pre-general E 125; 2023 YE 118; 2024 YE 124, C 6, E 4.

Four additional CFB viewer reference keys have type aoc (registration numbers **2442, 2471, 2491, 2495**, year 2022, period C, amendment 0). These are not pcc reports of receipts/expenditures; source type aoc belongs to the distinct *affidavit of contributions* category in [Minnesota Statutes 10A.323](https://www.revisor.mn.gov/statutes/2022/cite/10A.323). Their separate presence does not exempt those filers from any other report. They are preserved as four ancillary references, outside the 1,378 financial-report keys.

## Source provenance and limitations

The full source metadata artifact, which contains no raw report PDFs, donor details or transaction bodies, can be obtained from the source-run link above until **November 9, 2026**.

- Official corrected source artifact ID **11683227803**, original ZIP SHA-256: 5516f3863ae9e5122df923b2d0f7f1fc88b5a5af3ddcb6dba2d3160570844914
- Original 562,731-byte extracted JSON SHA-256: 933f9c55c71da049a4a9af21574f562676e8e930f0cb6be6883e50b5f8901da0
- Concatenated 396 official API body hashes SHA-256, sorted by source segment and registration: be6d3bde4a606ecfb6182756095c3aac36bbd97df7bd6d706f3e32be58331eca
- Sorted 1,382 exact source viewer document-version identifiers SHA-256: 7e375ae8e240e69c74f4aae9e058aa57869f22815897a43750904d397d50954b
- Deterministic reconstructed compact metadata-only 396-row PSV canonical SHA-256: 6056ce0072adfc6711588fe8d2b4b09694a658e52a249631fbf4e92f65a2a4f9

The full artifact is captured and hash-pinned, but **the reconstructed 396-row per-registration metadata ledger is not yet committed**. That is a remaining durable source preservation task before the Actions artifact expires.

The independent 2026 CFB current registry lists **109** of the 275 historic viewer registrations, leaving **166** missing from the **current-day** registry; 83 of the 84 viewer-2020-only registrations are also missing from today's list. Absence from a 2026 registry proves neither historical termination nor a 2021-2025 filing exemption. The 494-ID Senate discovery inventory excludes unknown historical registrants not visible in its 268 district pages.

Actual statewide Senate active registered committee-years, ballot-specific filing duties, 2021-2025 legally required original reports, actually filed original PDFs, original-vs-amended PDF proofs, independent historical public-by dates, late/nonfilers and production database row containment still require independent reconciliation. The broader official all-category CFB year-end figures are separately preserved in the source memo count context and must never be claimed as Senate-only counts.

**Issue #864 remains OPEN. No production database, prediction serving, backfill, model, scheduler, 2027 or private-donor changes.**
