# Member-history cap-20 prospective shadow protocol v1

## Status

Cap 20 remains a non-serving shadow candidate. This protocol freezes the 2027-2028 prospective test before any in-scope outcomes exist. It does not change `MEMBER_MODEL_VERSION`, production member probabilities, Deep targeting, or House Journal mechanics.

This v1 protocol is explicitly baseline-bound to `member-eb-v1.1`. The serving Quick default has since been promoted to `member-eb-v1.2-decay180`, so v1 is dormant under the normal production configuration. It is eligible only if the frozen v1.1 baseline is actually serving (for example under the explicit rollback control). A future cap-20 experiment against decay-180 would require its own separately frozen protocol and evaluation; this document does not authorize silently rebasing v1 onto a different serving model.

## Why a prospective test is required

The frozen cap grid mechanically selected a maximum member-history weight of 20 as the best qualifying finite cap. The subsequent exact 24-case 2025-2026 House replay reproduced all 3,193 uncapped member probabilities exactly before comparing the candidate.

On that already-revealed holdout, cap 20 improved member Brier by 0.000419, accuracy by 0.002505, ECE by 0.000864, and chamber mean absolute expected-Yes error by 0.258 votes. Sixteen of 24 cases improved on absolute member residual and chamber absolute expected-Yes error. However, log loss worsened by 0.004668 and absolute signed residual worsened by about 0.00118 under both member-weighted and equal-case estimands.

That is mixed retrospective evidence. It supports prospective measurement, not promotion.

## Frozen future cohort

The experiment is scoped to Minnesota's 2027-2028 session. House is the primary validation chamber; Senate is a mandatory safety slice for any global member-model promotion.

For each official final-passage vote event, the evaluator must use the latest otherwise-eligible production Quick revision whose generated calendar date is strictly earlier than the vote date. Same-day revisions are excluded because the current vote timestamp is date-only and cannot prove pre-vote ordering. No case may be replaced or selected based on the result, vote margin, mechanic presence, or candidate performance.

The cap-20 probability must be captured at forecast time from the same model inputs as the serving uncapped probability. Retrospective reconstruction does not qualify for the prospective cohort.

## Reveal boundary

Comparative outcome metrics may not be computed before **2028-07-01 00:00 UTC**. The scoped regular-session data cutoff is 2028-06-30. There is one final reveal: no sequential peeking and no threshold changes after capture starts.

## Minimum sample

House requires at least 20 resolved vote events and 2,500 decisive member outcomes. The Senate safety slice requires at least 12 vote events and 700 decisive member outcomes. A slice below its minimum is inconclusive rather than a reason to lower the threshold.

## House decision rule

Every House criterion must pass:

- member-weighted Brier delta (cap 20 minus uncapped) <= -0.0001
- equal-case Brier delta <= -0.0001
- ECE delta <= 0
- log-loss delta <= +0.002
- accuracy delta >= -0.002
- absolute member-weighted signed-residual delta <= 0
- absolute equal-case signed-residual delta <= 0
- chamber mean absolute expected-Yes-error delta <= 0

The tighter prospective log-loss and signed-bias guards are deliberate. Those were the candidate's weak points in the retrospective exact-holdout replay and must not be waved away after future outcomes are observed.

## Senate safety rule

A global production promotion is blocked unless the Senate slice reaches its minimum and also satisfies all of these safety limits:

- member-weighted Brier delta <= +0.001
- log-loss delta <= +0.003
- accuracy delta >= -0.002
- chamber mean absolute expected-Yes-error delta <= +0.5 votes

If House passes but Senate enrollment is insufficient, the global model still cannot change. A separately frozen chamber-specific follow-up would be required.

## Capture implementation boundary

`src/forecasting/member-history-cap20-prospective-shadow.ts` freezes the experiment key, session/chamber/mode eligibility, cap value, baseline model version, and deterministic candidate estimate. `src/forecasting/quick-runtime.ts` invokes the capture hook after a Quick revision is created, while `src/forecasting/member-history-cap20-prospective-capture.ts` persists the non-serving member-level shadow only when the Quick result is actually using the frozen `member-eb-v1.1` baseline.

A 2027-2028 Quick revision served by `member-eb-v1.2-decay180` is therefore intentionally ineligible for this v1 experiment rather than treated as a failed capture. This prevents routine production forecasts from logging false baseline-drift failures and prevents the old experiment from being silently redefined after the serving-model promotion.

## Production boundary

A prospective pass would still be evidence for a separate reviewed promotion change. This protocol itself authorizes no production probability action.
