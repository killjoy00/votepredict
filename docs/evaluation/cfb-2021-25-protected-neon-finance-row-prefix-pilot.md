# #864 Track B — first protected, bounded read-only finance evidence-row metadata pilot

**Purpose:** Advance from the successful **all-chamber CFB source_document registry** audit to a safe first look at actual persisted `evidence_items` metadata linked to those finance source-document families, without exporting rows, donors, dollar amounts, names, URLs or source document content.

This is an explicitly **capped prefix sampling experiment**, **not** the official filer universe, full stored database census, complete 2021–2025 Senate row count, original PDF–transaction reconciliation, or historical as-of certification. A source registry entry can contain no evidence rows, one row, or many rows, and member links can have ambiguous historical service periods.

## Precisely bounded SELECT

The query in [source](../../scripts/audit-cfb-864-neon-senate-finance-row-pilot.ts) samples the **first at most 64 persisted evidence rows per selected source document**, across **the first at most 500 existing source documents sorted by source family and source ID**. It uses a LATERAL read restricted by `evidence_items.source_document_id`, leveraging the existing source-document index. Later rows in a source document are intentionally **not sampled**, so no numerator from the sample can be divided by or silently substituted for the V5 complete source-document registry aggregate. No evidence is classified as missing from the database because it was not sampled.

Its four recorded finance families are independent: `campaign_finance_candidate_contribution_bulk`, `campaign_finance_candidate_expenditure_bulk`, `campaign_finance_independent_expenditure_bulk`, and legacy `campaign_finance_bulk`. It separates 2021–2025 metadata years from `unknown_or_outside`, and distinguishes real persisted `memberships` / `chambers` Senate links from a `metadata.chamber = senate` hint without a membership. Neither form proves the member actually served on the specific transaction date. No PAC or party finance is silently included in candidate contributions.

The only allowed per-year/source-kind numeric outputs are:

| Field | Meaning in this bounded stored-row sample |
| --- | --- |
| `sampled_evidence_rows` | All sampled finance evidence items across chambers |
| `sampled_source_documents_with_rows` | Sampled source-document IDs contributing a row to this year/family group; not all known source-document IDs |
| `senate_linked_rows` | Rows whose *stored membership link* points to the Senate |
| `senate_metadata_only_rows` | Senate metadata hint without resolvable membership chamber |
| `senate_eligible_claims` | Sampled linked Senate rows with pre-existing `metadata.asOfEligible=true`; **unverified stored claim**, not approved eligibility |
| `senate_eligible_missing_due_on` | Such claims without `reportDueOn`; metadata completeness flag |
| `senate_eligible_missing_disclosed_on` | Such claims without `disclosedOn`; **review candidate**, not proof an exact version was unpublished |
| `senate_eligible_filing_derived_flag` | Such claims with persisted `filingDateDerivedAvailability=true` or `availabilityProofKind=cfb_report_filing`; **review candidate**, not a confirmed leaked row |

Do not infer that a field absent from this query is known to be zero statewide. A zero within this capped sample is only the number observed in the particular bounded sampling window. Existing field names may vary across legacy import versions, so false negatives remain possible.

## Private access, test and publishing safeguards

The workflow [`senate-864-finance-row-readonly-pilot.yml`](../../.github/workflows/senate-864-finance-row-readonly-pilot.yml) is the same **previously authorized VotePredict default-Neon-branch** discovery family as the earlier successfully protected read-only source registry run, but operates with an additional unique single-use main-commit marker. A same-repository PR gets only the **keyless** CI and a **disposable PostgreSQL** migrated-schema `EXPLAIN` of the fixed SELECT. A protected main-only audit requires a matching reviewed squash commit, first run attempt, independent clean migrations, full `npm run check`, dependency audit, and the original protected GitHub environment `evidence-readonly-sandbox`.

The protected job executes only the fixed bounded `SELECT` in a verified PostgreSQL **`REPEATABLE READ READ ONLY`** transaction with required `ROLLBACK`, over an SSL-verified connection. It cannot use GitHub issue-write permission; a separate **keyless** issue publisher accepts only a strictly allowlisted year/family/number record, posts counts or a precisely named HOLD to #864, and explicitly labels those counts as a sample. Any SQL timeout, unsafe shape, missing access or local CI failure is **UNKNOWN / HOLD**, not a zero count. The secret, original evidence item objects, donor fields and private database error messages cannot be published by this design.

The exact-main one-shot marker is `SENATE_864_CFB_ROWS_READONLY_20261011_V1`. It must not be copied into a second unrelated merge title to replay the protected query. No production writes, data corrections, migration to production, evidence backfill, forecast changes, retraining, serving, scheduling, external contacts or 2027 work are performed.

## What an actual run can and cannot change

A successful protected aggregate can identify **which persisted Senate-linked historical finance metadata groups merit more detailed *authorized private* row-to-official-report review**, especially previously eligible claims without independently proven disclosure and report-version metadata. It does not expose private rows or prove that a stored item belongs to the authenticated 2023/24 71-version or 2025 special 12-report PDFs.

For genuine reconciliation, a future audit must securely compare official **exact PDF file SHA and report-version ID**, registration-to-serving-person effective date, report coverage/receipt/due, independently documented exact-version historical public-by, and the contained specific transaction against the persisted private record, while only exporting sanitized discrepancy counts. This step has **not** been completed by the pilot and requires further verified original source row containment.

**#864 remains OPEN.** Do not treat the pilot as an approved change to stored eligibility, production, or scoring.
