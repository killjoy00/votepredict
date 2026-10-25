# Senate historical repairs: final bounded closeout

**The user-approved repair workstream is complete. No further repair batch is needed.**
Issue #864 remains open as **blocked on source evidence**, because its original
historical-completeness requirement needs official inventories and originals that
are not available in the acquired corpus. This is the final closeout of the
current workstream, not a certificate of complete 2021–2025 history.

The accepted read-only snapshot is **2026-10-25T15:04:57.332Z** on the existing
VotePredict primary/default database. The audit used verified REPEATABLE READ
READ ONLY and explicit ROLLBACK, checked all 36 schema-ledger entries, and made
**zero production writes, new source acquisitions or outcome experiments**.
The first query attempt was not accepted: its source-type filter omitted the
already known Taxes PDF. The corrected query includes that exact existing URL;
the complete fixed-scope snapshot was rerun rather than joining different times.

## What was reconciled

| Category | Fixed existing evidence | Final result |
| --- | --- | --- |
| Committee votes | 233 retained candidate texts, existing stored event/choice inventory, prior source-question bridge and two reviewed follow-up fixtures | **221 events / 1,950 choices** inventoried. All **52 reviewed questions / 625 choices** accounted for: 51 same-source exact and one independently verified alternate-source match. |
| Campaign websites | Exact executed 1,194-record source plan reconstructed from committed literals and original/archive bindings | **1,194 / 1,194** exact: literal, stable person, source URL/hash, archive clock/CDX and non-serving flags. **92 people / 123 original bodies**; three known scope exclusions. |
| Finance | 830 pinned report versions and retained body-cache identities, three separate transaction families, existing Miller PDF and links | **830 / 830** registry versions exact, **813** distinct bodies. Retained Miller PDF bytes rehashed and locally extracted: **25 exact mechanical links**, three purpose holds unchanged. Historical publication is not inferred. |
| Media | Existing 44-source context catalogue and the three previously certified Miller fragments | **948** contextual items accounted for: 794 in-range and 154 outside the observation-year window; **688** distinct in-range source documents. All **three** selected fragments retain exact literal/person/source/clock and non-serving flags. |

The committee exact replay is a defined subset of the stored inventory. The
other previously published source-specific receipts remain dated evidence;
this closeout does not newly certify every stored event against a universal
official denominator. A contextual mention does not become a senator's speech.

| Hearing year | Stored committee events | Explicit choices |
| --- | ---: | ---: |
| 2022 | 40 | 270 |
| 2023 | 65 | 580 |
| 2024 | 63 | 561 |
| 2025 | 53 | 539 |
| **Total** | **221** | **1,950** |

Website observation years remain distinct from vote years: **373** excerpts were
observed before 2021, then **51 / 723 / 0 / 18 / 29** in 2021–2025. A zero in
this selected corpus does not mean no campaign statement existed. Both frozen
protocols and the already examined experiment result retain their exact SHA256s;
the closeout reads no floor outcomes and runs no new experiment.

Finance canonical transactions remain separated: contributions **10,920** from
37,115 evidence copies; candidate spending **9,953** from 24,795 copies; independent
expenditure **391** from 1,955 copies. These are observed scoped records, not the
legally owed report universe. The **58,555** legacy eligibility claims remain
revalidation debt; **32,711** possible early-date flags do not establish invalid
transactions. No automatic promotion, withdrawal or guessed version association
was performed. There are zero tracked exact-version historical public-by proofs
in the report registry.

## Fixed blocked list and reopening evidence

These are dispositions, not an active engineering queue. No automatic retries
or wider searches follow this closeout. The [detailed JSON receipt](source-proof/senate-864-final-closeout-20261025.json)
itemizes all 40 current held row-parser occurrences, four excluded cross-original
question keys, year/family counts and source fingerprints. Those occurrences
include duplicate originals/fragments and are not 40 certified missing votes.

