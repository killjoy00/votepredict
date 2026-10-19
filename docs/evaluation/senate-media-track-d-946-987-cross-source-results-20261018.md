# #946 / #987 Track D — protected all-stored-source-kinds historical media gap finding

**Verified October 18, 2026.** This report preserves actual [successful protected read-only run #39190098548](https://github.com/killjoy00/votepredict/actions/runs/39190098548), from merged [PR #1449](https://github.com/killjoy00/votepredict/pull/1449), main SHA `85c2cec06a31e32350e728cd29649b338f975a56`, and successful post-merge [full CI #39190098481](https://github.com/killjoy00/votepredict/actions/runs/39190098481). See the [machine-readable public aggregate receipt](senate-media-track-d-946-987-cross-source-results-20261018.json).

## Scope and result

The preceding, narrower [protected 948-local-news-context / 805-source original audit](senate-media-track-d-946-987-protected-coverage-20261018.md) established the original missing URL-prefix family *in one old 44-seed media pipeline*. The follow-up **actually queried all stored source kinds**, not only `wayback_local_trade_news`, and examined `source_documents.source_url`, `source_documents.content_sha256`, source metadata and linked `evidence_items.metadata`. It used 23 **already independently original Wayback indexed-SHA1 and actual raw-original-HTML SHA256 validated** capture identities. It never downloaded or published private article rows.

| Query fact, actual default Neon | Verified |
| --- | ---: |
| Source documents from **all stored source kinds** | **63,594** |
| Distinct stored source-kind categories (labels kept private) | **46** |
| Evidence items across source types | **344,016** |
| Reformer distinct authenticated original `/briefs/` publisher URLs | **13** |
| Reformer SHA-verified original HTML **versions** checked | **17** |
| MPR distinct authenticated original publisher URLs | **4** |
| MPR SHA-verified original HTML **versions** checked | **6** |
| **Exact original archive URL AND raw original body SHA** matches, Reformer | **0 / 17** |
| **Exact original archive URL AND raw original body SHA** matches, MPR | **0 / 6** |
| Alternate publisher-original URL plus same body SHA matches | **0** |
| Exact original publisher URL references in stored source/evidence metadata | **0** |
| Existing stored source/evidence metadata references to the **seven potential Reformer dated-path aliases** | **0** |
| Original source HTML bytes, private names, internal source IDs or private source types output | **0** |

**Conclusion:** Under this exact URL, Wayback `id_` archive-link, body SHA and known candidate alias URL comparison, **none of the 23 authenticated historical HTTP source versions appears in the stored source/evidence metadata inspected**. Unlike the earlier narrow media-context result, this includes all 46 stored source kinds and every evidence-context category in the existing VotePredict database. The query ran in an independently identified **existing default database/role**, `REPEATABLE READ READ ONLY` and explicitly **`ROLLBACK`**, with a bounded fixed parameterized aggregate-only `SELECT`. It made no source writes, human quote approvals, prediction edits, model changes or new secret requests.

**What zero does NOT mean:** This is not proof that 23 individual distinct news *articles* are missing, that any story was never archived externally, that unrelated raw documents with entirely different identifiers lack similar prose, or that every unknown ingestion or non-Neon store is empty. Different timestamps for the same original URL produce multiple original **versions** of one publisher page. Other URL slugs, alternate URL normalization, a rewritten page with different SHA and no linking metadata, audio files, publisher feeds, or hidden pipelines are **outside exact match proof**. Even a public archived snapshot's UTC is not automatically the publisher's initial posting UTC. Do not backdate content to a vote.

## Research-only collector shadow completed (no production change)

The new isolated [shadow proposal and defensive tests](../../src/evaluation/senate-media-track-d-historic-shadow.ts) model only the **2021–2025** historical candidate paths `https://minnesotareformer.com/briefs/` and `https://www.mprnews.org/episode/`. It compares actual production seed and topical path gates without changing either; it admits a **research queue of 22 previously SHA-authenticated source versions** (17 Reformer and five MPR `/episode/`). One separate MPR `/story/` control remains outside the *new* episode-path queue. No 2026 URL, unverified raw archive SHA1, cross-host redirect, unauthenticated original response, unknown publisher date, unreviewed quote or private data is promoted. Seven possible Reformer brief/dated link pairs stay **candidate aliases, zero deduplicated**. One May 2025 second Reformer replay whose SHA1 mismatched its CDX index was explicitly quarantined as UNKNOWN and is **not** part of the 23 authenticated versions.

The [public speaker-timing review](../../src/evaluation/senate-media-track-d-public-speaker-timing-review.ts) connects prior source-verified short name/speech cues without claiming full human approval:

- Three independent old Reformer brief pages print short named-senator fragments from **six distinct named source speakers** across 2021, 2022 and 2025. Original HTML versions are SHA-pinned; these are human-review candidates, not six news stories, six approved quotes or votes.
- The original 2023 MPR Kunesh source has two selected bounded printed `MARY KUNESH:` speaker-turn short phrases first demonstrated in a **February 10, 2023** archived HTML copy, not automatically on February 7 broadcast.
- The selected original 2024 Hauschild interview wording and speaker label were independently found in a **July 24, 2025** original HTML copy, **not in the earlier 2024 archive bodies**. Do not backdate that specific transcript cue to February 19, 2024.
- A selected Kunesh charter-oversight original HTML transcript cue is first demonstrated in the **December 11, 2024** archived page, not the October 22 early original. This does not pinpoint when the publisher inserted it.
- The April 30, 2025 Keri Heintzeman special-election story predates her **May 6, 2025 Minnesota Senate oath**. Do not use future senator membership for the April story.

Complete human-reviewed full quotations newly certified here: **zero**. Historic audio original binaries independently matched: **zero**. Automatic VotePredict historical score labels: **zero**.

## Recommendation / remaining issue work

The confirmed exact metadata gap now justifies proposing a small, **separately approved historical-only ingestion pilot** that retrieves original archive versions with independent indexed SHA1/raw-body SHA256, strict 2021–25 publisher/capture date bounds and as-of clocks, archive availability failure states, no automatic brief/dated alias merge, robots/rate limits, and human exact speaker plus membership review for any eventual direct quotations. The pre-existing general collector's search results/path scoring are **not** enough to prove original historic source identity. Before activation, design idempotent dedup/source version keys and rollback criteria and verify no forecast, weight, vote or model feature is touched. The owner authorized **research, dry-run collector planning, and protected read-only examination** in this phase, not source ingestion/reprocessing.

**Both [#946](https://github.com/killjoy00/votepredict/issues/946) and [#987](https://github.com/killjoy00/votepredict/issues/987) stay OPEN.** No production collection, data, scheduler, forecasts, serving models, source catalog or Vercel changes have been made.
