# #864 — 2025-04-08 Elections SF2384 A11 separate original motion inspection

This deliberately narrow **public-source research follow-up** investigates an original-minutes paragraph **adjacent to, but distinct from**, the authenticated [A10 source](senate-2025-elections-apr08-sf2384-a10-separated-original-source-review.md). No individual vote import, new statewide denominator, or stored-evidence parity follows from the mere discovery of an adjacent cue.

## Original A11 research lead before independent source authentication

[Successful original A10 run #38147978546](https://github.com/killjoy00/votepredict/actions/runs/38147978546), exact original official PDF/text SHA256s and [permanent A10 source checkpoint](source-proof/senate-2025-elections-apr08-a10-original-source-checkpoint.json) establish that the adjacent pre-A10 source excerpt contains an **A11 Amendment** 10/0/1 aggregate result and **Lucero marked Absent**. This is an **A11 research lead**, not yet an independently isolated full A11 motion paragraph or a certified new vote. No roll-call motion may be inferred solely from the A10 proof.

## One-original, fail-closed proof

The [single source workflow](../../.github/workflows/senate-2025-elections-apr08-a11-source.yml) is one-time, triggered ONLY when its workflow file lands on main. It retrieves ONLY the [actual official April 8 Elections minutes PDF](https://www.lrl.mn.gov/archive/minutes/senate/2025/elections/20250408/Elections_20250408_Minutes.pdf) with bounded bytes, type and redirect checks. It requires the existing exact PDF SHA256 `d26c583ef3e5caae1b52d379bf9c6cc784e0e9d39a80c056259f65f83f2e4c46`, PDF size 99,628 and extracted full text SHA256 `6dc40628432da41be2ac4afe24b8725d5638e069421c4f413445042794411101` before a motion can be parsed.

The parser requires **one genuine named committee-member A11 motion introduction**, associated SF2384 text and **one unique within-A11-section** 10/0/1 prevailing motion result, and isolates explicitly printed Ayes/Nays/Absent names into a full exact 11-member roster partition (ten Ayes, **zero** Nays, one explicitly absent Lucero). Repeated introductions, a roll request with no mover, fabricated/duplicate member names, non-A11 votes or mismatched source bytes **fail closed**. It outputs original offsets, local text hashes, a short motion-only snippet, aggregate tallies and SHA-only member/side identities into the ephemeral Actions artifact. No original PDF or full text or readable member-side list is committed.

Synthetic unit tests use **exclusively fictional roster identities** to enforce the shape and rejection cases. Original A11 motion meaning, independent official bill/amendment validation, originality against neighboring paragraphs, audio/video if needed, and private source-to-stored-row parity are separately required before counting any distinct certified vote.

## Original first-run failure and distinct bounded retry

The **actual initial one-time original source run [#38148643214](https://github.com/killjoy00/votepredict/actions/runs/38148643214) FAILED**, not a certified original A11 motion. Original failed artifact **#11705946102** was independently downloaded: ZIP SHA256 `6f1687ad28306512c46e0accf86e188edde6500f733e104077a9335aabebb3bc` / **923 bytes**, original decoded JSON SHA256 `8fea4d948469641c28e87104dbe21e245d91b8290bd09c7720a3eb51d746279f` / **1,254 bytes**. Exact reported error: `A11 unique 10/0/1 printed result absent or duplicated`. The original first-run runner did not distinguish passed PDF SHA checks from motion parser failure in its top-level boolean: **do not infer** that PDF bytes changed or that no 10/0/1 passage exists based on this combined failure.

The first parser erroneously required the **10/0/1 tally to be unique across the entire committee hearing**. Different amendments may have the same numeric aggregate, so an unrelated 10/0/1 could cause a false HOLD. The new parser requires exactly one real named A11 motion introduction, then isolates the section **until the next actual numbered-amendment motion introduction** and demands exactly one prevailing 10/0/1 result within that A11 section. An identical result elsewhere is neither merged into A11 nor a duplicate. Repeated results **inside A11** or ambiguous introductions still fail closed. Original source URL/PDF/text SHA requirements remain identical. The retry now reports original-PDF-verification and motion-parsing booleans separately.

The failed first-run artifact, exact hashes, and caveats are immutably preserved in [first-failure proof metadata](source-proof/senate-2025-elections-apr08-a11-original-first-failure-checkpoint.json) with [regression](../../tests/senate-2025-elections-apr08-a11-first-failure-proof.test.ts). The [separate scoped one-time retry workflow](../../.github/workflows/senate-2025-elections-apr08-a11-scoped-retry.yml) subsequently completed successfully, and its **actual** ZIP/decoded JSON were independently SHA256-checked as documented below. The first run remains FAILED. Neither run permits named-side ingestion or changes the statewide denominator.

## Successful exact original A11 scoped source verification (separate run)

[Scoped source correction PR #1063](https://github.com/killjoy00/votepredict/pull/1063) merged at `bc53fd9cac7e4220837732ec909d4c0738bc668b` only after exact-head full green CI #38149082114 (clean migrations, `npm run check`, production audit). The **actual original scoped retry [run #38149288925](https://github.com/killjoy00/votepredict/actions/runs/38149288925) SUCCEEDED**, re-verifying one original official PDF and original extracted-text SHAs, one actual motion-level A11 section and its complete eleven-name printed result partition with **zero source failures**. Its original artifact **#11706340911** was independently downloaded and rehashed: original ZIP SHA256 **`f24278e9a7f02d05403ed63d87a3796e396d7e6bbc224da402e2d16822993193` / 1,934 bytes**, decoded original JSON SHA256 **`05f8464659e1d6d45075600d523ccc257f8189621ef093ae42db343887fc14ad` / 3,402 bytes**.

| Original April 8, 2025 Elections A11 field | Exact authenticated original result |
| --- | --- |
| Original bill | `SF2384` |
| Amendment motion | **Senator Westlin moved A11** |
| Source result | **Prevailed**, 10 YEA, 0 NAY, 1 explicitly **Absent: Lucero** |
| Original A11 motion introduction offset | **1286** |
| Original printed result offset | **1422** |
| Distinct next motion-section boundary | **1574** (the separately audited A10 introduction) |
| All-meeting matching 10/0/1 result paragraphs | **2** (NOT two A11 motions) |
| 10/0/1 matching results within exact A11 section | **1** |
| Original SHA256 of bounded A11 nearby text | `9f56c02abb1cef0e8f4ea171f1ab53d4696c755dd5144eee350a6ed29a0cc433` |
| Original SHA256 of A11 pre-vote passage | `c3bb7c91eab1801f61cd3cce7f261dd50b73efc362707a72fe0425e426fe27d8` |

The complete original named Ayes/Nays/Absent list exactly partitions the **eleven-member** historical Elections roster at A11; Lucero is not imputed to vote YEA or NAY. The **other** same-numeric-tally paragraph elsewhere in the hearing explains the global matching defect; it is **not** merged into A11, converted to another certified vote or presumed an A11 duplicate. The source identity is permanently pinned in [A11 scoped-success metadata-only proof](source-proof/senate-2025-elections-apr08-a11-original-scoped-success-checkpoint.json) and [immutable test](../../tests/senate-2025-elections-apr08-a11-original-scoped-success-proof.test.ts). The first-run failure checkpoint remains unchanged.

**Scope still held:** This certifies only the original *printed motion and roster-level passage* as a source candidate, not motion-time video/audio corroboration, public database absence, legally eligible individual member-vote import or a new statewide recorded-vote denominator. Do not auto-count A11, A10 or the other identical aggregate result. Original full PDF/audio and unhashed individual YEA/NAY sides were not committed.

The original historical hearing date is **April 8, 2025** per project minutes convention, not proof of precise minute-level availability; exclude same-day forecasts without motion time. Statewide 2021 print-only minutes, 2022 print/electronic divergence, 141 electronically indexed meetings without linked minutes, seven caption exceptions and 2021–2025 historical committee vote denominator remain unknown. No private/prod DB, member_vote writes, models, forecasting, training, serving, scheduler, floor, 2027 or agency contact. [Issue #864](https://github.com/killjoy00/votepredict/issues/864) must remain **OPEN**.
