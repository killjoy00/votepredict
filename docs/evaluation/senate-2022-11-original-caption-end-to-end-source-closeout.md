# #864 — 2022 Senate official missing-Minutes caption-procedure source: full original 11/11 after bounded retry

**Source-only provenance checkpoint; no individual recorded votes, direct speech attributions, original AV playback, or historically forecast-eligible policies.** The original Minnesota Legislative Reference Library 2022 electronic committee index has **12 dated Senate committee meetings without linked Minutes**. Of those, **11** have exact independent official media identifiers; the twelfth **2022-04-21 Energy and Utilities Finance and Policy** has no dated media lead. This review is not the 2022 print committee-record universe, which remains unreconciled with the electronic index.

## Two actual original source runs — different outcomes

The source implementation [PR #1034](https://github.com/killjoy00/votepredict/pull/1034) merged with exact-head full [CI #38110155589](https://github.com/killjoy00/votepredict/actions/runs/38110155589) green. The actual first [source run #38110343054](https://github.com/killjoy00/votepredict/actions/runs/38110343054) correctly **FAILED** when the **2022-02-08 Environment and Natural Resources Finance** original LRL media `mtgid=1045607` returned a temporary `fetch failed`. It nevertheless independently revalidated **10 of 11** original HTML page SHAs, **9** timestamp-bearing hearing pages, **10** source caption streams, **21,532** `data-time` markers and **43** strict procedural category × 30-second provisional research windows across three hearings. Original failed run artifact **11691578389** was independently downloaded: ZIP SHA256 **a9decadea79c69858f41a85f03aaac410e2aebaab7d791d34c4872704ede98f7**, decoded **39,773-byte JSON** SHA256 **b223b015014ec3444ffe7dae4bd2b85515e9602b9111f2ce9dbf00917a347c29**. Do **not** retrospectively claim original 11/11 first-run success.

The exact one-hearing retry [PR #1040](https://github.com/killjoy00/votepredict/pull/1040) merged with full [CI #38110592545](https://github.com/killjoy00/votepredict/actions/runs/38110592545). Its real [source run #38110799424](https://github.com/killjoy00/votepredict/actions/runs/38110799424) **SUCCEEDED**, revalidating original **February 8** media HTML SHA **342a43b65a652fabcaa69c10c61fea25728b3f302e2559fa64c40dc6be42adb1** and the previously individually pinned **440,730-byte** original caption HTML SHA **7f11f63f10ea03d899c0555c76e6c8e99aec8b34c50f9900bc50e9067c36b66e**, containing **2,615** timestamp markers. That source was parsed with the strict visible-text procedure cue parser, finding **zero** matching category time-windows—not evidence of no committee motions. Retry artifact **11691588898** was independently downloaded: ZIP SHA256 **c42294055f34c6a4e7ccdcb6bc6a384337a369c85bb1def5fa431d55bf79ce46**, decoded **1,979-byte** JSON SHA256 **71ba360e072d95c482479d1f3effa6f491383dd3bf4f04b00f9f66ea017a2e52**.

## Bounded combined scope

| Verified item | Result |
| --- | ---: |
| 2022 electronic-indexed missing-Minutes hearing media leads | 11 |
| Original media record HTML SHA-256s reverified across original + retry | **11/11** |
| Hearings with nonempty original timed caption payloads | **10** |
| Original nonempty caption streams authenticated with exact previous SHA | **11** |
| Automatic source caption time marker attributes across streams | **24,147** |
| Distinct strict category × 30-second **research cue windows** (NOT votes) | **43** |
| Hearing pages with at least one category cue window | **3** |
| Original HTTP/source SHA errors remaining in this exact media-lead scope | **0** |

The three review priorities are **2022-02-10 Civil Law and Data Practices Policy `mtgid=1045642`** (27 windows), **2022-03-09 Environment and Natural Resources Finance `1045991`** (9), and **2022-02-07 Jobs and Economic Growth Finance and Policy `1045559`** (7). These are **unverified auto-caption procedural leads**, not three proven motions or 43 recorded votes.

The independent original **2022-03-15 Housing Finance and Policy `mtgid=1046040`** caption endpoint was an **empty** response with no timed rows; no original content or vote absence is implied. The independent original **2022-04-04 Education Finance and Policy `mtgid=1046323`** hearing had **two separately SHA-verified caption streams**; do not convert two streams into two legislative actions or independently certified roll-calls.

Permanent [original two-run source metadata ledger](./source-proof/senate-2022-11-original-caption-combined-source-checkpoint.json) and immutable regression tests lock the exact original ZIP/decoded JSON hashes and fail closed on first-run status/date/source drift. No caption transcript words, raw AV bodies, named sides or private data were retained. Remaining historical motion certification needs original hearing audio and separately verified clerk notes/agenda/amendment plus individual explicit YEA/NAY in official source; 2021 print-only and 2022 print/electronic records, actual 2021–25 distinct official committee vote denominator and source-to-existing-private-DB row equality remain UNKNOWN.

No private/production DB reads/writes, member-vote imports, training/model/forecast/serving/scheduler, Senate floor, 2027 program or government office contact. **Keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) OPEN.**
