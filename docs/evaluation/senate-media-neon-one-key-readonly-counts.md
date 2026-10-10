# Senate media — existing Neon key, READ ONLY counts

Tracker: [#912](https://github.com/killjoy00/votepredict/issues/912).

This workflow uses the **existing** protected GitHub Actions `NEON_API_KEY` and `VOTEPREDICT_NEON_PROJECT_ID`. No new Neon project, database, branch, SQL role or connection-string secret is needed for the aggregate inspection.

Run [Senate media Neon one-key historical counts](https://github.com/killjoy00/votepredict/actions/workflows/senate-media-neon-api-readonly-counts.yml) manually on `main`. Set `run_bounded_counts=true` and enter `VERIFY_SENATE_MEDIA_READONLY`. The `evidence-readonly-sandbox` GitHub environment must authorize the job.

The job reads the existing project metadata, its default branch's database inventory, existing compute endpoints and an existing-role connection URI using four read-only Neon API GET requests. It fails if the project name/ID, branch, database or endpoint cannot be verified. If the project has multiple databases without one named `votepredict`, optionally set environment variable `VOTEPREDICT_MEDIA_EXISTING_DATABASE` to identify an existing database; the script never guesses.

It connects directly using TLS, sets default transactions read-only, opens `REPEATABLE READ READ ONLY`, checks the six expected VotePredict source/roster relations and executes one bounded SELECT aggregation of archived local/trade-media context evidence grouped by **Wayback capture year**, then closes with `ROLLBACK`. The existing database owner role can have broader privileges, but this transaction cannot write. No SQL role is created or altered.

Only aggregate year-level counts appear in the workflow summary. The job does not expose original media pages, document identifiers, senator identities, full article content or connection secrets, and does not create workflow artifacts. This is an **existing-source-context count, not a statewide publisher article census and not any verified senator quotations**. It does not independently prove that the default Neon branch is the deployed production branch.

After this initial live checkpoint, the separate [private media export](senate-media-private-export-runbook.md), [original byte verification](senate-media-original-wayback-rehydration.md), [private batch reconciliation](senate-media-private-batch-reconciliation.md) and human [speaker audit](senate-media-2021-25-attribution-audit.md) remain outstanding. No production writes, ingestion or model changes are authorized.

Neon API reference: [connection URI](https://api-docs.neon.tech/reference/getconnectionuri), [database listing](https://api-docs.neon.tech/reference/listprojectbranchdatabases), [compute listing](https://api-docs.neon.tech/reference/listprojectendpoints).