| Blocked scope | Evidence required for separately scoped reopening |
| --- | --- |
| 2021 print inventory; 2022 print/electronic equivalence | Authenticated official meeting/motion inventory and original written records. |
| Six missing-Minutes dates: 2022-03-15 Housing; 2022-08-10 and 2022-10-03 Environment Finance; 2023-04-13 and 2024-05-16 Environment/Climate/Legacy; 2025-05-12 Subcommittee on Committees | The exact official written Minutes and, where absent, exact committee/hearing identity. No repeated failed-endpoint pass is proposed. |
| Forty held row-parser occurrences; four cross-original identity exclusions; date/header/attendance and Education question joins | Complete distinct parliamentary question, exact historical identity, named sides, tally/outcome and unique stored-event anchor as applicable. No slate or ordinal inference. |
| Nonbill questions within the held occurrences | Separately scoped nonbill question identity/storage semantics and complete source proof; a nearby bill cannot be assigned as a substitute. This is a scope/design dependency, not necessarily a missing archive. |
| Ten clipped/occluded originals and one unparseable Finance committee PDF | A legible authenticated original or a validated extraction that preserves the missing information. These are committee-source quality holds, separate from financial-report parsing. |
| May 12, 2023 Taxes / SF1949 | A safely selected complete question and exact stored original provenance; the misused amendment field is not silently treated as bill passage. |
| SF2818 | Authenticated complete question and list-completeness/tally proof. Its earlier investigation remains completed and held. |
| Legally owed CFB filings | Effective filer/entity identities, report duties/exemptions and an authoritative owed-report inventory. |
| Legacy finance eligibility and publication chronology | Exact transaction/version containment or authenticated regulatory row disclosure, plus the applicable historical release/observation bound. |
| Two PAC containment/publication cases; six held PAC comparison sets; 35 unclassified contribution copies | Exact original row/entity proof and applicable publication evidence. Existing 17/23 complete comparison sets do not certify containment or historical publication. |
| Three Miller full-purpose differences and separate exact-version public-by hold | Authenticated original bulk rows/version explanation; separately dated original or regulatory disclosure. Existing 25 mechanical links remain complete. |
| Wider owned-site coverage, Wiger/Tomassoni/Bakk originals and version-specific Clark pages | New exact owned-site originals or an authenticated wider inventory. The 88 aggregate-only items are not materialized records to invent. |
| Wider media attribution/coverage | An exact source-contained attributable passage, person and supported historical clock. **652** unresolved mention tokens remain unassigned; closed Reformer/MPR and general-crawl exclusions stay closed. |

The prior scoped visual review of **247 OCR originals / 416 pages** is preserved;
no word-perfect OCR or quality-certification flag is promoted.

## Reproduction and stop

`scripts/audit-senate-864-bounded-closeout.mjs` has offline-only prepare and verify
modes. Prepare writes the fixed 20-query plan, including READ ONLY/ROLLBACK and
bounded result limits. An authorized reader executes it on the existing primary
database; the private snapshot is keyed by the plan's names. Verify reuses the
existing conservative source/member/choice validators and emits only the public
receipt. It rejects truncation, source/protocol/schema drift, ambiguous literal
bindings, and raw/private output fields. It rehashes the cached Miller PDF and
uses local `pdftotext`; it performs no network acquisition. Private snapshots and
raw donor/PDF data are not published.

The [publication receipt](source-proof/senate-864-final-closeout-publication-20261025.json)
pins the report, auditor, tests, workflow and updated authoritative ledger. Six
focused negative/integrity tests cover wrong source/person/clock, read-only
query bounds, the Taxes source-type exception, schema/transaction failure,
immutable protocols/results and private-field rejection. Normal CI remains required.

**Stop condition met:** one accepted fixed-corpus reconciliation, zero demonstrated
new repair discrepancies, no repair batch, final report and blocked list published.
Further work requires a separately scoped request with new exact source evidence
or a demonstrated defect. There is no active archive search, parser expansion,
experiment or recurring task. Senate floor, serving models, forecasts, weights,
training, frozen evaluations, Vercel and scheduler state remain unchanged; no
office contact or manual audio review occurred.
