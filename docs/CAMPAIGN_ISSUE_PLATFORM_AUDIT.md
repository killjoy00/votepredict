# Senate campaign issue-platform evidence audit (2021–2025) — #864

This is a **static, credential-free, offline coverage and provenance audit**. It does not connect to Neon, Vercel, Wayback or other remote services. It does not run historical backfills or change the model, serving, vote labels, database, historical frozen artifacts or schedulers.

## Baseline and precise historical scope

The #477 closeout reported 350 / 551 / 405 Senate issue-position items across 23/67, 31/68, and 38/70 Senate memberships in 2021–22, 2023–24, and 2025–26. These are prior collection counts, **not** a statewide campaign-platform completeness certificate. The 2025–26 membership session is included only for calendar year 2025. A 2020 archived campaign page can prove an eligible public-by bound for 2021; a 2026 capture cannot be backdated to 2025.

The existing v3 Wayback selector retains at most one capture per original URL and capture year, favoring the latest, then applies a per-seed selection cap (40 in the v3 workflow). The CDX query is capped at 400 rows per seed, uses digest collapse, and the seed collector deduplicates by senator membership, source family and host. Thus cursor completion cannot prove every domain, URL, page version, statement or changed position was seen.

## Required offline JSONL exports

Each file contains one JSON object per line. Each of the first four files is mandatory and may be empty; the independent roster should enumerate **every relevant membership**, not only memberships with existing evidence.

1. roster.jsonl: membershipId, senatorName, sessionSlug (2021-2022, 2023-2024, 2025-2026). This tool does not independently certify the supplied membership denominator.
2. sites.jsonl: membershipId, campaignYear (integer or null if unproven), url, status (documented, unavailable, unverified), registrySourceUrl (source proving candidate ownership or null). Include lost, defunct, redirecting, archive-only and unresolved campaign domains. A missing site is unknown, not proof there was none.
3. captures.jsonl: membershipId, campaignYear, originalUrl, archiveUrl (exact Wayback /web/<timestamp>id_/ URL), capturedAt (UTC ISO timestamp), archiveDigest (CDX digest or null), selectedByV3 (boolean), snapshotStatus (fetched, failed, not_selected), contentSha256 (original fetched source-body hash or null), pageText (exact extracted text or null), pageTextSha256 (hash of UTF-8 pageText or null), pageType (issue, platform, policy, other, unknown), originalPostedOn (page-declared original post date or null). Include unselected CDX versions to measure losses caused by yearly collapse. If original bytes/text were not acquired, leave the fields null rather than fabricating them.
4. statements.jsonl: membershipId, archiveUrl, policyFamily (one of the deterministic ISSUE_POSITION_FAMILIES), exact excerpt, attribution (candidate, third_party, ambiguous), stance (supports, opposes, unclear). These are **reviewer-provided labels**; the analyzer does not certify speaker/authorship attribution. Do not mark third-party quotations as a senator's position.
5. Optional discoveries.jsonl: membershipId, seedUrl, requestedLimit (1–2000), returnedCount, status (complete, failed). Include attempted and failed seeds. Missing discovery logs remain explicitly unknown; a response reaching its row cap is potentially truncated.

The source/roster export itself is **not executed by this change**. It requires separately authorized SELECT-only database access and independently verified external Senate/SOS/archive inventories.

## Run

    node --import tsx scripts/audit-campaign-issue-platforms-offline.ts \
      --roster /path/to/roster.jsonl \
      --sites /path/to/sites.jsonl \
      --captures /path/to/captures.jsonl \
      --statements /path/to/statements.jsonl \
      --discoveries /path/to/discoveries.jsonl \
      --output /path/to/senate-platform-audit.json

The command never opens a network connection or database. Each input is bounded to 64 MiB and 50,000 JSONL records. The JSON output is created with mode 0600, and the script refuses to overwrite an input file.

## Interpretation

Every membership appears in the output, even when all evidence inputs are missing. Gap codes include missing URLs, unavailable provenance, unknown campaign year, invalid archive time/URL identity, missing hashed snapshot text, unselected same-year digest versions, failed/truncated discovery and unverified attributed excerpts. The earliest available-by bound can come only from a matching archive-capture timestamp and matched statement text in a corresponding candidate-owned, campaign-year-associated page. The post date printed on the original page is reported separately and is never used to predate the capture.

The pageTextSha256 is recomputed from provided text, but the full HTML/contentSha256 and archived source ownership are still upstream attestations until the original bytes and registry proof are independently inspected. The tool reports local manifest consistency; it is **not** an independent historical-source authentication service. Labels such as NO_PROVEN_ATTRIBUTABLE_STATEMENT describe missing proof in this ledger only: they must never become “no issue position”, a neutral vote prediction or opposition. Issue-level support/opposition is never converted into a position on a particular HF/SF bill.

A membership marked audited_sample_only merely has no identified gaps **within its submitted sample**. The report always sets officialRosterDenominatorVerified=false, archiveUniverseComplete=false, and reconciliationCertified=false. No new historical eligibility or forecast effect is claimed.

## What remains

1. Establish a complete, independently verified 2021–2025 Senate senator/membership denominator and campaign-year domain/URL inventory from official candidate filings and archived sources, including special elections and lost domains.
2. Obtain and inspect original campaign-page bytes and multiple captures per URL/year, including previously unselected digest changes and missing page versions, without silently rolling the production backfill cursor.
3. Reconcile original excerpts/hashes/earliest proved public-by dates to exact stored source_document and evidence_item rows from an **explicitly authorized SELECT-only export**.
4. Propose a separately reviewed, versioned historical capture strategy if the archive-audit confirms missing older versions. Keep current serving/model and frozen evaluation untouched.
