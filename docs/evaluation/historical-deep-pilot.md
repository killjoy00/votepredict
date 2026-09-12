# Historical Deep close-vote pilot

## Purpose

The first archive-backed Deep evaluation should start with a small, difficult, auditable subset rather than attempting all 1,224 historical Quick replay targets at once.

This pilot freezes six close Minnesota House passage votes from 2023-2024. They were chosen because they are consequential close votes, have strict pre-vote bill text in the replay corpus, and sit in a period with useful official House/Revisor historical archives.

The pilot manifest does **not** perform research. It reconstructs Quick inside the production runtime, runs the exact live Deep target planner, attaches historical legislator names/districts, and emits the exact research request that a future archive packet must satisfy.

## Frozen pilot

| Vote date | Bill | Outcome | Floor vote |
| --- | --- | --- | --- |
| 2023-01-19 | HF1 | Passed | 69-65 |
| 2023-03-20 | HF366 | Passed | 68-64 |
| 2023-03-23 | HF146 | Passed | 68-62 |
| 2023-05-02 | HF2 | Passed | 68-64 |
| 2024-05-02 | HF4300 | Passed | 68-64 |
| 2024-05-19 | HF3276 | Failed | 66-62 |

HF3276 is intentionally included because the broader floor-vote history is extremely pass-skewed. A close failed bill is particularly useful for testing whether Deep evidence improves member-level predictions without merely learning an always-pass chamber prior.

## Target planning

For each bill, the manifest:

1. reconstructs the leak-safe historical Quick forecast;
2. requires the Quick case to be `replayable`;
3. uses the exact production Deep target planner;
4. uses the production 12-member limit;
5. preserves target rank, pivotality, uncertainty, evidence gap, priority score, Quick probability, support counts, party, member name, and district;
6. binds the research request to the exact bill ID, chamber ID, and end-of-prior-day cutoff.

No alternate historical targeting heuristic is introduced.

## Execution

The protected production route is:

`POST /api/operations/historical-deep-pilot-manifest`

It requires the existing operations secret and production runtime. The GitHub workflow waits until the exact merged SHA is READY in Vercel, invokes the protected route, and uploads the manifest as a machine-readable Actions artifact.

## Source collection after the manifest

Source discovery is deliberately downstream of target selection. For each selected member/bill/cutoff, the archive builder should enumerate predefined historical collections rather than use present-day search ranking as the selection mechanism.

The first collections should be:

- Minnesota House Session Daily historical articles published before the cutoff;
- House journals and official committee records dated before the cutoff;
- legislature-specific Revisor bill/version records dated before the cutoff;
- independently archived member-primary pages only when the archival capture itself predates the cutoff.

Same-day material is excluded because the vote-events table does not preserve vote time. Post-vote articles are excluded even when they are useful summaries of the debate.

## Evaluation rule

The existing Quick weights and evidence-impact weights remain frozen. The first question is whether archive-backed Deep improves the already-established Quick member baseline:

- Brier: 0.1178360
- log loss: 0.3648038
- ECE: 0.0270857
- accuracy: 82.58%

Member-level lift is the primary signal. Chamber pass/fail is secondary because 99.08% of replayable historical floor passage votes passed and an always-pass rule has a lower chamber Brier than Quick on that imbalanced sample.
