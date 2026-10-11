# #864 — 2025 SD29/SD47 *conditional* special-election year-end reporting duty

**Independent original CFB calendar proof is a conditional legal rule, not a statewide or person-specific report obligation certificate.**

This bounded audit covers **only actual Minnesota senators** Michael Holmstrom Jr (District 29, CFB registration **19229**) and Amanda Hemmingsen-Jaeger (District 47, registration **19233**). Each actual service interval was independently checked against original [Legislative Reference Library Senate service](https://www.lrl.mn.gov/legdb/senate_dir) and [swearing chronology](https://www.lrl.mn.gov/history/caucus?body=s). The actual original 2025 special-election cycle-final PDF binary hashes, first-page identities, received dates and 2026 UTC acquisition timestamps were previously permanently pinned in [the two-final checkpoint](source-proof/cfb-2025-served-senators-2-special-cycle-final-original-source-checkpoint.json), originating in [merged #967](https://github.com/killjoy00/votepredict/pull/967) and [#972](https://github.com/killjoy00/votepredict/pull/972).

## Official original source: explicit exception

The [2025 SD29 disclosure calendar](https://cfb.mn.gov/pdf/calendars/2025_special_election_29.pdf) and separate [2025 SD47 disclosure calendar](https://cfb.mn.gov/pdf/calendars/2025_special_election_47.pdf), both original PDF byte-hash pinned in the above source checkpoint, set the special cycle-final deadline to **December 1, 2025**, covering **July 29–November 19, 2025**. They explicitly state that a further **2025 year-end report** is required **unless the special cycle-final report is a termination report**. Original 2025 [general disclosure calendar](https://cfb.mn.gov/pdf/calendars/2025_general_disclosure_calendar.pdf?t=1743206400) independently specifies **February 2, 2026** as the 2025 year-end due date. The original general-calendar PDF hash is independently pinned in the earlier [SD6 source checkpoint](source-proof/cfb-2025-senate-district6-report-pdfs.json).

This exception must **not** be dropped. A cycle-final PDF with `amend=0` is an original *version locator*, not independent proof of the PDF's termination report checkbox or its legal characterization. The original cycle-final headers established receipt dates (**November 26** for SD29, **November 20** for SD47); a Board-received special final is not, alone, sufficient to prove its final termination status. Per the effective [2025 §10A.243](https://www.revisor.mn.gov/statutes/2025/cite/10A.243), termination requires an identified final termination report meeting the statute's asset and transaction conditions. No positive or negative termination finding is justified by a missing 2026 termination marker.

The archived original [2025 CFB 41-registration report viewer ledger](source-proof/cfb-2025-dated-senate-85-reference-versions.psv) includes `19229:25:pcc:YE:0:0` and `19233:25:pcc:YE:0:0`. These are evidence of 2026-observed **viewer references only**; their PDF originals are the target of a separate PR, not proof of legally owed year-end reports or contemporaneous public disclosure.

## Dated registration and duty separation

The original [October 10, 2026 CFB current registry snapshot](source-proof/cfb-2026-public-current-senate-registry-checkpoint.json) lists registration dates **July 29, 2025** for reg19229 and **August 1, 2025** for reg19233, with no listed termination date in that current snapshot. These are **retrospective dates reported by a 2026 current list**, not independently established historical effective registration intervals. Even a correct contemporaneous registration filing must be reconciled with applicable [2025 §10A.14](https://www.revisor.mn.gov/statutes/2025/cite/10A.14) threshold and report-cycle predicates; a candidate name or viewer date does not alone imply a filing duty.

| Independently distinguished question | SD29 | SD47 |
|---|---|---|
| Actual senator service | Verified | Verified |
| Original 2025 special cycle-final PDF | Verified | Verified |
| Calendar rule: **year-end required unless termination** | Explicit in official PDF | Explicit in official PDF |
| 2026 current-list-reported registration date | 2025-07-29 | 2025-08-01 |
| Full historical registration/termination lifecycle proven | **No** | **No** |
| Final-cycle PDF independently proven to be a termination | **Unknown** | **Unknown** |
| Original 2025 ordinary year-end viewer reference | Observed, not yet PDF verified by this audit | Observed, not yet PDF verified by this audit |
| Legally owed year-end count attributable to case | **Unknown** | **Unknown** |
| Independently proven original report historically public-by | **None** | **None** |

A one-time GitHub Actions source job independently re-fetches all three calendar original PDF binaries and both original LRL Senate-service documents. It hashes/validates original bytes, checks the exact year/district/period/termination exception with fail-closed tests, and persists metadata/dates only. It does not store source HTML, PDF images, contributor names, addresses or report-body transactions.

**Outstanding requirement for a legal owed-count:** independently classify the cycle-final termination field or an original Board termination report, reconcile genuinely historical effective registration/termination documentation and other exemptions, and separately authenticate original year-end PDF headers. Do not classify any absence as nonfiling. Historical public-by remains `null`, all finance as-of eligibility false, and the statewide 2021–2025 legal-filer/report denominator `null`. No production database, serving, scheduler, model or 2027 changes; **keep #864 open**.
