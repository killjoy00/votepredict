# Senate media — existing Neon key, READ ONLY counts

Tracker: [#912](https://github.com/killjoy00/votepredict/issues/912).

## Dedicated one-time protected check, without repeated owner dispatches

**Observed issue, October 10, 2026:** Owner-triggered bounded read-only checks initially failed due to our Neon API-shape bug, which PR #943 corrected. The later one-time post-main-CI design in PR #952 never accessed Neon: its [main CI run #38092980029](https://github.com/killjoy00/votepredict/actions/runs/38092980029) was canceled by newer main pushes due to the repository-wide CI concurrency setting. The corresponding protected audit job was skipped. **No live historical rows or year counts have yet been verified by these attempts.**

**Dedicated fix:** The same workflow now accepts an exact specially marked, reviewed main commit containing `SENATE_MEDIA_DEDICATED_ONE_SHOT_20261010_V2`. It first runs its own `one-shot-verify` job with a disposable local PostgreSQL service, `npm ci`, migrations, full `npm run check` and dependency audit. It has a distinct concurrency group with `cancel-in-progress: false`, so unrelated main branch merges cannot cancel the verification needed for this audit. This unprivileged verification job has **no Neon secrets** and runs only after the marked commit is pushed to `main`, not on PR code or forks.

Only when `one-shot-verify` succeeds does `one-shot-readonly` enter the **existing protected `evidence-readonly-sandbox`** environment using the existing key. GitHub also enforces repository, main ref, exact V2 commit marker, run attempt 1, and verified job success; the Node script repeats strict approval gates before contacting Neon. Checkout pins to the triggering `github.sha` and checks that the checked-out HEAD matches. No arbitrary push, schedule, PR, fork, rerun, or unmarked merge can trigger a production count. The old V1 `workflow_run` path was intentionally removed to prevent further cancellation/replay surprises.

This remains one previously authorized attempt for a narrowly scoped `REPEATABLE READ READ ONLY` aggregate and final `ROLLBACK`, not an ongoing monitoring job, production export, migration, or new authorization for media quote ingestion. **Environment approval rules are unchanged:** if GitHub's protected environment requires a reviewer, that one approval may still appear, and the workflow cannot bypass it. The explicit manual workflow option remains available but is not part of this plan.
This workflow uses the **existing** protected GitHub Actions `NEON_API_KEY` and `VOTEPREDICT_NEON_PROJECT_ID`. No new Neon project, database, branch, SQL role or connection-string secret is needed for the aggregate inspection.

The [Senate media Neon one-key historical counts](https://github.com/killjoy00/votepredict/actions/workflows/senate-media-neon-api-readonly-counts.yml) workflow retains manual approval inputs as a fallback, but the normal next step is the separately verified, uniquely marked main commit described above. The `evidence-readonly-sandbox` GitHub environment still controls protected credentials.

The job reads the existing project metadata, the branch inventory's explicitly marked default branch, and that branch's database inventory, existing compute endpoints and an existing-role connection URI using five read-only Neon API GET requests. It fails if the project name/ID, branch, database or endpoint cannot be verified. If the project has multiple databases without one named `votepredict`, optionally set environment variable `VOTEPREDICT_MEDIA_EXISTING_DATABASE` to identify an existing database; the script never guesses.

It connects directly using TLS, sets default transactions read-only, opens `REPEATABLE READ READ ONLY`, checks the six expected VotePredict source/roster relations and executes one bounded SELECT aggregation of archived local/trade-media context evidence grouped by **Wayback capture year**, then closes with `ROLLBACK`. The existing database owner role can have broader privileges, but this transaction cannot write. No SQL role is created or altered.

Only aggregate year-level counts appear in the workflow summary. The job does not expose original media pages, document identifiers, senator identities, full article content or connection secrets, and does not create workflow artifacts. This is an **existing-source-context count, not a statewide publisher article census and not any verified senator quotations**. It does not independently prove that the default Neon branch is the deployed production branch.

After this initial live checkpoint, the separate [private media export](senate-media-private-export-runbook.md), [original byte verification](senate-media-original-wayback-rehydration.md), [private batch reconciliation](senate-media-private-batch-reconciliation.md) and human [speaker audit](senate-media-2021-25-attribution-audit.md) remain outstanding. No production writes, ingestion or model changes are authorized.

Neon API reference: [connection URI](https://api-docs.neon.tech/reference/getconnectionuri), [database listing](https://api-docs.neon.tech/reference/listprojectbranchdatabases), [compute listing](https://api-docs.neon.tech/reference/listprojectendpoints).

## First owner run and safe failure diagnostics

The first manual [run #38086731790](https://github.com/killjoy00/votepredict/actions/runs/38086731790) reached the existing-project access/SQL step but **failed closed**, with no aggregate evidence counts or source exports. It deliberately suppressed detailed Neon and PostgreSQL errors to avoid leaking host names, database login secrets, raw credentials or source documents.

Subsequent runs now emit a **fixed, non-sensitive last-completed-stage enum**: project metadata/identity, existing database inventory/selection, compute inventory/selection, password-bearing URI response/validation, SQL connection, read-only identity, required tables, aggregate SELECT, and final rollback. These labels never contain a value received from Neon or Postgres and do not claim success if the next stage failed.

Inspect the run's failure message for `last completed phase`. For example, `database_inventory_received` indicates the API responded, but database selection/ownership verification failed; `endpoint_selected` indicates the next URI retrieval failed; `connection_uri_verified` indicates the URI checks passed but the SQL connection itself failed. No password, project/branch name, connection host or underlying exception is displayed. If the resolved project has more than one database, the optional `VOTEPREDICT_MEDIA_EXISTING_DATABASE` variable is relevant **only** after an actual database ambiguity has been established.

The bounded read-only SQL and safe diagnostic labels are unchanged; no new role, branch, connection-string secret or source-export surface was introduced.

## Verified root cause of the second manually approved run

[Run #38088270532](https://github.com/killjoy00/votepredict/actions/runs/38088270532) failed at last completed safe phase `project_metadata_received`, **before SQL or source rows**. The earlier code incorrectly assumed `GET /projects/{id}` returns a `project.default_branch_id` field. Neon's published OpenAPI for the project response does not expose that field; instead, [`GET /projects/{id}/branches`](https://api-docs.neon.tech/reference/listprojectbranches) returns the existing branches with a `default` boolean per branch.

This correction performs one additional **GET** with `limit=100`, rejects a pagination cursor or an invalid/ambiguous default selection, and accepts exactly one existing branch marked `default=true` belonging to the verified project ID. It never relies on a branch called `main` or on the first listed branch, and never creates, updates or deletes branches. New safe phase labels `branch_inventory_received` and `default_branch_selected` distinguish any later failure. All previous read-only transaction, credential-hiding, exact project checks and human-quote restrictions are retained.

