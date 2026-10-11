# #946 — offline public URL discovery shadow audit (2021–2025)

**Scope:** apply the existing publisher seed-prefix and topical path-priority gates to the **selected 22 public URL leads** (including **two candidate alias pairs**) dated by current publisher labels across five years. No Neon, archive retrieval, production collector, or forecast changes.

## Reproduce with no credentials or Internet access

From the repository root:

```bash
node --import tsx scripts/report-senate-media-public-discovery-gaps.ts
```

The command uses [`senate-media-public-article-discovery-2021-25.json`](senate-media-public-article-discovery-2021-25.json) and `diagnoseMediaPublicDiscoveryPaths`. It checks two **sequential** collector gates: (1) public original URL begins with that publisher's checked-in Wayback seed prefix; (2) current topical path-priority selection passes. It reports public ID-level observations and possible alias pairs, never a private database match.

At the 2026-10-10 research checkpoint:
- **22** selected public URL leads, **10** outside their configured seed prefix (2021:2; 2022:3; 2023:2; 2024:1; 2025:2).
- **Two** same-host, same-day, same-slug `/briefs/`–dated path **alias candidates**, not two authenticated duplicate articles: [2022-03-22 public-safety plan](https://minnesotareformer.com/briefs/senate-dfl-outlines-500-million-public-safety-plan/) versus [dated link](https://minnesotareformer.com/2022/03/22/senate-dfl-outlines-500-million-public-safety-plan/), and [2025-05-01 road-signs story](https://minnesotareformer.com/briefs/minnesota-republican-senator-no-more-wit-pop-culture-portmanteaus-on-our-road-signs/) versus [dated link](https://minnesotareformer.com/2025/05/01/minnesota-republican-senator-no-more-wit-pop-culture-portmanteaus-on-our-road-signs/).
- There is an **additional** topical-path gate even for in-prefix URLs: the [June 10, 2021 MPR school-choice story](https://www.mprnews.org/story/2021/06/10/gop-wants-private-school-option-walz-dfl-push-back) is inside MPR's URL prefix but fails the collector's topical path priority. The CLI calculates the **exact** current sample-only gate counts; do not substitute URL exclusions for database missingness.

The current `minnesota-reformer-article-archive` prefix is `https://minnesotareformer.com/202`; a `https://minnesotareformer.com/briefs/` URL cannot pass it. Dated aliases may pass that first gate. A current publisher redirect, same slug and displayed day do **not** prove equal **historical Wayback** capture bytes or first-public-by dates, nor that either alias is absent from the private VotePredict export.

## What is and is not measured

| Statistic | Measured meaning | Invalid extrapolation |
| --- | --- | --- |
| Outside seed prefix: 10 / 22 sample URLs | Those current URLs fail the current seed prefix | Ten uniquely missed stories, or a 45% publisher/statewide missingness rate |
| Topical path rejections | Checked-in `pathPriority` excludes those current URL paths | Article unavailable in archive, or no substantive remarks |
| Two candidate alias pairs | Exact same publisher host, displayed day, and slug across brief and dated URL | Two proven duplicate archived originals or deduction from missing-article count |
| Displayed publication day | Date currently represented by publisher | Independently known historical first-public-by or a valid forecast cutoff |
| 2026-10-10 research check | Day the public lead was researched | Date source became available to a 2021–25 model |

[Public article discovery ledger](senate-media-public-article-discovery-2021-25.md) supplies the new six research stories (eight URLs), and the independent [Minnesota Legislature time capsule](https://www.lrl.mn.gov/timecapsule/session?lang=en) establishes **Keri Heintzeman's May 6, 2025 oath**, which is later than the displayed April 30 article date. The sample intentionally excludes people who never became Minnesota senators; a later senator is not an incumbent on a pre-service publication date.

**Missing: original captured HTTP bytes, matching original SHA-256, historical archive/public-by records, private VotePredict export membership and document identities, reviewed named senator quotations, and any publisher-wide/statewide publication denominator.** Treat every unverified article as a discovery lead; no model stance. Existing protected read-only aggregate (794 in-study contexts) does **not** provide row-level answers. Production collectors and models remain untouched.
