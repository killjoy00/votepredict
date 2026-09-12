# Frozen historical Deep discovery extractor

## Purpose

This workstream is the first deterministic extraction stage after chamber-wide discovery and source freezing. It answers a narrow question:

> Did the frozen pre-vote official record contain an explicit bill-level committee procedural vote by a member in the historical active chamber roster?

It does **not** yet infer final floor-vote intent, apply evidence to probabilities, or call a research model.

## Immutable upstream lineage

`data/evaluation/historical-deep-artifact-lineage-v1.json` pins the exact GitHub Actions artifacts used as input:

- the chamber-wide historical discovery manifest;
- the frozen official source bundle.

The extraction workflow verifies the GitHub artifact digest for each pinned artifact before download. The extractor then recomputes every frozen source's SHA-256 from the stored HTML bytes and fails if any source no longer matches the hash recorded in the source bundle.

No live web request is made during candidate extraction.

## High-precision extraction scope

Version 1 deliberately extracts only explicit **bill-level procedural committee roll calls** from the frozen Minnesota House committee records.

Accepted motion families include:

- re-referral or referral of the bill;
- recommendation to pass;
- laying the bill over;
- tabling the bill.

The parser requires an explicit member request for a roll call and a nearby bill-level motion that names the pilot bill. It then records the raw AYE/NAY side, exact motion text, bounded excerpt, source identity, publication timestamp, and source hash.

### Amendment votes are excluded

Amendment roll calls are intentionally ignored in this version. An AYE or NAY on an amendment cannot safely be translated into support or opposition to final passage without understanding amendment direction and strategic context.

### Procedural vote side is not final bill stance

The candidate artifact preserves the raw procedural side instead of pretending every NAY means opposition to the bill.

For example:

- AYE on a motion to recommend a bill to pass generally advances the bill.
- NAY on a motion to table a bill may also favor continued advancement.

Motion-direction classification belongs in a separate deterministic scoring/conversion stage with explicit tests. The extractor itself remains a provenance-preserving observation layer.

## Member identity resolution

Committee vote records do not always use the same name format as the chamber roster. The extractor resolves identities conservatively:

1. `LAST, First` records are matched by normalized first/last tokens.
2. A last-name-only vote line resolves only when that surname is unique in the active chamber roster **or** the same frozen committee page contains a unique explicit roster identity such as `NELSON, Michael, Chair`.
3. If a surname remains ambiguous, the vote is skipped and recorded as a diagnostic.

The page-local rule is important for the HF2 Labor record: both Michael Nelson and Nathan Nelson are active chamber members, but the committee page itself identifies `NELSON, Michael, Chair`, allowing its later shorthand `NELSON` roll calls to be resolved without guessing.

Unresolvable names remain excluded. The extractor never fabricates a member match to improve coverage.

## Outcome blindness

The frozen discovery artifact contains Quick probabilities/support metadata and active member identities, but no actual member vote outcomes. The source bundle contains only pre-vote official records.

Candidate extraction therefore cannot use the floor result being evaluated.

The candidate artifact intentionally contains no `actualOutcome` or chamber `passed` field. Historical outcomes may be joined **after this artifact is frozen** in a separate scoring step.

## Why this matters

The prior target audit showed the current 12-person Deep selector misses most Quick errors. The chamber-wide discovery layer creates 804 member-case opportunities across the six pilot votes.

The first frozen-source dry run already reveals a useful example: the April 9, 2024 State and Local Government committee record contains Rick Hansen's NAY on the final HF3276 re-referral motion, weeks before the May 19 floor vote. Quick assigned Hansen a 99.5% YES probability, and the current Deep selector did not choose him for research.

That is the kind of pre-vote signal the discovery stage is designed to surface without using post-vote information.

## Workflow output

`.github/workflows/historical-deep-discovery-extraction.yml`:

1. verifies the pinned upstream artifact digests;
2. downloads the exact frozen discovery/source artifacts;
3. reruns source-content SHA-256 validation;
4. extracts deterministic bill-level procedural candidates;
5. uploads `historical-deep-discovery-candidates-<sha>` for 30 days.

## Guardrails

This stage performs:

- no web research;
- no database reads or writes;
- no LLM inference;
- no amendment-position inference;
- no production targeting changes;
- no probability changes;
- no evidence-weight changes.

The next step is a separate outcome scorer that joins the already-frozen candidate artifact to historical outcomes, measures discovery recall/error coverage, and deterministically interprets procedural motion direction before any candidate is converted into replay evidence.