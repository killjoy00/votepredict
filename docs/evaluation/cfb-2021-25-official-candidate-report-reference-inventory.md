# Issue #864: historical Senate CFB candidate report references — bounded source-led discovery

**Date:** 2026-10-09. This is a **source discovery and provenance** tranche in the existing 2021–2025 campaign-finance completeness project. Nothing here alters `evidence_items`, model cutoffs, frozen artifacts, forecasts, production databases, Vercel, schedulers, or the 2027 program.

## Why and what is genuinely established

The CFB's official [historical candidate viewer](https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/) has a `Reports and Data` tab, backed by the existing `reports_data` endpoint used in `src/evidence/cfb-candidate-report-history.ts`. Each registration is queried in **two-year election segments ending 2022, 2024 and 2026**. The 2026 segment is needed to check 2025 reports; it is **not permission to expand the historical study into 2026/2027**.

The new `fetchCfbCandidateHistoricalReportReferenceSnapshot` reuses the existing session/API/parser, but now captures the precise response-body SHA-256, official source viewer page, API endpoint and retrieval time alongside the extracted `viewPDF` parameters. The original reference fetch API remains available unchanged through a wrapper.

The new `auditCfbSenateCandidateReportReferences` is a pure deterministic offline join between **explicit Senate candidate-filer-years supplied by an independent input** and source snapshots. It emits one row per filer/year, independent statuses and report-reference entries with official viewer PDF URLs, a source response SHA and the retrieval timestamp. It never guesses a due date from a report title or a publication date from a fetched-at timestamp.

**Critical: an `observed` viewer reference is NOT an official report-file acquisition, an earliest historic available-by date, proof the finance row appears in that report, or the official required/actual-filing denominator.** Reports filed on paper, waived filers, amendments and missing/unfiled reports can be omitted or represented differently. A committee's absence from a *partial target list derived from already persisted finance rows* can be entirely invisible. Null denominators and explicit gap states are intentional.

All recognized report entries have:
- `reportPdfSha256=null` until original official PDF bytes independently pass download validation and hashing.
- `reportFiledOn=null`, `reportDueOn=null`, `availableOn=null` until the independently reviewed authoritative regulator dates and report identity are proven.
- `rowContainmentVerified=false` until an actual row is found in that precise official report.
- Only an `https://register.cfb.mn.gov` candidate-viewer source with consistent registration/segment, SHA format and report year is accepted into the year-specific observed count.
- Separate `source_not_probed`, `source_fetch_failed`, `source_payload_invalid`, `source_snapshots_conflict`, `no_matching_year_references` and `source_references_observed` labels. **`no_matching_year_references` is not evidence no report was legally due or filed.**

## Run the bounded public-source capture

The command below makes **two official CFB read requests per registration+segment** (a viewer page and a public reports-tab API request). It does **not** download PDFs, raw itemized donations, addresses, proprietary data or historical forecasts. It makes no database connection and requires no secret. Each invocation caps to five numeric registration IDs and three historical segments. Source failures are recorded as failures, not swallowed as zero reports.

```sh
node --import tsx scripts/capture-cfb-candidate-reference-inventory.ts \
  --registrations 19205 \
  --segments 2026 \
  --output /private/cfb-source-references.jsonl
```

**The specific registration 19205 is a bounded public-source contract probe only** (the CFB's published [board enforcement document](https://register.cfb.mn.gov/pdf/bdactions/1753_Complaint.pdf) names a 2025 Minnesota Senate committee and the registration). It is **not** an assumed representative sample or complete Senate roster, and this code makes no inferred stance claim.

The one-time [2025 candidate report reference source probe](../../.github/workflows/cfb-2025-candidate-report-reference-probe.yml) is scoped to precisely that one registration and its 2025/26 viewer segment. It triggers when its workflow file is first merged into `main`. It writes a JSONL artifact containing only official public report-reference metadata and per-source success/failure; a successful GitHub job may still contain `fetch_failed` source records and must not be misreported as having retrieved source data. No production credentials or scheduled trigger.

## Reconcile against previously exported private evidence — offline

Input evidence is the allowlisted private JSONL from the existing [read-only SELECT template](../../scripts/export-cfb-historical-senate-evidence-readonly.sql); **obtaining that export from a real database requires separate authorization and a verified read-only DB role**. The tool derives `filerRegistrationNumber + year` targets only from Senate candidate contribution/expenditure source kinds (not IE, PACs, party units, House or 2026 records). This is only the persisted-row footprint, **not a comprehensive list of Senate candidate committees**.

```sh
node --import tsx scripts/audit-cfb-candidate-reference-inventory-offline.ts \
  --evidence /private/senate-finance-evidence.jsonl \
  --snapshots /private/cfb-source-references.jsonl \
  --output /private/cfb-reference-inventory-audit.json
```

You may add `--targets /private/officially-reviewed-senate-filer-years.jsonl` (one object per line, e.g. `{"registrationNumber":"19205","year":2025}`) to supply **separately reviewed** Senate filer-year scope beyond those already in the database. The tool does not independently verify user-supplied candidate or chamber identity. Never claim a complete official denominator from an unverified target list.

The audit output contains `filerYears`, `reports`, `byYear`, `denominator` and `policy`. Counts in `byYear` are scoped viewer-reference counts **only**; all true official counts remain `null`.

## Legal and completeness gates still required

Minnesota [§10A.20 subdivision 1b](https://www.revisor.mn.gov/statutes/2025/cite/10A.20) makes an ordinary report nonpublic until **8 AM the day after the report was due**, not the day after it was received. For each actual report, independently recover and prove:
1. Exact CFB filer identity and office by year, **including committees with no persisted finance rows**; current lists may omit terminated committees. Handle early terminations, nonfilers, unfiled reports and electronic filing exemptions distinctly.
2. Full official report **required/received** ledger for 2021–2025 (candidate, PCF/IE, PAC, and party unit as separate universes), amended report versions, true reporting deadline including category-specific election/special-election calendars, filing date, and historical legal release. The CFB [archived disclosure calendars](https://cfbreport.state.mn.us/filer-resources/disclosure-publications/calendars/calendars-archive) list separate general and special-election schedules. Do not apply one January-31 rule to every report category.
3. Original PDF bytes and hashes, exact finance-row containment, original report period, independently verified earliest public date, and conservative same-day exclusion. A retrieved API list or later capture does not backdate documentary availability.
4. A **read-only**, source-to-row reconciliation against existing historical rows and **previously eligible v6 timestamps**, split by 2021–2025/calendar year and finance entity class. Prepare but do not execute an idempotent correction without separate authorization.

The current patch is **not a completeness certificate** and does not fill the official `denominator` introduced by #867; issue #864 remains open.
