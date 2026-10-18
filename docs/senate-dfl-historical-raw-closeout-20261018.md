# Senate DFL 2023–2025 first-party RAW backfill — closed 2026-10-18

## Scope and conclusion

The bounded **publisher-sitemap historical RAW statement backfill is complete** for the 1,150 original `https://senatedfl.mn/` URLs in the two immutable Internet Archive copies of the first-party publisher post sitemaps taken January 28, 2026. The final original-source URL review found **1,116 stored in-scope first-party records (2023–2025)** and **34 excluded original URLs whose archived publication dates were outside the 2023–2025 window**. The remaining 34 are *not* missing eligible 2023–2025 statements.

This is completion of the **bounded pinned-sitemap RAW collection**, not a claim that the inventory represents every statement the Senate DFL ever published, or that all historical source text was captured contemporaneously.

## Protected final production receipts

- [Pinned sitemap exact URL inventory, collector run #39150185429](https://github.com/killjoy00/votepredict/actions/runs/39150185429): after restoring 30 historical statements, 972 / 1,150 pinned originals stored; 178 pending.
- [Complete, targeted archive review #39150984936](https://github.com/killjoy00/votepredict/actions/runs/39150984936): attempted all 178 outstanding originals, added 143 fully archived, timestamped 2023–2025 RAW articles, preserving matching archive-capture records. Exactly 35 original URLs were left: 34 published outside 2023–2025 and one eligible 2025 original with no usable historical archive replay. No index errors or 429/503 rate-limit stops.
- [Final Erin Murphy first-party recovery #39152818473](https://github.com/killjoy00/votepredict/actions/runs/39152818473): on protected reviewed main, loaded exactly `https://senatedfl.mn/senate-majority-leader-erin-murphy-responds-to-house-power-sharing-agreement/`, with `published_on=2025-02-06`, full official raw text length **1,215**, insert-only source-URL deduplication, and an independent rollback-only exact-row readback. New RAW inserts: **1**; archived Wayback capture rows for this one article: **0**; collector failures: **0**. The live first-party fetch date is preserved, **not** represented as a February 2025 archive observation.

### Final raw statement counts from protected production

| Original publication year | DFL raw records |
|---|---:|
| 2023 | 377 |
| 2024 | 305 |
| 2025 | 434 |
| **2023–2025 historical total** | **1,116** |
| 2026 (separate current-session collection) | 210 |
| **All DFL raw records** | **1,326** |

Of the 1,116 matched historical pinned originals, **1,115** have independent archived capture records from the bounded Wayback collector. The one February 6, 2025 Murphy article was recovered from its current official live page and therefore **does not establish 2025 archive provenance or eligibility as authenticated pre-vote observed evidence**. Publication date and first authenticated observation must remain distinct in downstream historical evaluation.

## Excluded candidates

The protected archive review identified **34** URLs with captured original HTML publication dates outside the 2023–2025 allowed period. **33** had 2026 sitemap last-modified hints; this hint is not itself proof of publication date. They belong to separate current-session or source-exclusion tracking and were not force-inserted into the historical archive importer.

## Operational closeout

The automatically scheduled 24-shard collector and 75-minute inactivity watchdog are retired in the same reviewed change. The existing **explicit manual/independently reviewed** workflow paths remain available if the pinned historical inventory changes or a distinct newly verified source requires recovery. This retirement does not change the 2026 current-session collector, GOP, Senate votes, forecasts, feature eligibility, models, serving, or Vercel.

No data was overwritten or deleted. Historical archives and the original capture manifests are preserved.
