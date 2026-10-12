# #864 Track B — CFB historical Wayback access triage V3 (PUBLIC ONLY)

**Scope:** determine why public original-source retrieval is held. Not a historical original-byte proof, stored-row parity check, official report PDF publication certification, or statewide report denominator. Issue #864 remains OPEN.

## Previous source-recovery results

- The protected [V2 finance metadata audit](https://github.com/killjoy00/votepredict/issues/864#issuecomment-6126220510) and [V3 finance archive metadata audit](https://github.com/killjoy00/votepredict/issues/864#issuecomment-6126760508) covered a deterministic 500-source/64-item-per-source **prefix**. Of 4,598 already-labelled eligible Senate-linked evidence observations, **2,150** have *stored* 2021–22 archive-original claim metadata (2,049 candidate contributions/expenditures, 101 independent expenditures). A separate **2,448** were filing-derived. No authenticated source-to-private-row parity was proved.
- Merged [PR #1232](https://github.com/killjoy00/votepredict/pull/1232) implemented original raw-replay SHA1/Base32 CDX digest and full-original SHA256/canonical parser matching against two documented 2023-era CFB candidate CSV selectors. Its first public [run #38275247968](https://github.com/killjoy00/votepredict/actions/runs/38275247968) incorrectly applied a raw replay URL requirement to the CDX endpoint, publishing a source [V1 HOLD](https://github.com/killjoy00/votepredict/issues/864#issuecomment-6128080613).
- Merged [PR #1234](https://github.com/killjoy00/votepredict/pull/1234) corrected that local distinction; its exact-main V2 source [run #38276619897](https://github.com/killjoy00/votepredict/actions/runs/38276619897) passed preflight and source job, but returned **candidate contributions `cdx_unavailable`** and **candidate expenditures `raw_replay_unavailable`**. No complete original archived CSV bytes or CDX body digest could be independently authenticated. Its **issue reporter failed with GitHub HTTP 500**, so the same safe V2 result was independently posted with a GitHub connector as [issue receipt #6128864883](https://github.com/killjoy00/votepredict/issues/864#issuecomment-6128864883). Distinguish the source job's success from the overall workflow's failure.

These are source-*retrieval* HOLDS, never a negative finding about the existence of 2021–22 campaign finance reports or transactions.

## Dedicated V3 public-source transport probe

`scripts/diagnose-cfb-864-public-wayback-access-v3.ts` is a deliberately separate **transport-only**, source-freezing tool:

1. Calls the Internet Archive CDX index exactly once for each of the **two fixed historical official download selectors**, with `20220101..20231231` time bounds, max 60 indexed candidate captures, max 160,000 CDX bytes. It validates the fixed six-field original CDX response using the existing V2 parser; no per-capture date/URL/digest is emitted.
2. On one valid indexed capture per source, requests the precise `id_` replay URL with **HTTP Range `bytes=0-2047`**. Redirects are intentionally not followed: a 3xx is a HOLD rather than silent substitution. If a 2xx response is returned at exactly the same requested archive host/capture path/query and is not `text/html`, at most **2,048 prefix bytes** are read into ephemeral memory and immediately discarded; no full source-file body is downloaded or hashed and no parsed transactions are produced.
3. Emits an exact finite status enum per source: indexed/empty/invalid index; HTTP 403/404/429/3xx/5xx/other, cross-host or capture identity hold, network/timeout, size cap, HTML interstitial, or a **prefix-readable-but-unverified** label. Response messages, exception text, raw headers/body, original source URLs, capture timestamps and digests are never logged or published.
4. Records `archiveBodyDigestAuthenticated=false`, `storedPrivateRowParityEstablished=false`, and `historicPdfPublicationEstablished=false` **regardless of result**. Even `prefix_read_no_auth` establishes only *transport availability*, never true original hash/row parity or first-public day.

No authenticated private-row metadata query is executed, no Neon/production credentials are provided, and no source body artifact or issue-writing permission is requested. A first-attempt, unique merged-main marker `SENATE_864_CFB_CDX_ACCESS_DIAGNOSTIC_V3_20261012` gates the one-shot run after exact-main clean PostgreSQL migrations, full `npm run check`, dependency audit, and source-specific synthetic privacy and URL tests. A precisely matched OWNER-authenticated issue #864 comment command is a fallback if the automated push is suppressed.

The tiny finite enum receipt is printed only in the public Actions logs. The earlier GitHub issue reporter HTTP 500 is intentionally **not retried** by this workflow; the sanitized result can be independently confirmed and posted via the GitHub connector after verifying actual run/job conclusion. This avoids adding any new sensitive-bearing artifact storage or reporter workflow.

## Next decision boundary

- If **CDX HTTP 403/429/5xx/network hold**: investigate public Internet Archive access alternatives and bounded retry/caching; do not expand to a full current-data download or claim source nonexistence.
- If **CDX indexed but raw replay 3xx/4xx/5xx/changed timestamp/HTML hold**: select separately authenticated immutable raw archival original, not a substituted current CFB download. Preserve the original CDX digest expectation.
- If **prefix readable**: the V2 full-original-body SHA1/Base32 digest match and SHA256 evidence remains the next *separate* authentication gate before any private aggregate parity.
- A complete authenticated candidate source file, even if recovered, must not be presumed to cover the entire 2,049 candidate prefix observations; the separate 101 IE claims still require correct historical source selectors.
- **Never** change `asOfEligible`, `published_at`, report publication semantics or the serving reader without independent source-to-row evidence and separate owner authorization.

**No database writes, backfills, outreach, scheduler, deployments, forecasting/training/serving changes, or 2027 work.**
