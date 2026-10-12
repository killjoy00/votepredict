# Issue #864 — original 2020/2022 direct Senate caucus remarks for three sparsely covered senators

This is a **historical-source research reconciliation, not a new verified Senate campaign platform, legislative roll-call vote, training feature, or deployed forecast**.

## Strict summary

The **six full original** pre-general-election caucus HTML bodies have matched both their **independent CDX-indexed SHA1/Base32 originals** and the recorded SHA256 of each complete HTML body and complete CDX index. The actually-serving person and source-election connection was rechecked against the complete original Minnesota LRL Senate directory (government whole-body SHA256 \`bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51\`). A second offline auditor checked **16** literal short excerpts within the named speaker's own source turn, including **two expressly joint** Dziedzic/Champion remarks.

**Source original-acquisition**: [Actions #38264756956](https://github.com/killjoy00/votepredict/actions/runs/38264756956).

**Independent literal source + speaker + campaign-ownership boundary audit**: [Actions #38266051746](https://github.com/killjoy00/votepredict/actions/runs/38266051746), SUCCESS.

| Senator and relevant historical election | Authenticated caucus original documents | New short exact individual direct quotes | New expressly joint two-person excerpts | Original public-by capture |
|---|---:|---:|---:|---|
| Kari Dziedzic, Senate SD60, Nov 8 2022 | 3 | **5** | **2** | 2022-08-11, 2022-10-01 |
| Bill Weber, Senate SD21, Nov 8 2022 | 1 | **4** | 0 | 2022-08-04 |
| Scott J. Newman, Senate SD18, Nov 3 2020 | 2 | **5** | 0 | 2020-05-17, 2020-08-05 |
| **Total** | **6** | **14** | **2** | all before relevant general election |

**First-party campaign-owned website figures remain exactly 92/95 people and 1,285 selected excerpts**. These 16 original short quotes are additional **caucus-published sitting-senator remarks**, stored as a distinct research-source category; they do not increment the candidate-owned-site original quote count or imply full historic position completeness.

## Original source-specific details

### Kari Dziedzic (2022, incumbent)

1. **[September 6 Senate DFL Tax Committee remarks on student debt](https://senatedfl.mn/dfl-senators-on-tax-committee-say-minnesota-should-not-tax-residents-getting-student-loan-forgiveness-2/)**. Original whole HTML at **Oct 1, 2022 20:03:02 UTC**. **Two** literal Dziedzic excerpts, specifically after/around **“said Sen. Dziedzic”**, support preventing additional Minnesota taxation of forgiven student loan debt. Nearby separate **Ann Rest** testimony was explicitly excluded from Kari's individual speaker scope.
2. **[July 14 Senate DFL housing affordability statement](https://senatedfl.mn/senators-melisa-lopez-franzen-kari-dziedzic-recognized-by-key-housing-group-for-work-to-expand-home-ownership-make-housing-more-affordable-in-minnesota/)**. Whole original **Aug 11, 2022 18:33:52 UTC**. **Three** literal Dziedzic excerpts on housing instability, precarious rent affordability and housing investments. Do not falsely attribute nearby statements made by **Melisa López Franzen or the housing association** to Dziedzic.
3. **[July 11 joint Dziedzic/Champion community trust statement](https://senatedfl.mn/senators-dziedzic-champion-release-statement-condemning-recent-harmful-remarks-by-minneapolis-council-member-michael-rainville/)**. Original **Aug 11, 2022 17:53:42 UTC**. **Two** short passages are tagged explicitly **joint_senators_Dziedzic_Champion_not_sole_speech**; this is not proof of a solo Dziedzic verbatim quote, nor evidence for policy on an unrelated issue.

### Bill Weber (2022, incumbent)

4. **[July 28 Minnesota Senate GOP caucus publication of Weber energy remarks](https://www.mnsenaterepublicans.com/coalition-for-a-secure-energy-future-honors-sen-bill-weber-with-energy-champion-award/)**. Original **Aug 4, 2022 05:26:20 UTC**. **Four** exact short Weber speaker-turn excerpts on rising energy prices, his criticism of excessive reliance on wind/solar and support for diverse affordable, reliable energy sources. The original text also quotes **Luke Hellier**, from the awarding organization; those words are **not** attributed to Weber.

### Scott Newman (2020, incumbent)

5. **[March 17 Minnesota Senate GOP published Newman emergency closure statement](https://www.mnsenaterepublicans.com/statement-from-senator-newman-regarding-bar-and-restaurant-closures/)**. Original **May 17, 2020 15:20:10 UTC**. **Three** direct short excerpts on the governor's unilateral emergency powers, equity between workers and small business owners, and misdemeanor penalties for business owners. Preamble claims that the Minnesota Senate approved appropriations are **not official voting records**.
6. **[March 3 Senate GOP publication of election-administration oversight exchange](https://www.mnsenaterepublicans.com/senate-republicans-raise-questions-on-sos-directing-voters-to-partisan-websites-on-election-day/)**. Original **Aug 5, 2020 21:37:32 UTC**. **Two** Newman-attributed quotes, bounded from the question explicitly **“asked Senator Scott Newman”** through the next separately attributed speaker. Statements by **Mary Kiffmeyer, John Jasinski, Mark Koran** were not included as Newman speech. This is a claim about an incident by Newman, not independent verification that the claimed conduct occurred.

## Exact original witness receipts and reproducibility

The six original URLs, raw HTML SHA256, whole CDX SHA256, original indexed SHA1 and capture UTC are retained in \`data/evaluation/senate-864-kari-weber-newman-six-original-2020-22-caucus-source-receipts-v1.json\`.

The **16** short research excerpts with their source page ID, named individual-vs-joint attribution, cautious issue meanings and production-ineligibility flags are in \`data/evaluation/senate-864-kari-weber-newman-16-new-original-caucus-remarks-v1.json\`.

A separate source replay, actual-member, published-date, exact speaker-boundary and 25-prior-publisher-excerpt nonduplication audit runs in \`scripts/audit-senate-864-kari-weber-newman-16-original-caucus-remarks.mjs\`.

Whole original HTML/CDX bodies are only in **30-day retention GitHub Actions artifacts** (no original full copyrighted HTML committed):
- Kari whole originals: **11754615669**
- Weber whole original: **11753399607**
- Newman whole originals: **11754276710**
- Original questionnaire lead (not authenticated): **11754246754**

## Precise holds and non-evidence

- **2022 iVoterGuide Weber questionnaire:** the current page advertises the 2022 SD21 election and displays detailed responses but an independent original historical page **was not obtained**: archive CDX response HTTP 200 was **not valid CDX**. **ZERO** iVoterGuide policy passages are admitted as historically public by Nov 8, 2022. Do not use 2026 mutable text to assert the 2022 original questionnaire, or interpret archive provider failure as candidate nonresponse.
- **Newman Feb 20, 2020 tax report** and **Weber April 27/May 23, 2022 caucus reports** had original index HTTP 200 provider non-CDX payloads. Current display content exists, but historically original complete-page versions are unverified in this bounded run. **No short excerpts from those sources were added**.
- The three original candidate-owned website historical gaps **Charles Wiger, David Tomassoni, Thomas Bakk** remain; they have separately authenticated publisher direct statements. Earlier Kari-owned **2013**, Weber-owned **2012** and Newman-owned **2020 broad homepage** excerpts remain distinct from this caucus category.
- Original capture public-by date is not an independently proven first-authored/published day. No extrapolation from absence of a topic/URL. **No legislative action or vote from candidate-published/caucus statements is certified without matching original official source.**
- Zero production DB reads/writes, zero training/model/forecast/scoring/scheduler changes, no migration or deployment. Parent **#864 stays OPEN**; roll-call, committee, finance and broader media parity have separate acceptance criteria.

**Next bounded research priority:** more authenticated election-era candidate-owned originals, if another trusted Wayback/index source is available; in parallel, connect separately audited caucus remarks and independently authenticated publisher questionnaires to a distinct *historical-source coverage* matrix without silently converting them into site platform positions or model features.
