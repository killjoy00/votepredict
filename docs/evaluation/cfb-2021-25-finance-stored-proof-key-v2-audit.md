# #864 Track B — CFB persisted policy-version and proof-key metadata V2 audit

**Status: bounded, one-shot, read-only evidence-item metadata triage; NOT historical disclosure certification, a distinct finance transaction census, legal filing-obligation denominator, stored repair, or serving change.**

## Question

The first protected [2021–25 Senate finance prefix audit](cfb-2021-25-finance-stored-eligibility-v8-revalidation-checkpoint.md) counted 4,598 persisted Senate-linked eligibility claims in a bounded sample; all lacked metadata fields with the exact names `reportDueOn` and `disclosedOn`. Those missing-field counts do **not** establish that the underlying transactions were improperly dated or that other versions of a report were never historically available. Older imports may store dates as `dueOn`, `availableOn`, and `evidence_items.published_at` or use a prior `availabilityPolicyVersion`. V2 is designed to resolve only **which metadata key families and labelled policy generations occur in the same sample**, not whether any field represents independently validated historical public-by proof.

## Deterministic sample and grouping

The one fixed SQL SELECT chooses the **first 500** `source_documents` sorted by `source_kind,id` from four fixed campaign-finance source families, and the first **64** `evidence_items` sorted by `created_at,id` **per selected document**. The candidate selection across *all chambers* occurs **before** filtering to persisted `memberships → chambers.slug = senate`; the V2 subset follows V1's exact **selection rule**, but a changed database inventory between protected runs could change which source/row IDs are selected. Equal aggregate totals do not independently prove the two selected private ID cohorts were identical. It does not sample later records, extra source documents, unlinked metadata-only Senate hints, or independent source-confirmed Senate service dates.

All emitted groups are defined by a **fixed** source-family enum, `metadata.year` (only 2021–2025 or `unknown_or_outside`), and these static policy buckets:

| Bucket | Meaning |
| --- | --- |
| `v8` | Exact stored `mn-cfb-report-availability-v8` label |
| `v7` | Exact stored `mn-cfb-report-availability-v7` label |
| `v1_to_v6` | Exact known `mn-cfb-report-availability-v1` through `v6` labels |
| `missing` | Missing or empty `availabilityPolicyVersion` |
| `other_or_unrecognized` | Any other nonempty label, **without exporting the raw value** |

The SQL counts Senate-linked sampled items and the subset with `metadata.asOfEligible=true`. Only inside that eligible subset does it count field/key presence: `published_at`, `metadata.availableOn`, overlap and date disagreement, no timing field, `reportDueOn`, older `dueOn`, `filedOn`, `disclosedOn`, filing-derived flags/proof labels, `cfb_public_disclosure` label, selected report-ID/name fields, proof URL/hash fields and `rowKey` presence.

**Interpretation guardrails:** `published_at` is not automatically a contemporaneous publication capture; `availableOn` may be a legal not-before floor; a present report locator, proof hash or URL is not automatically an authenticated contemporaneous *exact-version* PDF or row match; a `cfb_public_disclosure` label needs original verification. The mismatch check compares the first 10 characters of `metadata.availableOn` with stored `published_at::date`: this is only a triage signal, not a statutory release violation or proven bug. Counts may include multiple persisted evidence copies of one transaction. A missing field by one name may coexist with valid alternate metadata or missing information elsewhere.

## Audited execution controls

- `scripts/audit-cfb-864-neon-finance-proof-metadata-v2.ts`: a fixed SQL string, no CLI SQL arguments; existing approved Neon default-branch discovery; verified database/role/read-only session, `REPEATABLE READ READ ONLY`, mandatory `ROLLBACK`, one pool connection and a 500 × 64 source prefix. No private value rows, people, donor names, amounts, URLs, source IDs or raw policy strings are selected into the returned output.
- `scripts/verify-cfb-864-neon-finance-proof-metadata-v2-local.ts`: keyless disposable local PostgreSQL schema `EXPLAIN` only, with host/port/database and event checks.
- `tests/cfb-864-neon-finance-proof-metadata-v2.test.ts`: synthetic source/API/db mocks, strict positive-only integer subsets, rejection of unrecognized group labels and arbitrary columns, identity guard and rollback tests, protected-workflow privacy assertions.
- `.github/workflows/senate-864-finance-proof-metadata-v2.yml`: same-repo keyless PR verification; independently complete main-only `npm run check`, schema verification and high-severity audit; unique `SENATE_864_CFB_KEYS_READONLY_20261012_V2` **first-attempt** merged-main commit marker; protected `evidence-readonly-sandbox` read-only step; separate keyless, fixed-shape validating issue #864 reporter. No scheduler, artifact row export or database write.
- Reporter may publish **allowlisted count-only** aggregates. If pre-secret validation fails, the protected query does not run; if the read-only query fails, no speculative zero-row statistics are published.

## Required separate work after V2

1. Compare V1 and V2 counts under the **same deterministic capped source-prefix selection rule and persisted Senate membership-link filter**, noting that this does not freeze exact private source/row IDs between run dates. If keys are present under other names, investigate provenance individually in a separately authorized privacy-preserving source-to-record reconciliation.
2. Independently enumerate each actual-serving 2021–25 senator's CFB registration/effective-period filing obligations from official records before claiming any true report denominator.
3. Independently authenticate contemporaneous *exact original/amended report version public-by date* **and** transaction identity/row containment for the stored data. The 2023–24 71-version, 2025 special 12-report and old 51-request cohorts are not official denominators.
4. Keep every previously stored v7-or-earlier eligibility claim unapproved pending separate validation. A later eligibility repair, prior-cycle reader policy change or any serving, forecasting or database mutation requires **separate owner authorization**.

Parent [#864](https://github.com/killjoy00/votepredict/issues/864) remains OPEN. No 2027 work, no production data writes, deployment, retraining, scheduler reactivation or outreach.


## One-shot owner-comment fallback if the merged push does not emit a run

The original V2 code-only PR [#1218](https://github.com/killjoy00/votepredict/pull/1218) was merged after green PR checks at `9879583b6f78969dd0164fc06ac1b4120a507e80`, but the push-triggered protected workflow was not registered by GitHub Actions when this fallback was designed. This does **not** establish that the Neon source audit executed. GitHub can suppress follow-on events emitted through certain automation tokens.

The separately reviewed fallback adds `issue_comment: created` only as an alternate *one-shot request*; it is not a scheduler or open-ended API endpoint. Its full protected pipeline is gated on all of: repository `killjoy00/votepredict`, issue **#864**, trusted GitHub comment user `killjoy00` with `OWNER` association, the **entire exact comment body** `SENATE_864_CFB_KEYS_V2_OWNER_ONE_SHOT_20261012`, `refs/heads/main`, first run attempt, independently checked-out main SHA, the reviewed unique V2 marker in the **checked-out latest main commit**, clean disposable local migrations/SQL EXPLAIN, full repository check and dependency audit. Only then can the `evidence-readonly-sandbox` job get the existing Neon key and execute the unchanged fixed count-only SQL in a read-only transaction with `ROLLBACK`.

Use this route only if the original merged-main push run has not executed. If unrelated work advanced main so the V2 commit marker is missing, the owner-comment gate MUST fail closed rather than read under an unreviewed commit. The keyless issue publisher is likewise restricted to this exact trusted trigger, and any HELD receipt is not evidence of zero stored rows. No amount of comment text enters SQL, database connection parameters or aggregate output. Keep #864 open.
