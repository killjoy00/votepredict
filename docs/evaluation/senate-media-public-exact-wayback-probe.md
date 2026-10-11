# Track D: public Wayback capture verification

**Scope:** issues #987 (MPR episode interviews) and #946 (Reformer briefs). Public research only; no production changes, private VotePredict records or individual senator quote certification.

The current investigation cannot reach the Internet Archive CDX/Wayback endpoints from its network. No actual 2021-2025 capture, original article byte hash, first-public-by time or private source row has been independently verified by this new tool. The checks in this PR use wholly synthetic HTTP fixtures. Network unavailability does not mean no historical archive exists.

## New GitHub Actions pilot and five-year research batch (#987/#946)

[Senate media public Wayback exact proof batch](https://github.com/killjoy00/votepredict/actions/workflows/senate-media-public-wayback-proof-batch.yml) is a **separate no-secret, contents-read-only** workflow. It can be run by the repository owner through **Actions → Run workflow**, with `scope=pilot` or `scope=all`, and `replay_count=0/1/2`. An alternative owner-only exact issue comment on [#987](https://github.com/killjoy00/votepredict/issues/987) triggers it: `[senate-media-public-proof]` (pilot, one replay) or `[senate-media-public-proof-all]` (all 31 curated URLs, one replay). The trigger rejects other authors, comment values and issues.

The **four pilot URL leads represent three stories**: `mn-reformer-2024-sanctuary-brief`, `mn-reformer-2024-sanctuary-dated` (different *unverified* historical URL aliases), `mpr-2024-hauschild-north-star-on-air-interview`, and `mpr-2023-kunesh-native-family-preservation`. The **all** scope makes at most 31 independent exact-CDX index requests covering public examples across each of 2021–2025, with concurrency 3 and 20-second timeouts per response. Each index returns at most 20 captures; at most two exact timestamped `id_` replays per URL are allowed. The workflow has a 17-minute timeout, strict branch/owner gates and **no production database or Neon secrets**.

It emits a 7-day GitHub Actions artifact `senate-media-public-wayback-proof-batch` containing only `artifacts/senate-media-public-wayback-proof-batch.json`. It never persists article bodies. Public result statuses are **index_candidates**, **index_empty** (empty *bounded response*, NOT no article published), **index_failed** (network denial/invalid CDX response; historic availability unknown), followed by optional **matched_indexed_payload_sha1** (bounded replay bytes independently consistent with CDX's indexed payload digest; SHA-256 metadata recorded but NOT a private VotePredict source match) or precise failure status. An empty/blocked index, replay checksum mismatch or unsampled archive page is **not evidence of nonexistence**. No quotes, audio, speaker identity, original first-public-by, private DB row, eligibility or statewide completeness are certified in the **public** workflow.

Equivalent local run:

```bash
node --import tsx scripts/probe-senate-media-public-wayback-batch.ts \
  --scope pilot --replay-count 1 \
  --output artifacts/senate-media-public-wayback-proof-batch.json
```

All report metadata is designed to be subsequently checked **offline** against separately authorized private source-document exports, never by granting this public Actions workflow database access. Running a single URL via the script below remains supported.

## Run with an Internet-connected checkout

```bash
node --import tsx scripts/probe-senate-media-public-wayback.ts \
  --lead-id mpr-2024-hauschild-north-star-on-air-interview \
  --replay-count 1
```

Use `--replay-count 0` for index metadata only, or 1 or 2 for no more than two exact timestamped original HTTP requests. Valid IDs already in the public ledger include `mpr-2023-kunesh-native-family-preservation`, `mpr-2025-pha-hmong-lao-veterans`, `mn-reformer-2024-sanctuary-brief` and `mn-reformer-2024-sanctuary-dated`.

The script accepts a selected research ID, not an arbitrary URL. It requests one exact public URL's 2021-2025 CDX index with a 20-row cap. It does not use `collapse=digest`: identical-content captures at two different timestamps must remain two observations. The script refuses a redirect, substituted URL, malformed date, out-of-range capture or mismatched MIME. It never stores or displays article bytes, runs SQL, or changes evidence or predictions.

**Index metadata alone cannot authenticate article or audio content.** A successful exact-timestamp original replay is accepted only if its fetched raw HTTP body matches the indexed CDX base32 SHA-1 digest; the script then emits an observed SHA-256. These digests are not the private VotePredict `source_documents.content_sha256` unless independently matched. An index page limited at 20 is not a capture census.

The report always keeps first publisher publication time, original audio/transcript availability, verified individual speaker, private VotePredict row match, and historical forecast eligibility **unverified**. For example, MPR transcripts may be added after broadcast. A replay mismatch can result from encoding or archive behavior and is not proof the article never existed.

Synthetic regression test:
```bash
node --import tsx --test tests/senate-media-public-wayback-probe.test.ts
```

The separate private SHA-256 rehydration runbook remains authoritative for any separately authorized VotePredict source export.