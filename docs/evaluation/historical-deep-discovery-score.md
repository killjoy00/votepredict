# Historical Deep discovery outcome score

## Purpose

The discovery extractor is deliberately outcome-blind. This scoring stage is the first place where the already-frozen pre-vote candidate artifact is joined to the historical floor result.

That separation is the leakage boundary:

1. chamber-wide member identities and Quick state are frozen;
2. official pre-vote source pages are frozen and hashed;
3. deterministic procedural candidates are frozen without floor outcomes;
4. only then does this scorer read the historical floor outcomes to measure whether discovery would have helped.

The candidate artifact is pinned by GitHub Actions artifact ID and digest in `data/evaluation/historical-deep-artifact-lineage-v1.json`. The scoring workflow verifies the digest before download.

## Motion direction

Raw committee AYE/NAY observations are not automatically floor stances. The scorer interprets only motion families with deterministic advancement direction:

- re-referral / referral: motion advances the bill;
- recommendation to pass: motion advances the bill;
- table: motion blocks or delays the bill.

For an advancement motion:

- AYE => inferred support for advancement;
- NAY => inferred opposition to advancement.

For a motion to table:

- AYE => inferred opposition to advancement;
- NAY => inferred support for advancement.

Other motion types remain ambiguous and do not force an inferred outcome.

If the same member has multiple directional observations for the same bill and they imply both support and opposition, the member-case pair is marked mixed and does not generate a forced challenge.

## What is scored

For all six close-vote pilot cases, the production route reconstructs the same leak-safe Quick member forecasts and actual historical member votes. It also recomputes the current production 12-member Deep selection for comparison.

The scorer reports:

- total Quick classification errors;
- high-confidence Quick errors;
- how many error member-case pairs appear anywhere in the frozen discovery candidates;
- how many error pairs have a deterministic directional procedural signal;
- agreement between directional procedural signals and eventual floor votes;
- how often a directional signal **challenges** the Quick classification;
- correct versus wrong challenges;
- challenge precision;
- Quick-error correction recall;
- high-confidence-error correction recall;
- the same correction metrics restricted to errors outside the current 12-person Deep target sets.

A correct challenge means:

1. the pre-vote procedural signal implies the opposite binary outcome from Quick; and
2. that implication matches the later floor vote.

A wrong challenge means the procedural signal contradicts a Quick forecast that ultimately proved correct.

## Artifact contamination guard

Before scoring, the route recursively rejects candidate artifacts containing outcome-like fields such as:

- `actualOutcome`;
- `actualYes` / `actualNay`;
- `passed`;
- `floorOutcome`;
- `resolvedOutcome`.

Every candidate is also rechecked for a publication timestamp strictly before the vote date.

The route resolves the six pilot votes by stable legislative keys and joins candidate members to Quick replay members by legislator ID, so regenerated database UUIDs do not silently invalidate the evaluation.

## Production execution

`.github/workflows/historical-deep-discovery-score.yml`:

1. waits for the exact merged SHA to be READY in Vercel production;
2. verifies the pinned frozen candidate artifact digest;
3. downloads that exact candidate artifact;
4. reads the production operation secret privately;
5. posts only the frozen candidate JSON to the protected scoring route;
6. lets the production runtime reconstruct Quick and join outcomes;
7. uploads the resulting score artifact for 30 days.

## Guardrails

This stage is evaluation-only:

- no live research;
- no source refetch;
- no candidate re-extraction;
- no database writes;
- no probability changes;
- no production target changes;
- no evidence-weight changes.

The score determines whether the frozen procedural discovery signals are precise enough to convert into validated archive evidence packets. Evidence application remains a later, separately tested workstream.