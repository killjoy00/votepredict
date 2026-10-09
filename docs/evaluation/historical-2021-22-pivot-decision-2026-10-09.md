# October 9, 2026 decision: pause historical directional-evidence expansion

Decision owner: VotePredict owner, after a review of diminishing marginal yield in issue #718.
Scope: evidence research direction and forecast-evaluation prioritization only. **No serving change, model fit, production release, Vercel, Neon, evidence ingestion, external contact, or prospective-session activation.**

## Decision and success metric

**Pause further historical SF958 audio extraction, transcription, and general 2021-22 directional-source recovery.** A successfully recovered recording or generated transcript is not itself a new member-event directional feature. The frozen Evidence Quality v1.8 result remains **9 / 35,510** strict-pre-vote 2021-22 rows (3 exact-bill + 6 reviewed-applicability) out of 135,457 historical member-event rows overall. No 2021-22 rows were added by the 2026-10-09 audio effort.

Before work resumes, require a genuinely new, independent source/proof class and a tiny prespecified target-overlap sample demonstrating **actual** member-specific, strict-before-vote, semantically qualifying incremental rows. Potential row overlap, MP3 URLs, speech timecodes, article counts, or transcript segment counts do not satisfy the success metric.

Retain issue #718 as a **paused / reopen-only-on-qualifying-proof** tracker, not an active research queue. The closed general historical-source expansion in [#355](https://github.com/killjoy00/votepredict/issues/355) must not be implicitly reopened.

## Final bounded SF958 / Vang provenance check

