# Track D: reconcile private original Wayback batches and historical missingness

**Issue:** [#912](https://github.com/killjoy00/votepredict/issues/912). **Scope:** only historically captured 2021–2025 Senate local/trade news evidence in a separately authorized VotePredict SELECT-only context export. This is **not** a statewide media publication denominator, senator quotation census, model or serving feature.

## Why this is separate from the Neon key

The [manual GitHub Neon identity/read-only preflight](senate-media-gh-neon-access.md) and the [single-private-database export](senate-media-private-export-runbook.md) are independent. [Run #38084474936](https://github.com/killjoy00/votepredict/actions/runs/38084474936) proved that the GitHub Neon management API key authenticates to the correct VotePredict project, **but specifically reported** `project_verified_readonly_database_url_required`: the restricted SQL URL was not supplied. A Neon API key cannot substitute for SQL role privileges. **No live VotePredict media export has happened.**

After the private export, the [exact Wayback source rehydrator](senate-media-original-wayback-rehydration.md) fetches up to 12 archived responses per separate private batch. It verifies the original SHA256 and writes the matched bodies only in private source-batch directories. This new third step combines those batches and finds *unattempted, inaccessible, changed and hash-authenticated* sources, not quote verdicts.

## Offline private reconciliation

Run in the checked-out repo on the trusted operator's machine, after exporting the two JSONL files and running one or more batches. Inputs **and the destination must be absolute paths outside the Git repository**, and the output directory must not already exist:

```bash
node --import tsx scripts/reconcile-senate-media-batches-private.ts \
  --context "$HOME/votepredict-media-private-2021-25/media-context.jsonl" \
  --roster "$HOME/votepredict-media-private-2021-25/senate-roster.jsonl" \
  --batch-dir "$HOME/votepredict-media-original-batch-0" \
  --batch-dir "$HOME/votepredict-media-original-batch-12" \
  --output-dir "$HOME/votepredict-media-reconciled"
```

`--batch-dir` is repeatable; if there are no batches yet, omit it to obtain a **zero-retrieval baseline with all eligible original articles marked unattempted**. For large source sets, use each batch's `nextOffset` from the rehydrator manifest. Up to 1,000 private batch directories are permitted as an absolute bounded ceiling.

Every supplied batch has its manifest, source attempt ledger, unreviewed human-review queue, discovery-only audit, and possibly authenticated snapshot JSONL checked **against all recorded SHA-256, file sizes and row counts**. The reconciliation re-derives the exact selected source IDs, chronological order, year, publisher, SHA fingerprint, request offset and year filter **from the original context export**, independently of the batch manifest. It rejects duplicate or overlapping attempts, missing original bytes for claimed hash successes, contradictory observed digests, altered source snapshots, spoofed quote approvals and any wrong batch count.

Results are stored only in the newly created private 0700 directory with 0600 files:

- `source-retrieval-coverage.json`: 2021, 2022, 2023, 2024 and 2025 exact-source retrieval counts; by publisher × capture year: eligible source documents, attempted, original SHA matches, changed-body mismatches, network/unavailable failures and never-attempted. Also explicitly counts 2026/excluded records and invalid provenance separately.
- `authenticated-original-snapshots.jsonl`: generated **only if a real batch has original bytes matching the previously exported database SHA**, and safe to pass to the **existing offline quote auditor's** `--snapshots` option. This file contains raw article bytes encoded as base64 and must remain private.
- `manifest.json`: SHA256 of context/roster inputs and batch manifests, plus SHA256/bytes of outputs. No remote upload or GitHub artifact.

The console only prints aggregate counts and the private output path. Failed validation prints no sensitive source data, URLs, credentials, article text or quote fields.

## Reproducible count invariant for reused archived sources

The corrected `planSenateMediaRehydration` now preserves **raw evidence context row** counts even when several context rows share one archived `sourceDocumentId`, while retrieving the source body only once. A private batch manifest must exactly match the re-derived row totals and deterministic unique original-source selection; the reconciliation rejects an old/bad count rather than silently accepting an apparently complete but incomplete source audit.

For the independently verified [protected Neon capture-year baseline](senate-media-verified-live-neon-capture-year-counts.md), there are **794** 2021–2025 context rows, **154** outside-year context rows, and **688** distinct sources **summed within study-year buckets**, never established as globally unique articles. These numbers are **external verification context** only. A future export must be compared with the actual corresponding database/branch snapshot, not forced to satisfy 794 and 154 if the data has since changed. Senator-mention leads from repeated source contexts remain *discovery leads*, not human-authenticated quotations.

## Interpreting a result

An attempt-coverage rate uses **only eligible archived records in the supplied VotePredict export** as the denominator. `retrievalAttemptsCompleteForEligibleExport=true` means each eligible source received exactly one validated GET attempt across the supplied batches; **it does not mean** all sources were recoverable, all 44 publishers were exhaustively searched, all senators were quoted, or all historical remarks exist in the export. A 2026 archive capture is excluded even when its legislative session is marked 2025–2026. The source collector's 948 previously reported context items span 2021–2026; they are not 948 quotations or the 2025 count.

A verified original source-body SHA only establishes source identity. Independent named-quote review remains mandatory: verify a precise senator and membership on the article's *publication date*, contiguous exact direct-speech passage, publication-date proof in authenticated original HTML, separate archive public-by proof, actual legislative issue and human reviewer identity. **No automatic semantic quote classification and no production SQL writes** occur here.

Maintain [#912](https://github.com/killjoy00/votepredict/issues/912) as open until the correct SELECT-only VotePredict connection, private source export, historical source review and senator/year completeness limitations are independently reconciled. Do not post the private generated files or article bytes to GitHub Actions, issues, PRs or chat.
