# Minnesota Senate scorecards, endorsements, and district partisanship — RAW capture

**Scope:** Minnesota **state** Senate, publisher scorecards and endorsements dated 2021–2026, and official presidential / gubernatorial / attorney-general election results for 2020–2024. This is a raw provenance inventory, **not** an endorsement of any group's methods and **not** a forecast input. No feature, forecast, serving, `vote_events`, `member_votes`, or already-collected `mn_senate_election_raw_results` data is changed.

**Primary scorecard discovery guide:** [Minnesota Legislative Reference Library, Legislator Voting Records and Ratings](https://www.lrl.mn.gov/guides/guides?issue=ratings). The Library explicitly lists years, including PDFs from publishers; this collection stores original publisher documents/pages, not scraped library summaries. The source catalog is `data/senate-scorecard-sources.json`, not URL patterns constructed by guessing.

## Publisher inventory and gaps

The column **cataloged** means the first-party URL has been identified for bounded capture; it does **not** mean a production row is present yet. A successful HTTP/PDF acquisition creates a snapshot even if a difficult PDF table does not admit a sufficiently conservative row-level parser. An absent year is a **research/collection gap**, not proof that the publisher never made a statement.

| Publisher or requested group | Cataloged publication years | Not captured / missing coverage |
| --- | --- | --- |
| [Minnesota Chamber of Commerce](https://www.mnchamber.com/2025-2026-legislative-voting-record) | 2021 PDF, 2024 PDF (covers 2023–24), 2025 PDF, 2025–26 landing page in 2026 | Separate 2022/2023 editions not cataloged; interactive scorecard may require additional extraction |
| NFIB Minnesota | None | State-legislative Senate tables 2021–26 not located. [NFIB federal congressional scorecard](https://www.nfib.com/how-congress-voted/) is not Minnesota Senate data |
| [Minnesota AFL-CIO](https://mnaflcio.org/news/2023-legislative-report) | Annual original PDFs 2021, 2022, 2023, 2024, 2025 | 2026 publication not located |
| [Education Minnesota](https://educationminnesota.org/news/press-release/education-minnesota-endorses-99-candidates-for-legislature/) | Two first-party Senate candidate endorsement releases in 2022; four first-party Senate endorsement releases in 2026 (July 16 and 31, August 21, September 21) | No 2021/2023/2025 Senate-specific multi-candidate reports cataloged; 2024 legislative releases chiefly name House candidates; separate 2025 Senate special endorsement not yet extracted |
| Sierra Club North Star | None | First-party archived Minnesota Senate endorsement pages not confidently located; honor publisher robots exclusions |
| [Conservation Minnesota](https://www.conservationminnesota.org/voting-records) | Current public voting-record index (2025 catalog key) | Year-by-year senator entry extraction 2021–26 not yet implemented |
| [MCCL](https://www.mccl.org/legislative-accountability-ratings) | 2023 accountability-rating index | 2021 referenced on publisher's page but direct Senate table/PDF not cataloged; 2022, 2024–26 missing |
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
- The AFL-CIO report's **Senate vote descriptions** explicitly print `Minnesota AFL-CIO Position:` next to identified bills; preserve that literal text, including wording about amendments. The Action 4 Liberty PDF descriptions explicitly print `CORRECT VOTE: YES/NO`. Preserve that phrase as published, not as an independently adjudicated position.
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

The next-only migration is `migrations/0025_senate_scorecards_district_partisanship.sql`. It creates **only** the three publisher tables and the one election table, with idempotent CREATE statements; no DROP, TRUNCATE, or data updates to existing app tables. Publisher captures uniquely key on (original URL, group, year, original SHA-256). Individual entries and bill positions key on snapshot plus source ordinal. District rows key on plan/year/office/district/source URL/SHA; a repeated identical collection cannot duplicate votes.

The PR workflow `.github/workflows/senate-scorecards-partisanship-production.yml` has **no schedule**, and the keyless PR CI uses a disposable Postgres database. It must apply all migrations twice, run the focused fixture tests, `npm test` twice on the same database, and pass `npm run check` (TypeScript, tests, build). Only an explicit **non-forced first** merge push to `main` with `SENATE_SCORECARDS_PARTISANSHIP_PRODUCTION` in the merge message can trigger the independent-main test and then the existing protected `evidence-readonly-sandbox` environment. The protected job verifies the main SHA, Neon primary identity, migration ledger checksum prefix, applies only 0025 in a transaction if missing, checks drift, boundedly fetches with a declared user-agent and robots checks, and performs a read-only summary. Secrets never appear in the receipt.

**Counters and link rates** are intentionally **not fabricated** before production. Once the one-shot job runs, its `SENATE_SCORECARDS_PARTISANSHIP_PRODUCTION` JSON and GitHub Actions step summary give: sources attempted/fetched/unavailable by group and year; snapshots, extracted entries, bill positions; senator `linkedMembers / entries`; bill `linkedBills / billPositions`; district rows; and the per-election statewide comparison. Capture and parsing failures remain explicit even if other sources were saved.

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
SELECT election_year, office, district_plan,
       count(DISTINCT district) AS districts, count(*) AS versioned_rows,
       sum(dem_votes) AS dem, sum(rep_votes) AS rep, sum(other_votes) AS other
FROM mn_senate_district_partisanship_raw GROUP BY 1,2,3 ORDER BY 1,2,3;
```

Do not treat scorecards' publication date or the fetching time as an as-of forecasting feature timestamp. These are research-grade **raw source captures**, and all downstream eligibility decisions remain a separate project.
