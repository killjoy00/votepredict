# Issue #864 — 141 Senate electronically indexed meetings with no linked Minutes: alternate official page audit

The [verified Minnesota LRL 2022–25 electronic committee census](./senate-committee-2021-25-official-meeting-census.md) records **1,592** committee/date meeting entries across **99** official committee pages: **1,451** meetings have linked original electronic Minutes and **141** do not. One meeting has two original links, making 1,452 original PDF URLs. An absent Minutes link is NOT evidence of an absent meeting, lack of a vote, or an official record missing in all possible formats.

The 141 outstanding link gaps cluster strongly:
- **2022** 12 missing, including 6 Environment and Natural Resources Finance
- **2023** 64, including **37 Taxes** and **22 Agriculture, Broadband and Rural Development**
- **2024** 42, including **23 Taxes** and **13 State and Local Government and Veterans**
- **2025** 23, including **17 Energy, Utilities, Environment, and Climate** and **5 Rules and Administration Subcommittee on Committees**

The one-time 2022–25 [alternate-source triage workflow](../../.github/workflows/senate-committee-141-missing-minutes-alternate-pages.yml) uses only the *original* source census run [#38065594898](https://github.com/killjoy00/votepredict/actions/runs/38065594898), artifact ID **11674762938**, decoded JSON SHA-256 `ed5fb31e17df7acc035997fa487e55d3156997ac05603fdd046bffa554395ee0`; exact ordered 141 meeting identity-list SHA `b7702da8e81ae960fc20ae950e957c5172b4d7053a6c1c1424af0e4403cf2558`. Each independent year job checks the *official date-filtered LRL committee page* of each originally missing meeting, with a two-worker limit, no off-domain redirects or unbounded crawling, and a 2 MiB page cap.

Each metadata-only year artifact will contain the meeting/date/committee, official page URL and HTML SHA-256, a reproducible priority queue, categories for **candidate** agendas, media/recordings, and other public document links, and explicit failed-page or possible new-Minutes-link warnings. Categories are **not** automatically attributed specific recorded member votes, are not proof that all alternate sources are exhaustive, and do not make missing minutes magically present. Even an on-page Minutes URL requires independent original PDF retrieval, hash and correct hearing identity before the primary Minutes evidence gap can be closed.

A successful 141-page triage is not a 141-minutes recovery, complete meeting census, or all-vote denominator. The original **2021 print-only Senate minutes**, **2022 print and electronic differences**, and original source semantic accuracy remain unresolved. Minnesota Senate 2019-current media archives, the LRL Legislative Media Archive, and LRL committee-page agendas are *potential* alternate sources; no audio/video should be treated as verified named roll votes without speaker and individual choice reconstruction and source timestamp validation. The project does not contact public offices.

Do not claim success until the actual four-year independent source run and metadata artifacts have been inspected. Keep #864 open. No production evidence database reads/writes, member-choice fabrication, model/serving/training/forecast/scheduler changes, or 2027 work.
