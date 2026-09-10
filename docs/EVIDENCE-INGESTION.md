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
- `npm run data:cfb:evidence -- --snapshot=PATH` maps that snapshot to current memberships and persists campaign-finance context.
- `npm run data:evidence:bills -- --manifest=PATH` ensures official Revisor bills referenced by an evidence manifest have canonical bill/version records and `deterministic-v2.1` features.
- `npm run data:evidence:curated -- --manifest=PATH` fetches and hashes each manifest source, resolves targets, and persists evidence.

`Production evidence refresh` pulls the production runtime environment through the existing protected Vercel credential path and runs the three production ingestion stages on `main`. It is intentionally not scheduled on a recurring cadence yet. Before recurring refresh is enabled, evidence supersession/current-version selection should be explicit so changed source content does not appear as duplicate current evidence.

## Initial gambling tranche

`data/evidence/gambling-curated-v1.json` moves the existing priority gambling evidence into the durable store. It contains sourced member statements, official Revisor authorship records, and documented MIGA/SMSC gaming-policy positions. All are inspectable and currently non-mechanical.