The official [May 4, 2021 House committee schedule](https://www.house.mn.gov/schedules/05042021) lists Rep. Samantha Vang for an SF958 cottage-food comparison and public remote viewing. The [official 2021 House conference audio archive](https://www.house.mn.gov/audio/CCarchives/92) names the same bill/date and offers a currently downloadable MP3. The exact original May 4 and May 6 bytes were previously recovered, decoded, and hash-verified in [workflow #37945317116](https://github.com/killjoy00/votepredict/actions/runs/37945317116). The corrected six-clip ASR extraction [#37951482192](https://github.com/killjoy00/votepredict/actions/runs/37951482192) provides unverified machine hints; see [#718 audio content comment](https://github.com/killjoy00/votepredict/issues/718#issuecomment-6084060223).

**Bounded proof outcome:** the official dated schedule shows an intended public webcast, but the present-day schedule/archive does **not** independently prove exactly when the archived *speech content* became publicly observable before the two May 17 target votes. The precise Vang utterance and speaker identity have not been independently human/audio-correlated, nor has endorsement of the final conference report itself been established. We did not recover an exact contemporaneous, independently timestamped capture or publication record for that utterance. The later conference-report's cottage-food provision does not cure these failures. This is **not proof that a 2021 broadcast never occurred**; it is a fail-closed finding for this narrow evidence investigation.

**Disposition:** May 4/6 original recordings remain legitimate source/context artifacts. Vang cottage-food language is a **review lead only**; 0 newly accepted strict directional rows, no historical promotion, no further MP3/ASR work by default.

## Five-link official member-publication feasibility check

Independently located five existing Minnesota House member news/press pages and compared each named bill/date to the frozen v1.8 target-member-event universe, directly reading the original immutable matrix artifact [11494634289](https://github.com/killjoy00/votepredict/actions/runs/37647888556) **without reading vote outcomes**. This is a convenience sample, **not** a statistically representative corpus estimate or fresh data ingestion. Publisher-displayed dates are leads, not by themselves independent proof of prior public availability.

| Public House member source | Named bill | Displayed date | Frozen 2021-22 target overlap | Strict-direction result |
| --- | --- | --- | --- | --- |
| [Emma Greenman legislative update](https://www.house.mn.gov/members/profile/news/15552/30994) | HF9 | Jan 22, 2021 | No HF9 floor target in frozen matrix | 0; no target |
| [Tim Miller Forever Green update](https://www.house.mn.gov/members/profile/news/15440/44181) | HF661 | Mar 5, 2021 | No HF661 floor target | 0; no target |
| [Tim Miller HF643 press release](https://www.house.mn.gov/members/profile/news/15440/46746) | HF643 | Sep 20, 2021 | No HF643 floor target | 0; no target |
| [Tim Miller HF445 update](https://www.house.mn.gov/members/profile/news/15440/44094) | HF445 | Feb 19, 2021 | House HF445 frozen target Feb 18, 2021 | 0; post-target |
| [Peggy Scott SF970 release](https://house.mn.gov/members/profile/news/15314/44493) | SF970 | Apr 22, 2021 | Only Senate SF970 frozen target Apr 15, 2021 | 0; later than target and no House event |

**Pilot yield: 0 / 5 exact source pages generated a qualifying member-event row**, even before separate historical-publication proof. All five are source-specific exclusions; do not claim broad House member news can never yield anything. But member/caucus/publication Wayback source families were **already worked and bounded under #355**, so these pages do not open a genuinely novel historical recovery lane. No further historical crawl or archive probe is justified by this convenience sample.

For comparison, the theoretical May 17 SF958 opportunity consists of **134 House + 67 Senate frozen member-event rows**, but only a **genuinely attributable statement from a particular voting member** could cover that member's relevant row; it does not fill all 201 rows.

## Forecast-improvement strategy: reuse completed work

The strongest near-term analytical priority is **evaluation discipline**, not a new feature-hunting or retraining pass on repeatedly viewed 2021-26 outcomes.

| Forecast target | Current evaluated model | Existing benchmark / validation contract | Decision |
| --- | --- | --- | --- |
| At introduction, eventual source-chamber passage across *all* introduced bills | Accepted intro-title-text-eb-v4 | [Introduction v4 report](../modeling/source-chamber-introduction-v4.md) | Keep the accepted prior; do not substitute floor-conditioned scores |
| Given an actual selected floor-vote target, member probabilities and chamber passage | Serving member-eb-v1.2-decay180 | [Evaluation standard](../EVALUATION_STANDARD.md) and [#287](https://github.com/killjoy00/votepredict/issues/287) | Keep baseline unchanged; measure prospectively when outcomes exist |
| Given an evolving introduced-bill state, eventual source-chamber passage | Frozen lifecycle P4/P5/P6/P8 comparison | [#310](https://github.com/killjoy00/votepredict/issues/310) and [frozen P8 protocol](../../data/evaluation/lifecycle-p8-prospective-plan-v1.json) | Preserve model freeze and assess prospective-capture readiness separately; no premature promotion |
| Incremental Quick public evidence | Unified zero-weight/shadow Quick Evidence | [#287](https://github.com/killjoy00/votepredict/issues/287) frozen **40 resolved forecasts / 2,000 member outcomes / 50 evidence-applied members** gate | Do not tune/promote until the original prospective gate is met |

Already executed retrospective checks document why another historical score chase is counterproductive. In the [frozen combined Quick Evidence screen](../../data/evaluation/quick-evidence-final-2026-research-v1.json), 2023-24 member Brier improved **0.0039247**, but chamber passage Brier **worsened 0.0028687**, exceeding the frozen allowed +0.002. In [lifecycle P6](introduced-bill-lifecycle-program.md), decomposed end-to-end passage Brier improved versus P5 on 2023-24 (**0.01795661 to 0.01760599**) but regressed on 2025-26 (**0.02388678 to 0.02401691**) and has weaker introduction-snapshot probability scores than v4. These data are already inspected development/robustness periods, **not newly untouched holdouts**.

The lifecycle prospective P8 model has **already been frozen**; its **daily capture is not activated**. Its sealed scoring gate is no earlier than **2028-07-01 UTC**, and depends on its existing completeness/coverage thresholds. The separate Quick Evidence #287 scorecard likewise remains gated on enough genuinely prospective observations. These programs must not be duplicated, bypassed or activated via #718.

## Next authorized scope, in order

1. **Close the loop on #718:** record this stopped research outcome, preserve the v1.8 count, and retain source leads only for provenance. Reopen solely upon new independently timestamped pre-vote content and a demonstrated genuine qualifying member-event row; no timed standing work or external inquiries.
2. **Treat #287 and #310 as the governing forecast-quality programs.** Review status/readiness from checked-in frozen artifacts without reading a live DB. Their uncompleted prospective accrual/capture steps are real operational work and must receive **separate, explicit production/session authorization** before any activation. #732 production automation remains paused.
3. **Do not fit another retrospective predictor against 2021-26 outcomes** or expand member/caucus/House-attachment/Wayback/audio sweeps merely to increase source counts. With new out-of-sample observations, run the **already frozen** member/chamber and all-bill lifecycle comparisons under their own population/cutoff/reveal rules.
4. **Promotion remains human-reviewed** and must show improved governing chamber/all-bill proper scores without material member/calibration regressions. Evidence remains context-only, non-mechanical and zero-weight unless separately admitted.

No target vote outcome was used to nominate or assess the five written source pages. This decision makes **no new evidence, production, model, serving, Neon, Vercel, or 2027-28 data changes**. No public-office contact occurred.
