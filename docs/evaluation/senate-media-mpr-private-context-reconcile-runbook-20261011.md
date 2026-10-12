# Private, read-only MPR original-source reconciliation — operator runbook

**VotePredict #987 · October 11, 2026 · no database credentials or actual private production rows used in GitHub.**

## Scope and important limit

The public [six-interview historical receipts](senate-media-mpr-six-interviews-public-reconciliation-20261011.json) authenticate **five** independent original MPR News HTTP HTML bodies across **three** already-known first-party interview URLs. The existing [context SQL export](../../scripts/export-senate-media-context-readonly.sql) selects only `source_documents.source_kind='wayback_local_trade_news'` joined to `evidence_items` with `contextType='local_trade_news'`: the historical **44-source local-news collector**, not every VotePredict source or evidence pipeline. A missing exact original from **this export** means only that the bounded *export did not show it*, not that VotePredict never held the article, transcript, senator statement, or another URL alias.

The only connected Neon database available during this investigation identified itself as **`pack1`**, not VotePredict. We ran *only* a constant connectivity query, a session identity/settings query, and table-name metadata listing; **no Pack One application records were queried or changed**. We did not try to locate, copy or use any Pack One credentials, and did not claim VotePredict production database access.

## Usage on an authorized operator's machine only

1. Use a **separately authorized restricted SELECT-only VotePredict role**. Confirm the project and database identity before reading any tables; do not reuse unrelated app credentials or an owner/admin connection. If no suitable role exists, leave the actual private comparison unrun.
2. Produce the **private** source-context JSONL with [`scripts/export-senate-media-context-readonly.sql`](../../scripts/export-senate-media-context-readonly.sql). Do not paste, upload, log, or commit the export, credentials, source hashes, article bytes, source IDs, or row-level matching report.
3. Run locally, with no network access required:

```bash
node scripts/reconcile-mpr-interviews-private-context.mjs \
  --context PRIVATE-context.jsonl \
  --output PRIVATE-mpr-reconciliation.json
```

The script reads the committed public original SHA/UTC receipt manifest and a **separately supplied local private JSONL file**. Output is written exactly once with mode `0600`. It writes *aggregate and public-lead/UTC statuses only*, never private source IDs, private hashes, URLs, raw source bodies, row-level matches, or senator statements. Only a deliberately small **aggregate** can be discussed in public, and even then publishing private counts needs owner/privacy review. A `--output` file name must not be reused.

## Reconciliation rules and what a result means

- `exact_private_source_record_in_this_export`: exact first-party original URL, strict timestamped `id_` Wayback archive URL, capture UTC, original raw SHA-256 **and** expected source kind, publisher, seed, archive URL and storage URL match inside the **supplied context export**. This is only an archived source-body match, **not** proof of an independently audited full quote, source-publication time or historical model eligibility.
- `same_original_publisher_url_other_archived_version_only`: the private scoped export contains a record at the same MPR first-party original URL but **not the specific public snapshot**. Keep archive-version and raw original content SHA distinct; do not count as exact.
- `conflicting_or_invalid_private_provenance`: a selected URL or capture conflicts in digest, archived UTC, or multiple context rows sharing a sourceDocumentId disagree about its source identity. Explicitly resolve before treating it as evidence.
- `same_original_url_or_archive_alias_unverified`: a partial URL/archive overlap without the entire exact source identity. Do not infer historical redirects, canonical aliases, original bytes or archived availability.
- `not_observed_in_bounded_context_export`: no overlap in the supplied 44-source export. **Unknown outside the export**, not global absence, not newly missed articles, not forecast lift.

One article with multiple `evidence_items` still contributes **one distinct source document**, and selected original page *versions* never increase distinct article or quote counts. Exact original archived source matching must be followed by reviewed complete statement attribution, serving Senate term, original-date proof, passage and source SHA verification, before claiming any verified senator remark. The October 2024 Kunesh case remains especially sensitive: selected transcript cues were absent in the Oct 22 original and present by Dec 11. Never backdate the later transcript to the broadcast date.

## Reproduction and next handoff

Run offline adversarial tests:

```bash
node --test tests/reconcile-mpr-interviews-private-context.test.mjs
```

Tests are entirely synthetic except for read-only checked-in **public** receipt identities. No GitHub Action or workflow accepts private context JSONL, and no Neon/private role is accessed by the script. This step enables a correct private source audit once the right restricted VotePredict SELECT role/export is available; it does **not** claim that comparison actually occurred here.

Next, after that legitimate private comparison, rank only confirmed unrepresented originals or version gaps, separately check any other ingestors/aliases, and propose tested **shadow** improvements for `/episode/` and topical URL selection. Approval for changing historical collectors or training remains a separate decision. Keep #987 open until real evidence coverage and missingness are measured.
