# #946 — offline public URL discovery shadow audit (2021–2025)

**Scope:** apply the existing publisher seed-prefix and topical path-priority gates to the **selected 25 public URL leads** (including **four candidate alias pairs**) dated by current publisher labels across five years. No Neon, archive retrieval, production collector, or forecast changes.

## Reproduce with no credentials or Internet access

From the repository root:

```bash
node --import tsx scripts/report-senate-media-public-discovery-gaps.ts
```

The command uses [`senate-media-public-article-discovery-2021-25.json`](senate-media-public-article-discovery-2021-25.json) and `diagnoseMediaPublicDiscoveryPaths`. It checks two **sequential** collector gates: (1) public original URL begins with that publisher's checked-in Wayback seed prefix; (2) current topical path-priority selection passes. It reports public ID-level observations and possible alias pairs, never a private database match.

At the 2026-10-10 research checkpoint:
- **25** selected public URL leads, **11** outside their configured seed prefix (2021:2; 2022:3; 2023:2; 2024:2; 2025:2). The ten Reformer `/briefs/` examples remain, joined by one independently identified MPR `/episode/` actual-senator audio interview.
- **Four** same-host, same-day, same-slug `/briefs/`–dated path **alias candidates**, not authenticated duplicate historical originals: [2022-03-22 public-safety plan](https://minnesotareformer.com/briefs/senate-dfl-outlines-500-million-public-safety-plan/) versus [dated link](https://minnesotareformer.com/2022/03/22/senate-dfl-outlines-500-million-public-safety-plan/), [2023-02-21 driver-licensing brief](https://minnesotareformer.com/briefs/minnesota-senate-expected-to-pass-bill-giving-drivers-licenses-to-undocumented-residents/) versus [dated path](https://minnesotareformer.com/2023/02/21/minnesota-senate-expected-to-pass-bill-giving-drivers-licenses-to-undocumented-residents/), [2024-02-12 sanctuary/North Star Act brief](https://minnesotareformer.com/briefs/sanctuary-state-bill-already-dead-as-house-speaker-says-it-doesnt-have-the-votes/) versus [dated path](https://minnesotareformer.com/2024/02/12/sanctuary-state-bill-already-dead-as-house-speaker-says-it-doesnt-have-the-votes/), and [2025-05-01 road-signs story](https://minnesotareformer.com/briefs/minnesota-republican-senator-no-more-wit-pop-culture-portmanteaus-on-our-road-signs/) versus [dated link](https://minnesotareformer.com/2025/05/01/minnesota-republican-senator-no-more-wit-pop-culture-portmanteaus-on-our-road-signs/).
- There is an **additional** topical-path gate even for in-prefix URLs: the [June 10, 2021 MPR school-choice story](https://www.mprnews.org/story/2021/06/10/gop-wants-private-school-option-walz-dfl-push-back) is inside MPR's URL prefix but fails the collector's topical path priority. The CLI calculates the **exact** current sample-only gate counts; do not substitute URL exclusions for database missingness.

The current `minnesota-reformer-article-archive` prefix is `https://minnesotareformer.com/202`; a `https://minnesotareformer.com/briefs/` URL cannot pass it. The separate `mpr-news-story-archive` prefix is `https://www.mprnews.org/story/202`; a published `/episode/2024/` MPR senator interview cannot directly pass that URL prefix either. Dated aliases may pass that first gate. A current publisher redirect, same slug and displayed day do **not** prove equal **historical Wayback** capture bytes or first-public-by dates, nor that either alias is absent from the private VotePredict export.

## What is and is not measured

| Statistic | Measured meaning | Invalid extrapolation |
| --- | --- | --- |
| Outside seed prefix: 11 / 25 sample URLs | Those current URLs fail their respective configured seed prefixes | Eleven uniquely missed stories, or any publisher/statewide missingness rate |
| Topical path rejections | Checked-in `pathPriority` excludes those current URL paths | Article unavailable in archive, or no substantive remarks |
| Four candidate alias pairs | Exact same publisher host, displayed day, and slug across brief and dated URL | A proven duplicate archived original or deduction from missing-article count |
| Displayed publication day | Date currently represented by publisher | Independently known historical first-public-by or a valid forecast cutoff |
| 2026-10-10 research check | Day the public lead was researched | Date source became available to a 2021–25 model |

[Public article discovery ledger](senate-media-public-article-discovery-2021-25.md) supplies the new six research stories (eight URLs), and the independent [Minnesota Legislature time capsule](https://www.lrl.mn.gov/timecapsule/session?lang=en) establishes **Keri Heintzeman's May 6, 2025 oath**, which is later than the displayed April 30 article date. The sample intentionally excludes people who never became Minnesota senators; a later senator is not an incumbent on a pre-service publication date.

**Missing: original captured HTTP bytes, matching original SHA-256, historical archive/public-by records, private VotePredict export membership and document identities, reviewed named senator quotations, and any publisher-wide/statewide publication denominator.** Treat every unverified article as a discovery lead; no model stance. Existing protected read-only aggregate (794 in-study contexts) does **not** provide row-level answers. Production collectors and models remain untouched.

**Additional 2023 timing caveat:** The driver's-license Reformer page has a current publisher display timestamp of **2023-02-21, 8 p.m.**, but current text describes passage early Wednesday; official [Revisor HF4 Senate actions](https://www.revisor.mn.gov/bills/93/2023/0/HF/4/?body=Senate) date the 34–31 passage to February 21. Exact first-public-by, editorial updates, clock-time reconciliation, and original capture remain **unverified**. The source must never be backdated to provide a vote result before the event/forecast cutoff.

**2024 dated-current-publisher redirect observation (research check 2026-10-10):** the Minnesota Reformer [Feb 12 `/briefs/` URL](https://minnesotareformer.com/briefs/sanctuary-state-bill-already-dead-as-house-speaker-says-it-doesnt-have-the-votes/) currently redirects to its [dated `/2024/02/12/` URL](https://minnesotareformer.com/2024/02/12/sanctuary-state-bill-already-dead-as-house-speaker-says-it-doesnt-have-the-votes/). Page byline **Deena Winter**, current displayed **February 12, 2024 4:10 p.m.** Timezone and historic publication/edit timeline unknown. This is **not** an original 2024 Wayback capture or article byte hash, proof of an old archived redirect, a senator quote, a first-public-by time, or a private source-document reconciliation.

**Additional 2024 first-party MPR interview/possible remarks lead ([#987](https://github.com/killjoy00/votepredict/issues/987), checked 2026-10-10):** [MPR News February 19, 2024 audio interview](https://www.mprnews.org/episode/2024/02/19/without-total-dfl-support-the-north-star-act-is-going-south) has a current page audio player, speaker-labeled Senator **Grant Hauschild** transcript and displayed 10:32 a.m. publication clock (timezone unverified). The Legislative Reference Library [member record](https://www.lrl.mn.gov/legdb/fulldetail?id=15577) verifies his actual Senate service in 2024. **Current** publisher transcript/audio and reporter page date are **not** an exact historical Wayback HTTP-body SHA, original audio/transcript completeness match, private source-document linkage, human-reviewed 2024 quote or retrospective public-by timestamp. Do not modify production publisher prefixes or infer a missed-article fraction from this one example.
