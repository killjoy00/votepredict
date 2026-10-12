# Issue #864: independently reconciled Minnesota Senate committee-year evidence

**Scope:** historical Minnesota Senate committee/subcommittee meetings in 2021-2025, not Senate floor votes, forecasts, serving changes or model training. This is an offline source-only audit; no private database queries or writes, no external government contact, no deployment or scheduler.

## Verified inherited source baseline

The [original LRL index census](https://github.com/killjoy00/votepredict/actions/runs/38065594898) authenticated 99 committee/year pages, 1,592 indexed committee/date meetings for 2022-2025, 1,451 meetings with Minutes, 141 without linked Minutes and 1,452 original PDF links (one meeting has two PDFs).

| Year | Indexed meetings | Linked-Minutes meetings | No-linked-Minutes meetings | Original PDF SHA proved |
|---|---:|---:|---:|---:|
| 2021 | **Unknown — official print archive** | unknown | unknown | unknown |
| 2022 | 337 | 325 | 12 | 325 |
| 2023 | 517 | 453 | 64 | 454 |
| 2024 | 300 | 258 | 42 | 258 |
| 2025 | 438 | 415 | 23 | 415 |
| **2022–25** | **1,592** | **1,451** | **141** | **1,452** |

**Independent 2021 alternate-source evidence is not zero.** Separately SHA-verified official *Senate Journal Rule 12.10 committee-vote reports* establish distinct candidate committee decisions for SF1, SF2, SF173, SF566, SF910, SF970, SF1159 (two separate failed amendments), SF1457 and SF1470; a separately authenticated 2021 SF450 committee source also exists. See the [original 2021 Journal index and report leads](./senate-2021-official-journal-misc-rule1210-index-original-discovery.md) and the [three original April 12 motion/side proofs](./source-proof/senate-2021-apr12-three-strict-rule1210-original-committee-success.json). These are **selectively published journal report actions**, not a 2021 official printed-Minutes meeting universe: report date is NOT an independently proved committee hearing/vote date, and identical YEA/NAY sides on separate amendments do NOT identify the same motion. A 2022 SF2909 report appears in the 2021-labeled Journal index; it belongs to 2022, not 2021. For the first-special-session SF9 amendment, the **initial** strict original parser run failed; a **later independent second strict original-source run succeeded**, proving one distinct Finance committee amendment roll (6 YEA / 4 NAY) in the [authenticated second-run source proof](./source-proof/senate-2021-special1-sf9-original-rule1210-second-run-success.json). Preserve both run statuses. The Senate Journal **report date** remains unverified as the underlying actual committee hearing date.

The official [LRL minutes catalog](https://www.lrl.mn.gov/minutes/) warns the **2022 print and electronic Minutes may differ** and that 2021 official minutes exist in **print only**. These electronic figures are not the official five-year actual meeting or recorded-motion denominator.

The [full original source verification](https://github.com/killjoy00/votepredict/actions/runs/38297462724) SHA-revalidated **all 1,452 linked originals**, including the **207** initially low-embedded-text PDF originals recovered by OCR. The frozen parser-v2 original-source proof recognizes **104 named-roll and 49 count-only roll candidates**, with **989 named YEA/NAY choice occurrences**; a later verified parser-v3 source-only recheck recognizes **112 named candidates** (28 / 22 / 30 / 32 by year). These candidates are NOT a certified all-motion denominator or eight new persisted events.

The earlier embedded-text source audit recognized 1,519 voice-vote, 6 unanimous and 3,000 other result-only candidate actions; these parser results are not exhaustive across the 207 recovered OCR documents, nor a fully deduplicated official-action count.

In [the earlier protected source-to-Neon comparison](https://github.com/killjoy00/votepredict/actions/runs/38270466090), 1,452 original document SHA/URL identities were matched and 152/153 source candidate detailed rolls matched stored event/member choices, with 979/989 source named-choice tokens on fully matched rolls. One 2024 roll had **10 original choices and nine stored choices**, specifically one absent **YEA**. The default Neon branch was not independently certified as the deployed production database, and this change does not re-access it.

**Verified February 14, 2024 Education Policy extraction correction:** the [official original PDF](https://www.lrl.mn.gov/archive/minutes/senate/2024/educ/20240214/educ_20240214_Minutes.pdf), raw SHA 6d00d812236d4585ea315da9fdf2da8325fcad512e4089e1422fa4a96e2a7f52, contains **six distinct numbered amendment motions** with 4 YEA / 6 NAY each, against **two frozen v2 parser observations**. Record separately proven **four additional distinct original actions** for this committee, not inferred new database member rows. The other **one 2024 and three 2025** additional parser-v3 candidate motions remain unlocalized in the original per-document v2 manifests until exact action anchors can be certified.

**2024 YEA HOLD:** [V10](https://github.com/killjoy00/votepredict/actions/runs/38306239282) recovered a person name only inside protected read-only memory but found no conservatively matched active-day roster identity. The latest [V13 original-source run](https://github.com/killjoy00/votepredict/actions/runs/38311756018) was a source-SHA stage **HOLD**, with no new independently proved root cause. Do not assign a name, infer a membership or write an amendment.

**Old historical backfill is not replay safe:** [PR #1260](https://github.com/killjoy00/votepredict/pull/1260) demonstrates event IDs constructed from PDF URL hash and parser position; v3 motion insertions can map old indices to different motions under ON CONFLICT UPDATE. No existing-record reingestion until protected, authorized motion-anchor comparison.

## Authenticated 2021 alternate-source committee rolls, NOT the printed-Minutes universe

The separately verified [2021 partial machine-readable original-source ledger](./source-proof/senate-864-2021-committee-partial-official-original-source-roll-catalogue.json) reconstructs **12 distinct officially printed Senate Journal Rule 12.10 or public Senate archived-online named committee motions** with **103 explicitly named YEA/NAY positions**. This includes **one independently authenticated first-special-session SF9 amendment**, not just the ten indexed regular-session bill report references. This is **source evidence, not 12 new stored vote rows or 12 independently dated committee meetings**.

| 2021 historical committee | Authenticated distinct named motions (partial) | Named YEA/NAY occurrences |
|---|---:|---:|
| Agriculture and Rural Development Finance and Policy | 1 | 8 |
| Finance (first special session SF9) | 1 | 10 |
| Housing Finance and Policy | 2 | 14 |
| Judiciary and Public Safety Finance and Policy | 2 | 18 |
| State Government Finance and Policy and Elections | 3 | 24 |
| Transportation Finance and Policy | 3 | 29 |
| **Verified selective alternate-source evidence only** | **12** | **103** |

Eleven motions are authenticated in official Senate Journal committee reports, where the journal **report date is NOT an independently proved underlying hearing/vote date**. The twelfth (SF450, March 10, 2021) has an independently dated official Senate **online hearing-minutes page**, *not* the 2021 LRL printed volume. Its historical first-public availability remains unknown. The separate original **2021 printed committee-minute meeting denominator, all motions, all subcommittees and print reconciliation remain unknown**. Exact source report/PDF SHA, printed page, unique bill/amendment identity, and separate first-failure/later-success history for special-session SF9 are documented in the catalogue; no private membership ID/name sides are exposed.

## New offline ledger implementation

[Independent ledger builder](../../src/evidence/senate-864-independent-committee-meeting-ledger.ts), [exact-source CLI](../../scripts/build-senate-864-independent-committee-ledger.ts), [fail-closed tests](../../tests/senate-864-independent-committee-meeting-ledger.test.ts), and [PR source-only workflow](../../.github/workflows/senate-864-independent-committee-year-ledger.yml) join the **whole original SHA-verified meeting index** against the separately original-hashed **1,452** PDF proof records, all **207** OCR recoveries, the independent Judiciary 8-choice proof, and the previously verified **141** no-Minutes indexed meeting roster.

The source-only workflow reuses the existing historical research GitHub Actions artifacts by exact IDs and verifies whole JSON SHA-256 before producing any public output. **No PDF re-download, data connection, secret read or automatic old-event replay.** It publishes three metadata-only files in its CI artifact:

- 1592-official-meetings-to-source-action-candidates.json — meeting-level minute status, official original PDF link, raw-byte SHA, hearing day and parser-recognized action candidates and tallies, with motion text/page and stored identities explicitly unknown when not preserved.
- committee-year-completeness.json — per indexed committee and year, original index counts, linked and unavailable digital Minutes, SHA-authenticated/initially OCR originals, source action candidate types, missing context proof, and null stored-row/motion denominators.
- committee-year-completeness.md — per committee-year audit table for review.

A source-page-specific supplement now captures **all six amendment roll-call motions and the subsequent recommendation motion** from the independently SHA-verified [February 14, 2024 Education Policy original two-page PDF](https://www.lrl.mn.gov/archive/minutes/senate/2024/educ/20240214/educ_20240214_Minutes.pdf). Amendment 10 occurs on printed PDF page 1; amendments 2, 3, 5, 6 and 9, and the final recommendation, are on page 2. The six amendment votes are each 4–6 and failed; the final SF3534 recommendation was adopted **without a recorded individual roll call or aggregate tally**. The seven separately verified motion descriptions and pages form a source-grounded catalogue, not additive legacy database events, and the original member-side names and source choice digests are not exported. A regression test verifies the exact page/motion sequence and guards the original PDF SHA.

The generated report distinguishes **a listed meeting with no Minutes link** from a fully source-processed Minutes document, and distinguishes **an original OCR document with incomplete context-action proof** from a genuine recorded no-action finding. It makes no zero-vote inference. An action preserves its PDF SHA, committee, hearing day, amendment/bill where metadata permits and the explicit tally/member-choice occurrence count where named choices were originally printed. Literal source motion text and PDF page were not preserved in the frozen manifests and stay unknown, not fabricated; re-verifying exact original pages would be further separately scoped source work.

The owner-approved historical eligibility convention uses the **hearing day** and excludes same-day cutoffs. **Independently proven actual PDF-publication dates remain unknown** for these records; original source retrieval timestamps are not historical publication dates. Legacy parser observation indices are marked unstable, and no person/choice hashes or private persisted row IDs appear in public output.

## Remaining work and explicit stop criteria

1. **Accept the source ledger only if** source SHA guards and synthetic regressions pass, exactly 1,592 meetings / 1,452 PDFs / 207 OCR recoveries / 141 no-linked-Minutes match and every original document links to its original hearing committee/date. Any source drift **HOLD**, not a fabricated completeness certificate.
2. **Recover no-Minutes actions:** focus **2023 Taxes (37), 2023 Agriculture/Broadband/Rural Development (22), 2024 Taxes (23), 2024 State/Local Government/Veterans (13), 2025 Energy/Utilities/Environment/Climate (17)**, plus the three separately unverified exact meeting IDs 2022-04-21 Energy, 2024-05-16 Environment, 2025-05-12 Rules Subcommittee on Committees. Authenticate actual playable original motion and exact committee/date before admission; stop if self-service original media lacks such proof. No same-day other-committee audio substitution.
3. **Exact parser-v3 motion identities:** locate remaining +1 2024 / +3 2025 original candidate gains, authenticate original distinct motion/page and non-collision. Stop if stable original anchor cannot be independently proven. Never bulk rerun positional event keys.
4. **One missing 2024 YEA:** require original committee roll person/date proof and historically independently verified membership/alias then a separately approved read-only row/root-cause comparator. Stop if historical identity cannot be established without guesswork.
5. **Printed 2021 and 2022 record gaps:** search only publicly retrievable authoritative original printed material; if none is self-service accessible, retain unknown/hold. No external outreach, emails, calls or record requests.
6. **Source-to-current stored member-level reconciliation:** needs separately authorized bounded private SELECT-only source/event/member export and protected motion-anchor comparison. This work has not executed it. No database repair unless separately approved.

Issue [#864](https://github.com/killjoy00/votepredict/issues/864) **remains open**; completeness means independently verified actual government records, not merely more rows.
