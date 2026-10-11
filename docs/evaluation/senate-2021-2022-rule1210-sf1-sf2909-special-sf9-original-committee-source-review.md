# #864 — three distinct original Journal Rule 12.10 committee rolls (2021–2022)

This note documents the **original official published Senate Journal text** inspected publicly. It is **not yet binary SHA authentication**. The latter must come from actual GitHub Actions original-source jobs, with independent artifact ZIP/JSON SHA verification and a separate source-proof PR. Never count this note or selectively indexed journals as statewide committee coverage or missing database votes.

## 2021 regular session — SF1, Senate Journal February 11, page 297

- [Original official February 11 Journal PDF](https://www.senate.mn/journals/2021-2022/20210211013.pdf); [Minnesota Revisor SF1 Senate history](https://www.revisor.mn.gov/bills/92/2021/0/SF/1/?body=Senate).
- **State Government Finance and Policy and Elections**, committee reporter Senator Kiffmeyer. The motion printed under `REPORT OF VOTE IN COMMITTEE` pursuant to Rule 12.10 is **SF1 as amended recommended to pass**.
- Original passage prints **5 YEA / 3 NAY, motion prevailed**, with five and three individual names respectively, but **no separate printed absent field** (null, not zero).
- **Important genuine different-motions case:** all named yes/no choices coincide with separate verified **SF2** and **SF450** committee motions. These are **three different bills/actions**; matching roster digests are not a vote identity key.
- February 11 is an official Journal **report date**, not independent proof of exact original committee hearing/roll time or earliest publication time.

## 2022 regular session — SF2909, February 24, Journal page 5098

- [Original official February 24 Journal PDF](https://www.senate.mn/journals/2021-2022/20220224070.pdf); [Minnesota Revisor SF2909 Senate history](https://www.revisor.mn.gov/bills/92/2022/0/SF/2909/?body=Senate).
- **Civil Law and Data Practices Policy**, committee reporter Senator Mathews; **SF2909 recommended to pass**, Rule 12.10.
- Original passage prints **5 YEA / 3 NAY, motion prevailed**, individual names printed, no separate absent count (null).
- The 2021-named Miscellaneous Journal Index includes SF2909, but it was reported on **February 24, 2022**, not 2021. Do not label the report or action as a 2021 calendar-year roll.
- February 24 remains a **report** date; original committee roll date and public-by cutoff not independently established.

## 2021 First Special Session — SF9, June 21, Journal pages 156–157

- [Original June 21 First Special Session Journal PDF](https://www.senate.mn/journals/2021-2022/2021062107_ss1.pdf); [Minnesota Revisor first-special-session SF9 history](https://www.revisor.mn.gov/bills/92/2021/1/SF/9/?body=Senate).
- **Finance Committee**, committee reporter Senator Rosen. Under original `REPORT OF VOTE IN COMMITTEE`, the Rule 12.10 recorded vote is on the **second portion of the Marty division of the Pratt amendment** to SF9, not a committee recommendation to pass SF9 as a whole and not passage on the Senate floor.
- Source prints **6 YEA / 4 NAY, amendment adopted**, with six and four explicit individual names. Absent count unprinted = null. The roll crosses the printed page 156–157 boundary, which is a parsing and contextual-integrity regression target.
- This First Special Session report is **outside the ten regular-session miscellaneous-index entries**. The June 21 publication/report date is not independently validated exact motion/meeting time.

## Original-source acquisition and commitments

Each bill has a narrowly scoped one-time original-source Action running from main only after tested merge. Enforce exact official URL, HTTP 200, no redirects, PDF MIME/magic and byte caps, embedded-text extraction, committee/reporter/bill-stage context, one exact Rule 12.10 report, named YEA/NAY partition matching totals, adjacent printed outcome, source-window hashes, original PDF SHA and extracted-text SHA. Individual official voter/side choices appear solely as per-side SHA commitments in repository files; fictional names are used in fixtures.

A passed PR CI does **not** authenticate an original. Each actual on-merge source run needs independently inspected artifact ZIP and decoded JSON. A failed real run remains failed even after a future successful retry.

## Open limitations

1. These three published Journal reports do **not** prove the separately printed LRL 2021 committee-minute collection, or 2022 print/electronic parity.
2. Committee motion day/time, earliest public availability, and any historical forecast cutoff remain unknown.
3. Selective Rule 12.10 Journal reports do not yield an exhaustive 2021–2025 committee roll census.
4. This does not identify privately stored member-vote rows or justify a production vote import.
5. Additional 2021 regular-session source leads **SF1159** and **SF970** still need individual original page-and-identity authentication. They were not fabricated from this note.
6. Committee issue [#864](https://github.com/killjoy00/votepredict/issues/864) must remain OPEN; no other VotePredict modeling/floor/production changes are in scope.
