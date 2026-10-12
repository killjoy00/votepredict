# #864 — 2026 November incumbent nominees: public source-to-evidence reconciliation and Duckworth original statement leads

**October 12, 2026 · Evidence-only checkpoint · Minnesota State Senate · November 3, 2026 election.**

This checkpoint is a follow-on to the statewide 2021–2025 original campaign-site recovery and the separate 49-incumbent current-election public-source audit. It does **not** assert a successful exact per-member VotePredict database join. The user-facing complete candidate-by-candidate Excel, Markdown, and CSV reports have been generated separately.

## The populations are different

The official 2026 Secretary of State candidate-filing, state Senate service, and August primary reconciliation found **49 sitting senators on the November 3 general-election ballot**. This excludes 17 current nonfilers and one current incumbent primary loss (Paul Utke, SD5), as observed by the previous bounded official-election source reconciliation. It excludes challengers and open-seat candidates, not a census of *all* candidates in all 67 Senate districts.

A separately authenticated original 2021–2025 actual-service matrix contains **95** serving persons, **92** with one or more authenticated original historical candidate-owned website issue excerpts, and **1,285** selected such excerpts. Matching just the 49 2026 incumbent nominees produces **49/49 people with any original historical campaign-site excerpt, 716 selected excerpts**. These historical source excerpts can come from older years and sometimes a different office, and do not certify a new 2026 Senate campaign platform.

