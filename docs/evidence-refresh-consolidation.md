# Evidence refresh and extractor consolidation — PR 2

This change follows the merged Step 0 / PR 1 inventory at [evidence-cleanup-inventory.md](./evidence-cleanup-inventory.md). It is **source-structure-only**. No eligibility, historical interpretation, forecasting, models, evaluation outputs, raw data or production database records are changed.

## Refresh: one typed route entrypoint, four genuinely different jobs

Both Next.js operations routes now import `evidenceRefresh` from `src/evidence/refresh.ts`. The entrypoint exposes typed `.production()`, `.public(options)`, `.structured(options)` and `.campaignFinance()` handlers. Importing the entrypoint does not eagerly initialize unrelated source modules. Existing authorization and error responses in each route remain unchanged.

| Job | Source inputs | Read/write side effects | Why it remains independent |
|---|---|---|---|
| `production-refresh.ts` | Checked-in CFB snapshot and gambling / legislator-context manifests; Revisor bills | Seeds bills, bill versions and feature sets, persists durable context, records ingestion runs | Deterministic bundled input and bill seeding, not a live web/member crawl |
| `public-evidence-refresh.ts` | Current-member rotating batches, campaign websites, member primary pages, news, official structured sources, CFB refresh subject to existing age cutoff | Reads session/membership/bill context, writes durable evidence and its run metadata | Has a rotation cursor and selective/partial failure behavior; source-collection loop is different |
| `structured-public-refresh.ts` | Legislative Session Daily, election results, conference committees, House minutes, bill summaries, fiscal notes and activity-bill slices | Reads bills/members/votes; persists official evidence and ingestion runs | Session-based official-source batches, separate backfill semantics |
| `live-campaign-finance-refresh.ts` | Live CFB bulk snapshot, membership resolution and finance aggregates | Tracks a finance ingestion run and persists finance context | Has finance-specific identity resolution, freshness thresholds and unresolved-member tracking |

The SQL, specific `ingestion_runs` source_system/scope values, durable evidence inputs, call order, time limits, batch rotation, failure handling and CFB age cutoff remain in their original implementations. A mechanical unification of these source loops would not preserve behavior. The facade centralizes only the route-facing interface; it deliberately does not rewrite the four distinct jobs or their ingestion SQL.

`public-evidence-refresh.ts` still internally invokes structured and finance refreshes under its original conditions. `/api/operations/evidence-refresh` still runs bundled production refresh first, then finance refresh. `/api/operations/public-evidence-refresh` still runs only the public batch orchestrator. Historical GitHub action scripts still call their existing runner interfaces. No new network or database code was added.

## Extractor: one canonical import and a shared evaluation policy

Production sites and history backfills continue to use `extractExplicitBillStatements()` from `src/evidence/bill-statement-extractor.ts`, with the **v2** provenance string and unchanged evidence fields. This is important: v2 can classify descriptions of completed votes as directional textual statements, whereas the stricter evaluation-only v4 policy does not. Switching the production function to v4 without a separate eligibility decision would silently change historical evidence records. That is expressly out of scope.

The former separate `bill-statement-extractor-v3.ts` and `bill-statement-extractor-v4.ts` algorithms have been consolidated into `bill-statement-evaluation.ts`. One parameterized algorithm now implements both historical audit policies. Scripts and tests import v3 and v4 named functions from the **single canonical `bill-statement-extractor.ts` entrypoint**, with their original audit provenance/version constants. The internal policy retains exact differences in support/opposition matching, excluded objects and year context, recorded-vote handling, and metadata. No extra evaluation module files retain the old version-numbered names.

### Before-and-after behavior pins

`tests/fixtures/bill-statement-compat-inputs.json` holds 20 fixed examples covering direct support, opposition, negated support, recorded vote history, local versus distant attribution, bill amendments, limited subject matter, year context, and source subtypes. `tests/fixtures/bill-statement-compat-expected.json` was generated from the **three original implementations before the refactor**. `tests/bill-statement-compat.test.ts` deep-compares complete JSON evidence drafts, not just record counts. Those fixtures are frozen and are never recalculated by the test.

Existing per-version extractor tests also remain, as do all historical audit scripts and workflows. `tests/evidence-refresh-dispatch.test.ts` exercises every typed refresh handler against injected fake drivers to pin request forwarding, exact returned records, default options and unchanged error propagation without touching Neon.

## Other versioned modules

Other `*-vN*` source modules under `src/evidence/` are mostly narrowly scoped #864 historical experiments and CFB issue investigations, not alternate editions of a shared extractor API. They are still reachable from the automatic/protected workflow graph documented in Step 0. They are **not deleted or moved** in this PR. Consolidating them would require changing the workflow trigger inventory, and that belongs in PR 3 or an additional separately reviewed archival change. `quick-evidence-v3-manual-reference.ts` and `senate-committee-caption-motion-cues-v2.ts` describe separate source investigations, not versions of the active bill-statement extraction call chain.

## Scope and validation

- **Moved:** v4 evaluation code via `git mv` to `bill-statement-evaluation.ts` (history remains traceable); v3 removed after merging its policy into that file.
- **Merged:** v3/v4 evaluation-only extractor logic; a typed route-facing refresh dispatcher added.
- **Preserved:** live production v2 semantics, four specialized refresh jobs, route auth/error behavior, all output structures, tests, workflows, secrets, protected environments.
- **Deleted:** only the superseded v3 source file; no audit findings, source data or evaluation outcomes.
- **Not done:** force-merging different source loops, modifying forecasting/evaluation code, changing historical eligibility, editing source URL catalogs (PR 4), running Neon migrations, writing to production, or deploying the application.

Run `npm run typecheck`, `npm test`, and `npm run build` before merge. The PR's required `verify` job must pass.
