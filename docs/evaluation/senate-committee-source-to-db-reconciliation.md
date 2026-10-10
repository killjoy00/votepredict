# Issue #864 — Senate 2022–2025 original minutes to database reconciliation, offline only

**Purpose:** compare actual original CFB-free Minnesota Senate committee vote/action PDF observations to the already stored evidence records, without silently reingesting and duplicating old events. This is a *private, read-only export + offline reconciliation workflow*, not a public production database operation or an approved update.

## Inputs must be independently obtained

1. The [independent LRL meeting-link census](./senate-committee-2021-25-official-meeting-census.md) enumerates 1,592 official **2022–2025 indexed electronic meeting entries**, 1,452 actual Minutes-PDF links and 141 listed meetings with **no linked PDF**. Missing PDFs do not establish that no vote occurred. **2021 official Senate print minutes and the potential 2022 print-only minutes remain an independent gap.**
2. The [original-PDF action audit](./senate-committee-2022-25-original-pdf-action-census.md) reads the exact original 2022/23/24/25 Minutes PDF bytes. Its metadata-only year manifests preserve each original source SHA-256 and exact source vote-event external keys, tally, context action keys, and **one-way hashes of named member choices**. Parser output only identifies **candidate** recognized actions: the parser might miss other actions, so a full official vote/action denominator is not certified.
3. A separately authorized **SELECT-only** evidence database export. This conversation does **not** authorize that DB access. The query template [export-senate-committee-actions-reconciliation-readonly.sql](../../scripts/export-senate-committee-actions-reconciliation-readonly.sql) selects only original source document URL/hash/date/committee and corresponding persisted vote_event IDs/keys/day/tallies, member_votes normalized source names and membership IDs, and context-action evidence identity/kind/day. The normalized member names are public officials' names and are read **only by the private offline reconciler**, which hashes in memory and emits **no names**. There is **no donor, contact, claims, motion text, source body, forecast or outcomes** in the SQL export.

Do not run the export with an unrestricted production role or DB-bridge secret. Do not upload the private export, source-row reconciliation results or source PDF bodies to GitHub, an Actions artifact, external services or this issue.

Private operator use, only after owner authorization:

    psql -X -A -t -v ON_ERROR_STOP=1 -f scripts/export-senate-committee-actions-reconciliation-readonly.sql > private-senate-committee-actions.jsonl

Then, locally with exactly the downloaded original Action source manifests:

    node --import tsx scripts/reconcile-senate-committee-actions-offline.ts --source path/to/2022.json --source path/to/2023.json --source path/to/2024.json --source path/to/2025.json --db-export private-senate-committee-actions.jsonl --output private-senate-source-to-db-results.json

**The planner has no database driver, internet fetch, secrets loader or writes to a remote service.** It requires an explicit export file and never uses an absent DB export as a silent zero-row database universe. Outputs are local only.

## Reconciliation proof categories

Per original hashed PDF and by committee/year:
- Original source document missing from the export, duplicate source document, or original **PDF SHA-256 mismatch**. A retrieved 2026 PDF may differ from the historical stored original and must not be force-joined by URL alone.
- Original source exact hearing date and committee mismatch.
- Original recognized named or count-only source rollcall **missing in vote_events** (uses exact ingestion external_key), duplicated, inconsistent event hearing day or yea/nay tally. A count-only rollcall has *zero* inferred named votes. A named rollcall has explicit source name+choice hashes compared with the persisted member_votes (normalization and choice included), and unresolved DB membership IDs are a separate defect.
- Original voice/unanimous/result-only source action absent, duplicated, wrong subtype, wrong date, inferred membership or unverified source. Extra stored events/actions that the current original-source parser did not recognize require manual review, not silent deletion.
- Individual original PDF fetch/parse failures are separately counted. The 2021 print-only year and 2022 mixed-source collection are never represented as fully complete.

**Matching the parser observations to the database does not prove every actual action was extracted from the PDF.** The offline report therefore always leaves historical all-meetings and all-roll-call official denominators null, no completion certificate, no evidence eligibility promotion, and no production mutation.

## Independent legacy hearing-date correction

The separate [#879 reviewed, ROLLBACK-only legacy repair plan](./senate-committee-legacy-hearing-evidence-repair.md) uses the original source URL/hearing date/source SHA/observation identity/old flag checks before marking a stored item as a **repair-review candidate**. It is not an approved production correction. Any actual update needs new owner authorization, a trustworthy exact private SELECT-only export and a separate reviewed operator procedure. Naively rerunning the backfill could duplicate evidence due to the older date-dependent ingestion key.

**No production DB or model changes are made by this PR.** Keep issue #864 open until the original print/archive and row-level completeness requirements are truly met.
