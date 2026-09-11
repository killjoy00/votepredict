# Source-chamber introduction model v4

## Status

`intro-title-text-eb-v4` is the accepted introduction-stage model for Minnesota 2025-26. Its production role is an **unconditional originating-chamber passage prior at introduction**. It is not the conditional floor-vote probability and must not replace the member-derived floor simulation.

## Inputs

The model uses only facts available at introduction:

- the official Revisor title/description;
- the zero-engrossment official introduction document when it was posted on or before introduction;
- only the opening purpose statement from that document;
- title-excluded purpose tokens so the text feature is incremental to the title model.

Ordinary bills stop before `BE IT ENACTED BY THE LEGISLATURE`; resolutions and joint resolutions stop before the first `WHEREAS`. The one 2025-26 bill whose initial document was posted after introduction uses the exact title-only fallback.

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

## Production freeze

The 2025-26 serving artifact is trained only on the completed 2021-22 and 2023-24 universes: 20,538 bills and 402 positives. The artifact is pinned to the 2025-26 session and fails closed for later sessions. A new future-session artifact must be built from completed earlier biennia rather than training on unresolved same-session outcomes.

The serialized artifact retains only token statistics that meet the model's frozen minimum-support thresholds. The exporter verifies that predictions from the serialized artifact exactly match predictions from the in-memory trained model before emitting it.
