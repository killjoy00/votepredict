# Evidence source catalogs — PR 4 structural externalization

## Scope and fixed baseline

The live local/trade and organization publication modules contained 44 and 24 ordered source objects respectively. PR 4 extracts **exactly those 68 original objects**, unchanged, into versioned JSON at `data/sources/local-trade-news-v1.json` and `data/sources/organization-publication-v1.json`, with `data/sources/source-catalog.schema.json` as their checked-in JSON Schema.

`src/evidence/local-trade-news-history.ts` and `src/evidence/organization-publication-history.ts` now import this data and validate it on module initialization using `src/evidence/source-catalog.ts`. The exports and TypeScript seed interfaces stay the same. The current local/trade and organization module version constants stay `local-trade-news-history-v3` and `organization-publication-history-v2`. No caller imports change.

The actual ordered source arrays were hashed *before the refactor* and pinned to a separate test fixture:

- local/trade: 44 records, SHA-256 `86dd2d7aac66c31fa379a5db6f6179fe907681aa314dfcc30cf89d522334ebad`.
- organization: 24 records, SHA-256 `6f643dd5b0677f78ecaecfaa08a64d62c4574335130504a4813ee7c51fdf9aa8`.

The tests also retain the existing rotation/targeted-retry behavior and check that the current exported objects deeply match their source JSON. No original URLs, seeds, from/to dates, publisher types, ordering, path hints, selection windows or ingestion behavior were modified.

## Runtime and regression protection

The loader reads the checked-in JSON Schema at runtime via a static bundler import (no added package dependency). The schema defines the two catalog shapes, accepted enum values, required/optional seed fields and exact additional-property restrictions. Runtime checks supplement it with real YYYYMMDD calendar validation, ascending windows, strictly HTTPS URL parsing and unique IDs and normalized URL strings. It throws rather than silently ignoring bad catalog entries.

`tests/source-catalogs.test.ts` enumerates **every** versioned JSON file under `data/sources/`, checks the schema and exact exported seed records, and rejects duplicate normalized URLs within or between catalogs. It also tests missing or unknown fields, bad publication categories, invalid calendar days/windows, wrong prefixes, insecure URLs and schema mismatches. `tests/evidence-source-catalog-baseline.test.ts` validates all original array bytes by comparing SHA-256 of `JSON.stringify(seeds)` against pre-refactor fixtures. No database, network or production writes are required to run these tests.

The filenames' catalog `-v1` is separate from each module's original evidence-processing version; changing the file version does not imply changing historical source admissibility. These JSON files must be reviewed/deployed with the application. This PR does not introduce hot reload.

## Optional future editable-without-deployment sources table (proposal only)

If operators later require updates without deploying the app, a **separate, reviewed migration** could create a versioned `public.evidence_source_catalogs` table with columns roughly:

- `id TEXT` primary key, `family TEXT NOT NULL`, `catalog_revision INTEGER NOT NULL`, `url TEXT NOT NULL`, `metadata JSONB NOT NULL`, `active BOOLEAN NOT NULL DEFAULT TRUE`.
- `valid_from DATE` and `valid_to DATE` for the catalog's source-collection window (not source-original publication or archive capture time).
- `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`, `created_by TEXT` and a reviewed change-approval field, with a unique index on `(family, lower(url))` (plus application-level canonical URL duplicate checks).
- Source-specific metadata such as publisher, sector, publication kind, prefix flag and path hints, constrained by the same schema. A separate append-only revisions table could retain prior versions and attribution for reproducibility.

A future implementation would need explicit role-scoped read/write privileges, an approval/review flow, fail-closed catalog validation, as-of snapshots and deployment-safe fallback semantics. **This PR does not add a SQL migration file, create this table, change Neon permissions, perform a backfill, or query/write a production database.**

## Deliberate non-changes

- No files under `src/forecasting/`, model/training/evaluation outputs, historical evidence-eligibility rules, or `data/evaluation/` are touched.
- No source URL, publication-date interpretation, fetch order, batching/rotating cursor, source policy, ingestion outputs or protected GitHub Actions behavior are changed.
- No unrelated historical hard-coded research-specific list is moved in this PR. Those remain governed by PR 1's live reachability and protected workflow rules; extracting them safely would require their own complete caller/fixture analysis.
- No production database writes or migrations are run.

PR validation requires `npm run typecheck`, `npm test`, `npm run build`, and the protected-branch required GitHub `verify` check.
