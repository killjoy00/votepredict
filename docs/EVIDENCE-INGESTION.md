# Durable evidence ingestion

VotePredict stores reusable public evidence in the existing `source_documents` and `evidence_items` tables. UI-only constants are not a durable evidence source.

## Rules

1. **Retain source provenance.** Every imported source is fetched or derived from an identified URL and stored with a SHA-256 content hash.
2. **Resolve targets conservatively.** Member and bill targets must resolve uniquely. Ambiguous targets are recorded as unresolved rather than guessed. Curated member evidence should prefer the durable LRL legislator external key (`lrl:<id>`) when available so display-name changes do not break identity.
3. **Make refreshes idempotent.** Evidence receives a deterministic ingestion key scoped to source content, resolved target, claim, date, and extractor version. Re-running the same import reuses the prior evidence item.
4. **Version mutable evidence explicitly.** Repeated aggregates such as campaign-finance snapshots receive a stable `evidenceSeriesKey`. When a newer source snapshot creates a new item in the same series, the new item points to the older current item with an `evidence_relationships.relation_kind='supersedes'` relationship. Reads that represent current evidence exclude items targeted by a `supersedes` relationship. Exact re-runs backfill the series key onto existing rows without creating duplicates.
5. **Separate evidence from model effect.** Importing an item does not make it a forecasting feature. New curated and campaign-finance records default to `mechanicallyActionable: false` until a separately evaluated model explicitly uses them.
6. **Treat money as context, not stance.** Campaign receipts and independent expenditures are factual context. They do not imply a legislator's vote position by themselves.
7. **Prefer official facts.** Bill authorship/sponsorship is sourced from the Minnesota Revisor rather than inferred from advocacy material. Organizational letters describe only the organization's documented position.
8. **Treat legislative roles as context, not vote intent.** Committee membership and leadership may be relevant to bill routing or leverage, but they are persisted as neutral context and do not imply support or opposition.
9. **Preserve pre-vote bills.** An official bill referenced by evidence may be seeded into the canonical `bills` and `bill_versions` tables even if it has not appeared in historical floor-vote ingestion. Its deterministic features are generated at the same time.

## Commands

- `npm run data:cfb:snapshot` builds the normalized Minnesota Campaign Finance and Public Disclosure Board snapshot through the shared TypeScript live-source parser.
- `npm run data:cfb:evidence -- --snapshot=PATH` maps that snapshot to current memberships and persists campaign-finance context when run in an environment with a routable database connection.
- `npm run data:evidence:bills -- --manifest=PATH` ensures official Revisor bills referenced by an evidence manifest have canonical bill/version records and `deterministic-v2.1` features when run in an environment with a routable database connection.
- `npm run data:evidence:curated -- --manifest=PATH` fetches and hashes each manifest source, resolves targets, and persists evidence when run in an environment with a routable database connection.
- `npm run data:evidence:legislators` imports the versioned official committee/leadership context manifest using stable `lrl:` legislator keys.

## Production execution

Vercel's production database URL uses a Marketplace/internal database alias that is valid inside the deployed application runtime but is not routable from a GitHub-hosted runner. Production evidence refreshes therefore do **not** connect directly from GitHub Actions.

The `Production evidence refresh` workflow follows the same deployed-runtime boundary used by scheduler validation: it deploys protected `main`, privately reads `CRON_SECRET`, then invokes the production-only `POST /api/operations/evidence-refresh` endpoint. The endpoint performs the database work inside Vercel, where the configured Neon connection is valid. The GitHub runner never receives a separately routable database credential and the endpoint rejects unauthenticated requests.

Production campaign-finance refresh uses a two-stage migration-safe flow. First, the versioned bundled `data/cfb-2025-2026-snapshot.json` is replayed idempotently so existing aggregates retain stable evidence-series keys. Second, the runtime attempts fresh official Minnesota CFB candidate-contribution and independent-expenditure bulk downloads through the shared live parser. A changed official source hash creates a new aggregate that explicitly supersedes the older item in the same series. If the live source is unavailable or fails plausibility checks, the live stage falls back to the bundled snapshot and records `sourceMode=bundled_fallback` rather than making the full evidence refresh fail.

Production refresh is intentionally not scheduled on a recurring cadence yet. The live CFB path should first be verified in production for source mode, supersession relationships, unique current finance series, and zero mechanical use. Candidate general expenditures are the next finance stream to add so a member with spending but no contribution/IE rows is not mistaken for missing finance context.

## Initial gambling tranche

`data/evidence/gambling-curated-v1.json` moves the existing priority gambling evidence into the durable store. It contains sourced member statements, official Revisor authorship records, and documented MIGA/SMSC gaming-policy positions. All are inspectable and currently non-mechanical.

## Legislator context tranche

`data/evidence/legislator-context-v1.json` adds official 2025-2026 House member profiles and Senate committee rosters for the initial identity-gap cohort. It records committee assignments and leadership roles as neutral context, targets memberships through stable LRL legislator keys, and explicitly tags process-relevant committees such as House Commerce and Senate State and Local Government without converting committee service into a forecast stance or mechanical feature.
