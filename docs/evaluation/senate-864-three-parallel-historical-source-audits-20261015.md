# #864: three parallel Senate historical-source audits — verified October 15, 2026

**Scope:** Minnesota Senate historical committee Minutes in 2021–2025, source-only except the explicitly approved **read-only** 2023 SF1 Neon parity check. No government contact, unsafe historical positional-key replay, database mutation, model retraining, or 2027 changes.

## Track 1 — exact January 24, 2023 Rules SF1 original-source vs stored record

[PR #1306](https://github.com/killjoy00/votepredict/pull/1306) merged after independent CI and triggered [protected V3 existing-Neon read-only run #38784090365](https://github.com/killjoy00/votepredict/actions/runs/38784090365). The source re-authentication and five bounded read-only SELECTs succeeded, followed by explicit ROLLBACK.

- Exact original official PDF recorded **two independent rolls**: failed oral amendment **4–6**, adopted committee report **6–4**; twenty public source-side named choice occurrences.
- Exactly **one stored original PDF source-document identity**; **zero** same-day matching SF1 Rules committee event rows in the authenticated existing Neon default branch.
- Historical 2023–2024 roster: **68** rows, **67** active on the January 24 hearing date.
- Each of the two official ten-member rolls has **7 fully matched historical active membership identities and 3 unresolved names**, no ambiguities among matched entries or invalid membership UUIDs. First roll unresolved original choice positions 0/4/5; second roll 0/1/6 (source-only indices, not event or person IDs).
- Both remain **hold_historical_member_resolution**. No names or member IDs were exported, and **no vote rows were inserted**. Previously reported "0 service-day resolved choices" was all-or-nothing; the V3 breakdown is the correct individual 7/10 interpretation.

**Next data-safety gate:** independently resolve each of the remaining three printed senator identities per roll against exact hearing-day historical membership and alias proof; then re-run bounded exact-original source/roll/motion/stored-event parity. Add-only stable original-motion-anchor planning can only follow full 10/10 independently verified identities. Never re-ingest old parser positional event keys.

## Track 2 — 81 SHA-authenticated first-pass-zero OCR original Senate Minutes

[PR #1310](https://github.com/killjoy00/votepredict/pull/1310) merged, with all nine jobs including eight independent original source re-fetch and segmentation shards passing in [source workflow #38784909816](https://github.com/killjoy00/votepredict/actions/runs/38784909816). **81/81** original PDF raw SHA and OCR text proofs were reauthenticated, **zero document holds**. Source-only printed result cue classification:

| Printed result boundary category | Cue occurrences |
| --- | ---: |
| One nearby apparent motion introduction | **146** |
| Multiple nearby introductions: ambiguous motion boundary | **51** |
| Possible repeated result without a new introduction | **7** |
| No bounded nearby motion introduction | **3** |
| **Total authenticated formal-result TEXT cues** | **207** |

These **207** are printed text cue slots, **not certified distinct parliamentary decisions**, and do not show 207 missing persisted vote events. The 81 SHA-bound original PDF proof reports still identify **zero newly parsed individual named-roll candidates**. Classifier deliberately publishes hashed source spans, original offsets and aggregate categories, **not names or individual YEA/NAY inference**. The next stage is independent per-actual-motion distinct proof, then protected source-to-stored comparison for actions with enough identity/tally evidence.

## Track 3 — complete remaining 323 original embedded-text first-pass-zero Minutes

[PR #1307](https://github.com/killjoy00/votepredict/pull/1307) merged after **49/49 jobs succeeded** in [source run #38783916630](https://github.com/killjoy00/votepredict/actions/runs/38783916630): one exact-cohort preflight and **48** separate original PDF source SHA/grammar recheck shards. Previously **48** of the 371 first-pass-zero embedded-text originals had been reviewed; all **323** previously unreviewed sources have now been reauthenticated, **323/323 SHA verified, zero held**.

| Year | Newly authenticated original embedded-text PDFs | Documents flagged for additional source motion review | Documents with an explicit formal-result cue |
| --- | ---: | ---: | ---: |
| 2022 | 77 | 6 | 3 |
| 2023 | 97 | 6 | 3 |
| 2024 | 41 | 3 | 1 |
| 2025 | 108 | 11 | 10 |
| **Total** | **323** | **26** | **17** |

The 26 flagged *documents* and 17 documents with explicit result phrases are source-review queues, **not named member votes, distinct motions, or proven missing stored events**. Source artifacts for all 48 revalidated shards are retained in the Actions run.

### Independently proven written-Minutes coverage and print limitations

[PR #1311](https://github.com/killjoy00/votepredict/pull/1311) merged after complete CI and deterministic original-source identity testing of **141** official meeting dates with no linked Minutes PDF, **111** original Clerk HTML meeting Minutes plus another original LRL Housing PDF, **four** supplementary original meeting dates in eight PDFs, and **eleven** newly authenticated original written-minute meeting dates. The resulting count is **1,578 of 1,592 indexed 2022–2025 committee meeting dates with authenticated original written Minutes**; exactly **14** dates remain unsupported, broken down **2022: 3, 2023: 2, 2024: 4, 2025: 5**. Consult the [full exact fourteen committee/date list](senate-864-fourteen-remaining-written-minute-source-dates.md) before any follow-up source research.

The **2021 official printed-Minutes source denominator remains UNKNOWN**; **2022 printed-versus-electronic Senate Minutes equivalence remains UNVERIFIED** because authenticated publicly available originals have not established them. Government-office outreach is outside the owner-approved scope. Missing Minutes, printed cue repetitions, attendance, voice or unanimous decisions **do not imply any named YEA/NAY member vote or zero recorded motions**.

**Issue #864 stays OPEN.** Newly verified source coverage is not production member-vote completeness. No data writes, production deploy, new prediction positions or retraining were authorized by these source audits.
