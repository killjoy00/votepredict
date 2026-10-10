# VotePredict Neon key: manual Track D read-only media access gate

**Historical Senate media Track D, issue [#912](https://github.com/killjoy00/votepredict/issues/912).** A newly added GitHub Actions secret is **not** readable through the ChatGPT GitHub connector and does **not** itself prove that a restricted Postgres role exists. The separate ChatGPT Neon connector previously resolved to Pack 1, not VotePredict. Never paste a Neon key, Postgres password, private URL or original news article body in chat, PR text or logs.

## Already established

The owner previously approved and manually ran the VotePredict project identity workflow. [Run #37874080449](https://github.com/killjoy00/votepredict/actions/runs/37874080449) was **SUCCESS on 2026-10-09**, confirming that the protected GitHub `NEON_API_KEY` could perform a bounded authenticated project-details GET and that the configured project ID and normalized project name were VotePredict. This **does not** establish permissions of a new/rotated key, prove the app's production DB branch, or prove an independent SQL SELECT-only role.

## New manual check

[Open GitHub Actions: Senate media Neon access check](https://github.com/killjoy00/votepredict/actions/workflows/senate-media-neon-readonly-preflight.yml). Select `main`, enable `check_readonly`, enter approval phrase `VERIFY_SENATE_MEDIA_READONLY`, then choose **Run workflow**. The GitHub protected environment `evidence-readonly-sandbox` may require reviewer approval.

The workflow is deliberately **manual only**, scoped to repository `killjoy00/votepredict` on `main`, and performs **no media source export**, branch/role provisioning or Vercel access. Never run it from an unreviewed pull request.

### Existing project identity inputs

- Protected-environment **secret** `NEON_API_KEY`: management API key. The key never appears in command arguments, logs, a PR, or workflow artifacts. A repository-level secret of the same name may also be visible if not overridden by the protected environment.
- Protected-environment **variable** `VOTEPREDICT_NEON_PROJECT_ID`: independently configured expected VotePredict project ID. An environment **secret** named this will not satisfy `${{ vars.* }}`.

### Additional inputs needed for an actual read-only SQL permission proof

- Protected-environment **secret** `VOTEPREDICT_MEDIA_READONLY_DATABASE_URL`: a separately provisioned, **restricted SELECT-only** Postgres connection for the approved historical evidence database. Do not substitute `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, an app owner URL, or use the management API key to retrieve/create an owner password.
- Protected-environment **variable** `VOTEPREDICT_MEDIA_APPROVED_BRANCH_ID`: independently confirmed exact `br-...` identifier of the intended existing Neon branch for this historical check, not merely a branch name inferred by the script.

If the SQL URL or approved branch ID is not present, the workflow still verifies VotePredict **project identity** and prints a sanitized non-ready status. It does not attempt a database connection. **Adding `NEON_API_KEY` alone does not unblock the media SQL export.**

When both additional inputs exist, the workflow performs a read-only Neon Management API `GET /projects/{id}/endpoints`, requires that the Postgres hostname belong to the verified project **and exact approved branch**, and opens a single TLS-protected direct (non-pooler) SQL connection. Its only SQL is `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`, a catalog/privilege preflight over the six required VotePredict tables, and `ROLLBACK`. It refuses owner/admin/superuser roles, CREATE and all write-capable public-table grants, missing SELECT permissions, wrong database, and mismatched connection identity. The output contains only boolean readiness status. No article identifiers, quotes, raw rows, credentials, DB hostnames or passwords are exported.

Possible output statuses:

- `project_verified_readonly_database_url_required`: management API key works, no dedicated read-only SQL URL supplied
- `project_verified_approved_branch_required`: URL exists, but branch identity has not been independently approved
- `project_verified_role_preflight_ready`: management API project/branch/host checks and strict SQL SELECT-only grants passed; **still no source data exported**

A failed workflow is fail-closed; inspect key name/variable scope and SQL grants privately. No automatic fallback to Pack 1, GitHub owner secrets, a Neon DB admin role, a project clone, or a Vercel environment is allowed.

## Follow-on private export stays separate

Once the restricted connection passes, use the already merged [private export runbook](senate-media-private-export-runbook.md) from a trusted machine outside GitHub CI. It generates locally private `media-context.jsonl` and `senate-roster.jsonl`, then feeds [exact archived byte verification](senate-media-original-wayback-rehydration.md) and the human quotation audit. This workflow deliberately makes **no GitHub Actions evidence export and no completion claim** about any senator/year or statewide source denominator.

Official Neon management API endpoint listing: `GET /api/v2/projects/{project_id}/endpoints`, read-only. It does not retrieve role passwords or grant SQL permissions.
