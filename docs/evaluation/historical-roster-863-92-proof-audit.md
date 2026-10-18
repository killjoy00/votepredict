# #863: Frozen Evidence Quality v1.8 92-row historical-publication proof audit

Tracking: [#863](https://github.com/killjoy00/votepredict/issues/863), evidence substrate [#718](https://github.com/killjoy00/votepredict/issues/718) (**remains paused**).

**Scope:** Reclassify the *already frozen* 92 historical nonzero directional member-event feature rows by what their original captured-source provenance proves. This audit has no read or write access to production Neon, no outcome or model-weight interpretation, and no source discovery or historic reannotation.

## Original immutable evidence

Replays all of these original pinned [Actions artifacts](https://github.com/killjoy00/votepredict/actions):
- v1.8 feature matrix and manifest, **11494634289**, canonical raw SHA `2d4ed4993fd7efce5a0c7de2a4331f1f3a0f163e323f437c6f9e7dacf266a30b`.
- v1.5 exact-feature signal observations, **11380755983**.
- Evidence-item-granular Wayback byte/capture matching audit, **11315632754** (canonical underlying Wayback proof **11316021651**); archive evidence applies to the **specific matched excerpt only**, not the whole later-captured page.
- 2025 House strict claim/official-version pre-vote integration-readiness, **11493988951**.
- Four previously reviewed original P2 applicability records, **11436288880**.

The attached replay independently verifies the exact immutable SHA-256 of every input and every member-event key; it creates a **new audit ledger only** without rewriting the feature matrix, changing 135,457 target rows, or contacting production.

## Time-proof distinctions

The 92 rows contain 38 exact-bill directional features and 54 separately reviewed member/issue-applicability features. Among the 38 exact-bill rows, **19** map to independently authenticated pre-vote archive **excerpt** capture bytes and **19** have only pre-vote publisher/source dates without matching independent archive byte proof. Among the 54 reviewed rows, **52** retain upstream pre-vote claim availability metadata; the earliest two P2 rows' upstream historical claim availability provenance is not supplied in the currently pinned four-row P2 reviewed artifact.

**Crucially**, all 54 reviewed-applicability rows retain a valid, strict pre-vote *official Revisor bill-version posting* date and text fingerprint. That does **not** establish when the member's statement was first public. Dated Revisor bill text and a member quotation are different source objects.

The frozen historical feature ledger, grouped by member-statement publication proof:

| Proof tier | Rows | Interpretation |
| --- | ---: | --- |
| Authenticated pre-vote exact archived excerpt | 19 | Matching relevant text and actual archived observation time, **not** whole original-source byte proof |
| Pre-vote publisher/source metadata only | 71 | Date is asserted by source or recorded in upstream review, not independently established first-public timestamp |
| Insufficient publication metadata in the recovered canonical records | 2 | Do not treat as historically public without independent original claim-timestamp evidence |

This is **not** a new acceptance of 19 claims for serving, not a reversal of previous human policy determinations, not a finding that the other 73 claims were unavailable, and not license to backfill original historical availability using October 2026 crawls.

## Regenerating the exact row-level report

The reviewed-main GitHub workflow `.github/workflows/historical-roster-863-frozen-92-proof.yml` automatically downloads only the five fixed artifact IDs above, verifies original file bytes, runs `research/scripts/audit-863-frozen-directional-proof.ts`, and retains a complete per-row JSON/TSV ledger. The replay fails closed if a row, target key, cutoff, vector type, pinned SHA or proof cardinality differs. It never reads votes or scores outcomes and has no protected database secrets.

Downstream use of this diagnostic must keep all three tiers distinct from *model as-of eligibility*. No publication-tier inference can mutate immutable v1.8 features or prior prediction archives. Broad #718 historical archive recovery and Vercel remain unchanged.
