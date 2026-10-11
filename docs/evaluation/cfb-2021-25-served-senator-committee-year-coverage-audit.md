# #864 — Minnesota Senate finance: source-authenticated committee-year coverage and acquisition priorities

*Read-only, October 11, 2026. This document addresses campaign-finance original sources ONLY. It makes no statewide filing-completeness, source-to-database reconciliation, or historically public-by claims.*

## Exactly what the coverage table covers

The [90-row committee-year matrix](source-proof/cfb-2021-25-served-senator-committee-year-coverage.psv) and [51-row exact CFB PDF reference acquisition queue](source-proof/cfb-2021-25-served-senator-next-source-pdf-targets.psv) are built by joining **existing permanently committed** original Minnesota CFB candidate viewer response hashes against previously authenticated principal campaign committee original/amended finance PDF hashes. [The provenance checkpoint](source-proof/cfb-2021-25-served-senator-committee-year-coverage-source-checkpoint.json) freezes exact source hashes and cohort boundaries. [Regression tests](../../tests/cfb-2021-25-served-senator-committee-year-coverage.test.ts) independently rejoin every matrix and queue row to its original source, reject changed hash/identity/report period, and do not assert false nonfiling.

The sampled cohorts are **22 verified actual Senate-serving people** in 2022 election districts 14–30 and 32–36, examined for **report years 2021–2024** (88 committee-year rows), **plus two separately verified actual Senate-serving people** in the 2025 special-election cohorts for SD29 and SD47 (two 2025 rows). The 2025 41-registration source reference panel is **not** a general 2025 census of the first 22 senators, and older verified candidates are not asserted to be still serving in every report year. These are committee/person *source-coverage* rows, not legal-year membership or filing duties.

The 2022 CFB viewer segment includes pinned original API responses for **all 22** 2022 cohort registrations; the sampled 2024 viewer segment includes pinned responses for **14**, not the other **8**. For those eight, 2023/24 viewer counts appear as **`-` = no response included in this specifically sampled source inventory**, not as a reported zero, nonfiling, inactive committee or lack of legally required report. A response present with zero references is different from no sampled response.

## Verified financial-source coverage

| Report year | Sampled committees with original viewer response | CFB original version references | Authenticated original PDF binaries | CFB amendment version references | Distinct authenticated amended PDF binaries | Explicit source exception | Next PDF versions to fetch |
| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: |
| 2021 | 22 | 16 | 16 | 13 | 12 | Putnam amendment #1: **source-only HOLD** | 0, plus separate HOLD |
| 2022 | 22 | 66 | 66 | 43 | 42 | Hoffman amendment #2 aliases same PDF as #1 | 0 |
| 2023 | 14 of 22 | 14 | 0 | 6 | 0 | 8 sampled registration responses absent | 20 |
| 2024 | 14 of 22 | 14 | 0 | 10 | 0 | 8 sampled registration responses absent | 24 |
| 2025 special | 2 | 8 | 8 | 7 | 0 | cohort deliberately limited to SD29/47 actual senators | 7 |

The first two report years contain **82 distinct authenticated originals plus 54 distinct authenticated amended finance PDF binaries = 136 forms**. Their 138 official viewer version references consist of 136 authenticated unique PDFs, one additional repeated-reference alias and one atypical official-source PDF whose normal report identity is unverified. For the separately verified 2025 special-election panel, **eight** original PDFs are independently authenticated, while seven amendment-version references have not yet had their individual PDF identities established. These counts do **not** imply legally required filings, completeness, 2021–25 statewide coverage, usable financial transaction rows or historical public access.

## Priority 1: 2025 special-election amendments with already authenticated original parents

**Seven exact unverified amendment references** for actual senator **Michael Holmstrom Jr**, SD29, registration **19229**, all present in the official CFB 2025 candidate viewer and all linked to an already SHA-authenticated original PDF parent:

```
19229:25:pcc:C:1:1
19229:25:pcc:E:1:1
19229:25:pcc:YE:0:1
19229:25:pcc:YE:1:1
19229:25:pcc:YE:1:2
19229:25:pcc:YE:1:3
19229:25:pcc:YE:1:4
```

Each must be downloaded from the original official PDF viewer, SHA-256 fingerprinted, matched to its *exact* original parent and applicable reporting period and Board receipt, then independently checked for unusual/alias/failed-source statuses. Do **not** presume seven distinct PDF binaries merely because there are seven version indices. The separately verified 2025 SD47 actual senator **Amanda Hemmingsen-Jaeger** (registration **19233**) has four already authenticated source original PDFs and **zero amended references in this narrowly selected viewer response**; this is not a legal no-amendment or no-filing certification.

## Priority 2: 2023 and 2024 annual originals for 14 verified people

