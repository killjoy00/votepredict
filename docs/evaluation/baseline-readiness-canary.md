# Read-only application readiness canary

This release verifies that the repaired evidence readers can be deployed against the intended existing database. It does not start forecasting. The accepted member model, frozen research artifacts and prospective scoring rules remain unchanged.

The owner authorized completing the evidence remediation and explicitly connected Vercel. The specific deployment reason is: verify the reviewed application commit against the independently identified existing default-primary database and all 37 migration hashes, while retaining the #732 execution pause.

## Bounded operating contract

| Control | Setting |
| --- | --- |
| Execution mode | Read-only readiness; Quick, Deep and scheduled forecasts refuse execution before forecast work |
| Automatic scheduler owner | None; zero automatic runs per day |
| Manual operator | Repository owner/delegated agent through reviewed-main release controls |
| Git deployments / cron configuration | Disabled / no configured entries in `vercel.json` |
| Canary scope | One deployment, one health request; no forecast or expensive runtime smoke |
| Health budget | 20-second function maximum, 10-second connection acquisition, 2-second SQL statement limit, 500ms lock limit |
| Database behavior | Existing target only; repeatable-read/read-only snapshot with explicit rollback; no production writes |
| Alert destination | Repository issue #1586; API acceptance plus exact readback, not an email/push receipt |
| Recovery exercise | Synthetic missed capture -> delivered failure -> append-only retry -> delivered recovery, preserving the sealed manifest |
| Test data | Disposable CI-local PostgreSQL 18 only; never production fixture forecasts |
| Recurring spend | No new scheduled jobs, paid plan upgrade or automatic deployment |

This request budget is not a monetary account cap. The provider's billing-headroom lookup has not succeeded; broad operation must remain paused until a real usage/budget check is recorded. A READY build alone is not a runtime or database-binding proof.

## Release acceptance

1. Exact PR head passes the full PostgreSQL CI, typecheck, build and production dependency audit. Review the execution guards and secret boundaries before merge.
2. Exact merged main passes CI. The deployment workflow independently checks that exact SHA's latest main-push CI result and refuses stale main. It no longer provisions scheduler secrets/configuration.
3. The one-shot reviewed-main readiness workflow executes the fixture capture failure/retry and records both actual GitHub alert readbacks. Its issue-write token is confined to that job; PRs, forks, retries, forced pushes and unmarked main pushes cannot run the delivery drill.
4. Supply the nonsecret readiness flags and the independently verified default-primary fingerprint to this deployment's build/runtime only. The manual workflow carries the October 29 binding; no project-wide environment or domain-assignment setting change is needed. Preserve all deployment protection.
5. Stage the production build without domain assignment when supported. Verify one `/api/health` response: exact release SHA; `binding.verified`, target/schema matches; 37 migrations; explicit read-only rollback; forecasts and scheduling disabled. Promote only the verified build.
6. Record actual deployment identity, health response and live cron state. If the connector cannot expose a control-plane field, report it as unverified; do not substitute source configuration or absence of retained logs for proof.

## Source and future-program holds

A successful authenticated 2025-26 Revisor search for SF1-SF500 yielded 500 official rows on October 26. That is a bounded source sample, not the complete introduced-bill denominator or a fresh floor-calendar snapshot. A blank bill query returned an empty official envelope; HTTP 200 and an XML envelope therefore cannot establish source coverage.

No forecast may treat missing source observations as zero/opposition, infer an official universe from an externally supplied list, or reuse this sample as future freshness proof. Live baseline activation still requires a deliberately selected target/session, fresh official floor target/calendar and membership checks, and an authenticated scope denominator. Missing proof remains a hold.

The separate 2027-28 P8 capture and Quick Evidence programs remain inactive. Their future official universe/capture coverage, frozen reveal dates and promotion gates are not satisfied by this canary or its synthetic lifecycle tests. Keep #287/#310 open for those conditions. Historical archive gaps remain excluded under their existing closeouts; this release does not reopen them.

The bounded finish for this release is the deployment/database proof and delivered failure/recovery receipts, with the explicit paused operating contract. It is not a declaration that forecasting or future prospective validation has started.

## Dependency audit discovered during release verification

The October 29 PR run passed all 2,481 PostgreSQL tests with zero skips, typecheck and build, then failed the existing production dependency audit. Newly updated Better Auth advisories included [OAuth state/Magic Link confusion](https://github.com/advisories/GHSA-965c-763c-88jm) and [OAuth Proxy identity confusion](https://github.com/advisories/GHSA-r4xp-prcw-77qf), fixed in 1.7.7.

The SDK is updated from `@neondatabase/auth` 0.5.0-beta to 0.7.0-beta, with the installed Better Auth core, OAuth provider, passkey and API-key packages aligned to 1.7.7. The API-key dependency is pinned at the application root to let npm satisfy its `better-call` peer separately from the UI's different version; no API-key plugin is enabled. Existing client/server wrappers, managed Auth URL, credentials, accounts and owner authorization are preserved. No Auth service is provisioned or migrated. The local audit now reports zero high/critical findings; the remaining seven low-severity package findings trace to the unpatched transitive `deepmerge` advisory. Do not suppress the audit or claim the remote managed Auth server was patched by a client dependency update. Real user sign-in/sign-out has not been exercised by the read-only canary.

## Verified remediation and rehearsal receipts

[PR #1587](https://github.com/killjoy00/votepredict/pull/1587) merged as `d812e432c6fe87ef1b9a93b9c37442d229cbeb54` after exact-head [CI 40940448894](https://github.com/killjoy00/votepredict/actions/runs/40940448894) and the remediation workflow passed. The one-shot [rehearsal 40941051304](https://github.com/killjoy00/votepredict/actions/runs/40941051304) passed both jobs. Its [failure receipt](https://github.com/killjoy00/votepredict/issues/1586#issuecomment-6506455824) and [recovery receipt](https://github.com/killjoy00/votepredict/issues/1586#issuecomment-6506456238) were delivered by GitHub Actions and independently read back. The gated lifecycle fixture also passed; no real forecasts or scores were generated.

The final application deployment and live binding request are still pending. The GitHub connector does not expose manual workflow dispatch, and the browser release page is signed out. The safe continuation is the reviewed manual workflow with `run_vercel=true`, a specific reason, and its deployment-only `--skip-domain` path; do not replace this with a project-wide domain setting change or a push-triggered deployment.
