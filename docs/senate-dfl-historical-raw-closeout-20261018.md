# Senate DFL 2023–2025 first-party RAW backfill — closed 2026-10-18

## Scope and conclusion

The bounded **publisher-sitemap historical RAW statement backfill is complete** for the 1,150 original `https://senatedfl.mn/` URLs in the two immutable Internet Archive copies of the first-party publisher post sitemaps taken January 28, 2026. The final original-source URL review found **1,116 stored in-scope first-party records (2023–2025)** and **34 excluded original URLs that did not satisfy the strict original-publication-date gate (date missing or outside 2023–2025)**. None of these 34 is verified as an eligible 2023–2025 RAW original under the archived evidence rules; a missing date is not proof of a different publication year.

This is completion of the **bounded pinned-sitemap RAW collection**, not a claim that the inventory represents every statement the Senate DFL ever published, or that all historical source text was captured contemporaneously.

## Protected final production receipts

- [Pinned sitemap exact URL inventory, collector run #39150185429](https://github.com/killjoy00/votepredict/actions/runs/39150185429): after restoring 30 historical statements, 972 / 1,150 pinned originals stored; 178 pending.
- [Complete, targeted archive review #39150984936](https://github.com/killjoy00/votepredict/actions/runs/39150984936): attempted all 178 outstanding originals, added 143 fully archived, timestamped 2023–2025 RAW articles, preserving matching archive-capture records. Exactly 35 original URLs were left: 34 without an authenticated publication date within 2023–2025 (missing or outside the window) and one eligible February 2025 original with no usable historical archive replay. No index errors or 429/503 rate-limit stops.
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

The protected archive review identified **34** URLs whose captured HTML **lacked an acceptable 2023–2025 original publication date**, either because the date was missing or it was outside the window. **33** had 2026 sitemap last-modified hints; such hints are not proof of their actual publication date. The other URL also failed the same date gate. These sources remain explicitly classified as *not independently verified eligible*; any later original-date recovery may change their classification. They were not force-inserted into the historical archive importer.

## Operational closeout

The automatically scheduled 24-shard collector and 75-minute inactivity watchdog are retired in the same reviewed change. The existing **explicit manual/independently reviewed** workflow paths remain available if the pinned historical inventory changes or a distinct newly verified source requires recovery. This retirement does not change the 2026 current-session collector, GOP, Senate votes, forecasts, feature eligibility, models, serving, or Vercel.

No data was overwritten or deleted. Historical archives and the original capture manifests are preserved.