There are **28 unacquired exact original PDF references** in the already pinned official **2024-segment** CFB reports-tab source responses: one **`23:pcc:YE:0:0`** and one **`24:pcc:YE:0:0`** for each of these 14 independently verified serving-senator committee registrations. Preserve older versus newer district attribution from each PDF, without assuming it matches the election district.

| Verified actual senator | 2022 district | CFB registration | 2023 annual amendment refs | 2024 annual amendment refs |
| --- | ---: | ---: | ---: | ---: |
| Aric Putnam | 14 | 18430 | 3 | 3 |
| Gary H. Dahms | 15 | 17117 | 0 | 0 |
| Glenn Gruenhagen | 17 | 18795 | 0 | 0 |
| Steve Drazkowski | 20 | 18763 | 0 | 0 |
| Gene Dornink | 23 | 18058 | 3 | 0 |
| Carla J. Nelson | 24 | 17105 | 0 | 0 |
| Liz Boldon | 25 | 18901 | 0 | 3 |
| Jeremy R. Miller | 26 | 16891 | 0 | 0 |
| Mark W. Koran | 28 | 17893 | 0 | 1 |
| Bruce Douglas Anderson | 29 | 17362 | 0 | 0 |
| Michael E. Kreun | 32 | 18819 | 0 | 0 |
| Karin Housley | 33 | 16964 | 0 | 3 |
| John A. Hoffman | 34 | 17319 | 0 | 0 |
| Heather Gustafson | 36 | 18781 | 0 | 0 |

These are **real CFB viewer original report keys**, *not yet verified PDFs*. Before calling them authenticated, acquire the actual original binary and prove committee registration, Senate service identity, first-page printed Senate district, actual covered dates, original Board receipt, applicable independent legal calendar and SHA-256. Statutory timing and real historical public release remain different facts. Do not claim these originals were legally owed merely because the viewer lists them.

## Priority 3: the 16 corresponding 2023–2024 amendment versions

Once the applicable 2023–2024 originals above are authenticated, request **16** amendment versions: **2023 Putnam 3, Dornink 3; 2024 Putnam 3, Boldon 3, Koran 1, Housley 3**. Every exact original/amended version ID and original viewer response SHA is already queued in the [permanent target ledger](source-proof/cfb-2021-25-served-senator-next-source-pdf-targets.psv). Do not count a version as distinct before binary SHA comparison; do not relax the strict duplicate safeguard to handle anomalies.

## Outstanding source scope and completeness holds (not counted as missing filings)

- **Aric Putnam 2021 YE #1**: `18430:21:pcc:YE:0:1`, genuine official PDF SHA-256 `7529ad0bf417548f1617d2bb2b74e5115855844df4a979fdbb6ad3e5e6420acf`, but normal first-page principal committee, report period and Board receipt identity are not independently established. The separately authenticated #2 is not proof that this #1 is a normal financial amendment.
- **John Hoffman 2022 YE #1 and #2**: `17319:22:pcc:YE:0:1` and `17319:22:pcc:YE:0:2` both yield the same 686,801-byte original PDF SHA-256 `5a95df8f11a8b912b65d4befebd368cf00008e814844c69c3069c77fac7f8e2d`; preserve both viewer references, count one distinct PDF. CFB's reason for the alias is unknown.
- **2022 SD31**: historical SOS election-to-CFB registration remains unproven for the intended service identity; do not assert a nonfiler or manufacture a committee-year row.
- **Eight registrations not observed in the pinned 2024 segment**: Andrew Lang (SD16), Nick Frentz (SD18), John Jasinski (SD19), Bill Weber (SD21), Rich Draheim (SD22), Andrew Mathews (SD27), Eric Lucero (SD30), Jim Abeler (SD35). Their absence from this *sampled* 2024 source response inventory does **not** establish the absence of 2023/24 reports or obligations. Those cases need independent registration/report-viewer discovery.
- **Further actual serving senators** beyond these two fixed samples, including 2022 districts 37–67 and any proved 2025 special-election serving persons outside SD29/47, require independent LRL Senate service + SOS/CFB registration verification before adding them to the actual-senator-only denominator.

## Methods and safe interpretation

The permanent source files were obtained in October 2026; their original PDF/report identifiers and SHA-256 hashes identify authentic source documents but do not establish that those documents were historically *public by* a 2021–25 prediction cutoff. Coverage/report-period dates, Board receipt, statutory due date, possible-not-before release date, and contemporaneous proven public-by must remain separate. Even an entirely acquired original PDF cohort is not the same as a legally complete filer universe. Contributions, expenditures, independent expenditures, PACs, parties, filing obligations/exemptions and source-to-production row containment must be evaluated in their own subsequent, read-only reconciliation.

No donor records, unproven ever-served candidates, raw finance report PDFs, personal contact data, production database reads or writes, retrospective predictions, model/serving/scheduler changes or 2027 expansion are part of this checkpoint. Keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) **OPEN**.
