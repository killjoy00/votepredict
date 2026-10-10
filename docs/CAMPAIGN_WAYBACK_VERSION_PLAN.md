# Campaign archive version-selection plan (offline) — #864

This is a **non-serving, non-ingesting planning tool** for historical campaign issue pages. It does **not** change the current `senate-issue-positions-v3` selection, rewind a cursor, query Wayback, read Neon, deploy anything, or modify a source/evidence row.

## Identified loss under v3

The current `selectWaybackEvidenceCaptures` keeps the latest snapshot for each exact original URL × capture year. A candidate can edit an issues page multiple times in that year. Only collecting the latest version can miss earlier positions or policy changes even when Wayback archived them.

The offline plan uses **different CDX content digests** as evidence that a page may have changed. It retains the earliest capture for each distinct digest within a URL/year. It prioritizes issue/platform/policy pages, distributes scarce slots across distinct URL/year groups before selecting additional versions for the same page, and reports any versions still omitted by the (unchanged) maximum of 50 captures per seed. Duplicate digest captures are collapsed to the earliest observed timestamp. Missing digests are treated as distinct **unknown** versions, not evidence of identical text.

This is not proof that a campaign statement changed: many digest changes are template, menu, footer, or tracking changes. Only original source bytes and attributed statement excerpts can establish an actual position or edit.

## Reproduce from previously exported CDX JSON

Save the raw CDX JSON matrix with header fields `timestamp,original,mimetype,statuscode,digest,length` and 200-success HTML/text rows for a *single campaign seed*. The input can be at most 16 MiB and 2,000 data records. Run without credentials:

```bash
node --import tsx scripts/plan-campaign-wayback-versions-offline.ts \
  --cdx /path/to/campaign-seed-cdx.json \
  --output /path/to/campaign-seed-version-plan.json \
  --max-captures 40
```

Output includes candidate URLs, archive timestamps, digest distinctness, the number omitted by the cap, URL/year-level gap counts, old-v3 selection size, and additional candidates relative to v3. It is immutable by default and refuses to overwrite an existing output. The original post date must not be inferred from archive timing.

The input is **not a complete archive inventory** unless independent search proves every domain, URL, and year was covered. Upstream CDX `limit=400`, digest collapse, time windows, selection/pagination, defunct or unknown domains, and failed snapshot retrieval remain external limitations. The output explicitly sets `completenessCertified=false`, `upstreamCdxResultTruncated=null`, `upstreamMissingDomainsOrPaths=null`, `sourceBytesAuthenticated=false` and `anyCampaignStatementAuthenticated=false`. No new historical statement is admitted to prediction by this plan.

## Next checks before enabling future ingestion

1. Complete the #902 senator-by-senator campaign URL/campaign-year inventory and identify targets with multiple content versions and sufficiently historical snapshots.
2. Manually inspect original archived bytes for representative changes to distinguish true policy edits from template noise, preserving exact URL/hash, candidate attribution, and conservative earliest public-by time.
3. Separately review whether a version-aware selected-capture strategy should replace or supplement the v3 collector. A switch must use a fresh, bounded cursor and require its own explicit DB-write authorization; there is **no automatic rollout**.
4. Reconcile any new evidence with stored source-document and evidence-item IDs using an explicitly authorized SELECT-only export. Keep #864 open until official denominator and row-level proof exist.
