# Historical Deep procedural mechanics taxonomy v1

This is an evaluation-only, outcome-blind taxonomy over the already-frozen parser-v2 Minnesota House committee roll-call observations. It separates **what a committee motion mechanically does in the legislative process** from any inference about a member's later final-passage floor vote.

It does not change the production Deep classifier, target selector, evidence weights, Quick probabilities, Deep probabilities, or serving behavior. Every taxonomy observation is emitted with `mechanicallyActionable: false`, `finalPassageInference: none`, and artifact-level `probabilityAction: none`.

## Why this is necessary

The frozen parser-v2 development replay showed that broadening archive extraction is feasible, but treating every procedurally favorable committee vote as evidence of later final-passage support is not reliable enough. The next question is therefore semantic rather than statistical: distinguish committee recommendation, floor-eligibility advancement, continued committee routing, impediment, and deferral before attempting another predictive mapping.

The taxonomy is intentionally defined without consulting the frozen floor outcomes. Its sole runtime input is the immutable outcome-free parser-v2 candidate artifact.

## Institutional basis

The categories are grounded in Minnesota House procedure rather than development-set accuracy:

- [House Rule 1.20 — General Register](https://www.house.mn.gov/cco/rules/permrule/120.htm) says a bill must be on the General Register before it may be considered on the Calendar for the Day or Fiscal Calendar. A motion placing or recommending placement on the General Register is therefore classified as `advances_toward_floor_eligibility`; it is **not** labeled final-passage support.
- [The House rules adopted in the 2021–22 session](https://www.house.mn.gov/cco/journals/2021-22/J0107002.htm) contain the same General Register structure. They also show that bills may be referred or re-referred before passage and that some committee referrals are mandatory because of subject-matter or fiscal jurisdiction.
- [Current House Rule 4.13](https://www.house.mn.gov/cco/rules/permrule/413.htm) likewise requires re-referral of some bills to a jurisdictional committee. For that reason, `referred` and `re-referred` are classified as `continues_committee_review`, not as a direct endorsement of final passage.

These rules establish process mechanics only. They do not establish a calibrated relationship between any committee vote and a later floor vote.

## Observation mechanics

A single motion can contain more than one mechanic, so this is a multi-label taxonomy:

- `committee_recommends_passage`: the motion explicitly says the bill is recommended to pass;
- `advances_toward_floor_eligibility`: the motion places or recommends placing the bill on the General Register;
- `continues_committee_review`: the motion refers or re-refers the bill to another committee;
- `impedes_current_bill_progress`: the motion tables the bill;
- `defers_current_bill_action`: the motion lays the bill over.

For example, `recommended to pass and re-referred to Ways and Means` receives both `committee_recommends_passage` and `continues_committee_review`. The taxonomy does not collapse that mixed procedural state into a yes/no forecast signal.

`voteRelationToMotion` has only the literal meaning of the recorded roll call: an AYE supports the committee motion and a NAY opposes it. It is not relabeled as support/opposition to final passage.

## Immutable boundary

`data/evaluation/historical-deep-procedural-mechanics-lineage-v1.json` pins the canonical guarded parser-v2 candidate artifact:

- main workflow run `34731281176`;
- artifact `10308234950`;
- SHA-256 `41ca3d40144d6b125d618b32577d017d9b9c6c49405da40aaec478c8415274fd`.

The dedicated workflow verifies that digest, verifies the input has no outcome fields, classifies the 212 frozen observations entirely offline, and rejects any output that becomes mechanically actionable, adds a final-passage inference, or contains floor outcomes.

## What comes next

This taxonomy is meant to be frozen before another predictive experiment. A later, separate evaluation may test whether one or more predeclared mechanics have stable predictive value for final passage. That later step must not silently convert `continues_committee_review` or `advances_toward_floor_eligibility` into a probability change merely because they look favorable procedurally.

The production classifier remains unchanged unless a separately frozen evaluation supports a specific mapping.
