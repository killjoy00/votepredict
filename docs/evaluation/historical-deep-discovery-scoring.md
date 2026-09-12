# Historical Deep discovery outcome scoring

This stage scores the already-frozen pre-vote discovery candidate artifact against official historical member outcomes. It is deliberately downstream of extraction so floor outcomes cannot influence source collection, parsing, member resolution, or candidate inclusion.

The scorer is conservative about procedural direction. Re-referral/referral and recommendations to pass are treated as bill-advancing motions. Tabling is treated as bill-impeding. `Lay over` remains ambiguous and is not converted into directional evidence. Conflicting directional observations for one member/case are also excluded from directional scoring.

The workflow pins the exact candidate artifact by GitHub artifact ID and SHA-256, waits for the exact scoring code SHA to be live, freezes an official outcome-only snapshot for the six stable pilot cases, then performs the candidate/outcome comparison offline. The score measures floor agreement, Quick errors covered by directional procedural signals, high-confidence Quick errors, and whether signals occur inside or outside the current Deep target set.

This is an evaluation layer only. It does not change Deep targeting, convert procedural observations into production evidence, alter evidence weights, call live web research, create forecast revisions, or modify served probabilities. A positive result here is evidence that the frozen source class may be useful; it is not authorization to tune the model on the same pilot sample.
