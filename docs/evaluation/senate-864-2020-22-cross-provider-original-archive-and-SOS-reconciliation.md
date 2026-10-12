# VotePredict #864 — 2020/2022 historical original-candidate archives vs official SOS and LRL service (bounded alternate-provider research)

## Scope and precise finding

This research-only track independently rechecked the original Minnesota Secretary of State **2020 and 2022** post-general Senate results and 7-column ballot candidate files against the already pinned **95 actually-serving 2021–25 state senators**. It then tried an **independent** archive provider—Common Crawl CDXJ plus original HTTP **206 WARC.gz ranges**—for a bounded set of 2020/2022 original campaign-site and publisher-questionnaire leads. One original 2020 candidate-owned Scott Newman campaign homepage was fully recovered from Common Crawl, with raw WARC/http body and original independent index SHA1 matching; the other leads remain either unindexed/temporarily inaccessible or not independently full-body verified. This is not proof that those pages never existed or that no candidate held a view.

The candidate-owned site short-excerpt baseline **does not change**: **92/95** actually-serving senators have at least one independently authenticated historic owned-campaign-site excerpt, and there are **1,285** previously individually authenticated selected candidate-site short issue excerpts. The separately audited **16** new named caucus remarks in merged PR #1224 remain a **different provenance class**, and this round adds neither a caucus nor a website excerpt automatically.

### Independent 2020/2022 official government identity proof

The original Secretary of State public general-results table **`stsenate.txt`**, plus matching original **seven-column `cand.txt`** ballot lookup, are rehashed and structurally joined for both elections. The audit validates **67 Senate election districts and 67 district election winners in each year**. Each of the 2020/22 archive leads is reconciled by district, surname and election-year winning candidate identity against original official LRL Senate service and special swearing history. Independently pinned original SHA256 fingerprints:

| Original source | SHA256 |
| --- | --- |
| LRL actual Senate service original HTML | `bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51` |
| SOS 2020 Senate `stsenate.txt` | `c2937b1fee5ae077603d892adf03c4ce83e2bb2592753680d5bfdeb4aecf7ba5` |
| SOS 2020 Senate `cand.txt` | `8a0596d788b651ec27c05aa576bed31a3a51efd83c2cd2ee2ae5fdcc2f02965a` |
| SOS 2022 Senate `stsenate.txt` | `eb8980245094cf8af0cd08a69c42ae0262fb5a692b09a49be2aee959aecaae74` |
| SOS 2022 Senate `cand.txt` | `0973d5962a0afc830ac9374c43f70269871a6377d956b552065c0cf06bec3538` |

**This is post-election candidate/winner identity proof, NOT a complete historical original filing source or source-to-production-database parity certificate.** The separately requested Minnesota SOS **21-column original filed-candidate export including a historical Campaign Website column is still unavailable**. The seven-column `cand.txt` **does not include** campaign websites. Neither official election outcome records nor later-acquired evidence are automatically historical prediction inputs.

### One additional authentic original: 2020 Scott Newman owned Senate SD18 campaign homepage