Reference original GitHub Actions artifact: [full 95-person / 1,285 excerpt original-source fingerprint audit](https://github.com/killjoy00/votepredict/actions/runs/38260920551/artifacts/11752575710).

## Bounded 49-person current URL and public GitHub reference crosswalk

The complete per-candidate district, exact public research source URL, older excerpt count and bounded source-code URL result are stored in [the 49-person public-source crosswalk](../../data/evaluation/senate-864-2026-49-incumbent-public-source-reference-crosswalk-v1.json).

- **22/49** source URL/path/host search tokens surfaced in the prior public main-branch GitHub code index, mostly in *older campaign-domain research*. The index hit is **not** an authenticated match to the exact content of a current 2026 page, nor an evidence-item or source-document database join.
- **27/49** source URL/path/host search tokens were **not observed** in the bounded index results. A nonmatch is **not proof of absent source records**, because code indexing/normalization and hidden/private database records differ. It does identify an actionable public evidence discovery lead.
- A live 2026 site is not proof its full issues page was written during the current election. A dated caucus individual statement is not a candidate-owned campaign website. A party news release quoting many senators must be attributed only to the person actually quoted.
- The previous 49-person research table includes campaign pages, senator-owned news, third-party direct interviews/questionnaires, and caucus statements. This checkpoint has **not** independently reacquired and SHA-verified all 49 current publisher bodies or established whether their precise quotes are unique relative to stored private evidence.

Source-code search is useful for **public research-ledger reference reconciliation**, but not the production source-to-evidence answer the owner ultimately wants.

## What the existing protected read-only VotePredict data report actually says

A previous successful [sanitized seven-family protected Neon source audit](https://github.com/killjoy00/votepredict/issues/864#issuecomment-6116826026) on the **existing project default branch** recorded, in its `2026` campaign bucket, **140 stored candidate-site campaign evidence rows across 65 distinct source documents**. The [permanent V5 result](source-proof/senate-864-v5-protected-neon-seven-family-baseline.json) explicitly states:

- The default-branch database was **not independently bound to the deployed production app** in that audit.
- Those aggregate counts contain **no published candidate-by-candidate memberships, source URLs, original SHA or exact quote comparisons**.
- The `2026` bucket does not independently certify the first authored 2026 source date, the source's relevant office/cycle, or current 2026 campaign promise truth.
- **Actual exact current 49-person source-to-existing-evidence status remains UNKNOWN for all 49.** Zero private per-person records were queried here. Do not convert 22 GitHub source hits into 22 previously ingested sources; do not convert 27 misses into 27 missing sources.

An actual row-level private comparison requires a **separately authorized correct-project, verified restricted SELECT-only export**, preserving exact member/session/district identity, normalized original URL, raw source-content SHA-256, source kind, available-by/publication evidence, exact literal excerpt and attribution, and duplicate fingerprints in a private trusted environment. Verify the deployed serving database identity separately. Never put private row IDs/source URLs/excerpts into GitHub logs, PRs or ChatGPT. Without such approved data, leave each cell UNKNOWN.

## Duckworth — four distinct *dated source documents*, not automatically four unrelated issues

The previous senator audit singled out **Zach Duckworth (2026 SD57)** because the presently visible candidate site `https://www.voteduckworth.com/issues` contains older text. That page is genuinely original archival evidence **by January 18, 2022**, indexed SHA1/Base32 `3J4BJQQIJWTO6ZBAOBGEDCKJ6QMWGEYK`, complete historical HTML SHA256 `a66629f93b36290064ac1f959590aa95f14b6a22d819ea37dc0ef54e9ddc9929`. Its **14 selected historical excerpts** cover taxes, spending, health, education, public safety, natural resources and other topics. The archive records 2020-era campaign language; it **does not certify a newly authored 2026 position**.

Newly identified self-service public sources, all visibly dated before the 2026 election:

| Source's displayed date | Individually speaker-attributed material | Distinction |
| --- | --- | --- |
| [January 25, 2026 — CNN original broadcast transcript](https://transcripts.cnn.com/show/cnr/date/2026-01-25/segment/06) | Duckworth separately speaks about coordination and de-escalation between federal immigration enforcement, state authorities, local law enforcement and communities; prioritizes dangerous offenders | Named `ZACH DUCKWORTH` transcript turns; marked by CNN as a **rush transcript**, so text could have been corrected after broadcast |
| [January 26, 2026 — Senate GOP caucus original letter announcement](https://www.mnsenaterepublicans.com/duckworth-calls-for-federal-state-cooperation-in-pretti-shooting-investigation/) | Direct Duckworth statement urging coordination and transparency in the Alex Pretti shooting investigation, paired with support for lawful enforcement and proportionate tactics | Direct caucus personal quote, **overlaps the Jan 25 topic**; a separately printed passage but not automatically a separate independent policy |
| [March 17, 2026 — Senate GOP SHIELD school-safety release](https://www.mnsenaterepublicans.com/senate-republicans-roll-out-a-plan-for-safe-and-smart-kids/) | Explicit named direct Duckworth quote and attributed chief authorship of SF637 school hard-security grants, including access controls, glass/structural protections and staff training | Candidate-specific schooling *security grant* detail, not the generic 2022 site parental-school-choice quote; other senators' text must remain excluded |
| [May 16, 2026 — MPR News original attributed quote](https://www.mprnews.org/story/2026/05/16/minnesota-lawmakers-race-to-pass-bills-before-end-of-session-on-sunday) | Duckworth personally discusses increased meat-raffle prize limits for youth sports and charities | Original publisher-printed direct quote and a new selected topic not found in his 14 older campaign-site snippets; whether the proposed bill became law is separate |

**Negative controls:** May 19, 2026 [House joint interchange funding headline](https://www.house.mn.gov/Caucus/View/NR/52130) names Duckworth, but attributes its direct quotation to **Rep. Jon Koznick**, *not* Duckworth. The September 16 [Lakeville SD57 candidate forum listing](https://www.lakevillemn.gov/Calendar.aspx?EID=17241&calType=0&day=16&month=9&year=2026) is not a speaker transcript. A displayed **May 1, 2025** Duckworth higher-education quote is legitimately *2025*, despite the present caucus site's 2026 footer. Do not import these as new 2026 Duckworth-direct evidence.

The supporting [machine-readable source ledger](../../data/evaluation/senate-864-2026-incumbent-duckworth-exact-speaker-leads-v1.json) separates the four sources, exact short candidate speaker cues, older page digest, policy-topic overlap, false positives, publisher metadata, and unrecovered whole-current-body hashes.

## Source-checking implementation and what a successful job means

The new source-only [acquisition script](../../scripts/probe-senate-864-2026-duckworth-dated-original-public-statements.mjs) contacts only the **four exact public publisher URLs**, checks fixed hostnames, original HTTP 200 HTML and size, body SHA256, visible displayed date, named speaker proximity to an exact issue cue and real UTC observation. It preserves a **small source-metadata receipt only**, not copyrighted entire articles, personal contacts, or any private VotePredict row.

- A passed actual source read demonstrates **that original source body text was publicly observable at that run's UTC**, before the Nov 3 election. It does **not** prove the exact author-first-posted time, that a caucus claim is a candidate-owned platform, how an official vote occurred, or database ingestion.
- An HTTP 403/429/504, redirect, historical-source mismatch, or unavailable publisher is **UNKNOWN**, never an assertion that Duckworth did not say it or the page was absent.
- The offline regression suite defends against older content silently becoming 2026 claims, quote attribution to other senators, fake source dates, unsupported page bodies, old site re-use and party/government record promotion.
- Neither this job nor this research performs any SQL, production writes, source ingestion, model changes, 2027 election/scheduler/forecast actions, government contacts, emails or records requests.

## Next decision and stop criterion

The **2026 Duckworth research gap is resolved at the public-dated-speaker-lead level**, subject to original body probe results and later exact private-source reconciliation. The wider 49-person production parity gap is **not closed** by a public-repository source search. It can close only against the actual authorized, deployed VotePredict data and reviewed raw original-source identities. Keep #864 open; do not fabricate matched production counts.

The best next bounded evaluation is a privately executed **exact URL+source SHA+individual membership+literal quote comparison**, not new broad campaign-domain scraping. Only after an independently reviewed exact match can an owner decide which genuinely nonduplicative new evidence belongs in a separately approved ingestion workflow. 
