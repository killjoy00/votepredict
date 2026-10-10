# Senate media — existing Neon key, READ ONLY counts

Tracker: [#912](https://github.com/killjoy00/votepredict/issues/912).

## One-time protected post-CI check, not another owner click

The initial owner-triggered runs on October 10, 2026 authorized this bounded VotePredict read-only historical-media inspection, but implementation mistakes prevented live source counts. To avoid repeated workflow_dispatch requests, the same protected workflow now accepts **one** designated successful CI run on main after a reviewed squash merge.

Conditions for that path: a **single exact one-use** `SENATE_MEDIA_ONE_SHOT_20261010_V1` marker in the reviewed merge commit message, CI workflow name `CI`, successful conclusion, first CI run attempt, source event `push`, `head_branch=main`, exact owner/repo and `GITHUB_REF=refs/heads/main`. Ordinary merges, PR builds, manual CI reruns, schedule events, forks and any wrong repo fail closed. GitHub Actions checks these and the script separately checks all sanitized attributes before any Neon request.

**The GitHub evidence-readonly-sandbox protected environment remains mandatory.** This change does NOT bypass environment reviewers, remove a repository protection rule, broaden privileges, or create Neon credentials, branches, roles or databases. If GitHub requires a protected environment approval, the one-time job will remain waiting; it cannot evade that restriction.

The code checks out the exact successful source CI SHA, independently compares checkout HEAD to that SHA, then performs the same GET-only project/branch/database/endpoint/URI steps and hard-coded SELECT-count transaction with `BEGIN REPEATABLE READ READ ONLY`, query timeouts and ROLLBACK. Outputs remain sanitized aggregate historical year counts or fixed non-sensitive failure phases, never passwords, article bodies, source rows, quote claims or uploaded workflow artifacts.

**This is not a permanent recurring credential job.** Only the uniquely marked reviewed commit can trigger it. The manual option remains a fallback for explicit future owner use; the owner should not be repeatedly asked to run it as a debugging loop. The historical public-source audit and human attribution checks continue separately.

This workflow uses the **existing** protected GitHub Actions `NEON_API_KEY` and `VOTEPREDICT_NEON_PROJECT_ID`. No new Neon project, database, branch, SQL role or connection-string secret is needed for the aggregate inspection.

Run [Senate media Neon one-key historical counts](https://github.com/killjoy00/votepredict/actions/workflows/senate-media-neon-api-readonly-counts.yml) manually on `main`. Set `run_bounded_counts=true` and enter `VERIFY_SENATE_MEDIA_READONLY`. The `evidence-readonly-sandbox` GitHub environment must authorize the job.

The job reads the existing project metadata, the branch inventory's explicitly marked default branch, and that branch's database inventory, existing compute endpoints and an existing-role connection URI using four read-only Neon API GET requests, with an additional read-only branch inventory GET. It fails if the project name/ID, branch, database or endpoint cannot be verified. If the project has multiple databases without one named `votepredict`, optionally set environment variable `VOTEPREDICT_MEDIA_EXISTING_DATABASE` to identify an existing database; the script never guesses.

It connects directly using TLS, sets default transactions read-only, opens `REPEATABLE READ READ ONLY`, checks the six expected VotePredict source/roster relations and executes one bounded SELECT aggregation of archived local/trade-media context evidence grouped by **Wayback capture year**, then closes with `ROLLBACK`. The existing database owner role can have broader privileges, but this transaction cannot write. No SQL role is created or altered.

Only aggregate year-level counts appear in the workflow summary. The job does not expose original media pages, document identifiers, senator identities, full article content or connection secrets, and does not create workflow artifacts. This is an **existing-source-context count, not a statewide publisher article census and not any verified senator quotations**. It does not independently prove that the default Neon branch is the deployed production branch.

After this initial live checkpoint, the separate [private media export](senate-media-private-export-runbook.md), [original byte verification](senate-media-original-wayback-rehydration.md), [private batch reconciliation](senate-media-private-batch-reconciliation.md) and human [speaker audit](senate-media-2021-25-attribution-audit.md) remain outstanding. No production writes, ingestion or model changes are authorized.

Neon API reference: [connection URI](https://api-docs.neon.tech/reference/getconnectionuri), [database listing](https://api-docs.neon.tech/reference/listprojectbranchdatabases), [compute listing](https://api-docs.neon.tech/reference/listprojectendpoints).

## First owner run and safe failure diagnostics

The first manual [run #38086731790](https://github.com/killjoy00/votepredict/actions/runs/38086731790) reached the existing-project access/SQL step but **failed closed**, with no aggregate evidence counts or source exports. It deliberately suppressed detailed Neon and PostgreSQL errors to avoid leaking host names, database login secrets, raw credentials or source documents.

Subsequent runs now emit a **fixed, non-sensitive last-completed-stage enum**: project metadata/identity, existing database inventory/selection, compute inventory/selection, password-bearing URI response/validation, SQL connection, read-only identity, required tables, aggregate SELECT, and final rollback. These labels never contain a value received from Neon or Postgres and do not claim success if the next stage failed.

Inspect the run's failure message for `last completed phase`. For example, `database_inventory_received` indicates the API responded, but database selection/ownership verification failed; `endpoint_selected` indicates the next URI retrieval failed; `connection_uri_verified` indicates the URI checks passed but the SQL connection itself failed. No password, project/branch name, connection host or underlying exception is displayed. If the resolved project has more than one database, the optional `VOTEPREDICT_MEDIA_EXISTING_DATABASE` variable is relevant **only** after an actual database ambiguity has been established.

This is a diagnostic-only iteration of the same manually approved, read-only workflow; no new role, branch, connection-string secret or source-export surface was introduced.

## Verified root cause of the second manually approved run

[Run #38088270532](https://github.com/killjoy00/votepredict/actions/runs/38088270532) failed at last completed safe phase `project_metadata_received`, **before SQL or source rows**. The earlier code incorrectly assumed `GET /projects/{id}` returns a `project.default_branch_id` field. Neon's published OpenAPI for the project response does not expose that field; instead, [`GET /projects/{id}/branches`](https://api-docs.neon.tech/reference/listprojectbranches) returns the existing branches with a `default` boolean per branch.

This correction performs one additional **GET** with `limit=100`, rejects a pagination cursor or an invalid/ambiguous default selection, and accepts exactly one existing branch marked `default=true` belonging to the verified project ID. It never relies on a branch called `main` or on the first listed branch, and never creates, updates or deletes branches. New safe phase labels `branch_inventory_received` and `default_branch_selected` distinguish any later failure. All previous read-only transaction, credential-hiding, exact project checks and human-quote restrictions are retained.

