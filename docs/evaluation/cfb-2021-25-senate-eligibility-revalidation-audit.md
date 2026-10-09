# Issue #864: 2021–2025 Senate CFB historical disclosure revalidation — offline tranche

This is a **read-only triage and proof-reconciliation tool**, not a recovered corpus, a new set of eligible features, or a certificate of official completeness. It follows [PR #866](https://github.com/killjoy00/votepredict/pull/866) and the [ordinary-report timing policy](./cfb-ordinary-report-statutory-release-policy.md). No live database is read by the new executable. No Neon, Vercel, cron, source ingestion, migration, frozen evaluation, or serving updates are authorized by this tranche.

## Why another audit is necessary

Before policy v7, filing date plus one day was sometimes used as historical public availability. Minnesota Statutes [§10A.20 subd. 1b](https://www.revisor.mn.gov/statutes/2024/cite/10A.20) keeps an ordinary report nonpublic until **8 AM the day after its due date**, even when received early. When filing is late, the conservative day-only bound also does not precede the day after the recorded filing. Never substitute a transaction, coverage, publication of a later Board agenda, or PDF retrieval timestamp for a filing's independent public-availability proof.

Previously stored `asOfEligible=true` does not become valid merely by merging v7. We must distinguish *what was stored*, *what report the underlying finance row actually appeared in*, *what dates the CFB documented for that exact report*, and *what was publicly available before the target forecast cutoff*. Early filings can be especially dangerous; official year-end deadlines may vary by calendar year, election, filer type and weekends. Do not silently assume January 31 or infer a due date just from a PDF's title.

## Files and precise semantics

- `src/evidence/cfb-historical-release-audit.ts`: pure audit engine. Reviews only 2021, 2022, 2023, 2024 and 2025 **Senate** rows with the three recognized existing source families: `candidate_contribution`, `candidate_expenditure`, and `independent_expenditure`. A historical `campaign_finance_bulk` record is included only when the subtype identifies the exact candidate family. **PAC/party-unit finance is not silently counted as candidate contributions**. Each output year/family has its own independent numerator and missing-proof counts.
- `scripts/audit-cfb-historical-release-offline.ts`: local JSONL-only CLI. No database client, network calls or environment-variable secrets. Validates input format, enforces file/row caps, writes detail only when an explicit output path is supplied, and refuses to overwrite its inputs.
- `scripts/export-cfb-historical-senate-evidence-readonly.sql`: illustrative **SELECT-only** export for the existing `evidence_items` / `source_documents` / `memberships` schema, with a field allowlist that excludes donor names, employer data, full free-text claims and personal addresses. **Do not run against production absent separate access authorization and a verified read-only role.** Its presence is not permission to connect.
- `tests/cfb-historical-release-audit.test.ts`: deterministic synthetic proofs for early/late filings, missing row evidence, invalid regulator hosts/digests, duplicate row identities, separate finance families, date-exclusive as-of and explicit unknown denominators.

## Offline usage

Prepare a JSONL file where **each line** is the JSON object produced by the SELECT template. Example (synthetic, not a real legislator):

```json
{"sourceKind":"campaign_finance_candidate_contribution_bulk","membershipChamber":"senate","publishedAt":"2025-01-29T12:00:00Z","metadata":{"rowKey":"synthetic-row-1","year":"2024","chamber":"senate","filerRegistrationNumber":"19001","transactionDate":"2024-10-25","availableOn":"2025-01-29","filedOn":"2025-01-28","asOfEligible":"true","availabilityPolicyVersion":"mn-cfb-report-availability-v6"}}
```

Run locally on those existing export bytes:

```sh
node --import tsx scripts/audit-cfb-historical-release-offline.ts \
  --evidence /private/input/senate-finance-evidence.jsonl \
  --output /private/review/cfb-2021-25-audit.json
```

The optional `--proofs` input is another local JSONL file. Each entry must **explicitly link one persisted rowKey and its exact finance family to a specific official report** and provide report type, filer registration, period, due date, received date, official HTTPS URL, report-file SHA-256 and **independently inspected row containment proof SHA-256**. Example (synthetic, hash placeholders, **not a valid proof**):

```json
{"rowKey":"synthetic-row-1","family":"candidate_contribution","registrationNumber":"19001","reportId":"19001:2024:YE","reportName":"2024 Year-End","reportType":"ordinary_report","coverageStartOn":"2024-01-01","coverageEndOn":"2024-12-31","filedOn":"2025-01-28","dueOn":"2025-01-31","proofUrl":"https://cfb.mn.gov/rptViewer/Main.php?regnum=19001","reportSha256":"0000000000000000000000000000000000000000000000000000000000000000","exactRowProofSha256":"1111111111111111111111111111111111111111111111111111111111111111"}
```

The hashes above merely illustrate the field shape. A matching URL, row key and syntactically valid digest are **not proof that the real official PDF/bytes were obtained or that it contains the transaction**. An independent source acquisition and row-containment inspection must verify all manifest assertions. The analyzer therefore labels even structurally valid claims **`source_linked_review_candidate`**, *never* automatically `asOfEligible=true`.

Run with a reviewed local proof bundle:

```sh
node --import tsx scripts/audit-cfb-historical-release-offline.ts \
  --evidence /private/input/senate-finance-evidence.jsonl \
  --proofs /private/input/source-linked-row-proofs.jsonl \
  --output /private/review/cfb-2021-25-audit.json
```

## Interpretation of results

- `priorEligibleClaims`: distinct persisted row identities that currently carry `asOfEligible=true`, **not** newly validated eligibility.
- `legacyEligibleRevalidationDebt`: previously claimed eligible rows with missing or pre-v7 release-policy metadata. These **still require review** even if a new source-linked candidate has been found.
- `sourceLinkedReviewCandidates`: distinct rows for which a supplied manifest satisfies strict date, filer, row-specific SHA and official-host checks. Still not independently verified against source bytes by this tool.
- `storedBeforeSourceLinkedBound`: previously eligible dates that precede the later independently **supplied** due-plus-filing bound. Treat as potential early-availability defects requiring source validation, not automatically approved database corrections.
- `rowsMissingRowProof`, `missing_report_due_date`, `missing_report_filing_date`, and `invalid_official_proof_manifest`: explicit reason-coded debt, **not neutral or evidence of no contribution**.
- `conflicting_persisted_copies`: different dates for the same family/year/filer/row key; deliberately unverified, not silently resolved.
- `officialReportDenominator=null` for **every** year/family and `denominator.reconciliationCertified=false` globally. That is intentional: neither a DB export nor ad hoc proof manifests enumerate the regulator's **true full official report inventory**. No missing-official-report count may be derived from a partial archive.

This first tranche audits only the three **existing documented input families** and rejects ambiguous or absent Senate membership attribution. Party units, political committees/funds, PAC contribution sources, notices, source-absent filings and their official inventories need **distinct follow-up**; do not call the three families “all campaign contributions.”

The historical same-day date-exclusive cutoff remains excluded even when the statutory date is correct. The script never consults target votes, calculates stance, modifies the frozen evaluation, imports evidence or mutates stored `published_at`/metadata.

## Next source-to-database completion requirements (not done)

1. Obtain and hash the **true 2021–2025 CFB ordinary-report inventory by filer category, filing year and report identity** using only self-service official sources. Keep absent, unavailable, unparsed and not-enumerated reports distinct. Calendar/deadline sources must be individually tied to each category and year, not estimated.
2. Independently verify received date, due date, legal release floor, later public posting if documented, report URL/hash, and *exact row contained in the report*. Extract source-native identities, not plausible report-title matches. For amendments, prove first publication from the exact earlier source before using its availability.
3. Cross-check distinct row IDs against the read-only export, including candidate contribution/expenditure and independent expenditure, plus separate PAC/party-unit families; annotate persisted v6 early-date risk and missing original rows without imputing zero.
4. Produce an official-denominator reconciliation with verified scope/provenance. Only after **separate** owner authorization, propose and test an idempotent repair of old persisted timestamps and flags with post-write verification. No automatic historical replay or retroactive model eligibility.

No source or database audit was executed as part of authoring this code, so **all real-world 2021–2025 finance completeness counts remain unknown** until authorized inputs have been independently verified.
