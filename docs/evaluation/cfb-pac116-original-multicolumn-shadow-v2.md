# #864: PAC116 source-page multicolumn CFB contribution matching — V2 shadow

This is **campaign-finance original-PDF research only**, following merged
PR #1408 and successful protected READ ONLY run #39002428756.

## Verified production baseline

Two original-CFB + first-party source-attested *current* PAC identities led to
116 distinct 2021–25 Senate candidate contributions and 299 stored evidence
copies. There were zero conflicting duplicates, 113 contributions with at
least one official indexed candidate report and three without such a report.
Original report versions are ambiguous for 71 of the 116 contributions;
the original v1 schedule-line extraction had **zero exact** transaction
matches in this 116-row cohort. 114 existing historical eligibility labels
are **unverified**. No historical source-qualified issue finance signals exist.

## What this stage newly tries

Prior v1 original schedule-entry extraction favors single-line layouts and
could miss report schedules where date, contributor, in-kind and cash/total
amounts occupy multiple source columns. Reuse the existing 830
SHA-registered CFB PDF version identities, cached original page text,
0030 source-preserving v2 raw spans, and independently tested v3
arithmetic/printed-header reconstruction.

For each PAC contribution's **receiving committee registration + report
year**, compare the page's source date, full printed contributor name,
printed amounts, A1 column header and arithmetic consistency against
**all** canonical candidate-contribution rows for that receiving
committee/year. Without this full comparator, a donor-row subset may appear
unique even if another source row could have matched the same span.

The result has two independent dimensions: number of
**source-header-arithmetic provisional PDF version/row pairs**, and number
of distinct cohort contributions having at least one such candidate.
Count multiple original/amended versions separately; retain rows with
no reconstructed match and aggregate original parsing gaps.

These are intentionally **not certified row-to-version containment**:
PDF table coordinates and other version-specific provenance still require
independent source verification, and same-body amendments are not first-public
certificates. **Nothing is added to cfb_finance_report_transaction_links, no
published_at or asOfEligible field is rewritten, and zero historical strict
finance features become usable by running this shadow.** The PACs'
October 2026 independently observed organizational relationships cannot be
retroactively asserted for 2021–25.

## Run safety

The existing protected, marker-gated
`.github/workflows/senate-864-cfb-pac-116-contribution-readonly.yml`
now runs the new multicolumn shadow **after** the exact report-link census,
following independent keyless tests. It uses the same verified existing
Neon default branch/primary, static bounded SQL, `REPEATABLE READ READ ONLY`
and explicit `ROLLBACK`. All amount and contributor text stays inside the
private runner; only aggregate integer counters reach logs.
No general publisher/news crawling or forecast/serving changes.
