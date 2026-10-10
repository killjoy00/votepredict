# Runbook — private 2021–2025 Senate media source export

**Track D of #864.** This runbook is for a **separately approved, strictly SELECT-only** VotePredict database role. No production database writes, GitHub Actions artifact uploads, Neon branch changes or schedulers. It extracts the existing historical media **context** rows and Senate roster; it does **not** certify real senator quotations.

## Prerequisites and access gate

- Confirm a connection to the **VotePredict** production database (must contain source_documents, evidence_items, memberships, legislators, chambers and legislative_sessions). A connection to an unrelated Neon database must fail closed.
- Obtain a restricted SELECT-only role through an authorized database administrator/provisioning route. This runbook does not create/grant a role, alter credentials or request a general owner connection.
- The role must have SELECT on those six source tables, no INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER privileges on **any public relation**, no CREATE on database/public schema and no elevated Postgres role flags. All missing/inherited write privileges are checked. Even when the session is READ ONLY, an admin/owner role is refused.
- Install Node.js 22, dependencies (`npm ci` from the repo root), and PostgreSQL `psql` client. Use an actual private terminal on a trusted machine rather than a public CI runner.

## Single local export command

From the checked-out VotePredict repository:

```bash
read -r -s -p 'Restricted SELECT-only Postgres URL: ' VOTEPREDICT_MEDIA_READONLY_DATABASE_URL
printf '\n'
export VOTEPREDICT_MEDIA_READONLY_DATABASE_URL
node --import tsx scripts/export-senate-media-readonly.ts --output-dir "$HOME/votepredict-media-private-2021-25"
unset VOTEPREDICT_MEDIA_READONLY_DATABASE_URL
```

The URL is never placed in command arguments, written to GitHub or echoed to stdout. The runner uses TLS (`sslmode=require`), read-only session options and a separate role/tables preflight. It then runs both checked-in SELECTs in **one REPEATABLE READ READ ONLY transaction**, keeping a consistent historical export snapshot. It rejects malformed, unexpected, duplicate and partial JSONL before writing anything.

The output directory must be **new, absolute and outside the Git checkout**. All files are local, user-private mode 0600; the directory is mode 0700. Do not commit, attach to a public issue or upload these files to a workflow artifact.

Generated files:

- `media-context.jsonl`: each archived local/trade news context identity, source content hash, publisher, archive URL/capture timestamp, recorded mentioned-members discovery leads and metadata; **no original full article body**.
- `senate-roster.jsonl`: Senate membership/year identity and active date bounds for 2021–2025.
- `media-discovery-audit.json`: offline source/year and senator/year coverage, invalid provenance and explicit missingness; without original snapshots and human reviews, zero verified quotations is **not zero real-world remarks**.
- `manifest.json`: timestamp, file checksums/counts, split between 2021–2025 and out-of-scope 2026, and a no-completeness-certificate flag.

## What should be checked next

1. Confirm context exported count, unique sources and independent 2025 versus 2026 distribution. The earlier **948 context items** included 2025–26 combined; it is *not* a 2021–25 target-year denominator. New counts may differ following repairs or new ingestion.
2. Confirm the roster has real membership/year bounds; null term dates remain unknown and block attribution instead of silently treating a named person as serving.
3. Acquire source-specific original Wayback HTML bytes **whose SHA-256 exactly matches** the `source_documents` hash; the metadata export alone does not contain article bodies.
4. Perform source-by-source named-speaker/issue/quote human review; run `scripts/audit-senate-media-remarks-offline.ts` with private `--reviews` and `--snapshots` only when those independent proofs are available.
5. Report by senator/year and publisher/year verified items, ambiguous speakers, unavailable sources and source-to-database mismatches. Do not promote into forecasts or claim statewide media completeness. Keep #864 open.

## Limits and troubleshooting

- A direct ChatGPT Neon database connection that only exposes another project is **not** permission to query VotePredict. The operator must supply a VotePredict restricted role (never post its URL in chat). The runner refuses a wrong schema.
- If an export fails: the runner does not print underlying psql error messages, URLs or article text. Check read-only grants and network locally.
- The helper does not grant or create roles and never obtains credentials from Vercel or the GitHub Secrets store. A README, SQL template, or successful synthetic CI test does not mean live production data was exported.
- The deliberate historical cutoff here is archive **capture year 2021–2025**, with 2026 retained separately as excluded context. Actual article **publisher year** and **public-by** are distinct and remain unresolved until each original source is inspected.

Relevant code: `scripts/export-senate-media-readonly.ts`, `src/evidence/senate-media-readonly-export.ts`, both `scripts/export-senate-media-*-readonly.sql` templates, and `tests/senate-media-readonly-export.test.ts`.
