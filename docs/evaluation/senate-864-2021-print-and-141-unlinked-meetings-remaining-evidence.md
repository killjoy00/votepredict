# #864 — remaining Minnesota Senate 2021–25 official committee record coverage

**Research scope:** only 2021–2025 Senate historical COMMITTEE records. This does not modify the Senate floor model, production records, historical as-of policy, or database.

## Independently inventoried electronic meeting/Minutes gap

The already independently SHA-verified LRL 2022–2025 electronic index [source ledger](source-proof/senate-2022-25-committee-original-minutes-source-ledger.json) and [complete 141-entry meeting-date roster](source-proof/senate-committee-141-unlinked-original-meeting-roster.json) retain **1,592** committee/date index entries: 1,451 with linked official Minutes, 141 without, and 1,452 linked original PDFs (one 2023 meeting has two PDFs). All 207 initially low-text original linked PDFs have separately been OCR-recovered. **Missing electronic links do not prove meetings, votes or members were absent.**

| Year | Indexed without a linked Minutes PDF | Exact dated LRL media-record leads | No dated LRL media-record leads |
| --- | ---: | ---: | ---: |
| 2022 | 12 | 11 | 1 |
| 2023 | 64 | 64 | 0 |
| 2024 | 42 | 41 | 1 |
| 2025 | 23 | 22 | 1 |
| **Total** | **141** | **138** | **3** |

The three exact metadata exceptions (still **UNKNOWN**, not zero actions):

- 2022-04-21 — **Energy and Utilities Finance and Policy**. A publicly indexed Senate Granicus audio archive contains *other* April 21, 2022 committee/floor entries; the absence of an exact Energy listing in that viewed archive is not proof the committee did not meet or vote.
- 2024-05-16 — **Environment, Climate, and Legacy**. A Senate Granicus archive contains a *different* May 16, 2024 **Rules and Administration – Subcommittee on Committees** clip, not an authenticated Environment/Climate/Legacy source for this date. A same-day, differently named committee clip must not be substituted.
- 2025-05-12 — **Rules and Administration – Subcommittee on Committees**. Senate Media Services posted a contemporaneous **general Rules and Administration** meeting video, but that does not establish the specifically indexed **Subcommittee on Committees** session, its action, or its vote membership. Separate session attribution is required.

Original source pointers: [LRL Senate minutes](https://www.lrl.mn.gov/minutes/Default), [Senate Granicus video archive](https://mnsenate.granicus.com/ViewPublisher.php?view_id=1), [Senate Granicus audio archive](https://mnsenate.granicus.com/ViewPublisher.php?view_id=2), [Senate Media Services May 12, 2025 Rules session](https://www.youtube.com/watch?v=BkoyNKNmYZk). Archive entries are **research leads**, not newly reverified original meeting/vote evidence; their original bytes, exact hearing attribution, and any audiovisual vote segment remain unverified.

## 2021 original print and 2022 print/electronic boundary

The [Minnesota Legislative Reference Library's official Minutes collection statement](https://www.lrl.mn.gov/minutes/Default) explicitly places **1999–2022 Senate official print Minutes at LRL**; Minnesota Senate electronic collection began **2022** and **the 2022 electronic/print sets may differ**. The state's [Legislative History Resources](https://www.lrl.mn.gov/history/hist_resource) additionally cautions *not all committees produce minutes*. This makes the 2021 whole meeting/recorded-vote/print denominator **unknown** and the 2022 print-versus-electronic equivalence **not yet verified**. The electronic 2022–25 index is not an official 2021–25 all-meetings/all-motions denominator.

Previously authenticated 2021 **Senate Journal** Rule 12.10 committee-report roll calls and dated Senate hearing/agenda evidence remain separate **non-print-Minutes** evidence types. They must never be recast as independently checked 2021 official printed Minutes or used to infer same-day prediction eligibility.

## Required source work still open (no outreach)

1. For **138** dated official LRL media leads, independently verify exact committee **and meeting date**, actual playable audiovisual/caption source, and the precise motion/speaker/timestamp when available. An HTTP-200 player page is NOT a recording; captions alone do not authenticate individual YEA/NAY.
2. For **three** no-media-lead meeting dates, search only existing independently attributable public governmental records/archived video/committee journals or other non-contact primary sources. Maintain no-source-lead vs unavailable-source distinction, and never import another committee's same-day clip.
3. Acquire independently verifiable **2021 official printed Minutes** and a genuine **2022 printed-versus-electronic source-diff** where publicly accessible. No contact with Minnesota LRL/legislative offices under owner direction. Until the print originals can be acquired without outreach, preserve a clear HOLD.
4. Once official motion-level source discovery and parser/dedup review are complete, seek a **separately reviewed** bounded read-only source-to-stored export. The 141 no-PDF entries cannot be treated as motion zeroes. Production source/member_vote repair requires separate owner authorization.

The pure [fail-closed checker](../src/evidence/senate-864-committee-coverage-gap-gates.ts) and [synthetic fixtures/tests](../tests/senate-864-committee-coverage-gap-gates.test.ts) pin the original 141 four-year census and prevent accidental promotion of a 2021 print denominator or 2022 print parity.

**Not yet certified:** full statewide committee vote coverage, official print meeting denominator, real media playback/motion attribution, 2024 single-YEA persisted row repair, deployed production data binding. No database contact/write, forecasts/serving, 2027 change, or legislative-office contact. Keep [#864](https://github.com/killjoy00/votepredict/issues/864) OPEN.
