# Evidence workflow consolidation (PR 3)

This PR follows the Step 0 inventory. It changes **only evidence collection/action dispatch**, not forecasting, model behavior, evaluation data, source eligibility, production database state, secrets, or deployment protections.

## Three parameterized manual workflows

| Active workflow | Inputs | Fixed implementation |
|---|---|---|
| `evidence-acquire.yml` | `source_type` (official-source-smoke / revisor-source-passage), `session` (302/300/257/all), `member_or_batch` (all only), `dry_run` | `scripts/run-evidence-workflow.ts` → checked-in source adapter |
| `evidence-audit.yml` | `audit_name` (official-source-smoke / revisor-source-passage / quick-evidence-extractor), `scope` | Same generic runner, approved audit/test allow-list |
| `evidence-readonly-query.yml` | `named_query`, `session_scope`, explicit `run_readonly`, existing sandbox approval phrase | `scripts/run-evidence-readonly-query.ts` using existing Neon API GET helper and fixed SQL catalog |

**Acquisition:** `official-source-smoke` calls the unchanged `scripts/smoke-official-sources.ts` for source session 302/300/257, retaining read-only public source fetch behavior. `revisor-source-passage` calls the unchanged six-scope `audit-revisor-source-passage-search.ts` and, when `dry_run=false`, `export-revisor-source-passage-snapshot.ts`. The snapshot has its original `artifacts/revisor-source-passage-snapshot.json` filename and Actions artifact name `revisor-source-passage-snapshot` with seven-day retention. `dry_run=true` still performs source reads and audit checks but never exports the snapshot.

Both acquisition adapters support only `member_or_batch=all`: the existing scripts do not implement a safe per-member or reduced-batch selector. The generic runner rejects other selectors, unsupported session/year combinations, arbitrary scripts, commands, SQL, or shell strings rather than silently broadening their scope. A member-specific adapter would require explicit verified filtering.

**Audit:** `quick-evidence-extractor` runs the four existing v2/v3/v4 exact-record regression tests. `revisor-source-passage` runs the existing audit without exporting a snapshot. `official-source-smoke` runs the source smoke for an allowed session. All jobs have `contents: read`, `workflow_dispatch` only, a reviewed `main` repo/ref guard, and non-cancelling concurrency. Checkout does not persist credentials.

## Named read-only Neon queries

The new protected workflow is manual-only and retains **environment: evidence-readonly-sandbox** with the existing `secrets.NEON_API_KEY`, `vars.VOTEPREDICT_NEON_PROJECT_ID` and optional existing database selector. No new credentials, branch, roles, endpoint, environment or permissions are created or weakened. It requires `run_readonly=true` plus the original `READ_ONLY_SANDBOX_AUDIT` phrase and runs only from the reviewed `main` repository.

`src/operations/senate-media-neon-api-readonly.ts` performs its existing project/default-branch verification through Neon GETs. The new SQL client uses `default_transaction_read_only=on`, query/statement/lock timeouts, then explicitly:

1. Begins `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`.
2. Verifies expected current database, role, and transaction_read_only=on.
3. Executes exactly one fixed aggregate or health SELECT from `data/evidence-workflows/readonly-queries.json`, with a bound session parameter when applicable; permitted names: `connection-health`, `session-membership-counts`, `evidence-item-count`.
4. Enforces expected field names, no private/source records, at most three rows, bounded nonnegative integer counts, and only three approved session slugs.
5. Executes `ROLLBACK` even on query failure. Sensitive SQL/connection exceptions are never printed.

This guarantees this **transaction is read-only**; it does not claim the existing Neon role has no other grants. No production write or migration occurs in this PR.

## Archived unprotected manual-only workflow definitions

- `research/workflows-archive/source-smoke.yml` (from `.github/workflows/source-smoke.yml`) → `evidence-acquire` source_type=official-source-smoke, session=302/300/257, member_or_batch=all, dry_run=true (or equivalent named audit). Same existing smoke script. The new workflow uses `npm ci` rather than the old unpinned `npm install`.
- `research/workflows-archive/revisor-source-passage-audit.yml` (from `.github/workflows/revisor-source-passage-audit.yml`) → `evidence-acquire` source_type=revisor-source-passage, session=all, member_or_batch=all, dry_run=false. Same two existing scripts in the original order, same snapshot path, Actions artifact name and retention.

Both archived workflows were verified to have only `workflow_dispatch`, no protected environments, no secrets, and no automatic or called callers. Their Git history follows `git mv`. These YAML files now live outside `.github/workflows/` and are no longer executable or shown as active GitHub Actions.

## Deliberately retained workflows and incomplete UI-size target

A fresh offline inventory after archiving two YAMLs and adding three found 689 active workflow files: 458 automatic, 178 protected (not automatic), 30 other/ambiguous events, and 23 unprotected manual-only (two new plus 21 remaining). These are conservative categories, not statements about historical execution.

- **Automatic/called:** All existing push, PR, schedule and other event workflows are retained. The Duckworth 2026 proof workflow was mislabeled manual-only by the older Step 0 inventory but contains a PR trigger, so it is untouched. It also has a pre-existing YAML parse issue (an unquoted colon in a step name) unrelated to this PR.
- **Protected:** All environment- or secret-bearing workflows remain, including the existing `evidence-neon-readonly-sandbox.yml` and protected Neon audits. Their environment protections, permissions, and secret names are unchanged.
- **Not safely superseded:** The 20 historical-deep discovery/source/candidate/mechanics/impact dispatches and Quick Evidence committee roll-call extraction have provenance-bound GitHub artifact IDs, digest checks, staged uploads/downloads, fixed historical outcomes, and lineage gating. A simple named CLI dispatcher would bypass that protection. These 21 workflows remain until equivalent tested lineage-aware adapters exist.

It would be unsafe to archive the remaining workflows just to reach the target of only a handful of manual Actions. The 20–40 evidence-module goal was already addressed conservatively in PR 1.

## Validation

`tests/evidence-workflow-parameterization.test.ts` exercises permitted and forbidden source/audit inputs, scopes, output artifact paths, explicit READ ONLY / ROLLBACK order, identity checks, unexpected result rejection, secret/environ guards and the archived YAML paths. All three new YAMLs parse as YAML 1.2 using an isolated tool outside package dependencies. No new runtime or dev dependency is introduced. Before merge, run `npm run typecheck`, `npm test`, `npm run build` and require GitHub `verify` to pass. No production SQL is executed during tests.
