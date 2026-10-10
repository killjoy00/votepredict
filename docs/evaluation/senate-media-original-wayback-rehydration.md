# Track D: exact original archived media bytes and private reviewer queue

**Follow-up:** [#912](https://github.com/killjoy00/votepredict/issues/912), building on [#904](https://github.com/killjoy00/votepredict/pull/904) and [#909](https://github.com/killjoy00/votepredict/pull/909). Historical study years: **2021–2025 only**. The 44 news publisher prefixes are a bounded discovery corpus, not a complete statewide media universe.

## Why this step is necessary

The first media audit requires the **precise archived HTTP body bytes** hashed by the original local/trade news collector, not a public live article, current Wayback page, excerpt, screenshot or copied news quotation. The SELECT-only export from #909 contains source-document IDs and SHA-256 fingerprints but intentionally no raw article bodies. This new operator-run helper attempts to retrieve each **exact timestamped `id_` Wayback URL**, checks the response body SHA against the corresponding `source_documents.content_sha256`, and never marks a statement verified automatically.

**Live status:** The ChatGPT Neon connection previously found was `pack1`, not VotePredict. There is not yet an actual restricted-role VotePredict source export. The tool, docs and tests are preparatory. CI synthetic tests do not constitute successful fetching of the production source corpus.

## Local private workflow

First, export `media-context.jsonl` and `senate-roster.jsonl` with the separate [private SELECT-only runbook](senate-media-private-export-runbook.md). On a trusted machine that can reach the public Internet Archive, from the repository root:

```bash
node --import tsx scripts/rehydrate-senate-media-archive-private.ts \
  --context "$HOME/votepredict-media-private-2021-25/media-context.jsonl" \
  --roster "$HOME/votepredict-media-private-2021-25/senate-roster.jsonl" \
  --output-dir "$HOME/votepredict-media-original-batch-0" \
  --offset 0 --limit 6
```

Optional `--year 2023` limits the batch to the **capture year**, not the independently proven article publication year. `--offset` is over deterministic eligible original archived sources; use the `nextOffset` printed by the preceding run in a **new** output directory. Each run is bounded to 1–12 HTTP GET attempts, sequentially, with a delay between them. No GitHub Action, Neon project owner role, production secrets, or Vercel environment access is needed for this second step **after** the authorized export.

Original archive URL validation refuses non-HTTPS, non-`web.archive.org`, redirects, mismatched original URL/capture timestamps, illegal or non-neutral context rows, and malformed original SHA-256. A URL with the **same article content at a different archive capture** is a different source: no substitution. The receiver accepts only HTTP 200 HTML/plain/XHTML, imposes the same 2,500,000-byte body cap as the historical collector, hashes the **binary response bytes**, and stores raw bytes only on an exact original SHA-256 match. A change to the original response is explicitly `original_bytes_hash_mismatch`; the new body is discarded rather than silently re-certified.

Private outputs (new directory, 0700; files, 0600; never in the checkout):

- `source-attempts.jsonl`: per-source status, original observed digest if a response was available, and failure categories; no article body
- `human-review-queue.jsonl`: original source identity, name-mention **leads only**, capture/date fields, source-proof status, explicit *unreviewed* state, and no certified speaker or issue
- `authenticated-original-snapshots.jsonl`: **only when at least one exact SHA match**, base64 of the exact archived HTTP body keyed by sourceDocumentId, compatible with `--snapshots` of the existing #904 offline auditor
- `discovery-audit.json`: updated senator/year and publisher/year context coverage, source snapshot availability, and explicit missingness; **zero verified quotes without human review**
- `manifest.json`: version, deterministic batch boundary, matched/mismatched/unavailable counts, output SHA-256 and no completeness flag

All outputs are private; **never attach article bytes or member/source rows to GitHub issues, CI logs/artifacts, chat messages or public documents.** Console output prints only aggregate counts/status and private output path. If no source matches the original SHA, no snapshot file is written: do not pass a nonexistent/empty `--snapshots` file to the auditor.

## Next: human attribution review (still outstanding)

1. For each byte-verified source, independently inspect original HTML, original publication timestamp/line, and distinct Wayback capture time. Do not use archival capture year as a substitute for article publication year.
2. Confirm the precise speaker is an actual Senate member on the **publication date**. A source that merely names a senator is not a quotation. Distinguish reporter paraphrases, anonymous captions, other speakers and delimited verbatim quotations.
3. Record a human `SenateMediaReview` disposition for the original source with reviewed name, time, membership, issue, named cue, exact original source passage and date proof. Use `exact_named_quote` only with independently verified source/date/name semantics, not mechanical matching alone.
4. Run `scripts/audit-senate-media-remarks-offline.ts` with private `--reviews`, `--context`, `--roster`, and the independently matched `--snapshots`; a quote passes only if all existing #904 gates succeed.
5. Summarize **by publisher and calendar year** and **by senator and publication year** verified vs ambiguous vs unavailable items; retain unknown statewide denominator and the 2026 exclusion. Do not alter predictions, models, backfills or data-serving without separate review.

**Important:** A network response with a different SHA is not proof of data corruption; Wayback responses can vary or become inaccessible. Record the gap, investigate under separate provenance work, and never rewrite the database fingerprint to match a newly fetched body.
