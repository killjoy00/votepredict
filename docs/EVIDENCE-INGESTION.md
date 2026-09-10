# Durable evidence ingestion

VotePredict stores reusable public evidence in the existing `source_documents` and `evidence_items` tables. UI-only constants are not a durable evidence source.

## Rules

1. **Retain source provenance.** Every imported source is fetched or derived from an identified URL and stored with a SHA-256 content hash.
2. **Resolve targets conservatively.** Member and bill targets must resolve uniquely. Ambiguous targets are recorded as unresolved rather than guessed.
3. **Make refreshes idempotent.** Evidence receives a deterministic ingestion key scoped to source content, resolved target, claim, date, and extractor version. Re-running the same import reuses the prior evidence item.
4. **Separate evidence from model effect.** Importing an item does not make it a forecasting feature. New curated and campaign-finance records default to `mechanicallyActionable: false` until a separately evaluated model explicitly uses them.
5. **Treat money as context, not stance.** Campaign receipts and independent expenditures are factual context. They do not imply a legislator's vote position by themselves.
6. **Prefer official facts.** Bill authorship/sponsorship is sourced from the Minnesota Revisor rather than inferred from advocacy material. Organizational letters describe only the organization's documented position.
7. **Preserve pre-vote bills.** An official bill referenced by evidence may be seeded into the canonical `bills` and `bill_versions` tables even if it has not appeared in historical floor-vote ingestion. Its deterministic features are generated at the same time.

## Commands

- `npm run data:cfb:snapshot` builds the normalized Minnesota Campaign Finance and Public Disclosure Board snapshot.
- `npm run data:cfb:evidence -- --snapshot=PATH` maps that snapshot to current memberships and persists campaign-finance context when run in an environment with a routable database connection.
- `npm run data:evidence:bills -- --manifest=PATH` ensures official Revisor bills referenced by an evidence manifest have canonical bill/version records and `deterministic-v2.1` features when run in an environment with a routable database connection.
- `npm run data:evidence:curated -- --manifest=PATH` fetches and hashes each manifest source, resolves targets, and persists evidence when run in an environment with a routable database connection.

## Production execution

Vercel's production database URL uses a Marketplace/internal database alias that is valid inside the deployed application runtime but is not routable from a GitHub-hosted runner. Production evidence refreshes therefore do **not** connect directly from GitHub Actions.

The `Production evidence refresh` workflow follows the same deployed-runtime boundary used by scheduler validation: it deploys protected `main`, privately reads `CRON_SECRET`, then invokes the production-only `POST /api/operations/evidence-refresh` endpoint. The endpoint performs the database work inside Vercel, where the configured Neon connection is valid. The GitHub runner never receives a separately routable database credential and the endpoint rejects unauthenticated requests.

The initial runtime refresh uses the versioned `data/cfb-2025-2026-snapshot.json` campaign-finance snapshot, whose official bulk-download URLs and content hashes are retained in provenance. The first production runtime bridge was added after a GitHub-runner attempt failed on the unroutable database alias before inserting any evidence. A later ingestion phase should refactor the official CFB downloader into reusable application code so production can refresh the snapshot dynamically without relying on a GitHub runner for database access.

Production refresh is intentionally not scheduled on a recurring cadence yet. Before recurring refresh is enabled, evidence supersession/current-version selection should be explicit so changed source content does not appear as duplicate current evidence.

## Initial gambling tranche

`data/evidence/gambling-curated-v1.json` moves the existing priority gambling evidence into the durable store. It contains sourced member statements, official Revisor authorship records, and documented MIGA/SMSC gaming-policy positions. All are inspectable and currently non-mechanical.
