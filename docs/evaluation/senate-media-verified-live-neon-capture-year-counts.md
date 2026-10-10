# Track D: VERIFIED VotePredict Neon media context counts (2021–2025)

**Source of truth:** protected, automatically launched [GitHub run #38093691235](https://github.com/killjoy00/votepredict/actions/runs/38093691235), running the reviewed commit `71bb9000389b49019d5c71b05209f5a111277098` merged from [PR #956](https://github.com/killjoy00/votepredict/pull/956). Run status **SUCCESS**: dedicated CI-equivalent ephemeral database verification passed, then protected Neon metadata and `REPEATABLE READ READ ONLY` SQL passed and ended with `ROLLBACK`. No operator click was necessary.

Machine-readable public, bounded aggregate: [`senate-media-verified-live-neon-capture-year-counts.json`](senate-media-verified-live-neon-capture-year-counts.json). Values below are exact live results from the run's sanitized JSON summary, **not invented fixture values** or a private row export.

| Wayback archive capture year | Context evidence rows | Distinct source documents within year |
| --- | ---: | ---: |
| 2021 | 131 | 122 |
| 2022 | 182 | 163 |
| 2023 | 155 | 132 |
| 2024 | 118 | 103 |
| 2025 | 208 | 168 |
| **2021–2025** | **794** | **688 summed per year** |
| Other years (including excluded 2026 if any) | **154** | Not separately broken out |
| **All capture years** | **948** | **805 summed across year groups** |

**Arithmetic:** 131+182+155+118+208=794; 794+154=948. Distinct sources are deduplicated *within each capture year* only: 122+163+132+103+168=688; 805 is the sum of per-capture-year distinct source counts across ALL years, **not** the globally deduplicated number of original articles. Repeated documents between archive capture years may be included more than once in those source totals.

## What this live evidence establishes

- The protected `NEON_API_KEY` selected the intended VotePredict-named Neon project, its existing single marked default branch, database, compute endpoint and SQL login. The script verified the existing six evidence/roster relations were readable; it did not independently prove the branch is the database currently bound to a deployed production service.
- The transaction itself was `READ ONLY`; existing SQL owner permissions outside that transaction may still allow writes. The script issued one predefined count SELECT with `sd.source_kind='wayback_local_trade_news'` and `ei.metadata->>'contextType'='local_trade_news'`, plus only identity/catalog SELECTs and a final `ROLLBACK`. It printed counts only.
- The previously reported **948 collector context rows** can now be matched to the actual live year-bucket aggregate (794 inside 2021–2025, 154 outside). This does **not** establish that 948 media articles existed, that the 2025-only count was 362, or that a specific senator was the quoted speaker of anything.

## What this live evidence does not establish

**No original article body, archive public-by proof, full source row, senator identity, direct quote, publication date, issue stance, cross-year globally unique document ID, or 44-publisher × five-year completeness matrix was examined or exported.** Consequently no human-verified senator quotes were produced by this query; it would be incorrect to infer that zero such remarks exist. The statewide publication denominator and forecasting usefulness remain unknown.

## Required downstream reconciliation

1. Privately obtain the separately authorized **strictly SELECT-only** context and Senate roster export using the existing local protected runner, without posting source IDs, URLs, names or article bodies to CI/PRs/issues. Verify the raw private capture-year counts against **794** in-range and **154** outside. Report any differing SQL database/branch identity first.
2. Build publisher seed × year and senator roster × year missingness from the private export; explicitly distinguish unobserved from published zero. Account for URL collection blind spots, including Reformer `/briefs/` and topical path filtering documented in [#946](https://github.com/killjoy00/votepredict/issues/946).
3. Rehydrate archived original HTTP bytes and independently match the stored SHA-256, prove exact publication and first-public-by dates, review Senate membership and named-speaker quotations, and keep ambiguous/context-only findings unpromoted. No raw evidence article can be inferred from aggregate counts alone.
4. Keep Track [#912](https://github.com/killjoy00/votepredict/issues/912) open. No automatic ingestion, prediction-feature promotion, model retraining or production write is authorized by these counts.
