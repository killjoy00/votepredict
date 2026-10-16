# Minnesota Senate scorecards, endorsements, and district partisanship — RAW capture

**Scope:** Minnesota **state** Senate, publisher scorecards and endorsements dated 2021–2026, and official presidential / gubernatorial / attorney-general election results for 2020–2024. This is a raw provenance inventory, **not** an endorsement of any group's methods and **not** a forecast input. No feature, forecast, serving, `vote_events`, `member_votes`, or already-collected `mn_senate_election_raw_results` data is changed.

**Primary scorecard discovery guide:** [Minnesota Legislative Reference Library, Legislator Voting Records and Ratings](https://www.lrl.mn.gov/guides/guides?issue=ratings). The Library explicitly lists years, including PDFs from publishers; this collection stores original publisher documents/pages, not scraped library summaries. The source catalog is `data/senate-scorecard-sources.json`, not URL patterns constructed by guessing.

## Publisher inventory and gaps

The column **cataloged** means the first-party URL has been identified for bounded capture; it does **not** mean a production row is present yet. A successful HTTP/PDF acquisition creates a snapshot even if a difficult PDF table does not admit a sufficiently conservative row-level parser. An absent year is a **research/collection gap**, not proof that the publisher never made a statement.

| Publisher or requested group | Cataloged publication years | Not captured / missing coverage |
| --- | --- | --- |
| [Minnesota Chamber of Commerce](https://www.mnchamber.com/2025-2026-legislative-voting-record) | 2021 PDF, 2024 PDF (covers 2023–24), 2025 PDF, 2025–26 landing page in 2026 | Separate 2022/2023 editions not cataloged; interactive scorecard may require additional extraction |
| [NFIB Minnesota](https://www.nfib.com/news/news/2022-nfib-mn-pac-endorsements-for-the-minnesota-legislature/) | Original 2022 Minnesota **Senate** candidate endorsement index plus four release waves; original 2024 special-Senate endorsement; 2025 SD6 special endorsement; September 2026 Senate endorsements; 2021–22, 2023–24 and 2025–26 Senate Voting Record PDFs | 2023 non-election edition not located; 2026 earlier endorsement rounds and OCR-safe per-Senator PDF row extraction remain gaps. Do not confuse with federal congressional records |
| [Minnesota AFL-CIO](https://mnaflcio.org/news/2023-legislative-report) | Annual original PDFs 2021, 2022, 2023, 2024, 2025 | 2026 publication not located |
| [Education Minnesota](https://educationminnesota.org/news/press-release/education-minnesota-endorses-99-candidates-for-legislature/) | Two first-party Senate candidate endorsement releases in 2022; four first-party Senate endorsement releases in 2026 (July 16 and 31, August 21, September 21) | No 2021/2023 Senate-specific list found; 2024 SD45 and 2025 SD60 Senate specials now cataloged separately from House-only releases |
| Sierra Club North Star | None | First-party archived Minnesota Senate endorsement pages not confidently located; honor publisher robots exclusions |
| [Conservation Minnesota](https://www.conservationminnesota.org/voting-records) | 2025 public voting-record index; 2026 original legislator directory and 201 original Senate profile/page snapshots covering 67 Senate districts | 763 explicitly printed named senator Yes/No bill votes were captured and mechanically linked; these are individual publisher-reported votes, **not** a publisher score or official roll certification. Publisher score-by-year coverage remains unstructured |
| [MCCL](https://www.mccl.org/legislative-accountability-ratings) | 2023 accountability-rating index and separately cataloged original 2023 joint House/Senate votes-and-issues PDF | The original 2023 PDF failed the first bounded protected retrieval. Do not infer per-senator grades from its potentially ambiguous printed vote lists. 2021 direct Senate table/PDF and 2022, 2024–26 remain collection gaps |
| Pro-Choice Minnesota / Gender Justice / Planned Parenthood MN Action | None | Verified first-party MN **state Senate** scorecards/endorsements by year not cataloged |
| NRA | None | Public Minnesota state-legislative ratings by year not cataloged; US Senate ratings intentionally excluded |
| Protect Minnesota | None | First-party named Senate-endorsed candidate list not cataloged |
| Taxpayers League | None | No qualifying 2021–26 legislative record confirmed; LRL guide chiefly lists 2018 and older |
| [Action 4 Liberty](https://www.action4liberty.com/) | 2021, 2022, 2024, 2025 original scorecard PDFs | 2023, 2026 not cataloged |
| [Minnesota Gun Owners Caucus](https://gunowners.mn/elections/) | 2022 and 2024 state Senate race grade/endorsement tables, 2025 Senate specials, 2026 election index | 2021, 2023 and 2026 Senate-specific table not yet cataloged |
| [CPAC Foundation](https://www.cpac.org/) | 2025 Minnesota scorecard PDF | 2021–24, 2026 not cataloged in this bounded set |
| [Legislative Evaluation Assembly](https://lea-mn.org/lea-annual-reports-on-the-legislature/) | Annual reports index, cataloged under 2025 | Downloading/parsing Senate tables for individual years 2021–24 remains |

The 2026 Chamber record is a **2025–2026 legislative-session** landing page and may contain material from both years; do not infer a 2026 vote occurred just because the page title includes 2026. Scorecard `year` is the catalog's labeled source year. `published_on` stays **NULL** unless an explicit date is printed (no substitution with `fetched_at`).

### Row extraction constraints

- The 2021/2022/2024/2025 **Action 4 Liberty** PDF Senate grids print senator, party, Senate district, year score, and lifetime score. Store **annual** percent verbatim; `value_numeric` is its plainly numeric component. Ignore House-district rows.
- The **Minnesota Gun Owners Caucus** State Senate **HTML tables** publish a named candidate, Senate district, literal grade (`A+`, `A (P)`, `?`), `ENDORSED` where printed, and in some cases a `100%` voting record. Keep all published literal values, including `?`, without inferring missing endorsements or equating candidate ratings with votes. A 2022 candidate printed on new district lines is matched against the 2023–24 Senate membership roster, and challengers remain unresolved.
- **Education Minnesota** publisher release pages explicitly identify endorsed **State Senate** candidates. Preserve the original 2022 two-column paired Candidate/District table and 2026 Senate-only district/name/party lists, excluding House candidates and all U.S. Senate races. New-cycle 2026 challengers need not have an existing membership and are left unresolved rather than fitted to an incumbent.
- **NFIB Minnesota** source documents include 2022 Senate-only endorsement tables and bullet lists, 2024 SD45 and 2025 SD6 special-election endorsements, September 2026 Senate endorsements, and original 2021–22/2023–24/2025–26 Voting Record PDFs. Extract only explicit district/person endorsements. Preserve the PDFs' raw text and original binary SHA even when their multicolumn numeric scores cannot be safely associated with rows. Where the PDF explicitly prints a numbered Senate/both-chambers issue, bill ID, and 'A YES/NO vote supports the NFIB position', capture that literal phrase as a separate bill-position row; stop at any House-only issue section, and preserve distinct proposed votes on the same bill. The 2022 endorsees who are not winners may remain unresolved against 2023–24 Senate memberships; do not invent IDs.
- The AFL-CIO report's **Senate vote descriptions** explicitly print `Minnesota AFL-CIO Position:` next to identified bills; preserve that literal text, including wording about amendments. The Action 4 Liberty PDF descriptions explicitly print `CORRECT VOTE: YES/NO`. Preserve that phrase as published, not as an independently adjudicated position.
- **Conservation Minnesota** publishes individual senator profile pages with literal named `Senator [name] voted Yes/No`, bill identifier, date, district and party. Store these only in `senate_scorecard_member_votes_raw`, with original page URL/SHA, distinct from publisher grade/score/endorsement entries, organizational bill positions, and independently certified official roll calls. Follow the 67 original numeric Senate-district links from the publisher's own directory and literal same-profile pagination anchors; exclude House A/B district links. Do not construct guessed profile URLs or impute score values.
- PDFs that do not yield unambiguous individual Senator rows (e.g. embedded tables as images or misleading text ordering) are still preserved in `senate_scorecard_snapshots.raw_text`; do **not** extrapolate senator scores from narrative passages. `match_method='unresolved'` and nullable `membership_id`/`bill_id` are expected. Parser coverage is distinct from source capture coverage.
- The original content's SHA-256 is computed on downloaded **bytes** before PDF text extraction, and stored beside human-readable extracted `raw_text`. The original PDF binary is not a column in this specific schema, so an exact PDF reconstruction from `raw_text` alone is not possible; `url` plus `sha256` retain original-source provenance.

## District partisanship sources, district lines, and verification

The preferred **Legislative Coordinating Commission GIS office** [2022 district download site](https://gis.lcc.mn.gov/html/download.html) was inspected; this bounded collector uses the SOS's directly published office totals rather than a GIS-generated 2020 reallocation.

| Election | Office | Plan | Direct official published results | Statewide check |
| --- | --- | --- | --- | --- |
| 2022 | Governor and Lieutenant Governor | **2022** | [SOS all state/federal/county races by precinct](https://electionresultsfiles.sos.mn.gov/20221108/allracesbyprecinct.txt), joined using [SOS `PrctTbl.txt` 2022 House-district codes](https://electionresultsfiles.sos.mn.gov/20221108/PrctTbl.txt) by (county, precinct) | [SOS statewide Governor text](https://electionresultsfiles.sos.mn.gov/20221108/Governor.txt) |
| 2022 | Attorney General | **2022** | Same official all-races precinct file and district lookup | [SOS statewide Attorney General text](https://electionresultsfiles.sos.mn.gov/20221108/attorneygen.txt) |
| 2024 | U.S. President | **2022** | [SOS President by legislative House district, A/B](https://electionresultsfiles.sos.mn.gov/20241105/USPresLG.txt), summed by common Senate district number | [SOS President statewide](https://electionresultsfiles.sos.mn.gov/20241105/USPres.txt) |
| 2020 | U.S. President | **2012** | [SOS President by legislative House district, A/B](https://electionresultsfiles.sos.mn.gov/20201103/USPresLG.txt), summed on the original 2012 lines | [SOS President statewide](https://electionresultsfiles.sos.mn.gov/20201103/USPres.txt) |

The SOS bulk text publication labels itself as **election-night unofficial results**. Do not imply these rows are a post-canvass certified precinct extract. The 2022 Secretary of State [certified 2022 General Election Results](https://www.sos.mn.gov/elections-voting/election-results/2022/2022-general-election-results/) is a separate context source; the enforced check uses statewide and precinct files from the **same SOS bulk release**, so mismatched publication revisions cannot silently be stored.

For 2022, the published `PrctTbl.txt` field five contains the post-2022 **House district** (e.g. `10A`); its numeric prefix is the Senate district. `county_code|precinct_code` must map uniquely, with zero missing precinct mappings. For 2020 and 2024, the published presidential legislative-district file has 134 House A/B districts; sum the two halves belonging to each Senate district. This is simple arithmetic across two officially published House halves, **not an unofficial 2020-to-2022 crosswalk**. The 2020 rows carry **`district_plan='2012'`** exclusively. No 2020 presidential votes are assigned to 2022 Senate lines without an official reaggregation.

**Strict check before write:** exactly 67 Senate districts, all fields nonnegative integers, each district's `total_votes = dem_votes + rep_votes + other_votes`, and all four statewide sums (DFL, Republican, all others, and total) **exactly equal** the official standalone statewide file. On any mismatch, write **zero** rows for that office/year and log it as an unavailable source. A successful office-year writes 67 rows in one database transaction. Election table expected maximum for one source version: **4 × 67 = 268 district rows**.

## Migration, repeatability, and production receipt

The original additive `migrations/0026_senate_scorecards_district_partisanship.sql` creates the three publisher tables and one election table. The separately reviewed additive `migrations/0029_senate_scorecard_member_votes_raw.sql` adds **only** a first-party publisher-labeled senator-vote table, with idempotent CREATE statements; no DROP, TRUNCATE, or data updates to existing app tables. Publisher captures uniquely key on (original URL, group, year, original SHA-256). Individual entries and bill positions key on snapshot plus source ordinal. District rows key on plan/year/office/district/source URL/SHA; a repeated identical collection cannot duplicate votes.

The PR workflow `.github/workflows/senate-scorecards-partisanship-production.yml` has **no schedule**, and the keyless PR CI uses a disposable Postgres database. It must apply all migrations twice, run the focused fixture tests, `npm test` twice on the same database, and pass `npm run check` (TypeScript, tests, build). Only an explicit **non-forced first** merge push to `main` with `SENATE_SCORECARDS_PARTISANSHIP_PRODUCTION` in the merge message can trigger the independent-main test and then the existing protected `evidence-readonly-sandbox` environment. The protected job verifies the main SHA, Neon primary identity, migration ledger checksum prefix, applies the reviewed 0026/0029 additive migrations transactionally if missing (and validates exact migration order), checks drift, boundedly fetches with a declared user-agent and robots checks, and performs a read-only summary. Secrets never appear in the receipt.

**Production receipt, 2026-10-16:** [marker-bearing successful run #38954540813](https://github.com/killjoy00/votepredict/actions/runs/38954540813) executed independent-main, protected Neon, migration `0026`, drift gate and read-only match-rate verification. The workflow result was successful but the collector reported **`bounded_partial`** because not every scorecard source could be fetched or parsed. First production readback: **27 URLs attempted; 19 publisher snapshots; 313 entries; 158 senator links (50.48%); 38 bill positions; 38 bill IDs (100%); 268 district rows**. All four 67-district datasets matched all four corresponding statewide party and total vote sums **exactly**. The 2020 presidential result was stored only on the 2012 plan.

**Missing on this run:** four Action 4 Liberty originals (2021, 2022, 2024, 2025), CPAC 2025 original, and Minnesota AFL-CIO 2021–22 originals were prohibited by publisher robots rules; Legislative Evaluation Assembly's index returned a publisher HTTP error. **No workaround/bypass was attempted.** The other 19 snapshots were saved, though Chamber, MCCL, Conservation Minnesota and the 2026 Gun Owners index yielded no structured senator entries. The 2023–25 AFL-CIO reports supplied 38 explicit printed bill positions; the 2022/2024/2025 Gun Owners pages and 2022/2026 Education Minnesota releases supplied 313 entries in total. These are literal candidate-level raw values, not methodology assessments.

**Second production receipt, 2026-10-16:** [PR #1380](https://github.com/killjoy00/votepredict/pull/1380) merged with the reviewed one-shot marker; [protected run #38964243367](https://github.com/killjoy00/votepredict/actions/runs/38964243367) passed independent-main and protected Neon readback. Its evidence status remains **`bounded_partial`**, not complete scorecard coverage. The catalog contains **40 public source URLs** (13 newly cataloged), and the follow-up attempted all 40. It fetched 21, saved **11 new snapshot versions**, and added **108 entry rows**. Before → after: **19 → 30 snapshots; 313 → 421 entries; 158 → 205 senator links**. The present senator link rate is **205/421 = 48.69%**. Bill positions and links stayed **38/38 (100%)**.

**Do not mistake versioned rows for distinct endorsements.** Changed/re-fetched Education Minnesota pages account for most of the 108 extra rows. The new first-party 2024 **Senate District 45** special-election source produced one parsed endorsement. The 2025 Senate District 60 special release was captured with **zero** structured senator entries. Original source text and SHA-256 remain preserved.

**NFIB follow-up outcome:** all three biennial voting-record PDFs (2021–22, 2023–24, 2025–26) and multiple original endorsement pages were cataloged, but **zero NFIB snapshot or senator/bill entries were inserted**. Nine NFIB pages/PDF links were prohibited by publisher robots policies; two historical NFIB PDF URLs failed retrieval or parsing. These failures were recorded without bypassing access restrictions. Other unavailable sources remain four Action 4 Liberty originals, CPAC 2025 and AFL-CIO 2021–22 (robots), and Legislative Evaluation Assembly's index (publisher HTTP error). **19 of 40** attempted URLs were unavailable during the follow-up.

**Unstructured but saved:** Minnesota Chamber of Commerce's four historical source versions, MCCL 2023, Conservation Minnesota 2025 and the 2026 Minnesota Gun Owners index still lack conservatively extracted structured scores. These are publisher-body snapshots, not proof that a score exists for every senator.

**Part B remains verified without repeat fetching:** the follow-up reported `districtDataReused=true`, **0 new district rows**, and exactly the original **268 district results** (67 for each of 2020 president on 2012 lines, 2022 governor and attorney general on 2022 lines, and 2024 president on 2022 lines). Original same-release statewide total checks all passed. The follow-up did not reapply migration 0026 or modify forecasting/serving.

**Third production receipt, 2026-10-16 (saved-source replay):** [PR #1383](https://github.com/killjoy00/votepredict/pull/1383) passed both CI workflows and merged to main. The reviewed one-shot [protected run #38971092839](https://github.com/killjoy00/votepredict/actions/runs/38971092839) completed with `status=committed_readback_verified`, `storedOnly=true`, `reparsed=9`, `attempted=0`, `fetched=0`, `newSnapshots=0`, `electionRowsNew=0`, and `districtDataReused=true`. It replayed the existing saved publisher plaintext for Chamber, MCCL, Conservation Minnesota, and Education Minnesota's 2025 special, using the exact preexisting URL/group/year/SHA; it did **not** request another public source, create a new publisher version, alter source hashes, or touch forecast/model/serving code.

The saved Minnesota Chamber PDF text yielded **58 new literal publisher bill-position records**, mechanically resolving **all 58 bill IDs**: **11** from the **2021** voting record, **43** from the **2024** record, and **4** from the **2025** record. These retain the explicitly printed Chamber support/opposition wording and amendment identifiers where available. They are **not** reconstructed individual senator scores or proof a vote took place. Existing AFL-CIO's 38 positions remain intact: total **38 → 96 bill positions; all 96 linked**. The newly printed records are evidence of the publisher's position and are not forecast features.

There were **zero** additional per-senator score, grade or endorsement entries from the nine replayed snapshots. Both Conservation Minnesota saved versions, both MCCL saved versions, the 2026 Chamber landing page and the 2025 Education Minnesota District 60 special page yielded no safely structured record from already stored text. The Education Minnesota 2025 item remains a **raw captured publisher page**, not a structured endorsement. No inferred member ratings were synthesized from the Chamber individual Yes/No voting grid or linked MCCL original legislative vote lists.

Exact before → after readback: **30 → 30 publisher snapshot versions, 421 → 421 entry rows, 205 → 205 member links, 38 → 96 positions, 38 → 96 bill links, 268 → 268 official district-election rows**. Publisher line counts, year labels and partial-coverage caveats above remain applicable; **0 new senator scores** does not mean MCCL or Conservation Minnesota lack first-party published voting records.

**Fourth production receipt, 2026-10-16 (original senator profiles + Education special):** [PR #1390](https://github.com/killjoy00/votepredict/pull/1390) passed both CI lanes, merged with its scoped one-shot marker, and [protected run #38981056236](https://github.com/killjoy00/votepredict/actions/runs/38981056236) completed independently verified production readback. Migration `0029` was applied exactly once; mode `expand` used polite public publisher requests and left forecasting and serving inputs untouched. Conservation Minnesota's original directory yielded **67** State Senate profile links. **201** original profile/pagination pages were successfully fetched and saved with source URL, byte SHA, and raw text. These yielded **763** named personal Yes/No vote descriptions on printed bills and dates, mechanically linked **763/763** to existing Senate memberships and **763/763** to the preexisting bill catalog. These are literal publisher-reported senator votes, **not** numeric scorecard entries, organizational group positions, or certified legislative vote records. The 763 are versioned raw vote descriptions; do not assume distinct vote-event count without deduplication.

In the same protected run, the existing original January 27, 2025 Education Minnesota page was replayed using its original URL/group/year/SHA. Its text explicitly named **Doron Clark** as endorsed for the special election in **Senate District 60**. The conservative parser produced **one** structured `endorsement` entry, which linked to the existing Senate membership. No new Education source version was fetched. Exact before → after production readback: **30 → 231 snapshot versions; 421 → 422 scorecard/endorsement rows; 205 → 206 senator-linked scorecard entries; 0 → 763 publisher-reported named senator vote rows (763 member links, 763 bill links); 96 → 96 organizational bill positions (all linked); 268 → 268 district election rows**. The raw election body was not re-requested or rewritten.

The **MCCL 2023** original PDF was attempted once during that run, but failed publisher retrieval/parsing, so **zero new MCCL PDF snapshots or structured score rows** came from that attempt. The workflow reported `status=bounded_partial` for this single publisher gap; the fully verified Conservation and Education writes were committed. The original MCCL index and its earlier saved versions remain available as unstructured publisher evidence. No robots restriction was bypassed.

### Current versioned publisher readback

| Group / publication years | Snapshot versions | Scorecard entry rows |
| --- | ---: | ---: |
| Education Minnesota 2022, 2024, 2025, 2026 | 4, 1, 1, 8 | 92, 1, **1**, 122 |
| Minnesota Gun Owners Caucus 2022, 2024, 2025, 2026 | 1, 1, 1, 2 | 190, 2, 14, 0 |
| Minnesota Chamber of Commerce 2021, 2024, 2025, 2026 | 1 each | 0 entries; 11, 43, 4, 0 explicit publisher bill positions respectively |
| Minnesota AFL-CIO 2023, 2024, 2025 | 1 each | 0 entries; 38 literal bill positions across 3 snapshots |
| Conservation Minnesota 2025 and 2026 | 2, 201 | 0 scorecard entries; **763 separate publisher-reported named senator votes** from the 2026 profile/page captures |
| MCCL 2023 | 2 | 0 |
| NFIB and all unavailable groups | 0 | 0 |

Totals following original-profile expansion: **231 snapshot versions, 422 scorecard/endorsement entry rows (206 linked to senators), 96 linked organizational bill positions** (38 original AFL-CIO + 58 Chamber), plus **763** separate published personal-vote descriptions (all linked to senator and bill). The publisher snapshots can repeat the same name/value across refreshed versions; these versioned rows are not a unique candidate-endorsement count. Further NFIB capture requires a publisher-permitted, technically reliable original source path; do not evade robots rules.

Read-only production SQL after deployment:

```sql
SELECT group_name, year, count(*) AS captured_versions
FROM senate_scorecard_snapshots GROUP BY 1,2 ORDER BY 1,2;

SELECT count(*) AS entries,
       count(membership_id) AS senator_links,
       round(100.0*count(membership_id)/nullif(count(*),0),2) AS senator_link_pct
FROM senate_scorecard_entries;
SELECT count(*) AS positions,
       count(bill_id) AS bill_links,
       round(100.0*count(bill_id)/nullif(count(*),0),2) AS bill_link_pct
FROM senate_scorecard_vote_positions;
SELECT count(*) AS publisher_reported_personal_votes,
       count(membership_id) AS member_links, count(bill_id) AS bill_links
FROM senate_scorecard_member_votes_raw;
SELECT election_year, office, district_plan,
       count(DISTINCT district) AS districts, count(*) AS versioned_rows,
       sum(dem_votes) AS dem, sum(rep_votes) AS rep, sum(other_votes) AS other
FROM mn_senate_district_partisanship_raw GROUP BY 1,2,3 ORDER BY 1,2,3;
```

Do not treat scorecards' publication date or the fetching time as an as-of forecasting feature timestamp. These are research-grade **raw source captures**, and all downstream eligibility decisions remain a separate project.
