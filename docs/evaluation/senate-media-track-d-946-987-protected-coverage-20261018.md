# Track D #946 / #987 — first real stored-media original source coverage result (Oct 18, 2026)

**This is a bounded historical-source coverage measurement, not a new ingest, missing-article census or human quote adjudication.** It is backed by the [machine-readable public aggregate receipt](senate-media-track-d-946-987-protected-coverage-20261018.json), independently reviewed and merged [source crosswalk PR #1446](https://github.com/killjoy00/votepredict/pull/1446) and [context-denominator verification PR #1447](https://github.com/killjoy00/votepredict/pull/1447).

## Two actual guarded GitHub Actions runs, not test fixtures

1. **Exact original public snapshot crosswalk:** [protected source run #39184754249](https://github.com/killjoy00/votepredict/actions/runs/39184754249), SUCCESS. Original HTML bodies had already been SHA-1-index authenticated and SHA-256 replayed as 2021–25 Wayback HTTP originals in original studies. The new bounded read-only DB check compared exactly **12 Minnesota Reformer `/briefs/` versions across 10 original URLs** and **six MPR original interview/story HTML versions across four original URLs** against one narrowly filtered existing media source/evidence context. The first result was **0 exact SHA+URL+archive-clock stored matches of 18 selected original versions** within that context.
2. **Independent live denominator + repeated original crosswalk in one snapshot:** [protected run #39185450015](https://github.com/killjoy00/votepredict/actions/runs/39185450015), SUCCESS, separately marked first-run reviewed main SHA `e15ac5a8cf51a05071070da2898bea0f42970aa3`. In a single verified existing-default-Neon `REPEATABLE READ READ ONLY` transaction, selected database and role identity checked, static scoped aggregate SELECTs executed and **explicit `ROLLBACK` completed**, producing a no-private-rows receipt. Actual repo post-merge [CI](https://github.com/killjoy00/votepredict/actions/runs/39185450002) also passed.

### What is actually present in that source/evidence scope?

| Bound | Actual count |
| --- | ---: |
| Evidence contexts in `source_documents.source_kind = 'wayback_local_trade_news'` joined to `evidence_items.metadata.contextType = 'local_trade_news'` | **948** |
| Distinct `source_documents` under that same fixed filter | **805** |
| Evidence contexts carrying original publisher URL | **948 / 948** |
| Evidence contexts carrying archive URL, archive UTC and indexed digest | **948 / 948 for each field** |
| Distinct source documents with well-formed raw body SHA-256 metadata | **805 / 805** |
| Distinct source documents with publisher marked **Minnesota Reformer** | **37** |
| Distinct source documents with publisher marked **MPR News** | **22** |
| Filtered Reformer evidence context rows whose original URL starts with `https://minnesotareformer.com/briefs/` | **0** |
| Filtered MPR context rows whose original URL starts with `https://www.mprnews.org/episode/` | **0** |
| Exact raw original body SHA-256 + archive URL/UTC + indexed SHA1 matches from #946's selected source versions | **0 / 12** |
| Same from #987's selected source versions (five `/episode/`, one `/story/` control) | **0 / 6** |

The denominator is **nonempty**, contains source items from **both publishers**, and the relevant archive URL, original URL, capture UTC, digest and stored SHA columns are populated. Thus this audit confirms a **genuine lack of those two URL path families within this one filtered historical local-news context**, not an empty-table artifact or nonfunctional SHA comparison.

**Do not misstate the result.** The context is a specific local-news ingestion family, not all `source_documents`, every other evidence source kind, official Senate caucus raw statements, privately ingested transcript/audio, newsletters or journalist articles in different pipelines. A zero match here is **not** proof that 18 unique articles are globally missing from VotePredict or that 18 senator statements should have been incorporated into prior predictions. Two different timestamped originals from the same original publisher URL do not count as two news articles. All four same-slug Reformer brief/dated path alias hypotheses remain only **potential historical aliases**, not proven duplicate original articles, since archived original bytes from both paths have **not** been authenticated. Original archive observation UTC is **not necessarily initial publisher publication or speaker transcript availability**.

## Why the separate two-path problem matters

- #946's checked-in Wayback Reformer seed currently requests a `https://minnesotareformer.com/202` URL prefix. Original publisher `/briefs/` URLs cannot satisfy that path prefix. Some current brief pages redirect to dated paths, but this did **not** establish historic original alias or full private source equivalence.
- #987's MPR seed currently requests the `https://www.mprnews.org/story/202` URL prefix. Historical `/episode/` interview pages cannot satisfy it. A separate topical pathname-priority gate rejects some episode URLs even if the prefix were changed. One authenticated MPR `/story/` Benson control was also absent in the selected context; that is consistent with the independent topical gate, not proof of no MPR material elsewhere.
- #987 original MPR page capture timestamps do **not** automatically certify audio/transcript presence at the interview broadcast instant. The October and December 2024 Kunesh originals are separate authenticated bodies with different speaker-text cues; no backdating or automatic human quote claim is allowed.

## Next in-scope engineering and decisions (issues remain OPEN)

1. **Owner-approved proposal, not automatic deployment:** Design an isolated shadow-run seed/path-priority change to admit exact Reformer `/briefs/` and MPR `/episode/` **only for 2021–25 historic public-source capture research**, with strict year/date bounds, robots/CDX rate limits, observed SHA/capture proofs, duplicate alias handling, source-retention policy and regression tests. Per both issue scopes, production collector, scheduling, historical reprocessing or media seed change needs a **separate explicit owner approval**. None is implemented or activated here.
2. **Independent cross-ingester reconciliation:** An additional specifically scoped, protected read-only comparison across other allowed `source_documents` families can test whether the relevant article URLs or exact archived body SHA identities occur in other pipelines; any negative claim is limited to the actually inspected source kinds and metadata coverage. Do not export private row/person/article data into public Actions.
3. **Editorial and historic source proofs:** Investigate remaining historical dated-path alias Wayback originals, exact user-visible publication-by timelines, senator term on the local publication date, actual named transcript-speaker turn boundaries and context; do not treat journal voting or a newsroom paraphrase as a direct senator quote. Prior `/episode/` same-day MPR programs with **different MP3 identities** cannot be silently merged.

**Nothing changed:** no VotePredict database writes/backfills, model or historical forecast updates, labels, weights, Vercel deployment, source settings, source article bytes, audio, person IDs, unrestricted SQL output or human Senator quote approvals. [#946](https://github.com/killjoy00/votepredict/issues/946) and [#987](https://github.com/killjoy00/votepredict/issues/987) remain OPEN; parent #912 was previously owner-closed.
