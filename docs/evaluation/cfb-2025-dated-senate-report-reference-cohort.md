# #864: official 2025 candidate report-reference discovery for 41 independently dated Senate registrations

**Purpose**: extend the source-verified October 2026 election-viewer and candidate registry overlap to a **bounded, source-selected 2025 registration-date cohort**.

The independent [CFB statewide Senate source checkpoint](cfb-2021-25-senate-statewide-registration-proof-checkpoint.md) observed 494 numeric registration IDs across viewer segments 2020/22/24/26. [October 2026 current-candidate registry source checkpoint](cfb-2026-current-candidate-registry-senate-join.md) dates 230 source-observed current Senate registrations. Crucially, among **134** registration IDs only visible in the 2026 election viewer: **41 were registered in 2025**, **78 registered in 2026**, **15 had unknown effective registration dates in the current list**.

## Narrow target and official retrieval

This tranche submits exactly those **41 source-verified 2025-dated CFB registration IDs** against the official historic Senate *candidate reports tab* for election-viewer segment **2026**. The existing, tested CFB HTTP reader performs a public candidate viewer page GET and POST reports-tab API request per ID; a maximum of two requests are active at once. The source result retains official viewer URL and API response SHA-256, fetch timestamp, per-filer reference count, exact CFB report viewer params, amendment number, and source status. No PDF or donor details are fetched.

Only original **2025** report-reference year entries survive into the report reference audit. A report viewer reference is **not** an original report PDF, verified filing date, public-by date, report-year obligation, original-versus-amended uniqueness count, or proof the committee legally had to file. A report with an amendment parameter is version-specific and cannot substitute for the original; no report should be used as evidence without exact-file identity/containment and legal/historical time rules.

### One-time acquisition and reproducibility

The [PR-only workflow](../../.github/workflows/cfb-2025-dated-senate-report-refs.yml) runs only when its script, test, selection module or workflow changes. It does not run on a schedule, does not read/write production databases or trigger retraining/model serving, and does not alter 2027.

    node --import tsx scripts/capture-cfb-2025-dated-senate-report-references.ts --output artifacts/cfb-2025-registered-senate-report-viewer-references.json

    node --import tsx --test research/tests/cfb-2025-dated-senate-registration-cohort.test.ts

The offline selector validates exact source-viewer ID and segment masks, and the SHA-256 of the 230-reg date ledger from the prior source proof. It refuses to proceed unless the cohort remains **41/78/15**. In particular **19205** (independently verified Senate District 6 original 2025 PDFs) is a mandatory cross-control. Source failures are materialized and cause the job to fail rather than translating into "no report filed". A public current-list match cannot establish historical filing validity.

## What remains to establish genuine 2021–2025 campaign-finance completeness

1. Recover dates and committee lifecycle status for the **15 as-yet-undated IDs** within the 2026 viewer-only segment and **264 IDs** from older viewers absent the 2026 public current list. Historical office/district assignments and termination/renewal history are still unverified.
2. Build a *regulator-source-proven legal filing obligation ledger*, using 2021–2025 election and special-election calendars, reporting triggers, affiliated committees, waivers and termination requirements. A candidate reporting 2025 year-end in 2026 does not retroactively become 2025-eligible prediction evidence.
3. Recover, SHA-256 hash and reconcile actual original CFB PDFs; distinguish amendments and original report versions, filing dates, statutory disclosure floor, actual public-by and exact finance row containment.
4. Treat 2026 current-registry membership and apparent missing viewer references as **source observations, not evidence of legal compliance or nonfiling**.

Keep issue #864 open. Official complete 2021–2025 Senate filer/report denominator and DB reconciliation remain explicitly null and no production changes are authorized.
