# Historical evidence density program

_Last updated: 2026-10-06_

Issue #718 is the active bounded program for increasing strict-pre-vote historical directional evidence without weakening provenance, chronology, or semantic review. Its primary objective remains the 2021-22 training universe, while newer sessions are tracked explicitly so the evidence substrate does not become disproportionately sparse outside training.

This program is evidence construction and coverage work, not model tuning. Broad retrospective feature searching on the 2021-26 vote outcomes remains closed.

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

## Next work

1. Freeze the cross-session target-gap inventory from v1.7 and publish its immutable artifact/digest.
2. Use the 2025-26 gap map to build a bounded **source** inventory from genuinely fresh member-primary/campaign and exact-member+bill surfaces without Vercel or outcome access.
3. Recover exact bodies only for frozen source candidates whose source/content identity and historical availability can be independently revalidated.
4. Feed recovered member/issue evidence through the same semantic gate rather than creating a bespoke session-specific applicability pipeline.
5. Repeat for 2023-24 after the 2025-26 bounded lane reaches a stop rule.
6. Continue 2021-22 recovery only through genuinely new proof surfaces; do not reopen exhausted routes merely to increase document count.

Success continues to be measured in unique strict-pre-vote member-event rows, memberships, and target events, with exact-bill and reviewed member/issue applicability reported separately. Raw document count is not a success metric.
