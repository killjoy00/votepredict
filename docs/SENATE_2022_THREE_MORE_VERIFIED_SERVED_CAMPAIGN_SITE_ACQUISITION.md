# #864 — Original 2022 campaign site discovery for three *additional actually served* Senators

Focus: **first-party campaign-page breadth for verified individual Minnesota senators**, not modern redistricting district-label debate, winner-only sampling or production campaign-site import. The latest merged [59 short issue statements](SENATE_ORIGINAL_CAMPAIGN_ADDITIONAL_35_STATEMENTS.md) come from seven actual senators, but first-party original historical website/issue text has been independently verified for only **five** of them. A new original page must be proven against exact 2022 archival captures before a named historical candidate stance can be added.

## Three additional served-person campaign domain leads

| Real Senator (independent LRL service source required at runtime) | 2022 election cohort | First-party domain discovery lead | Why historical original-source research is still necessary |
| --- | --- | --- | --- |
| Judy Seeberger | 2022 SD41, Senate service 2023+ | https://judyforsenate.com/priorities/ | The current page contains claims from later Senate service; never date those later statements to 2022 without an actual 2022 source capture |
| Bonnie Westlin | 2022 SD42, Senate service 2023+ | https://www.bonniewestlinformnsenate.com/legislative-issues/ | The site is updated for newer elections and legislation; an original 2022 version is required before citing any exact earlier passage |
| Steve Cwodzinski | 2022 SD49, independently served in SD48 before redistricting and SD49 afterward | https://cwodforsenate.com/ | Exact same person's public official Senate service is sufficient to justify site research; don't treat historical district numbers as different people |

Domain and URL leads were discovered from current publisher/candidate sites in October 2026 and are **not** historical filed-candidate SOS website proofs or 2022 statement publication evidence. This pilot uses **only three candidates with separately documented actual Senate service**. It requires original Minnesota LRL service directory HTML bytes, observed UTC timestamp and SHA-256 source manifest before any public archive query.

## Bounded authenticated original acquisition

The [source-only script](../scripts/acquire-senate-three-new-served-2022-campaign-domains.ts) queries the original Wayback historical *domain* CDX index for calendar 2022 through November 7 (not future 2023+ copy). It caps each response to **300 archived index rows**, validates status-200 text/html, exact original campaign host, safe paths, timestamps strictly before November 8 2022, and SHA-1 base32 digest shape. It prioritizes recognizable issue/priorities/vision/platform paths, then distinct homepage/about variants. At most three bounded ORIGINAL page replays per served-person domain, or **nine** original archive page GETs in total, are attempted.

A page is retained as historically authenticated only when a successful 200 original HTML body exactly matches its separately fetched indexed Wayback CDX SHA-1 digest. The report independently records the actual 2026 request/completion UTC times, original captured UTC, byte SHA-256, SHA-1 digest, original URL, source file name, campaign-name-in-page signal, and the distinction between a page and a human-reviewed issue quote. Even when a candidate page is retrieved and independently dated, **zero issue positions are automatically inferred**; original quote text, context/attribution, issue category and conservative dates require a follow-up human review.

A query returning HTTP 503/timeout is **unknown coverage**, not a zero count; a successfully indexed bounded empty [] means only that that one query found no eligible rows in this window, never that a politician had no platform. A sample at its 300-row index cap can omit pages or versions and is not a comprehensive website crawl. Candidate text observed in October 2026 can never be made available pre-2022 by choosing a displayed article date or by reading later legislative accomplishments. No opponent remarks may be attributed to the senator.

The [PR-only public source acquisition workflow](../.github/workflows/acquire-senate-three-served-2022-campaign-originals.yml) obtains the pinned original public LRL senator directory from [source run #38094976711](https://github.com/killjoy00/votepredict/actions/runs/38094976711), runs the tightly bounded source probe, and keeps raw source response index, successfully digest-verified original pages and a dated manifest as an expiring 30-day research artifact. It never reads or writes the production database, changes a forecast, visits private sources, contacts an office, launches a recurring monitor or automatically adds quote/evidence rows.

## Next decisions

If 2022 original candidate issue-page HTML is actually obtained, re-open raw bodies to identify speaker/third-person campaign text, the earliest independently attested capture for each exact quote, issue taxonomy, distinct campaign promises versus retrospective claims, and comparisons between archived copies. Only then propose new senator-page dated issue statements in a separate audited ledger. Otherwise preserve each failed or bounded query explicitly and prioritize alternate original Common Crawl WARC acquisition or independent contemporary campaign-primary publisher originals.

The complete senator-by-campaign-year website denominator, original SOS 2020/2022 candidate *filing* website fields and historic evidence/source membership mapping remain unresolved. **Keep #864 OPEN.**
