# Historical Deep House Journal mechanics score v1

This stage is a **post-freeze development diagnostic** over the outcome-blind House Journal mechanics taxonomy frozen by PR #171. It is deliberately separate from extraction and from production forecasting.

The question is narrow: **when a previously frozen bill-level House Journal mechanic is present before the selected House floor vote, how does the already-frozen Quick member forecast behave against the already-existing decisive member outcomes?**

This stage does not make a mechanic actionable, assign an evidence weight, choose Deep targets, or move any production probability.

## Frozen inputs

All three inputs were created before this scoring lineage and are verified by exact GitHub Actions artifact SHA-256 before use.

### Outcome-blind Quick discovery manifest

- schema: `historical-deep-expansion-discovery-manifest-v1`
- workflow run: `34727649103`
- artifact: `10308004770`
- head SHA: `03463b728ed30540c8a840f214d56ccd70578b6f`
- artifact SHA-256: `084c5d38b41ef8532e67a076c585fd9e9e36e14babe9c8fc2dbebd20e1313cb0`
- 24 frozen cases
- 3,216 member-case Quick probabilities
- no outcomes in the manifest

### Frozen House Journal mechanics

- schema: `historical-deep-house-journal-mechanics-v1`
- parser: `deterministic-house-journal-mechanics-v1`
- workflow run: `34778905021`
- artifact: `10324485900`
- head SHA: `c3de5f8e06e411b661ab3cda7e92b174005c0d2c`
- artifact SHA-256: `b65eff9cbc1302906c5131b8d41222df9b161e34c55bbfeaeb12ade2a07d1de6`
- 107 outcome-blind mechanic observations across all 24 cases
- every observation remains `mechanicallyActionable: false`
- every observation remains `finalPassageInference: "none"`

### Preexisting development outcomes

- schema: `historical-deep-expansion-outcome-snapshot-v1`
- workflow run: `34728183585`
- artifact: `10308981046`
- head SHA: `39980f44b4d0d36270358ef9646f4e5d77330c2a`
- artifact SHA-256: `0487cbf826c1fe1dcbaf887b2850a94914aa9e8a6fdddcfff73483ef87c92471`
- 24 cases
- 3,133 decisive member outcomes
- origin candidate artifact: `10308141732`
- origin candidate SHA-256: `c752a3885921d086609b11e815cb7e122ba36a8521cb4d091c6c54aac8cdd4eb`

The workflow has no database access, no live Deep calls, and no new source discovery.

## Important cohort limitation

All 24 selected development floor events ultimately passed by YEA majority. That means this cohort cannot estimate whether a House Journal mechanic distinguishes bills that pass from bills that fail.

The unit of useful outcome variation here is instead the **member vote**. For each case the scorer joins the frozen Quick probability for every member with a decisive YEA/NAY outcome, then evaluates Quick conditional on the bill-level mechanics that had already been observed before that vote.

This distinction matters. A mechanic such as Calendar placement or reaching the final-passage stage is a state of the bill, not a member-specific voting signal. The score artifact therefore must not be read as saying that the mechanic independently caused or predicted any individual member's vote.

## Metrics

For each mechanic the artifact reports the cases with that mechanic and the cases without it.

### Member-weighted signed residual

`actual YEA share - mean frozen Quick P(YEA)`

- positive: Quick underpredicted the chamber's eventual YEA share in that stratum;
- negative: Quick overpredicted it;
- near zero: Quick's average YEA probability was close to the eventual YEA share.

This is weighted by decisive member observations, so larger decisive chambers contribute more observations.

### Equal-case residuals

The artifact also computes each case's YEA share minus its mean Quick probability, then averages across cases. It reports the mean signed residual, mean absolute residual, and counts of positive/negative/zero-residual cases.

This prevents a mechanic's apparent pattern from being summarized only through member weighting.

### Quick score slices

Within every stratum the artifact reports Quick's Brier score, log loss, and classification accuracy. These remain **Quick forecast metrics**. They are not scores for the Journal mechanic itself.

### With/without contrasts

The artifact subtracts the no-mechanic slice from the mechanic-present slice for residuals and Quick metrics. These contrasts are descriptive only.

House Journal mechanics overlap heavily in the same bills, and the 24 cases were not randomized across mechanics. A with/without contrast is therefore not an independent effect estimate and must not be interpreted causally.

### Co-occurrence

All 78 pairwise combinations of the 13 mechanics include case counts and Jaccard overlap. This makes obvious when two apparent signals are effectively describing the same subset of bills.

### Recency

For each mechanic/case pair the scorer uses the last frozen observation date before the selected floor vote and reports the minimum, median, mean, and maximum days-before-vote across the mechanic's cases.

Recency is descriptive context only in v1; there is no fitted decay, threshold, or weight.

## Initial development patterns to verify

An offline prototype over the exact frozen inputs produced several patterns worth preserving for formal scoring, but they are hypotheses rather than actionability rules:

- `reaches_final_passage_stage`: 5 cases; member-weighted signed residual roughly **+0.066**, meaning Quick underpredicted YEA share by about 6.6 percentage points in those cases.
- `laid_on_table`: 2 cases; member-weighted signed residual roughly **-0.220**, meaning Quick overpredicted YEA share by about 22 percentage points in that tiny slice.
- `companion_substitution`: 5 cases; residual roughly **+0.038**.
- `calendar_designation`: 7 cases; residual roughly **-0.083**.
- `author_added`: 7 cases; residual roughly **+0.061**.

The `author_added` result is itself a useful warning: an administrative mechanic can correlate with a residual pattern in a small, overlapping development cohort. That is why this score cannot directly become an evidence weight.

The exact workflow artifact, not these rounded prototype values, is the authoritative result.

## Guardrails

The score artifact is hard-coded with:

- `outcomeUse: "post-mechanics-freeze-development-scoring-only"`
- `probabilityAction: "none"`
- `actionabilityDecision: "none"`
- `mechanicallyActionableObservations: 0`
- `finalPassageInferenceObservations: 0`

The workflow also re-verifies that the mechanics input itself contains no actionable observations and no final-passage inference.

## What this can establish

This stage can establish whether some previously frozen Journal states are associated with systematic Quick over- or underprediction of **member YEA share** in this 24-case development cohort, and whether the pattern is consistent across cases or mainly driven by overlap and small samples.

It cannot establish that a mechanic:

- predicts bill passage versus failure;
- is causal;
- independently explains the residual after controlling for other mechanics;
- should alter a member forecast;
- should change a Deep evidence weight;
- should be mechanically actionable; or
- improves production Quick or Deep out of sample.

## Appropriate next validation

If one or two mechanics survive this development diagnostic with a coherent direction, enough distinct cases, and acceptable overlap, the next scientific step is a **predeclared out-of-cohort or time-split validation** using the same source and extraction rules.

That validation should include failed floor bills if they can be selected outcome-blind, because the current all-passage cohort cannot answer the bill-level passage-discrimination question. No source, case, or hypothesis should be selected because of its observed outcome.

Only after independent validation should a separate workstream even consider an actionability rule or evidence-weight experiment.