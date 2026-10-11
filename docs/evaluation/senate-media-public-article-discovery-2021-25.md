# 2021–2025 Minnesota Senate media: independent public article discovery

**Track:** [#912](https://github.com/killjoy00/votepredict/issues/912), [#946](https://github.com/killjoy00/votepredict/issues/946). **Research check:** 2026-10-10. **Status:** **23 selected current-publisher URL leads** across 2021–2025, including **three unverified alias pairs** (thus not 23 demonstrated unique articles). No authenticated original Wayback article bytes, historical public-by dates, private source-document matches, or human-verified Senate quotations were obtained in this research.

Structured, offline-tested public ledger: [`senate-media-public-article-discovery-2021-25.json`](senate-media-public-article-discovery-2021-25.json). Its displayed publication date is a **publisher claim seen during present-day research**, not a contemporaneously authenticated release date. The research-check date proves only that the public lead was examined on 2026-10-10. Neither date establishes availability before a historical prediction cutoff. No private rows, original article body, speaker quote, stance, or source hash is published.

## Actual 2022, 2024, and 2025 additions

Eight new, publicly identified **URL leads**, six on `/briefs/` and two on dated paths, were checked on 2026-10-10. All linked names below are **search leads for people who did serve in the Minnesota Senate**, not verified article quotations.

| Displayed article day | Publisher URLs in this research sample | Senate-member research leads | Audit interpretation |
| --- | --- | --- | --- |
| 2022-01-26 | [GOP public-safety/tax/education agenda](https://minnesotareformer.com/briefs/senate-gop-legislative-agenda-get-tougher-on-crime-and-cut-state-taxes/) | Jeremy Miller; Roger Chamberlain | `/briefs/` seed-prefix exclusion |
| 2022-03-22 | [DFL public-safety plan — brief](https://minnesotareformer.com/briefs/senate-dfl-outlines-500-million-public-safety-plan/) and [dated path](https://minnesotareformer.com/2022/03/22/senate-dfl-outlines-500-million-public-safety-plan/) | Melisa López Franzen; Bobby Joe Champion; Ron Latz; Warren Limmer | Same slug and displayed day, **candidate alias pair**; current brief request resolved to dated publisher path during research, not archived identity proof |
| 2023-02-21 | [Driver-license Senate story — brief](https://minnesotareformer.com/briefs/minnesota-senate-expected-to-pass-bill-giving-drivers-licenses-to-undocumented-residents/) and [dated path](https://minnesotareformer.com/2023/02/21/minnesota-senate-expected-to-pass-bill-giving-drivers-licenses-to-undocumented-residents/) | Zaynab Mohamed | Same slug and publisher-displayed day: **candidate alias** only. Publisher now describes an early-Wednesday vote even though its displayed timestamp is Tuesday Feb. 21; official Revisor groups final passage under Feb. 21. Exact event/publication sequence unverified. |
| 2022-04-25 | [Bipartisan Senate crime bill](https://minnesotareformer.com/briefs/senate-approves-tough-on-crime-bill-with-bipartisan-support/) | Jeremy Miller; Warren Limmer; Melisa López Franzen | `/briefs/` seed-prefix exclusion |
| 2024-02-12 | [North Star Act/sanctuary state reporting](https://minnesotareformer.com/briefs/sanctuary-state-bill-already-dead-as-house-speaker-says-it-doesnt-have-the-votes/) | Grant Hauschild; Erin Murphy; Omar Fateh | `/briefs/` seed-prefix exclusion; do not misattribute House speaker remarks to senators |
| 2025-04-30 | [SD6 special-election result](https://minnesotareformer.com/briefs/keri-heintzeman-wins-special-election-for-minnesota-senate-seat/) | Keri Heintzeman | She **later served** as senator but was **not yet sworn in** on the article's displayed date |
| 2025-05-01 | [Transportation-signs story — brief](https://minnesotareformer.com/briefs/minnesota-republican-senator-no-more-wit-pop-culture-portmanteaus-on-our-road-signs/) and [dated path](https://minnesotareformer.com/2025/05/01/minnesota-republican-senator-no-more-wit-pop-culture-portmanteaus-on-our-road-signs/) | Steve Drazkowski; Ann Johnson Stewart | Same slug and displayed day, **candidate alias pair**, not proven same historical captured HTTP bytes |

**Exact official membership boundary:** Minnesota Legislative Reference Library's [2025–2026 time capsule](https://www.lrl.mn.gov/timecapsule/session?lang=en) records Keri Heintzeman's SD6 election on **April 29, 2025** and swearing-in on **May 6, 2025**. A separate [Minnesota Senate May 6 journal](https://www.senate.mn/journals/2025-2026/20250506031.pdf) documents the oath. The April 30 news article is within this **ever-served** research universe, but she was **not an incumbent senator at publication**; no contemporary-incumbent quote/stance can be inferred. This official 2025 service date is **not** the article's first-public-by date.

## Deterministic URL discovery blind spots

The existing `minnesota-reformer-article-archive` seed requests Wayback original URLs beginning with `https://minnesotareformer.com/202`. That prefix cannot directly select `/briefs/` paths. The separate collector topical URL-path filter may reject **additional** URLs even within a configured seed (see [shadow audit](senate-media-public-discovery-shadow-gaps.md)). These are **URL-gate findings only** and do not establish that an article is missing from the persisted private corpus, unavailable via an alias, or historically discoverable.

| Sample only, URL-level | 2021 | 2022 | 2023 | 2024 | 2025 | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Selected public URL leads | 4 | 7 | 4 | 3 | 5 | **23** |
| Outside configured seed prefix | 2 | 3 | 2 | 1 | 2 | **10** |

Three pairs match on publisher, displayed date and slug: **2022-03-22 public-safety plan**, **2023-02-21 driver licensing**, and **2025-05-01 road signs**. These are *proposed* aliases; neither pair has been equated through original archived bytes or a trusted fingerprint. **23 URL leads ≠ 23 authenticated historically unique articles; 10 outside-prefix URLs ≠ 10 missing articles.** Neither statistic is a rate for Minnesota Reformer, 44 seeded publishers, or all Minnesota Senate media.

### February 2023 displayed-date versus late-night Senate action

The currently served [driver-licensing Reformer page](https://minnesotareformer.com/briefs/minnesota-senate-expected-to-pass-bill-giving-drivers-licenses-to-undocumented-residents/) shows **February 21, 2023 at 8:00 p.m.** while narrating a Senate vote **early Wednesday, February 22**. The separate [official Revisor Senate action index for HF4](https://www.revisor.mn.gov/bills/93/2023/0/HF/4/?body=Senate) lists **February 21, 2023** as the third-reading passage day with **34–31** votes. These observations are not reconciled to an exact clock time, editorial revision history, timezone, or original archived news bytes. The article **cannot** supply the completed-vote claim to a February 21 forecast without specific independent historical public-by proof. Its stored first-public-by status remains unknown.

## Next private/offline reviewer reconciliation

1. Cross-reference each public original URL **and possible dated alias** against the separately authorized private `source_documents` and `evidence_items` export. Keep source IDs, article bodies and names from private rows off public PRs and CI artifacts. Mark non-matches only as *not found in this particular export*, never *never published*.
2. Reconcile exact archived URL, original HTTP bytes/SHA-256 and Wayback capture timestamp. A publisher's displayed day and 2026 research-check day cannot substitute for archive-public-by evidence. Reject same-day date-only cutoffs.
3. For any proposed quote, separately verify exact senator identity, effective Senate service on the article day (including midterm elections), contiguous quoted passage, substantive relevance and human reviewer signoff. Explicitly distinguish context, paraphrase, ambiguity, and missing original.
4. Keep distinct denominators for URL leads, potential alias groups, export context rows, within-year source documents, authenticated original articles, and reviewed quotations. Do not deduplicate archival articles solely by public slugs.

**Scope and safety:** Public discovery only; no Neon/SQL reads, private source exports, unverified historical Wayback capture claims, production seed changes, ingestion, feature/stance promotion, forecasting changes, or 2026 study-year contamination. Both #912 and #946 remain open.
