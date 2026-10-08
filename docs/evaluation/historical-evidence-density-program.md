# Historical evidence density program

_Last updated: 2026-10-08_

Issue #718 is the active bounded program for increasing strict-pre-vote historical directional evidence without weakening provenance, chronology, or semantic review. Its primary objective remains the 2021-22 training universe, while newer sessions are tracked explicitly so the evidence substrate does not become disproportionately sparse outside training.

This program is evidence construction and coverage work, not model tuning. Broad retrospective feature searching on the 2021-26 vote outcomes remains closed.

## Non-negotiable operator instruction: self-service only; no external contact

**Do not email, call, draft or queue correspondence, submit requests, schedule visits, or otherwise contact the Legislative Reference Library or any other office for historical 2021 Senate committee minutes.** The project owner expressly ruled out external records requests, repeatedly. Do not ask to seek exceptions. The prior 2021 print-minute request package (#784) is a historical targeting artifact, **not an action item**; the 2021 print-minute acquisition lane is blocked absent publicly accessible online files. Use only independently accessible public web archives, recordings, captions and bill pages; stop when source bytes/attribution/chronology cannot be proven. See [`2021-senate-public-source-audit.md`](2021-senate-public-source-audit.md) for the 2026-10-08 online pass (8 public agenda records matching 17 frozen associations; zero verified source recordings or directional statements).

## Governing contract

Every lane must preserve all of the following:

- independent historical availability proof with `available_date < target cutoff_date`; same-day evidence is excluded unless ordering is independently proved;
- current mutable pages are never backdated;
- exact member and bill identity where exact-bill evidence is claimed;
- member/issue evidence stays bill-free unless exact bill linkage is independently established later;
- ambiguous identity, timing, content, acquisition, bill mapping, or semantic applicability fails closed;
- target vote outcomes are not used for evidence discovery, annotation, candidate screening, applicability review, or feature construction;
- exact/repeated archive captures do not count as multiple semantic signals;
- all newly admitted evidence remains `contextOnly=true`, `mechanicallyActionable=false`, and `modelWeight=0`;
- no automatic serving, probability, or model-weight changes;
- no model fitting is authorized by the historical-density program itself.

The current automation is intentionally GitHub-first. New bounded read-only inventory and canonicalization work should not require Vercel.

## Canonical historical feature state

PR #747 merged the second P2 applicability tranche and produced historical feature matrix **v1.7**.

Canonical main commit: `88ccf6cc0f44647b11351786bdd8a011bd3dc0a3`.

Main verification runs:

- normal CI: `37515675112` — clean migrations, `npm run check`, and high-severity production dependency audit all green;
- historical-density canonical pipeline: `37515675071` — semantic gate, immutable freeze, v1.7 overlay, and coverage audit all green.

Main immutable artifacts from run `37515675071`:

- remaining P2 canonical review: artifact `11436288880`, digest `sha256:9866a478daef63baff18a2f49ac7d38ca9fae7bd93a722ee9b94b3dca4b13c16`;
- v1.7 historical feature freeze: artifact `11436413885`, digest `sha256:fc1d77ccc51bc33f3e3f1c0dd6622c0f2a9797d62a8d54bcb65906de30228e44`;
- v1.7 coverage audit: artifact `11436388908`, digest `sha256:5c16c1b31a4d9232f7ffb6a27a5b62143a493904fa1186db1d30769a39d2a67b`.

The v1.7 matrix preserves the full 135,457-row target universe and the exact-bill feature family unchanged:

| Session | Target rows | Exact-bill rows | Reviewed-applicability rows | Combined directional rows |
| --- | ---: | ---: | ---: | ---: |
| 2021-22 | 35,510 | 3 | 6 | **9** |
| 2023-24 | 49,827 | 32 | 0 | **32** |
| 2025-26 | 50,120 | 3 | 0 | **3** |
| **Total** | **135,457** | **38** | **6** | **44** |

Exact-bill rows changed versus v1.6: **0**. Exact/reviewed overlap: **0**. Ambiguous or pending applicability rows admitted to the matrix: **0**.

Coverage remains far too sparse to justify model fitting.

## P2 semantic-gate architecture

The P2 program deliberately separates four stages:

1. recover historically available member-primary/campaign text without inventing bill linkage;
2. freeze an outcome-blind member/issue semantic review cohort;
3. nominate only strict-pre-vote member-event candidates using official bill text and chronology;
4. admit only explicitly reviewed applicable pairs into the separate reviewed-applicability feature family.

The remaining second tranche froze **124 candidate review groups / 138 candidate claim pairs**. Final semantic decisions were:

- **4 applicable** groups;
- **17 ambiguous_fail_closed** groups;
- **103 not_applicable** groups;
- **0 pending_review** groups.

Full eligible-pair accounting was **4 applicable / 91 ambiguous_fail_closed / 2,621 not_applicable / 0 pending**.

The four newly accepted rows are deliberately narrow:

- Julia Coleman -> SF2575;
- Julia Coleman -> SF2666;
- Zach Duckworth -> SF2575;
- Paul Utke -> SF2848.

Together with the two previously accepted reviewed-applicability rows, v1.7 contains six reviewed-applicability rows total.

## Completed and closed lanes

Do not reopen these without a genuinely new source, parser/index surface, archive provider, or independently defensible proof class:

- exhausted 2021-22 Session Daily exact-URL Wayback lane;
- bounded 24-PDF House attachment exact-URL Wayback pilot, which ended with 24/24 lacking a verified pre-vote archived PDF;
- previously exhausted Senate member-publication and candidate-finance/IE proof surfaces documented in their originating issues;
- already-reviewed P2 first and second cohorts except when a new independently proven source changes the evidence set.

The stop rule is strict: do not weaken timing/provenance, repeat an exhausted archive surface, invent member/bill identity, or continue broad crawling after bounded diminishing yield.

## Cross-session gap map

The next infrastructure step is a GitHub-only read-only gap inventory built directly from the immutable v1.7 matrix. It uses only frozen target identity and current directional coverage; it does not query production, discover sources, fetch pages, infer applicability, or read outcomes.

Against v1.7, the uncovered target map is:

| Session | Covered | Uncovered rows | Memberships with uncovered rows | Uncovered events | Uncovered bills |
| --- | ---: | ---: | ---: | ---: | ---: |
| 2021-22 | 9 | **35,501** | 201 | 374 | 196 |
| 2023-24 | 32 | **49,795** | 203 | 480 | 203 |
| 2025-26 | 3 | **50,117** | 207 | 485 | 251 |

The primary historical program remains **2021-22** because that is the training universe and the explicit objective of #718. For additional newer-session recovery, **2025-26 is the first priority**, followed by 2023-24, because 2025-26 currently has the lowest strict directional coverage rate and the largest uncovered row count among the newer sessions.

This target-gap ranking is not a claim that any row is recoverable. Source recovery still requires a separate bounded inventory with exact historical availability and freshness guards.

## Current post-v1.7 checkpoint and next work

PR #782 froze v1.8 (post-merge artifacts and CI recorded in [issue #718 milestone](https://github.com/killjoy00/votepredict/issues/718#issuecomment-6041784252)): the unchanged 135,457-row universe has 92 combined directional rows, of which **9 / 35,510 are 2021-22**; 2023-24 remains 32, and 2025-26 increased to 51. v1.7 remains the frozen input for independent downstream audits, not the latest feature matrix. The House cohort-2 2025-26 sweep ranks 1–264 finished after #845 with **49 aligned context-only pairs** across 11 tranches; none are integration-ready and they do not improve the 2021-22 primary goal ([accepted milestone](https://github.com/killjoy00/votepredict/issues/718#issuecomment-6068882931)).

1. Focus on **2021-22** strict directional coverage: the 2021 Senate print-minute request/intake plumbing exists but **has zero received print records**. Do not use its request package for outreach. Public online media is the only permitted alternative.
2. Follow the bounded independent public-media pass in [`2021-senate-public-source-audit.md`](2021-senate-public-source-audit.md): eight exact 2021 Senate agenda pages name 14 distinct frozen bills and satisfy date windows for 17 target-event associations. These are **candidate discovery only**, not evidence.
3. Retrieve/historically anchor only publicly accessible audio/video/captions (if available) and require source hashes, independent bill+member attribution, specific directional statements, and strict chronology. Fail closed if missing. Reuse existing bounded media/caption probe modules and existing semantic review gates; do not invent an unsupported record.
4. Preserve all closed/exhausted source lanes and the non-serving, zero-weight contract. Stop a source lane when progress requires library contact, private records, assumed evidence or relaxed provenance; do not open a new 2025-26 tranche or claim that the 2025-26 sweep satisfied the 2021-22 training objective.

Success continues to be measured in unique strict-pre-vote member-event rows, memberships, and target events, with exact-bill and reviewed member/issue applicability reported separately. Raw document count or agenda hits are not success metrics.
