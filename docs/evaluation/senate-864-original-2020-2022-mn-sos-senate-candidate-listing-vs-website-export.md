# Issue #864 — original 2020/2022 Minnesota Secretary of State candidate-filing website field acquisition

This is a **source fidelity and historical-election identity audit**, not candidate website coverage certification, a scraped 2026 substitute for 2020/2022, independent legislative vote verification or deployed predictor data. **No original 2020/22 filed-candidate bulk export with campaign website column has been obtained** in this bounded pass.

## Authenticated real historical original SOS State Senate listings

A significant new government-primary-source outcome is **two true complete original 2020/2022 State Senate-filtered `CandidateFilingResults.aspx` listings** on the old official `candidates.sos.state.mn.us` hostname, plus a separate May 2022 original snapshot. Each complete pre-general-election HTML is checked against its own **independent original indexed Wayback CDX SHA1/Base32** and the complete whole HTML SHA256; no archived original privacy-bearing source text is committed.

| 2020 or 2022 source | Original archive UTC | Indexed original SHA1 Base32 | Entire original HTML SHA256 | Named actual 2021–25 senators found |
| --- | --- | --- | --- | --- |
| 2020 Senate-only SOS candidate list | **2020-10-21 21:17:52** | `BBYBU7X3BAFEV27UGT5BGV6WMWIOJ7IM` | `89fe0c0cb330a005ad662a5b9d993b520954b247934b93204c324218e1022d89` | **Thomas (Tom) Bakk**, SD3 winner; **David J. Tomassoni**, SD6 winner; **Charles "Chuck" Wiger**, SD43 winner |
| 2022 Senate-only SOS candidate list | **2022-08-16 15:20:37** | `7WHUBL6VSXWR36YI2PMWCIMWC3QFZLZX` | `1776f314b4ef3b35eb8610ec883f7f0033b91199f3c1b4e6b55bfece5b537464` | **Bill Weber**, SD21 winner; **Kari Dziedzic**, SD60 winner |
| 2022 earlier Senate-only SOS candidate list | **2022-05-28 16:40:23** | `EY2O2CJG3DA3DTAVCRX3DZWZNZAM7IMH` | `55dec1666b6664beaafb125a7321a52fdf48aa56c4b3d96cbeb1e5b418a1e69d` | **Bill Weber** and **Kari Dziedzic**, respectively original SD21/SD60 election winners |

The official original complete **2020 and 2022 post-general SOS Senate result and candidate lookup files** have separately been rehashed in both year-specific jobs, confirming **67 Senate districts and 67 district winner identities for each year**. Earlier independent original Minnesota LRL Senate service and swearing files confirm **95 actual-serving persons across 2021–25**. The names in original Senate-only pre-general filing lists are authentic evidence of candidacy; the **winning Senate district** is independently anchored to the post-general SOS results rather than spuriously inferred from the candidate list row.

Source acquisition scripts: `scripts/probe-senate-864-sos-historical-filing-export-originals.mjs`, `scripts/probe-senate-864-sos-aspnet-postback-and-historic-results.mjs`, `scripts/audit-senate-864-sos-original-senate-only-candidate-results.mjs`.

Source-date metadata and safe name/office/district URL detection outputs are kept in thirty-day Actions artifacts from [2020/22 exact original source run](https://github.com/killjoy00/votepredict/actions/runs/38285917742), independent official current portal/old historic snapshot checks [run](https://github.com/killjoy00/votepredict/actions/runs/38283881827) and [run](https://github.com/killjoy00/votepredict/actions/runs/38283881944).

## The confirmed blocker: actual website field is **not visible in original State Senate search listing**

The original SOS State Senate search results have names in **table column two** (zero-based index one), with candidates named above. Replayed originals had **zero external HTTP website links within those candidates' individual table rows**. The candidate name links use **ASP.NET JavaScript `__doPostBack` handlers**, not historical straight URL links, so neither list proves those candidates had or lacked a submitted website. Their original candidate detail response may have held the campaign website field but **was not obtained with independent historical timestamp + full-body hash**.

The official candidate-file layout separately documents field **Campaign Website** in column 16 (zero-based index 15) of the **federal/state/county filed-candidates semicolon-delimited export**. This export must not be confused with the **seven-field post-vote `cand.txt`**, which contains no website field. The current SOS site is serving the **2026 election**, so its candidate download is **not evidence of a 2020/22 candidacy site**.

The 2026 SOS download uses ASP.NET POST, triggered by `__doPostBack('ctl00$ContentPlaceHolder1$lbStateMediaFile','')` on `https://candidates.sos.mn.gov/`; a bounded public GET + POST test received **`Radware Captcha Page` HTTP200**, not the candidate file. Do **not** bypass the CAPTCHA, call its body a semicolon-delimited filing source or copy the current content into 2020/22 data. Historical initial candidate-listing URLs are discoverable via original indexed Wayback HTML; actual historical bulk POST file responses were not recovered.

Some Wayback endpoints respond HTTP 200 but return non-CDX provider errors; a missing index is **not a negative census** of filings or campaign websites. The 2020 original archive also contains a true SHA1-verified **March 5, 2020** Senate-only URL body with **no candidate list rows**; it does not disprove later Senate candidates who were verified in the October copy. All source dates are observed public **by** archive UTC, not first authorship.

## Candidate-owned website research and next realistic route

Parallel [PR #1239](https://github.com/killjoy00/votepredict/pull/1239) specifically searches original candidate-owned sites for Wiger, Tomassoni and Bakk. It independently authenticated original `tombakk.com` **2008 Governor** pages and the 2019 `tomassoni4senate.com` **unrelated receipt-template** site; neither is a 2020 Minnesota **Senate** website. Wiger's 2012 Patch candidate profile links a **government Senate website**, not his candidate-owned election campaign site. None of those false positives may be promoted as new original Senate campaign evidence.

**Most defensible next archival source**: original 2020 and 2022 bulk **filed-candidates** export (21-column schema, including Campaign Website) or archived historical candidate *detail-page postback response* from official Minnesota SOS. Candidate files may include home addresses, telephone numbers and emails: use only the **public candidate name, State Senate district and Campaign Website** for safe metadata, without retaining/surfacing the raw personal-contact data. If the official source cannot be recovered by public archived bytes, document a need for an election-office historical data export request rather than inventing domains.

**Cumulative site coverage unchanged**: **95** actually served, **92/95** with previously verified original candidate-owned campaign websites, **1,285** selected original campaign-owned brief research excerpts. More than 90 separate original publisher direct-answer/caucus excerpts remain **separate evidence types**. No new campaign-site original source item, candidate position, official vote or prediction feature has been accepted in this SOS track.

**Zero production database reads/writes, no official campaign filing privacy leak, no model training/prediction/forecast/scheduler changes, no schema migration or deployment.** Issue #864 remains open.
