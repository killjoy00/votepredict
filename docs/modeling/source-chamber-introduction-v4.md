# Source-chamber introduction model v4

## Status

`intro-title-text-eb-v4` is the accepted and deployed introduction-stage model for Minnesota 2025-26.

Its production role is an **unconditional originating-chamber passage prior assessed at introduction**. It is not the conditional/current floor-vote probability and must not replace the member-derived floor simulation.

Production serving was promoted in PR #127 and merged as commit `f5d855bf669ac74a844b343ec248a6866b0f60bc`. The exact commit was deployed to Vercel production as `dpl_VhST7gkrhXeMZYWr6JQoczJdPfsQ` on 2026-09-12 after the candidate had already earned empirical promotion and runtime integration passed CI.

## Target

For every bill introduced in the supported Minnesota regular-session universe, predict at introduction whether it will eventually pass its originating chamber during the biennium.

The target population includes bills that never reach a floor vote. This is why the introduction prior is a different probability from VotePredict's current/floor forecast.

## Inputs

The model uses only facts available at introduction:

- the official Revisor title/description;
- the zero-engrossment official introduction document when it was posted on or before introduction;
- only the opening purpose statement from that document;
- title-excluded purpose tokens so the text feature is incremental to the title model.

Ordinary bills stop before `BE IT ENACTED BY THE LEGISLATURE`; resolutions and joint resolutions stop before the first `WHEREAS`.

The one 2025-26 bill whose initial document was posted after introduction uses the exact title-only fallback. Later-posted text is never exposed to the introduction prediction.

## Frozen settings

- title prior strength: 100
- title minimum token support: 25
- title maximum features: 8
- title scale: 0.35
- text prior strength: 200
- text minimum token support: 40
- text maximum features: 10
- text scale: 0.18
- purpose-text cap: 8,000 characters
- probability floor: 0.0025
- probability ceiling: 0.35

## Authoritative corpus

The complete audited Minnesota regular-session introduced-bill universe is:

- 31,010 introduced bills;
- 654 source-chamber passages;
- 30,356 non-passages;
- 0 unknown labels;
- 31,010 authoritative introduction dates and initial-version records;
- 31,009 initial documents eligible at introduction;
- 1 late-posted initial document that is model-ineligible for text and uses title-only fallback.

## Evaluation

The 21,495-bill chronological development holdout covered 2023-24 and 2025-26, with each biennium trained only on earlier biennia.

| Metric | v1 title | v4 title + purpose text |
| --- | ---: | ---: |
| Brier | 0.020653159691417195 | **0.020600917045487117** |
| Log loss | 0.09924615933371052 | **0.09802744365532193** |
| ECE | 0.00268275382396815 | **0.002601839105605231** |
| Average precision | 0.15935372689100646 | **0.164364768048953** |
| ROC-AUC | 0.7678398138785231 | **0.7822363949947402** |

v4 improved Brier, log loss, calibration, and ROC-AUC in both holdout biennia. Average precision improved overall and in 2023-24, with a modest decline in 2025-26.

Promotion was earned because the governing probability metrics improved overall and in both holdout sessions without a material calibration or ranking-quality regression.

## Production freeze

The 2025-26 serving artifact is trained only on the completed 2021-22 and 2023-24 universes:

- 20,538 training bills;
- 402 training positives.

The artifact is pinned to the 2025-26 session and fails closed for later sessions. A future-session artifact must be built from completed earlier biennia rather than training on unresolved same-session outcomes.

The serialized artifact retains only token statistics that meet the model's frozen minimum-support thresholds. The exporter verifies that predictions from the serialized artifact exactly match predictions from the in-memory trained model before emitting it.

Current-session serving parity was verified on all 10,472 2025-26 bills with maximum serialized-versus-in-memory prediction delta **0**.

## Serving contract

Production runtime must:

- serve the frozen artifact rather than retraining from mutable production labels at request time;
- require the supported session and authoritative introduction metadata;
- use introduction-eligible zero-engrossment text only;
- use exact title-only fallback where introduction-time text is unavailable;
- reject or omit unsupported/future-session predictions until a new frozen artifact is promoted;
- preserve model/version and artifact provenance;
- never blend this probability silently into the current/floor member-derived forecast.

## Production validation

For the deployed v4 integration:

- PR integration CI passed clean migrations, TypeScript, tests, full Next.js build, and production dependency audit;
- the production Vercel build completed successfully;
- the production deployment reached `READY` with the expected promoted commit SHA;
- `/dashboard/introduction` passed an unauthenticated routing/auth smoke test by returning the expected owner-auth redirect;
- no 5xx errors or introduction-route runtime-error clusters were observed immediately after deployment.

The unauthenticated smoke test validates routing and the auth boundary only. Authenticated product use should continue to be observed through normal owner usage and production runtime logs.