# Versioned evidence source catalogs

These files replace source URL arrays previously embedded in live TypeScript. The catalogs are **reviewed, deploy-time source data**, not a production-editable table, ingestion output or permission to change evidence eligibility.

| Data file | Existing consumer/export | Sources |
|---|---|---|
| `local-trade-news-v1.json` | `src/evidence/local-trade-news-history.ts` → `LOCAL_TRADE_NEWS_SEEDS` | 44 local/trade publication prefixes |
| `organization-publication-v1.json` | `src/evidence/organization-publication-history.ts` → `ORGANIZATION_PUBLICATION_SEEDS` | 24 organization publication URLs |
| `source-catalog.schema.json` | `src/evidence/source-catalog.ts` | Common JSON Schema (Draft 2020-12) |

## Editing and validation

Preserve stable IDs and source ordering unless a separate product decision explicitly authorizes changing collection cadence, source eligibility and historical as-of interpretation. The original module version constants (`local-trade-news-history-v3` and `organization-publication-history-v2`) remain unchanged; the catalog file revisions are independent.

Each catalog has `schemaVersion: "source-catalog-v1"`, a fixed `kind`, and an ordered `sources` array. The module imports JSON directly into the Next.js bundle and calls `loadPublicSourceCatalog(...)` **at runtime on module initialization**. The loader applies the checked-in schema's required/allowed fields, types, enums and patterns. It additionally rejects invalid HTTPS URLs, duplicate IDs, duplicate **normalized URLs** (including host-case equivalents), invalid calendar dates, and reversed `from`/`to` windows. The test suite checks **every** catalog JSON file against the schema and checks duplicates both within and across files.

Run:

```sh
node --import tsx --test tests/source-catalogs.test.ts tests/evidence-source-catalog-baseline.test.ts tests/local-trade-news-history.test.ts tests/organization-publication-history.test.ts
npm run typecheck
npm test
npm run build
```

The two complete pre-refactor source arrays were pinned with SHA-256 hashes under `tests/fixtures/evidence-source-catalog-baseline-v1.json`. Those regression hashes intentionally fail if entries, metadata or ordering change. To make an intentional source-policy change in a future PR, review the source update and explicitly update/baseline the fixtures; do not silently regenerate them in this structural PR.

Editing these checked-in JSON files **requires a reviewed code deployment**. The application does not hot-reload a production database list. See [PR 4 notes](../../docs/evidence-source-catalog-externalization.md) for an *optional future* Neon source-catalog table proposal (not implemented, migrated, or populated here).
