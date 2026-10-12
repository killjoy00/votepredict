# #864 — Source-authenticated senator positions, 2023 bonding choice reversals, and 2021 Wiger education

**Research-only checkpoint, October 12, 2026.** Uses authenticated historical originals, exact bill-event identities, and independently downloaded official Journals. Nothing ingested into production; no changes to bill/vote labels, forecasting, models, schedulers, serving, or deployments. No outreach, email, interviews or institutional requests.

## 1. Official member-vote discovery: same HF669 number, different decisions and texts

The [Minnesota Revisor HF669 status](https://www.revisor.mn.gov/bills/93/2023/0/HF/669/) distinguishes the failed **March 16, 2023** 33–32 Senate final-passage vote from the successful **May 22** 56–11 Senate third-reading vote *after amendments*.

| Original government journal | Whole original PDF raw SHA256 | Bytes | PDF pages | Selected roll PDF page |
| --- | --- | ---: | ---: | ---: |
| [2023-03-16 Senate Journal](https://www.senate.mn/journals/2023-2024/20230316037.pdf) | `5bb04ac1a09813b8f6fcde5c432458e17a2050ef051632a73e5bae4586c2cd50` | 2,698,337 | 168 | 165 |
| [2023-05-22 Senate Journal](https://www.senate.mn/journals/2023-2024/20230522077.pdf) | `ad8463bc465a620c21931dd1a7c7c81d9f450c41478ca68bc2741b188cb8119b` | 12,314,742 | 848 | 821 (HF669), 751 (HF670) |

The independent whole-PDF audit with *bill-nearest roll anchor, exact chamber tally, third reading and separately printed affirmative/negative rosters*, excluding proxied Rule 40 mentions, gives:

| Actual senator | March 16 HF669 failed | May 22 amended HF669 passed | May 22 HF670 cash infrastructure passed |
| --- | --- | --- | --- |
| **Mark T. Johnson** | **NAY** | **YEA** | **NAY** |
| **Karin Housley** | **NAY** | **YEA** | **UNKNOWN** — named in neither verified personal roster subsection here |
| **Bill Weber** | **NAY** | **YEA** | **UNKNOWN** — named in neither verified personal roster subsection here |
| **Nathan Wesenberg** | **NAY** | **NAY** | **NAY** |

This is **three NAY→YEA changes on two DIFFERENT floor-amended HF669 decision events**, one NAY→NAY, and **no invented explanation**. The HF670 roll is a different bill; an unidentified person cannot be assigned yea or nay based on its 35–14 tally.

Independent [live government original-PDF audit #38322618545](https://github.com/killjoy00/votepredict/actions/runs/38322618545), artifact `11779810918`; **10 synthetic source/roll/proxy/adjacent-motion tests passed**. Full raw PDFs and extracted page text are intentionally NOT committed.

## 2. March 6 personally attributable written condition **before** March 16 decision

The March 6 original Senate GOP publisher release [“tax cuts for bonding”](https://www.mnsenaterepublicans.com/senate-gop-offers-win-win-tax-cuts-for-bonding/) was independently original-archived **by March 7, 2023 at 22:07:14 UTC**, before the March 16 HF669 failed passage. Exact whole original HTML indexed SHA1 Base32 `HB6IVRHSZVLL6D7BJ33UOFUNEQL4XTF7`; raw SHA256 `95f8ff71b78198c39b51400d1d4b8dd4621077fdd98514e361c2353fdd6aae85` (82,012 bytes).

**Mark T. Johnson**'s precise publisher-bounded individually named original written quote states that a bonding bill was conditioned on obtaining tax cuts. The selected originally attributed whole printed quote SHA256 is `138109280dfcb7c4e22958456a545eca725b1221092a10fa2c15da8e35ed9bbf`.

The same article *currently* also contains statements individually credited to **Karin Housley** and **Bill Weber**, but the deliberately strict archived original post-quotation speaker gate has **not independently validated their full quote boundaries**; do not count their current source as historical pre-vote statement. The [March 7 Nathan Wesenberg statement](https://www.mnsenaterepublicans.com/wesenberg-senate-gop-offers-win-win-tax-cuts-for-bonding/) similarly has not passed entire indexed original authentication. The differently published Housley repetition is not another underlying policy event. Original archived source validation run [#38322285543](https://github.com/killjoy00/votepredict/actions/runs/38322285543), 12 synthetic tests passed, source artifact `11779381317`.

### Do not claim a solved causal mechanism

The [March 27, 2023 Senate Republican Caucus Compromise Offer retained by Minnesota Legislative Reference Library](https://www.lrl.mn.gov/vf/item?record=266236) listed **HF669**, **HF670**, additional roads/bridges, tax relief including full Social Security income-tax exemption and no new tax increases, nursing-home support, and agriculture funding as a *collective* package. The page displays an original PDF and date March 27, but an independently captured 2023 entire-original public-by timestamp for the LRL PDF was **not** recovered in this work. An organizational commitment does not automatically bind a single senator's exact later HF669 vote.

Later [legislative committee reporting](https://www.house.mn.gov/SessionDaily/Story/18028) documents a negotiated infrastructure package, while [contemporaneous May 2023 original publisher reporting](https://www.startribune.com/minnesota-legislators-strike-last-minute-deal-on-infrastructure/600276484) directly quotes Johnson discussing nursing-home funding. The specific full historical publisher original underlying that separate Saturday quotation remains **unverified**, and cannot be given a made-up historic posting minute. A negotiated budget trade-off is plausible **context**, NOT an independently proved reason for any senator's changed vote. Revisor [HF669 versions](https://www.revisor.mn.gov/bills/93/2023/0/HF/669/) and exact March/May Senate amendment text need further version-by-version crosswalk before treating two ballots as identical policy.

## 3. Chuck Wiger: three distinct original Senate DFL publisher documents, NOT Senate campaign websites

This is a targeted replacement for low-yield campaign domain searching. Whole indexed Wayback SHA1 original source replay recovered **three historical first-party Minnesota Senate DFL publisher HTML originals**, independently checked at full raw SHA256 and indexed SHA1, [successful workflow #38322976362](https://github.com/killjoy00/votepredict/actions/runs/38322976362), artifact `11779054359` (**9 offline adversarial tests passed**):

| Issued statement | Original archive public-by | Raw full HTML SHA256 | Individual exact signed/quoted policy passage |
| --- | --- | --- | --- |
| [2021 SF960 omnibus education](https://senatedfl.mn/senate-wiger-statement-on-omnibus-education-bill/) | **2021-04-24T17:43:32Z** | `b183fe353f77249d54ace06d57c37e980f6eb12d6630c84590a36e76c94b4856` | **VERIFIED Wiger signed** — school funding, vouchers, conference changes |
| [2021 E-12 budget compromise](https://senatedfl.mn/senator-chuck-wiger-statement-on-e-12-budget-agreement/) | **2021-07-03T00:46:57Z** | `0914c4d656d3f521e20c175b5b81ab4edf06ae20094709bdbfc1379e3c5367be` | Original page verified; exact speaker quote not yet bounded |
| [2022 education measure](https://senatedfl.mn/senator-chuck-wiger-statement-on-republican-education-bill/) | **2022-05-21T21:59:29Z** | `b76dd303a5f470bf2e58775ff80f9e83f635a0c7bb39499d61e3eff39a5a27c2` | Original page verified; exact speaker quote and exact bill not yet crosswalked |

Three distinct selected short clauses in the authentic April 2021 Wiger signed source concern **insufficient schools funding**, **money toward private vouchers**, and his **intention to increase schools funding and remove provisions during conference**. It is *after* the original April 22 SF960 37–29 Senate passage, so it cannot predict that earlier ballot. Its later crosswalk is an unresolved separate legislative decision. **Wiger still has ZERO authenticated candidate-owned original Senate campaign-site excerpts**. This research adds first-party LEGISLATIVE SPEECH without changing the **92/95** original campaign-site people or 1,285 selected website snippets.

Machine-readable Wiger full original SHA/source attribution: `data/evaluation/senate-864-wiger-three-2021-22-original-firstparty-publisher-receipts-v1.json`.

## 4. Tom Bakk and David Tomassoni: one attributable 2021 joint policy source — archive unresolved

[September 3, 2021 first-party caucus Line 3 joint signed statement](https://www.mnsenaterepublicans.com/statement-from-minnesota-legislators-on-dc-squad-visit-to-protest-line-3/) explicitly includes **Senator Tom Bakk** and **Senator David Tomassoni** as signatories; [Minnesota House member official publication](https://www.house.mn.gov/members/profile/news/15395/46693) repeats the same underlying text, not another independent speech. They are named **JOINT signatories**, not two recorded individual first-person oral statements, not proof of a vote on a specific bill. Research-original source proof audit [#38323324783](https://github.com/killjoy00/votepredict/actions/runs/38323324783) **7 synthetic adversarial tests passed**, but source provider results were **CDX_REQUEST_OR_PROVIDER_ERROR_UNKNOWN** for the Senate Caucus and **CDX_INDEX_INVALID_UNKNOWN** for the House copy. **No original HTML source promoted**, no historical public-by assertion, no claim of absent policy. Candidate-owned historic Senate campaign site gaps **remain Wiger, Bakk and Tomassoni**.

## 5. Recomputed all-senator audit

Independent actual-served person original 95 report is SHA-pinned to the government 2021–25 directory `bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51`. The read-only new `scripts/overlay-senate-864-95-person-historical-position-matrix.mjs` reconciles previous direct-speaker claim ledger, current authenticated original audit and new source-to-original-government-vote joins without conflation. [Successful workflow #38323588015](https://github.com/killjoy00/votepredict/actions/runs/38323588015), artifact `11779717749`:

| Bounded source-audited matrix metric | Result |
| --- | ---: |
| Actual serving persons | **95** |
| People with ANY separately authenticated historic candidate-owned site snippet | **92** |
| Selected historic candidate-owned site snippets | **1,285** |
| Person/actual-service-year × policy issue cells | **5,085** |
| Cells with ANY independently authentic individually attributed original historic written statement | **18** |
| Cells with ANY direct independently checked original Senate named-person ballot | **9** |
| Cells having only currently retrieved/archival-UNVERIFIED source lead | **7** |
| Cells with unresolved jointly signed 2021 Line 3 source | **2** |

These last four metrics describe **this SELECTED proof corpus**, not all historical statements, hearings, bill decisions, or social-media positions in Minnesota. Multiple votes in the SAME senator/year/issue cell correctly add events, not extra coverage cells. The vast majority of cells were not systematically searched and are NEVER labeled "had no position". Five genuine original **2020** publisher research passages remain earlier-cycle context and are not relabeled 2021 evidence.

## Priorities and failed-source route documentation

1. **Legislative chronology / causal uncertainty**: HF669 March 16 version and May 22 amended version, tax/social-security and nursing-home compromise timeline, original Mark Johnson later May statements, individual source-bound speaker proof for Housley/Weber/Wesenberg; never infer motivations from votes.
2. **Wiger**: 2021 E12 and 2022 exact statement quote boundaries and associated later bill versions, separate from already authenticated original page provenance; no value in repeating guessed 2020 election candidate-domain archives.
3. **Bakk/Tomassoni**: named joint Line3 current first-party + House reprint original historical bytes unavailable (record two failure classes); search alternative original primary Senate hearings or contemporaneous audio, not a fake joint solo quote.
4. **Other serving persons**: targeted senator/year/issue from 95-person matrix emphasizing legislative decisions and ordinary measures; current-only Rasmusson tax response, Weber PRO Act, Dziedzic housing and Pha 2025 HOA remain UNKNOWN raw historic original.
5. **Source-as-of and production**: archived original-by UTC ≠ original first-authored or database ingestion timestamp. No restricted read-only private source-to-evidence export attempted. All source-to-backtest feature eligibility remains UNKNOWN/false in this increment.

No contact, public records request, email, interview, source-original paywall evasion, production data modification, deployment, model training, forecasting, ingestion or scheduler changes. Parent **#864 remains open**.