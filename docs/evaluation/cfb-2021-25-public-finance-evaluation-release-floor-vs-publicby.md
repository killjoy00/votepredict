# #864 Track B — historical public-finance Quick evaluation: statutory floor is not historical public-by

**Scope:** Minnesota Senate 2021–2025 CFB finance as-of research; offline historical evaluation only. No production/Neon writes, evidence imports, migration, serving/forecast changes, model training, source-private rows, or outreach.

## Original legal and PDF source boundary

Minnesota [2025 Statutes §10A.20, subd. 1b](https://www.revisor.mn.gov/statutes/2025/cite/10A.20) provides that an ordinary report is **nonpublic until 8:00 a.m. America/Chicago on the day after its due date**. This is a *not-before* restriction, not a guarantee that an identified original or amended PDF actually appeared in the regulator's public distribution system that day. Late filing can move the conservatively possible date later.

Already independently authenticated original sources, **not newly acquired by this patch**:

- [2025 Senate specials: 12 original-version PDF legal release-floor audit](source-proof/cfb-2025-senate-12-special-due-vs-received-historical-release-floor-audit.json) and [original PDF/official-calendar methodology](cfb-2025-special-senate-12-early-filed-due-date-release-audit.md). Seven received before the due date, five on due date. Exact historic version-public-by **0 of 12** proven; 0 of 12 transaction-row containment independently confirmed.
- [2023–2024 selected served-senator cohort: 71 exact year-end version references](cfb-2023-24-71-source-version-statutory-publication-barriers.md), 68 distinct authenticated original PDF bodies, two identity holds and one duplicate alias. Exact historic version-public-by **0 of 71** independently proven.
- [Read-only current Neon source-document registry baseline](senate-864-existing-neon-key-readonly-source-baseline.md) is all-chamber source-document inventory, not historical senator-linked financial transactions or as-of reconciliation.

None of these source counts is the legally required statewide Senate-report denominator. An exact current PDF SHA/URL, report receipt stamp, or due date is not by itself a dated historical capture of the same public version.

## Previously identified false-positive path

The offline `src/evaluation/public-finance-data.ts` importer accepted a bulk CSV record with `Filed date` + `Report due date` but **no explicit disclosure date** and assigned it `availableOn = cfbElectronicReportAvailableOn(filedOn, dueOn)`. `src/evaluation/public-evidence-quick-screen.ts` then accepted any such non-null `availableOn` as historically eligible before a vote cutoff. That **promoted a legal nonpublicity boundary into an affirmative public-by claim**, not independently supported by those CSV columns.

This patch:

1. Preserves the original statutory bound as `statutoryNotBeforeOn` for audit, with `availableOn=null` and `availabilitySource=null` when the bulk record has no explicit dated disclosure.
2. Requires a valid *row-level* direct CFB disclosure-date column for the offline public-finance loader to populate `availableOn`; an impossible purported disclosure before transaction date fails closed.
3. Hardens the Quick replay feature reader to require `availabilitySource='direct_disclosure'`, rejecting even **legacy** `filed_due_statutory_release` rows with non-null saved dates.
4. Separately counts `statutoryFloorOnlyRows` from `availabilityDatedRows` for receipts, spending, and independent spending. Counters are diagnostics, **not the official filing obligation denominator**.
5. Validates canonical date strings rather than accepting invalid calendar dates that could silently roll forward.

The row-level direct disclosure label is a **necessary input-column test, not a source-verified certification** that a particular report PDF version, amendment or transaction was public at that time. Bulk CSV labels, committee name heuristics, current file URLs and even the explicit `Disclosure date` column require independent provenance and registration / report-version / row-containment verification before any official historical reconciliation can be certified. This patch prevents the *known* floor-only false-positive path; it does not claim the remaining direct-column rows meet that stronger bar.

## Adversarial offline regression

`tests/public-evidence-quick-screen.test.ts` now covers:

- Early-filed **2025-10-22** / due **2025-10-28** with no direct disclosure -> `statutoryNotBeforeOn=2025-10-29`, `availableOn=null`, excluded.
- Same dates with explicit subsequent direct disclosure -> independently *source-labelled* candidate date used only by this experimental screen, strictly before event cutoff.
- A purported disclosure preceding the underlying contribution date -> excluded.
- Legacy prepopulated filing/due-only feature row -> ignored even when it has a seemingly eligible date.
- Invalid ISO/US calendar dates -> not admitted.

## Remaining acceptance debt

- The full 95-person actual-serving senator-to-CFB-registration effective-period crosswalk and conditional per-year/report-type legal obligation matrix are not complete.
- Authenticated contemporary exact-PDF historical publication captures and proven original transaction-row containment remain missing in the 12-report/71-version cohorts.
- The current protected Neon read-only aggregate includes source-document registry families but does **not** provide exact stored-row-to-official-version agreement, incorrect persisted eligibility counts, or a certified statewide 2021–2025 denominator.
- Existing materialized historic eligibility must be audited via safely authorized, bounded read-only source-to-row joins, with production repairs requiring separate authorization. No stored value was edited by this PR.

**Net conclusion:** legal due+filed calculations remain useful **negative temporal constraints**, but cannot be inserted as positive as-of finance features without independent publication evidence. The next high-value Track B action is a protected *read-only*, privacy-preserving source-to-row revalidation followed by original CFB filer/obligation identity work.
