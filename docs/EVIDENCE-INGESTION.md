# Durable evidence ingestion

VotePredict stores reusable public evidence in the existing `source_documents` and `evidence_items` tables. UI-only constants are not a durable evidence source.

## Rules

1. **Retain source provenance.** Every imported source is fetched or derived from an identified URL and stored with a SHA-256 content hash.
2. **Resolve targets conservatively.** Member and bill targets must resolve uniquely. Ambiguous targets are recorded as unresolved rather than guessed. Curated member evidence should prefer the durable LRL legislator external key (`lrl:<id>`) when available so display-name changes do not break identity.
3. **Make refreshes idempotent.** Evidence receives a deterministic ingestion key scoped to source content, resolved target, claim, date, and extractor version. Re-running the same import reuses the prior evidence item.
4. **Version mutable evidence explicitly.** Repeated aggregates such as campaign-finance snapshots receive a stable `evidenceSeriesKey`. When a newer source snapshot creates a new item in the same series, the new item points to the older current item with an `evidence_relationships.relation_kind='supersedes'` relationship. Reads that represent current evidence exclude items targeted by a `supersedes` relationship. Exact re-runs backfill the series key onto existing rows without creating duplicates.
5. **Separate evidence from model effect.** Importing an item does not make it a forecasting feature. New curated and campaign-finance records default to `mechanicallyActionable: false` until a separately evaluated model explicitly uses them.
6. **Treat money as context, not stance.** Campaign receipts, campaign expenditures, and independent expenditures are factual context. They do not imply a legislator's vote position by themselves.
7. **Prefer official facts.** Bill authorship/sponsorship is sourced from the Minnesota Revisor rather than inferred from advocacy material. Organizational letters describe only the organization's documented position.
8. **Treat legislative roles as context, not vote intent.** Committee membership and leadership may be relevant to bill routing or leverage, but they are persisted as neutral context and do not imply support or opposition.
9. **Preserve pre-vote bills.** An official bill referenced by evidence may be seeded into the canonical `bills` and `bill_versions` tables even if it has not appeared in historical floor-vote ingestion. Its deterministic features are generated at the same time.

## Relationship to Quick and Deep

Durable evidence ingestion does **not** require a Deep forecast. The durable store is a shared substrate that can be populated on a schedule or by curated imports and then displayed in legislator profiles, issue dossiers, Operations, or Quick forecast explanations.

Today the serving Quick model does not mechanically consume general durable evidence. Quick remains based on the evaluated member/history/analogue pipeline. That separation is intentional: storing a fact or source does not prove that using it as a numeric feature improves forecasts.

Deep adds a second layer: it selects consequential/uncertain members, performs fresh targeted research, verifies source-backed directional evidence against the forecast cutoff, applies the evidence-impact policy, and writes a new immutable Deep revision. The evidence-impact path is therefore currently invoked by Deep, but the underlying evidence schema and durable ingestion system are not Deep-only.

The current Deep preloaded context includes:

- GDELT news-index discovery for the target bill and selected members;
- official Minnesota Campaign Finance Board catalog links;
- deterministic campaign-finance snapshots already available to VotePredict.

A GDELT hit is discovery metadata, not verified article evidence. The article content must still be fetched/verified and associated with a publication date before it may be treated as source-backed evidence.

### Non-Deep public-evidence direction

The next evidence expansion should create a durable source registry and recurring ingestion for campaign/legislator websites, press releases, issue pages, and selected reputable news sources. This can happen without invoking Deep or changing probabilities.

A safe progression is:

1. fetch and hash the source with capture/publication time and canonical URL;
2. resolve the member/bill target conservatively;
3. extract/store claims and provenance as non-mechanical durable evidence;
4. display the material in member profiles and Quick explanations;
5. build historical/as-of coverage and a frozen evaluation/shadow for any evidence class proposed to change probabilities;
6. only then promote a proven evidence class into a serving probability path.

Campaign-finance data should remain neutral context unless an evaluated model demonstrates predictive value. Donor identity, employer, contribution amount, or independent spending must never be converted directly into a support/opposition stance.

## Commands

- `npm run data:cfb:snapshot` builds the normalized Minnesota Campaign Finance and Public Disclosure Board snapshot through the shared TypeScript live-source parser.
- `npm run data:cfb:evidence -- --snapshot=PATH` maps that snapshot to current memberships and persists campaign-finance context when run in an environment with a routable database connection.
- `npm run data:evidence:bills -- --manifest=PATH` ensures official Revisor bills referenced by an evidence manifest have canonical bill/version records and `deterministic-v2.1` features when run in an environment with a routable database connection.
- `npm run data:evidence:curated -- --manifest=PATH` fetches and hashes each manifest source, resolves targets, and persists evidence when run in an environment with a routable database connection.
- `npm run data:evidence:legislators` imports the versioned official committee/leadership context manifest using stable `lrl:` legislator keys.

## Production execution

Vercel's production database URL uses a Marketplace/internal database alias that is valid inside the deployed application runtime but is not routable from a GitHub-hosted runner. Production evidence refreshes therefore do **not** connect directly from GitHub Actions.

The `Production evidence refresh` workflow follows the same deployed-runtime boundary used by scheduler validation: it deploys protected `main`, privately reads `CRON_SECRET`, then invokes the production-only `POST /api/operations/evidence-refresh` endpoint. The endpoint performs the database work inside Vercel, where the configured Neon connection is valid. The GitHub runner never receives a separately routable database credential and the endpoint rejects unauthenticated requests.

Production campaign-finance refresh uses a migration-safe flow with stable evidence-series keys. The runtime refreshes official Minnesota CFB candidate contributions, candidate expenditures, and independent-expenditure context through the shared live parser. A changed official source hash creates a new aggregate that explicitly supersedes the older item in the same series. If a live source is unavailable or fails plausibility checks, the supported fallback path records the source mode instead of silently replacing provenance.

Production refresh is not yet the broad recurring public-evidence crawler described above. Campaign finance is durable; general news/campaign-site material is not yet systematically captured outside curated imports and Deep discovery/research.

## Initial gambling tranche

`data/evidence/gambling-curated-v1.json` moves the existing priority gambling evidence into the durable store. It contains sourced member statements, official Revisor authorship records, and documented MIGA/SMSC gaming-policy positions. All are inspectable and currently non-mechanical.

## Legislator context tranche

`data/evidence/legislator-context-v1.json` adds official 2025-2026 House member profiles and Senate committee rosters for the initial identity-gap cohort. It records committee assignments and leadership roles as neutral context, targets memberships through stable LRL legislator keys, and explicitly tags process-relevant committees such as House Commerce and Senate State and Local Government without converting committee service into a forecast stance or mechanical feature.
