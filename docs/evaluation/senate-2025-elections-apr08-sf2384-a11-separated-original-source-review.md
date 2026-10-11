# #864 — 2025-04-08 Elections SF2384 A11 separate original motion inspection

This deliberately narrow **public-source research follow-up** investigates an original-minutes paragraph **adjacent to, but distinct from**, the authenticated [A10 source](senate-2025-elections-apr08-sf2384-a10-separated-original-source-review.md). No individual vote import, new statewide denominator, or stored-evidence parity follows from the mere discovery of an adjacent cue.

## What actually exists before this PR

[Successful original A10 run #38147978546](https://github.com/killjoy00/votepredict/actions/runs/38147978546), exact original official PDF/text SHA256s and [permanent A10 source checkpoint](source-proof/senate-2025-elections-apr08-a10-original-source-checkpoint.json) establish that the adjacent pre-A10 source excerpt contains an **A11 Amendment** 10/0/1 aggregate result and **Lucero marked Absent**. This is an **A11 research lead**, not yet an independently isolated full A11 motion paragraph or a certified new vote. No roll-call motion may be inferred solely from the A10 proof.

## One-original, fail-closed proof

The [single source workflow](../../.github/workflows/senate-2025-elections-apr08-a11-source.yml) is one-time, triggered ONLY when its workflow file lands on main. It retrieves ONLY the [actual official April 8 Elections minutes PDF](https://www.lrl.mn.gov/archive/minutes/senate/2025/elections/20250408/Elections_20250408_Minutes.pdf) with bounded bytes, type and redirect checks. It requires the existing exact PDF SHA256 `d26c583ef3e5caae1b52d379bf9c6cc784e0e9d39a80c056259f65f83f2e4c46`, PDF size 99,628 and extracted full text SHA256 `6dc40628432da41be2ac4afe24b8725d5638e069421c4f413445042794411101` before a motion can be parsed.

The parser requires **one genuine named committee-member A11 motion introduction**, associated SF2384 text and **one unique** 10/0/1 prevailing motion result, and isolates explicitly printed Ayes/Nays/Absent names into a full exact 11-member roster partition (ten Ayes, **zero** Nays, one explicitly absent Lucero). Repeated introductions, a roll request with no mover, fabricated/duplicate member names, non-A11 votes or mismatched source bytes **fail closed**. It outputs original offsets, local text hashes, a short motion-only snippet, aggregate tallies and SHA-only member/side identities into the ephemeral Actions artifact. No original PDF or full text or readable member-side list is committed.

Synthetic unit tests use **exclusively fictional roster identities** to enforce the shape and rejection cases. Original A11 motion meaning, independent official bill/amendment validation, originality against neighboring paragraphs, audio/video if needed, and private source-to-stored-row parity are separately required before counting any distinct certified vote.

## Source-result hold

**Await the actual post-merge one-time original-source Actions job and independently download SHA256-check its ZIP AND decoded JSON** before recording a successful result. A runner alone does not establish any A11 source facts. On failure, preserve the failure and inspect precise source text; do not weaken authenticity guards or silently relabel a failure.

The original historical hearing date is **April 8, 2025** per project minutes convention, not proof of precise minute-level availability; exclude same-day forecasts without motion time. Statewide 2021 print-only minutes, 2022 print/electronic divergence, 141 electronically indexed meetings without linked minutes, seven caption exceptions and 2021–2025 historical committee vote denominator remain unknown. No private/prod DB, member_vote writes, models, forecasting, training, serving, scheduler, floor, 2027 or agency contact. [Issue #864](https://github.com/killjoy00/votepredict/issues/864) must remain **OPEN**.
