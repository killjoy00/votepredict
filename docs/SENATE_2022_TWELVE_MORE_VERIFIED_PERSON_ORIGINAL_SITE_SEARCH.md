# #864 — Twelve more ACTUAL Minnesota senators' original 2022 campaign sites: one-shot historical retrieval

## What this expands

The merged prior research includes original archived first-party campaign-page excerpts for **10 independently actually serving Minnesota Senate people** (eight with 2022/2024/2025 contemporary election pages and Bonnie Westlin's older District 34 copy independently *visible* in January 2022). It retains **84** distinct short source research excerpts, of which **80** are date-attested original historic first-party page text and four 2026-only publisher candidate questionnaires. These are sampled excerpts, not comprehensive pages, vote tallies or production historical forecast features.

This new one-shot source acquisition seeks first-party candidate-site **page breadth** for **12 additional independent ACTUALLY served senators** in their 2022 elections, not just more snippets from the ten previously investigated people. All source leads below are present-day publisher/campaign domains or secondary historical-link discoveries. **No row is an authenticated filed 2022 SOS candidate-website field. No current page's text is assigned a 2022 publication date.**

| Verified Senate person's 2022 election campaign | 2022 district | Public campaign domain discovery lead | What original-source retrieval must still prove |
| --- | ---: | --- | --- |
| Mark Johnson | 1 | https://www.markjohnsonmnsenate.com/ | Whether old/current campaign copy existed unchanged in 2022 |
| Grant Hauschild | 3 | https://grantformn.com/ | Independent 2022 campaign and issue-page archive original |
| Robert Farnsworth (campaign displays Rob) | 7 | https://robfarnsworth.org/campaign/ | Actual LRL identifies **Robert**, not a new person called Rob |
| Jen McEwen (LRL Jennifer, nickname Jen) | 8 | https://www.votemcewen.com/issues-1 | 2022 original issue page vs mutable modern candidate position |
| Nathan Wesenberg | 10 | https://www.wesenbergforsenate.com/ | Original pre-election 2022 platform copy |
| Aric Putnam | 14 | https://aricformn.com/ | Identify any 2020/2022 carryover before labeling as newly authored |
| Gary Dahms | 15 | https://www.dahmsforsenate.com/ | 2022 SD15 archived original, regardless of former SD16 term |
| Liz Boldon | 25 | https://lizboldon.com/priorities | Distinguish actual 2022 issue page from later House/Senate election updates |
| Mary Kunesh | 39 | https://marykunesh.com/ | Person was Senator SD41 prior to SD39 redistricting; original 2022 copy may contain historical priorities |
| Erin Maye Quade | 56 | https://erinmayequade.com/ | Historically dated 2022 first-party campaign issue page, not current campaign copy |
| Zaynab Mohamed | 63 | https://www.zaynabmohamed.org/ | Actual 2022 original campaign source before any current first-person legislative retrospective is used |
| Clare Oumou Verbeten | 66 | https://www.clareverbeten.com/ | Original pre-November 8, 2022 first-party candidate policy page |

**Actual Senate service is the identity criterion.** The [original official MN LRL Senate directory](https://www.lrl.mn.gov/legdb/senate_dir) was acquired as complete original HTML from an independent public-source GitHub Actions run [#38094976711](https://github.com/killjoy00/votepredict/actions/runs/38094976711), artifact **11685387674**. Before any new public archive network request, the runner requires the exact historical original HTML file, original SHA-256, actual government source observation UTC and unambiguous LRL person + next-term Senate service confirmation. It does NOT infer identity from the website alone, a surname, a party, winner status or an adjacent district.

## Exactly bounded original-source recovery

The [immutable fixture](../data/evaluation/senate-twelve-served-2022-original-campaign-domain-targets-v1.json) permits **12** domain CDX public archive index GETs only. Each is restricted to original 2022 dates **2022-01-01 through 2022-11-07**, successful HTML responses and a maximum of **300** index rows. The source probe selects up to **four** real archive captures per Senator (48 total maximum), prioritizing platform/issue/priorities/policy pages before homepage and supporting campaign context. Every indexed URL must have exactly the authorized original campaign host (including www variant), no query or fragment, a safe original content path and an independently date-bounded capture. Broken URLs and out-of-window versions are discarded.

A true historical archived source page is retained only if a real HTTP 200 original HTML response (not merely a CDX listing) matches its **separately retrieved original CDX SHA-1 base32 payload digest**, in addition to its acquired actual original source SHA-256. A captured page may still be an empty navigational placeholder, contain statements from earlier election cycles, contain later-delivered site code, or fail to mention the candidate. These possibilities remain **explicitly unreviewed** until human source text comparison. Source capture UTC is a latest independently attested availability bound for that precise page text, not the author's first posting date. Source retrieval timestamps from **October 2026** are recorded independently from archive capture timestamps.

An HTTP 503/429/timeout is **unknown historical archival availability**, not zero policy stances; even a parsed empty source index shows only that bounded query's index count, not historical website absence. A 300-row index limit may omit a later (or earlier) page version, and at most four original replay pages cannot establish whole-site completeness.

The PR-only [original HTML/CDX source workflow](../.github/workflows/acquire-senate-2022-twelve-verified-served-original-pages.yml) invokes [the research runner](../scripts/run-senate-2022-twelve-served-original-campaign-domains.ts), which requires the actual official LRL original and its corresponding source receipt before all twelve candidates are validated. It stores the raw successfully returned historical CDX index payloads, individually verified original HTML files and SHA/date receipts, including failed-source observations, in a 30-day Actions artifact. It never contacts any public office or interacts with private production data.

## Next review

Once the real original 2022 archive attempts finish, inspect the actual saved HTML pages, classify each historic page as (a) genuinely contemporary **2022 campaign source text**, (b) **older campaign copy carried into 2022** or (c) unverified candidate identity, and only then extract exact speaker-attributed issue passages. Pin short original visible text excerpts, issue family, candidate-owned attribution, full historical original SHA-256/CDX SHA-1, actual first attested capture UTC and separate first-author-posted-date **unknown**. Legislative claims of past accomplishments do not prove an individual vote, a bill outcome or pre-2022 availability.

No original 2020/22 SOS candidate filed-website column is automatically reconstructed from current domains. No research page is an authorized production forecast feature. No database/Neon/Vercel reads or writes, historical evaluation freeze changes, model training, scheduler work, 2027 activities or ingestion operations. Keep [#864](https://github.com/killjoy00/votepredict/issues/864) **OPEN**.
