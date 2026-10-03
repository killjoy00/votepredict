# Historical evidence: two-clock policy

Historical evidence has two distinct time questions. VotePredict must preserve both instead of forcing every use case through a single publication-date gate.

## The two clocks

### 1. Underlying-activity clock

This clock records when the underlying real-world activity occurred.

Examples:

- candidate contribution: the contribution transaction date;
- candidate expenditure: the expenditure transaction date;
- independent expenditure: the transaction date;
- annual lobbying summary: conservatively, the end of the reporting period summarized by the row.

The activity clock is appropriate for **retrospective signal learning**. If a contribution happened before a vote, it may be useful evidence about the relationship between financial activity and later voting behavior even when the public did not learn the exact contribution until after the vote.

### 2. Public-availability clock

This clock records when the exact row/value is proven to have been publicly observable. It may come from a regulatory filing/disclosure timestamp, a verified publisher timestamp, an official historical artifact, or an independent archive capture under the existing provenance rules.

The availability clock is required for **strict historical as-of replay**. It answers the counterfactual question: *could a model running at that historical cutoff actually have consumed this exact information?*

## Eligibility by analytical purpose

| Purpose | Required date rule | What the result may claim |
| --- | --- | --- |
| Strict historical as-of replay | proven public availability date < vote/forecast cutoff | performance using information observable at the time |
| Retrospective signal learning | underlying activity date < vote date | whether pre-vote activity contains predictive signal when viewed with later knowledge |
| Annual aggregate retrospective analysis | reporting-period end date < vote date | whether a completed earlier reporting period contains signal for a later vote |
| Prospective serving/evaluation | evidence must satisfy the prospective capture contract at forecast time | real forward-looking performance |

Same-day evidence remains excluded whenever the source is only date-granular. The rule is strictly earlier than the cutoff.

## Why both are necessary

A reporting year, transaction date, and publication date answer different questions.

Suppose a contribution occurred on 2022-06-15, a vote occurred on 2023-03-01, and the exact contribution row was not publicly disclosed until 2024-01-10.

- The contribution is **retrospective-activity eligible** for studying the 2023 vote because the underlying financial relationship existed before the vote.
- The same row is **not strict-as-of eligible** for a replay of a model supposedly running on 2023-03-01 because the exact row was not then observable.
- Once the disclosure is known in later years, the historical relationship may still be useful training evidence for a future model. That does not retroactively make it contemporaneously observable.

This distinction prevents two opposite errors: overstating historical live accuracy by leaking later disclosures into an as-of backtest, and throwing away real pre-vote behavior merely because its publication timing is late or difficult to prove.

## Late filings, corrections, and amendments

Late disclosure or a later correction does not erase the fact that the underlying activity occurred before a vote. Retrospective signal analysis may therefore use the later-known exact row/value when the activity date is pre-vote.

That richer row must still be labeled as retrospective information. It cannot be used to claim that the historical model knew the corrected amount at the earlier cutoff.

The current durable candidate-finance row identity includes substantive row fields. A corrected source value can therefore create a new exact row identity. Two-clock diagnostics must preserve this caveat rather than imply that every present-day row version was the historically visible version.

## Annual lobbying evidence

Annual lobbying totals are not point events. For retrospective timing, use the **end of the reporting period** as the conservative activity clock.

A 2022 annual lobbying total is therefore eligible as retrospective context for votes after 2022-12-31, even if the exact report was filed or discovered later. It is not automatically eligible for votes during 2022 because the annual total includes activity from the rest of that year.

Public-availability provenance remains separate. If the exact 2022 total is proven public by a later date, that date governs strict as-of replay.

## Model-use boundary

The two-clock policy is an **eligibility and interpretation contract**, not an automatic model-weight rule.

- Financial relationships remain neutral context and never imply a YEA or NAY stance by themselves.
- Candidate finance already has a frozen five-feature historical diagnostic contract, so it can be evaluated under both clocks without inventing a new transformation after outcomes were seen.
- Independent expenditures and lobbying can adopt the same two-clock data semantics now, but a predictive transformation for those families must be predeclared before it is evaluated as a model feature.
- Retrospective results are exploratory and are not an independent validation set.
- No retrospective result automatically changes serving Quick.

## Current implementation

`src/evaluation/historical-evidence-two-clock.ts` defines the shared clock semantics and strict-before-cutoff helpers.

`data/evaluation/historical-finance-two-clock-diagnostic-plan-v1.json` freezes the first two-clock model diagnostic. It keeps the existing five candidate-finance features, ridge lambda 20, the 2021-22 fit / 2023-24 validation / 2025-26 descriptive chronology, and the +/-1 logit cap.

`scripts/evaluate-historical-finance-two-clock.ts` evaluates two versions of the same finance feature contract:

1. **strict-as-of finance**, keyed by proven public availability;
2. **retrospective-activity finance**, keyed by the underlying transaction date.

The canonical issue #459 matrix remains frozen. The two-clock artifact is separately versioned, read-only, non-serving, and cannot be described as a replacement historical replay.

Serving decisions remain prospective. The definitive forward test is the prospective evidence/model evaluation under issue #287.
