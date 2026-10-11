# #864 — 2019–2020 first-party Senate campaign ORIGINAL website recovery for six actually served people

Campaign-issue original-source research now extends backward to the **November 3, 2020** Senate general-election cohort—the correct pre-2021 source window. This tranche does not treat redistricting as a barrier: it verifies historical district/person service from the original Minnesota Legislative Reference Library (LRL), then searches only the candidate's historical campaign domain. It is an archived-source discovery exercise, **not** a website completeness certificate, speaker quote audit, or automatic forecasting evidence import.

| Candidate who ACTUALLY served in Minnesota Senate beginning 2021 | Official 2020 Senate district | Campaign domain discovery lead | Independent campaign-year check still required |
| --- | ---: | --- | --- |
| **Mark Johnson** | 01 | https://www.markjohnsonmnsenate.com/ | Preserve differences between 2016, 2020 and post-2020 site text |
| **Jen McEwen** | 07 | https://www.votemcewen.com/issues-1 | LRL identifies the person as Jennifer A. McEwen, formally listing nickname Jen; her later SD08 is not her original 2020 district |
| **Aric Putnam** | 14 | https://aricformn.com/ | Original source from 2020 campaign rather than retrospective legislative accomplishments |
| **Gary Dahms** | 16 | https://www.dahmsforsenate.com/ | Correct 2020 SD16, rather than his later SD15 post-redistricting |
| **Mary Kunesh** | 41 | https://marykunesh.com/ | Historic 2020 ballot name Mary Kunesh-Podein is the same person LRL identifies as Mary K. Kunesh, before later SD39 |
| **Steve Cwodzinski** | 48 | https://cwodforsenate.com/vision | Correct 2020 SD48, rather than his SD49 post-redistricting Senate service |

Source paths listed above are **discovery leads** from the known candidate-owned campaigns. The original 2020 SOS filed-candidate website column and original first publication dates remain unverified; a current site cannot prove any archived page content.

## Explicit LRL person identity gate BEFORE archival source GETs

All six people must be independently verified to have personally served in the original **2021 Senate term**, using the exact original official [LRL service directory](https://www.lrl.mn.gov/legdb/senate_dir) HTML originally acquired in [public run #38094976711](https://github.com/killjoy00/votepredict/actions/runs/38094976711), artifact **11685387674**. The runner independently rehashes original HTML SHA-256, verifies the saved government source observed-at UTC and checks every full person identity, 2020 election district and 2021 Senate-service term BEFORE even the first archive request. Mary’s former surname (and Jen’s official nickname) cannot be blindly copied to another person.

This is not a 2020 ballot-candidate denominator: the first-party website discovery focuses strictly on **six people proven to have served Senate**, not losing candidates never shown to have served. An earlier losing campaign of a subsequently served person is legitimately in scope for later targeted research, but is not assumed or invented in this six-person winning-term cohort.

## Original historical archive boundaries and verification

Each candidate's original campaign domain is searched via real public Wayback CDX archives limited to original webpage captures **2019-01-01 through 2020-11-02**, strictly before the November 3 election. The maximum CDX sample is **300** 200-status indexed HTML rows per domain. Up to **four** bounded original HTML replays per candidate (24 total) prioritize recognizable policy/issues/platform pages before homepage/about; only exact approved domain host, safe paths and historically bounded capture dates can pass. Index metadata alone is not a statement or source-content proof.

A recovered original page is considered **HTML authenticated** only after its actual HTTP 200 HTML body rehashes to the separately acquired original CDX **SHA-1 base32 digest**, and its full body SHA-256/source capture UTC, current original HTTP retrieval timestamp, URL and local immutable file are independently recorded. These proofs establish *exactly that HTML existed no later than its historic capture*, NOT an author's original first-posted day, contemporary campaign-year adoption, personally spoken quote, legislator vote or guaranteed pre-primary cutoff eligibility. A 2019 page may be retained older-cycle copy and is never silently labeled newly issued in 2020.

An HTTP 503, timeout, missing original replay or the 300-row sampling limit means **unknown/missing source proof**, not proof that any senator had no issue position. Successfully empty bounded index is no more than an observation of that query.

The PR-only [public original acquisition workflow](../.github/workflows/acquire-senate-six-served-2020-original-campaign-pages.yml) uses [the original-source runner](../scripts/run-senate-six-served-2020-original-campaign-domains.ts) and retains the dated source-CDX/index/original HTML/provenance outputs in an expiring **30-day** GitHub Actions artifact. The source manifest keeps original 2020 election district, original verified person and historic archived campaign URL distinct from 2026 source acquisition and modern redistricted service.

## Next: exact issue-page text review

Examine the preserved actual 2019/20 campaign-page copies to discover historically attributable exact short quote snippets: the policy text must appear in the relevant candidate-owned page body, identity and historic campaign cycle must be human-reviewed, full source SHA/CDX verified, source capture UTC recorded, and original author-post date left **UNKNOWN** absent independent proof. Site existence alone adds **zero** statement excerpts. No older-page change may be inferred solely from changing SHA digests.

No production database, Neon/Vercel, evaluation frozen historical scores, model training, campaign evidence rows, forecast, 2027 program, cron or public-office outreach. The complete 2020/22 original SOS filed-candidate domain export and 2021–25 full senator site/page/statement denominator remain unknown. Keep [#864](https://github.com/killjoy00/votepredict/issues/864) OPEN.
