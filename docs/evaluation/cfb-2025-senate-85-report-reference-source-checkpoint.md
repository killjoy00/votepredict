# #864 — source-pinned 2025 Senate report references, 41 dated committees

This checkpoint is **viewer metadata only**. It is not PDF authentication, required filing counts, source-to-database reconciliation, or historical public-by proof. No model or production behavior changes.

## Official acquisition and provenance

The [one-time source run](https://github.com/killjoy00/votepredict/actions/runs/38085296709) completed on October 10, 2026, for **41 CFB Senate registrations independently dated as registered during 2025**. The acquisition is merged in [PR #930](https://github.com/killjoy00/votepredict/pull/930). Every official candidate reports-tab request succeeded. The observed 2025 versions are:

| 2025 period | Original version reference, amend=0 | Amended version reference, amend>0 | Total |
|---|---:|---:|---:|
| YE (year-end; including different special-election flags) | 48 | 19 | 67 |
| C (special-election reporting period) | 7 | 3 | 10 |
| E (special-election reporting period) | 5 | 3 | 8 |
| **Total** | **60** | **25** | **85** |

The 48 YE originals can exceed 41 committees because report-period special-election flags distinguish report identities. Amendments must remain separate from original report obligations. **None of these 85 viewer references, by itself, proves an original PDF, a filed-on date, a due date, or historical public availability.**

The full original source metadata is temporarily stored in GitHub artifact ID **11682530876**, expiring **November 9, 2026**. We downloaded and independently hashed both the ZIP and embedded JSON. The permanent [compressed report-version ledger](source-proof/cfb-2025-dated-senate-85-reference-versions.psv) preserves each of the 41 numeric committee IDs, its original API response SHA-256, and all its 2025 exact report-version parameters.

- Original ZIP SHA-256: f66f717162ccc2d0f9d84cb939c37fe3a45fcd49cc83dbad562647f88b9d2027
- Embedded JSON SHA-256: 279cf523e15487bac3ad4e295a806d046bffbd26d67a60e4b3b55f4b7af90ce7
- Compact source-ledger SHA-256: d34bb475cccd94481fd2f2215bf47e3c9695ad328e06bed2475967add067f0d0
- Reconstructed sorted 85-version-reference key SHA-256: e2d650a432620738a8cfcb68ce794ad9007353e93608cd7850cb1ce465011ece

A matching [JSON proof checkpoint](source-proof/cfb-2025-dated-senate-85-reference-source-checkpoint.json) and deterministic test validate all identities, counts and hashes. Neither the raw API bodies nor any report PDF bodies, candidate names, contact details or financial transactions are placed in the repo.

## Next evidence step

The **12 C/E original references** are highest-priority candidates for historic cutoff investigation: source-acquire exact report PDF versions, validate registration, period, report identity and filing/receipt dates, and verify applicable special-election and ordinary due dates. Historical statutory release floors and independently proven public-by dates must remain separate. Do not use PDFs as prediction evidence before the cutoff is proven.

The **48 original YE references** still require exact PDF verification for historical completeness. Year-end PDFs received or made public in 2026 cannot inform 2025 forecasts.

A true statewide 2021–2025 committee-year and legally required-report denominator also requires historically dated registration/termination episodes, legal reporting obligations, exemptions, actual filings, amendments and nonfilers—including committees absent from these 41 targets. Reconciliation to database rows requires separate authorization. **Issue #864 remains open**; production database, prediction model, scheduler and 2027 program remain unchanged.
