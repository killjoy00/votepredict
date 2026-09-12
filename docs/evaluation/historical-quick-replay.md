# Historical Quick replay

## Purpose

This runner reconstructs the current Quick floor-vote model at a historical pre-vote snapshot without creating forecast revisions or reading current bill text.

It is the frozen base that a future historical Deep replay must modify. Deep and Quick should be compared from the same target bill version, historical member state, chamber roster, and analogue-selection policy.

Run:

```bash
npm run eval:historical-quick-replay
```

Add `--include-members` only when a full member-level artifact is needed. The default JSON output keeps event-level diagnostics and scorecards without emitting every member prediction.

## Snapshot and leakage rules

For an official vote date `D`, the replay snapshot is the start of `D`, equivalent to the end of the prior UTC calendar day.

The runner enforces:

- target bill text must be dated strictly before `D`;
- historical vote support uses only passage votes with `occurred_on < D`;
- analogue vote events on `D` are excluded;
- the active chamber roster is evaluated on `D - 1`;
- same-date target votes cannot update each other's member, party, or global history;
- no network source fetch is performed;
- no database writes are performed.

For analogue bills that are already in the historical past relative to the target, the runner mirrors the live Quick runtime and permits a dated bill version from the analogue's own vote date. That does not leak target outcomes because the analogue event must itself precede the target date.

## Model parity

The replay uses the production member model implementation and current `MEMBER_MODEL_VERSION` directly. Historical support is reconstructed independently for each chamber from decisive member votes before the target date. Analogue selection retains the live limits of 30 lexical/relationship-prefiltered events and 10 selected analogues.

The replay also preserves the live guard that refuses a bill-insensitive substitute when selected analogues contain no direct votes from members on the target chamber roster. Such events are labeled `no-member-analogue-support` instead of being scored as if a production Quick forecast existed.

## Frozen features

The replay never fetches current Revisor text. It loads dated bill versions already stored in Neon.

When a selected dated version has the current persisted deterministic feature set, that feature set is reused. When it does not, deterministic features are recomputed from the **stored frozen raw text** with the current deterministic extractor. A 2026-09-12 audit found 273 of the 1,224 strict replay targets lacked the current persisted feature-set row, so this fallback preserves cohort coverage without introducing future text.

## Cohort relationship

The target cohort is the same strict population introduced by `eval:deep-replay-cohort`:

- resolved Minnesota passage event;
- usable target bill text dated strictly before the vote;
- at least 20 decisive member outcomes;
- vote date in the past.

The production-data snapshot on 2026-09-12 contained 1,224 such targets and complete historical roster coverage for all 1,224. Only one early-2021 Senate target had zero prior safe passage events at all; analogue/model guards will expose such cases in replay status rather than inventing support.

## Scorecard

The runner reports:

- target/replay status counts;
- member prediction coverage;
- member accuracy, Brier score, log loss, and ECE;
- chamber expected-Yes mean absolute error;
- chamber passage Brier and accuracy;
- always-pass chamber Brier as a class-imbalance reference;
- session and chamber slices.

The chamber sample is heavily pass-skewed, so member-level metrics remain the primary signal for deciding whether Deep improves on Quick.

## Next layer

The next step is an archive-safe Deep replay that accepts the exact Quick member probabilities produced here, researches only sources provably available by the cutoff, applies the frozen evidence policy, and feeds paired Quick/Deep rows into `eval:deep-vs-quick`.

No evidence weights should be tuned until that paired comparison exists.
