# Senate media — existing Neon key, READ ONLY counts

Tracker: [#912](https://github.com/killjoy00/votepredict/issues/912).

This workflow uses the **existing** protected GitHub Actions `NEON_API_KEY` and `VOTEPREDICT_NEON_PROJECT_ID`. No new Neon project, database, branch, SQL role or connection-string secret is needed for the aggregate inspection.

Run [Senate media Neon one-key historical counts](https://github.com/killjoy00/votepredict/actions/workflows/senate-media-neon-api-readonly-counts.yml) manually on `main`. Set `run_bounded_counts=true` and enter `VERIFY_SENATE_MEDIA_READONLY`. The `evidence-readonly-sandbox` GitHub environment must authorize the job.

The job reads the existing project metadata, its default branch's database inventory, existing compute endpoints and an existing-role connection URI using four read-only Neon API GET requests. It fails if the project name/ID, branch, database or endpoint cannot be verified. If the project has multiple databases without one named `votepredict`, optionally set environment variable `VOTEPREDICT_MEDIA_EXISTING_DATABASE` to identify an existing database; the script never guesses.

It connects directly using TLS, sets default transactions read-only, opens `REPEATABLE READ READ ONLY`, checks the six expected VotePredict source/roster relations and executes one bounded SELECT aggregation of archived local/trade-media context evidence grouped by **Wayback capture year**, then closes with `ROLLBACK`. The existing database owner role can have broader privileges, but this transaction cannot write. No SQL role is created or altered.

Only aggregate year-level counts appear in the workflow summary. The job does not expose original media pages, document identifiers, senator identities, full article content or connection secrets, and does not create workflow artifacts. This is an **existing-source-context count, not a statewide publisher article census and not any verified senator quotations**. It does not independently prove that the default Neon branch is the deployed production branch.

After this initial live checkpoint, the separate [private media export](senate-media-private-export-runbook.md), [original byte verification](senate-media-original-wayback-rehydration.md), [private batch reconciliation](senate-media-private-batch-reconciliation.md) and human [speaker audit](senate-media-2021-25-attribution-audit.md) remain outstanding. No production writes, ingestion or model changes are authorized.

Neon API reference: [connection URI](https://api-docs.neon.tech/reference/getconnectionuri), [database listing](https://api-docs.neon.tech/reference/listprojectbranchdatabases), [compute listing](https://api-docs.neon.tech/reference/listprojectendpoints).

## First owner run and safe failure diagnostics

The first manual [run #38086731790](https://github.com/killjoy00/votepredict/actions/runs/38086731790) reached the existing-project access/SQL step but **failed closed**, with no aggregate evidence counts or source exports. It deliberately suppressed detailed Neon and PostgreSQL errors to avoid leaking host names, database login secrets, raw credentials or source documents.

Subsequent runs now emit a **fixed, non-sensitive last-completed-stage enum**: project metadata/identity, existing database inventory/selection, compute inventory/selection, password-bearing URI response/validation, SQL connection, read-only identity, required tables, aggregate SELECT, and final rollback. These labels never contain a value received from Neon or Postgres and do not claim success if the next stage failed.

Inspect the run's failure message for `last completed phase`. For example, `database_inventory_received` indicates the API responded, but database selection/ownership verification failed; `endpoint_selected` indicates the next URI retrieval failed; `connection_uri_verified` indicates the URI checks passed but the SQL connection itself failed. No password, project/branch name, connection host or underlying exception is displayed. If the resolved project has more than one database, the optional `VOTEPREDICT_MEDIA_EXISTING_DATABASE` variable is relevant **only** after an actual database ambiguity has been established.

This is a diagnostic-only iteration of the same manually approved, read-only workflow; no new role, branch, connection-string secret or source-export surface was introduced.