* Original URL: `https://www.scottnewmanforsenate.com/`.
* Independent original Common Crawl collection: **CC-MAIN-2020-29**, original observation **2020-07-11 23:29:16 UTC**, before Nov 3 general election.
* Independent CDXJ original indexed payload SHA1/Base32: `CHATYL4CHR6KRTYBSY4GZ5TKROS4LXUU`.
* Exact `206 Partial Content` original compressed WARC range, **15,304** bytes, original compressed WARC record SHA256 `16e78fa1b491314a6e62adc57f7f315e07a5bd9263916127520798768f8566b7`.
* Raw HTTP 200 original HTML SHA256 `a6fcc4aba0c362e39f8bcb5ab157c415435aa13d8f7b17be31c5b0a77fae9b28`.
* Original WARC headers and independent CDXJ both match original URL, original UTC, encoded SHA1 and independent original compressed byte location; reconstructed HTML was strictly limited to the WARC-declared HTTP `Content-Length`, excluding WARC record separators. `originalCampaignVisibleText` independently confirmed **Scott Newman** on page.
* Original acquisition source run [#38275506880](https://github.com/killjoy00/votepredict/actions/runs/38275506880); original whole source WARC/HTML/CDXJ **artifact 11758783024**, 30-day retention. Permanently pinned receipt `data/evaluation/senate-864-newman-2020-authenticated-original-commoncrawl-secondary-WARC-receipt-v1.json`.
* Prior independent original Wayback source **2020-07-08 08:09:01 UTC** has full original HTML SHA256 `73569ee37eeb4064826856217d0cd5683aa2858a2e0e0f9e883c623655ede299`. Both are 2020 Senate SD18 original home versions, just three days apart. The earlier Wayback-authenticated page already contributed **two broad selected** Newman candidate-owned site excerpts on safety and agricultural/industrial economy. **Do not treat a second archive version or independent provider as a new senator, issue quote, platform detail or separately verified actual Senate vote.**
* The independent secondary audit in `scripts/audit-senate-864-newman-2020-original-commoncrawl-independent.mjs` reopens raw public originals, reconstructs WARC/HTTP correctly, verifies the independent full CDXJ original row, previously pinned entire HTML/WARC digests, actual original state Senate winner/member and prior two broad quote ledger, without admitting duplicates.

### Remaining historical original-source research targets — explicit unknowns

| Candidate or track | What was tested | Historical original status and admission decision |
| --- | --- | --- |
| **Scott Newman, 2020 SD18** | `/issues/` original candidate-owned site path (linked from the 2020 candidate profile), and 2020 BallotReady candidate page with issue summaries | Historic original full issue page was **not recovered**; current publisher republished issue details and historical link are lead-only. Owned homepage was recovered separately. No new detailed 2020 issue positions admitted. |
| **Bill Weber, 2022 SD21** | General-year and www variants of iVoterGuide candidate answer page, a **distinct primary election** questionnaire version, and historically reused `weberforsenate.com` | Original 2022 whole questionnaire captures not independently indexed/replayed in this bounded sample. Historic `weberforsenate.com` 2022-captured page actually displayed **2012 SD22** posts (earlier #1217 source audit); not a fresh 2022 SD21 platform. Keep 2020 Weber questionnaire nonresponse distinct from 2022 versions. |
| **Kari Dziedzic, 2022 SD60** | 2022 Action Network legislative priorities survey she sponsored, and historical candidate domain www/no-www | New authentic whole 2022 website/form original not acquired. Original 2017 `kariforsenate.com` later parking content not her campaign; genuine older 2013 issue text is **not** a 2022 publication. A menu of issues on the constituent survey asks **constituents** for preferences; do not assign the listed positions to Kari. |
| **Charles Wiger, 2020 SD43** | `chuckwiger.com` | Alternative-provider captures unverified. Website-gap remains; authenticated publisher/caucus direct-speech evidence exists separately. |
| **David Tomassoni, 2020 SD6** | `tomassoni4senate.com` | Index unavailable; current commercially repurposed domain explicitly disqualified as 2020 candidate text. No new owned site original verified. |
| **Thomas Bakk, 2020 SD3** | `tombakk.com` | Index unavailable, not a proved candidate original. Existing authenticated separately publisher-hosted historical original quoted speech is not an original website. |

The four tracks probe **2020 Common Crawl collection IDs `CC-MAIN-2020-40/34/29/24` or 2022 `CC-MAIN-2022-40/33/27/21`**. Every source request has a bounded original CDXJ JSONL response, HTTP result and status/unknown if missing. This sample does **not** exhaust other Common Crawl collections, historical domains or archive hosts. Valid original index rows must be distinguished from returned 404/unavailable provider pages. Original indexed metadata alone never proves page text; original ranged WARC plus original raw payload SHA1, provenance and named source audit are required. The one 2020 Newman original passes.

### Durable evidence and guardrails

* Strict multi-track original acquisition: `data/evaluation/senate-864-2020-22-original-archive-alternate-index-and-official-sos-reconciliation-v1.json`, `scripts/probe-senate-864-commoncrawl-2020-22-sos-warc-originals.mjs`, `.github/workflows/senate-864-independent-2020-22-commoncrawl-sos-recovery.yml`.
* Standalone independent original full-byte audit: `scripts/audit-senate-864-newman-2020-original-commoncrawl-independent.mjs` and workflow `.github/workflows/senate-864-newman-2020-commoncrawl-secondary-original-audit.yml`.
* Whole original copyrighted campaign HTML/WARC only in 30-day GitHub Actions source artifact, **not Git**. Reports pin original source SHA, capture time, original index and explicit data provenance type.
* The original date is **observed public by archive UTC**, not proof that the author first posted on that exact day. Campaign site opinions aren't official Senate recorded votes or model features.
* **No production read or write, no Neon/Vercel operation, no protected secret use, no forecast/scoring/model/training/scheduler change, no migration/deploy, no contact with government offices.**
* Issue #864 remains **OPEN** pending genuine filed candidate website source and official committee/finance/media original-source-to-DB reconciliation. This branch does not certify historic data completeness.

Suggested next steps: seek the actual 2020/22 Minnesota SOS 21-column filed-candidate website exports or original older election voter-guide versions from authoritative public self-service sources; only then match URL identity and archive content. Separately verify entire election-era candidate issues source text on the actual original website before recording new platform excerpts. Do not repeatedly treat failures in one provider as a negative census.
