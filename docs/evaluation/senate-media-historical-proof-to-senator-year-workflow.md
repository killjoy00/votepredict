# Track D #987/#946 — from public original-byte archive proofs to private human-reviewed statements and 2021–25 member/year coverage

**Research checked:** 2026-10-10. **Safety:** No production source-collector, public media seed, database, scheduler, forecast, model or training change. Owner-closed parent #912 stays closed; #987 and #946 remain open pending real private source reconciliation.

## 1. Real bounded Wayback acquisition is now running

[PR #1027](https://github.com/killjoy00/votepredict/pull/1027) added a **public-only** owner-triggered archive workflow and full 31-URL 2021–25 research batch. Its first [actual GitHub Actions pilot](https://github.com/killjoy00/votepredict/actions/runs/38109279186) returned:

| Pilot original URL | Captured exact `id_` replay UTC | Exact replay body SHA-256 | Observation |
| --- | --- | --- | --- |
| [Minnesota Reformer 2024 North Star /briefs/](https://minnesotareformer.com/briefs/sanctuary-state-bill-already-dead-as-house-speaker-says-it-doesnt-have-the-votes/) | 2024-02-12T22:13:40Z | `ad570161c43fad500dd8bc1dde593369703e1ccba6bb47b5ad6688865d15eed1` | 128,637 HTTP-body bytes, SHA-1 independently matched the indexed CDX digest |
| [MPR 2024 Grant Hauschild interview](https://www.mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south) | 2024-02-19T22:55:56Z | `a990fb4207938f11b58b787966f67f1cc9577fd5c1d4feafe081bd8f14242387` | 80,716 bytes, exact indexed-payload SHA-1 matched |
| [MPR 2023 Mary Kunesh interview](https://www.mprnews.org/episode/2023/02/07/new-bill-would-keep-native-families-together-proponents-say) | 2023-02-10T02:40:30Z | `091376b6f0a3a0a1104d9aa8bd4573212c2ba5953486c082df2877a8eb041f92` | 81,419 bytes, exact indexed-payload SHA-1 matched |
| Reformer 2024 dated-path alias candidate | Not verified | unknown | CDX error is not proof of missing article or historic redirect |

The public JSON artifact contains capture URLs/times/indexed digests and observed raw body SHA-256 only. It does **not** contain source HTML. Three exact archived original-page versions have been independently fetched and checked against the corresponding CDX digest. **No exact private VotePredict `source_documents.content_sha256` has been compared**, and no actual quotation, article first-publication clock, broadcast transcript content, 2024 newsroom alias identity or vote forecast cutoff has thereby been authenticated. The only established public-by bound for these exact page versions is **no later than their checked archive capture**, not the publisher-displayed broadcast/day.

The fixed pilot checks **four URL aliases representing three stories**. The separately triggered `[senate-media-public-proof-all]` action on #987 requests at most 31 bounded exact public URL checks from the same non-exhaustive ledger, with no arbitrary host access and no private secrets. Index failures remain **unknown**, not “missing media.”

## 2. Distinguish original HTML page version from human statements

[Public pinned-original passage workflow](https://github.com/killjoy00/votepredict/actions/workflows/senate-media-pinned-original-passage-proof.yml) fetches **only those same three exact timestamped `id_` locations**. It first requires independent SHA-256 and byte-length equality to the values above. Only then does it examine the archived HTML's **visible** (not `script`, hidden JSON-LD or template) text to report Boolean findings for the known current-day MPR interview excerpts, full-name colon speaker labels, transcript headings and a bounded uninterrupted single-speaker turn. The Reformer page is assessed as a **reporter-attributed quote**, NOT a first-party recorded interview. It never emits the article bodies or quote passages and never human-approves anyone's speech.

Owner-only exact comment `[senate-media-original-passages]` on issue #987 can run the workflow after merge, or use Actions `workflow_dispatch`. Result artifact `senate-media-pinned-original-visible-passages` expires in seven days. A failed/missing excerpt could simply mean a **later transcript revision**; it is not proof the interview or audio was never published. Positive text found **inside an exact archived HTML capture** establishes presence in that **specific captured page version**. It does NOT establish when audio was first broadcast or a transcript was initially posted, and string proximity alone is not human speaker attribution.

The *existing* [offline named-media-remarks audit](senate-media-2021-25-attribution-audit.md) remains authoritative for human speaker/issue/date review and original article SHA validation. Its explicit `speaker_labeled_transcript` rule requires an exact full senator name, original `Audio transcript` heading, the person's own bounded turn, the complete original source bytes, source-published date proof, review identity and active Senate membership. It never automatically infers support or opposition from a journalist's narration or another speaker's words.

## 3. Reconcile public exact captures against existing private VotePredict sources, without granting public Actions DB access

Only after a separately authorized **VotePredict** SELECT-only export is supplied locally (NOT unrelated Neon projects), use the existing [context export SQL](../../scripts/export-senate-media-context-readonly.sql) and [roster export SQL](../../scripts/export-senate-media-roster-readonly.sql). The owner controls execution with a restricted read role and keeps all exports, article-body snapshots and human review notes **off public CI and GitHub issues**.

Download the **public metadata JSON** from the Actions artifact. Run locally:

```bash
node --import tsx scripts/reconcile-senate-media-offline-private.ts \
  --context PRIVATE-media-context.jsonl \
  --roster PRIVATE-senate-roster.jsonl \
  --public-batch PUBLIC-senate-media-public-wayback-proof-batch.json \
  --output PRIVATE-reconciled-senator-year.json
```

Optionally add `--reviews PRIVATE-human-reviewed-quotes.jsonl` and `--snapshots PRIVATE-original-html-snapshots.jsonl` acquired independently. The offline checker has **zero network and database access** and writes a new private 0600 report, never overwriting. Input artifact SHA-256 and private export digests support reproducibility; do not upload the final report publicly.

Every potential match requires **the same original publisher URL, exact `id_` archive URL/capture UTC, SHA-256 from the index-consistent raw HTTP-body replay, indexed CDX SHA-1 digest equal to stored `archiveDigest`, and valid neutral-context source metadata**. A matching URL alone (or 2026 live-page redirect) is **not** a match. A hash in a public JSON file requires independent workflow provenance checking; the offline script does not itself re-download any original bytes. If no row matches, status is `not_in_supplied_private_export` / `archive_identity_or_hash_differs` / `not_probed` as applicable, **never proof a statewide article is missing**.

A metadata crossmatch goes into the **private review queue**, not the predictive model. Original HTML snapshot SHA equality, senator term bounds, original publication proof and human direct quotation review are separately evaluated by the existing offline auditor. Verified quote passages are counted separately from URL matches, image/audio availability and reporter contextual mentions. Exact-source byte bodies and raw review passages are intentionally **omitted** from the new summary report.

## 4. Five-year senator-by-year and publisher-by-year coverage, not invented statewide denominators

The offline report enumerates **all unique `(year, senatorId)` keys from the *supplied* authorized Senate roster**, across 2021–2025, consolidating repeated/district-changing membership IDs rather than counting one senator twice. It reports for each supplied senator-year:

- Curated public article URLs that mention the person **during verified active Senate service** versus dates with unknown service bounds, with reporter **mentions** explicitly different from direct quotations.
- Distinct neutral archived source context mentions in the supplied private export.
- Exact public replay ↔ persisted source SHA/URL/capture/digest metadata crossmatches.
- Human-verified quote passages in independently supplied original-byte snapshots and reviewed verdicts, including the subset crossmatched to the public batch.
- An operational priority: review matched original first; otherwise acquire originals for curated leads; otherwise inspect existing source mentions; otherwise expand public discovery. These are **work queues**, not a ranking of senators or estimate of articles missing statewide.

There are 10 publisher/year summary slots for **MPR and Minnesota Reformer × 2021–2025**, plus five year summary slots for the supplied roster. Public ledger contains **31 selected URL leads**; candidate Reformer `/briefs/`–dated paths **cannot be deduplicated as one historic original until exact archived identity is proven**. A senator-year with zero verified quotes means “none demonstrated in this bounded export,” NOT “this senator made no statements.” Without the authorized roster, the checker cannot assert a complete list of all historical active Senate memberships.

## Outstanding completion gates

**Achieved now:** exact archived-page replay SHA observations for 3 pilot URLs and new reproducible public-batch machinery. **In progress:** all-31 URL public query and pinned historical HTML statement-text check.

**Awaiting authorized private inputs:** match actual VotePredict stored source SHA and original archived HTML snapshot bytes; complete genuine human named-senator quote reviews; certify which individual historical vote cutoffs, if any, preceded those captures. Neither original 2024 audio/MP3 byte equality nor MPR transcript initial-post timing has been established. Do **not** promote publisher metadata, reporter paraphrases, X screenshots or a retroactive transcript into same-day prediction inputs without those additional checks.
