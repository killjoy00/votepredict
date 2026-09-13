# Historical Deep expansion parser v2

This is an evaluation-only, outcome-blind extension of the frozen historical Deep expansion extraction experiment. It does not change production evidence ingestion, target selection, evidence weights, Quick probabilities, or Deep probabilities.

## Why this exists

The immutable 24-event development cohort has 49 frozen official Minnesota House committee-minute pages and 51 source/case matches, but the unchanged `deterministic-house-committee-roll-call-v1` parser produced candidates for only one event. Review of the already-frozen pre-vote source structures showed several deterministic formatting gaps rather than a lack of official archive material.

V2 is deliberately specified before consulting the post-discovery floor-outcome artifact. Its only inputs are the same SHA-bound outcome-free Quick manifest and official pre-vote source bundle already frozen for the expansion experiment.

## Narrow v2 additions

V2 preserves every v1 candidate and adds only these exact-bill, named-member committee vote formats:

- procedural motions that place or recommend placing a bill on the General Register;
- official roll-call trigger wording such as `a roll call was taken` and `the clerk noted the roll`;
- named `AYES` / `NAYS` lists that immediately follow an exact-bill procedural motion even when the minutes omit a separate roll-call-request sentence;
- one-sided named vote lists, such as a unanimous `AYES` list, without inventing votes for unlisted members.

The parser still rejects amendments, voice votes, bare `motion prevailed` text without named members, unrelated roll calls, post-cutoff material, source hash mismatches, and unresolved member names. It does not infer the votes of members absent from a named list.

## Frozen lineage

`data/evaluation/historical-deep-expansion-candidate-lineage-v2.json` pins the same immutable inputs as v1:

- outcome-free expansion discovery manifest: workflow run `34727649103`, artifact `10308004770`, SHA-256 `084c5d38b41ef8532e67a076c585fd9e9e36e14babe9c8fc2dbebd20e1313cb0`;
- official expansion source bundle: workflow run `34727446742`, artifact `10307974620`, SHA-256 `6d522eddcb3b6a92b413c9f19e6db189c0412e76760663173f95cf2f220bf1cf`.

The dedicated workflow re-verifies both artifact digests, runs parser v2 offline, rejects any artifact containing floor-outcome fields, and freezes the resulting candidate artifact separately from v1.

## Evaluation order

1. Freeze and inspect the v2 candidate artifact while outcomes remain sealed.
2. If v2 materially broadens named-member evidence coverage without obviously unsafe extraction, pin that artifact by digest in a separate scoring change.
3. Only then join the already-frozen post-discovery outcomes and score directional/conflicting signals.
4. Replay any usable signals through the unchanged production impact policy in another separate step.

No production target-selector or evidence-weight change is justified by parser coverage alone.
