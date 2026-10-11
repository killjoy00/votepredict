# Track D: public Wayback capture verification

**Scope:** issues #987 (MPR episode interviews) and #946 (Reformer briefs). Public research only; no production changes, private VotePredict records or individual senator quote certification.

The current investigation cannot reach the Internet Archive CDX/Wayback endpoints from its network. No actual 2021-2025 capture, original article byte hash, first-public-by time or private source row has been independently verified by this new tool. The checks in this PR use wholly synthetic HTTP fixtures. Network unavailability does not mean no historical archive exists.

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