# #864 — Existing GitHub Neon key is sufficient for a protected READ ONLY historical source count

**Correction to the previous restrictive access note (October 11, 2026).** A new database key or a newly provisioned strict-SELECT-only SQL login is **NOT required** for a narrowly scoped, fixed-shape VotePredict historical evidence source-count audit. The protected GitHub Actions environment `evidence-readonly-sandbox` already contains `NEON_API_KEY` and VotePredict project-ID variable. The full successful [original media-count SQL run #38093691235](https://github.com/killjoy00/votepredict/actions/runs/38093691235) and [original three-district campaign source read #38089505309](https://github.com/killjoy00/votepredict/actions/runs/38089505309) prove that the key can locate the existing VotePredict project, its **single expressly marked existing default branch**, associated database, compute and owner-role connection URI, then perform approved SQL **READ ONLY** and explicit `ROLLBACK`. It is incorrect to treat the ChatGPT Neon connector's inability to discover this project as a database-access blocker when its **existing GitHub Actions secret** succeeds.

## What this one-shot does

The [dedicated source workflow](../../.github/workflows/senate-864-existing-neon-key-cross-track-counts.yml) reuses only this already working mechanism. The sensitive key is unavailable on PR jobs, CI test jobs and forks. It is available only after an unusually marked **single reviewed main commit**, successful independent clean-db migrations, full repo check and dependency audit on that exact main SHA, a GitHub protected environment approval (when configured), and separate in-script run/identity checks. Ordinary later pushes, PRs, schedules, reruns, and unmarked commits cannot run the protected SQL.

The reviewed [fixed-only SQL script](../../scripts/audit-senate-864-neon-one-key-readonly-coverage.ts) makes Neon **GET** requests (no project/branch/role creation), opens TLS with an established existing Postgres role, sets a default transaction **READ ONLY** and begins one explicit `REPEATABLE READ READ ONLY` transaction. It verifies the actual project/database/role identity and the eight required existing VotePredict tables before running only **seven hardcoded aggregate SELECT statements** with no arbitrary SQL input. It closes with `ROLLBACK` on both success and failure. No private individual identities, records, evidence row IDs, source URLs, donors, campaign excerpt text, media originals or credentials are printed or uploaded. Only year/family aggregates appear in sanitized logs; they are not evidence of named legislative votes or stances.

The seven bounded existing-data observations are:

| Existing database family | Counts and missingness read, without private row export |
| --- | --- |
| Actual Senate memberships | 2021–25 distinct stored people and membership rows, unknown start/end bounds |
| CFB finance | Year / stored candidate finance source subtype; evidence rows, distinct source documents, stored eligibility policy debts, missing row keys, missing stored availability-proof digests |
| Committee original minutes | Persisted original source documents by year, duplicate URL indications, missing SHA and meeting/committee metadata |
| Committee vote events | Persisted `committeeVote=true` events by year, missing source document/external key/tally |
| Committee named individual choices | Persisted committee member-vote rows, unresolved member identity/source name |
| First-party campaign issue evidence | Stored Senate campaign-site evidence by year, distinct source documents, missing source SHA or timestamp |
| Wayback-indexed media context | Existing 2021–25 and outside capture-year context rows, within-year distinct documents, missing original archived locator/source checksum |

These are **actual data observations only when the protected run succeeds**. The historical reference baseline is the independently verified **95** actual LRL 2021–25 senators, **79** currently with at least one source-authenticated first-party issue excerpt research lead, **1,592** electronically indexed 2022–25 committee meetings with **1,452** original linked Minutes-PDF references, **71** independently audited 2023/24 year-end CFB report-version references, and **794** in-study stored media context rows from the previous protected Neon read. Data may have changed between snapshot dates; a differing live count is a discrepancy to investigate, **not** an error to paper over. The protected Neon role used for this audit may still possess privileges outside the one enforced READ ONLY transaction.

## Remaining step needed for full existing-source reconciliation

A count-only audit does **not** compare each archived Senate minute's original SHA and specific named choice directly against each database `vote_events` / `member_votes` row, each CFB original report transaction proof against a stored row, each campaign-page original hash against a stored evidence item or each media archival copy against a personally attributed verified quote. Doing those needs separately reviewed **source-by-source in-memory comparisons or a private restricted per-row export**, exact original binary receipts and source identities. Never release sensitive source rows to GitHub logs/artifacts just because a management API key works. A permanently restricted SELECT-only SQL role would be a stronger defense for a *bulk* private data export, but should not be inaccurately presented as a prerequisite for this safe aggregate audit.

**Not altered:** No write, migration, backfill, source ingestion, published date repair, as-of eligibility promotion, training/serving/model/scheduler/2027, Senate floor expansion or agency contact. The 2021 official print-only committee universe, 2022 printed-versus-electronic discrepancy, legally owed finance report denominator, historical exact CFB report public-by, full campaign-domain universe and statewide published-media denominator remain unknown. Issue #864 stays OPEN.


## Follow-up: verified GitHub-visible sanitized result receipt (one-shot V2)

The initial independently tested V1 one-shot main-commit workflow could be read
in the web GitHub Actions UI but the current connected GitHub API only exposes
pull-request-associated workflow run lists, not the new protected main-push run.
Thus a successful PR/merge alone does not independently establish the count
outcome. We must not report that live database counts succeeded without
an authenticated successful protected run.

The V2 marker is SENATE_864_EXISTING_NEON_KEY_COUNTS_ONESHOT_20261011_V2.
After the marked, independently reviewed main revision passes its own clean
local Postgres and full repository CI, the existing protected GitHub Neon
read-only job runs seven immutable aggregate SELECTs and explicitly ROLLBACKs.
The protected secret-bearing job has no GitHub issue-write permission.
On genuine success it emits only a capped base64-encoded JSON of prevalidated
year/family-grouped **nonnegative integer counts** as an Actions job output,
never raw private source rows, passwords, donor records, archived article
bodies, or exact evidence-row URLs.

A distinct **keyless** job, after success *or fail-closed failure*, has
GitHub **issues: write** permission but **no protected Neon environment and
no secret**. It strictly revalidates the source result schema, transaction
read-only and ROLLBACK attestations, and every numeric aggregate row. It then
posts one self-contained, sanitized success table to
[issue #864](https://github.com/killjoy00/votepredict/issues/864)
or an explicit fixed-safe-phase failure without private database errors.
The issue comment links the exact GitHub workflow run for later inspection.
It cannot perform SQL or retrieve the Neon key. If the GitHub environment
has a required human reviewer, approval is still enforced by GitHub and
cannot be bypassed by either job.

This is a *visibility mechanism*, not a SQL-role privilege escalation,
new read policy, raw row export, statement evidence, or source-completeness
certification. Source-level exact document joins and official per-year
denominators remain separate requirements even after a successful count.


## Verified first protected run and reviewed V3 correction

[Protected V2 main Actions run #38192700703](https://github.com/killjoy00/votepredict/actions/runs/38192700703)
**reached the actual existing VotePredict-selected Neon default branch**,
passed project/database/SQL READ ONLY identity and all eight table checks,
completed the full bounded Senate **roster** SELECT, then **FAILED CLOSED**
during the finance group. The independently separate keyless job successfully
published [its exact safe failure receipt in #864](https://github.com/killjoy00/votepredict/issues/864).
No previous partial cohort totals were falsely presented as completed.
Neon access or secret availability was **not** the blocker.

The finance query joined the *entire* finance evidence corpus with broad
OR conditions spanning stored membership chamber and arbitrary metadata
chamber. Since the source documents have no standalone source-kind index,
the resulting planner path might be expensive. The live failure occurred
approximately one server-side 15-second statement-timeout window after
the roster query, strongly suggesting but **not independently proving** a
statement timeout. Original PostgreSQL errors are intentionally suppressed
to avoid leaking private connection information.

V3 changes **only the finance SELECT's source scope**: it starts from
**actual Senate memberships in the three 2021–2026 session slugs**, joins
the indexed evidence_items.membership_id relation, then source_documents,
and filters to the four existing candidate-finance source kinds.
It uses explicit SELECT-column ordinal grouping to avoid ambiguity.
Unlike V2, it **does not claim** to cover finance rows that have no
persisted membership ID and merely carry a metadata chamber field.
That missing population requires a separately reviewed, safely bounded
future source query. It does not promote any stored as-of eligibility.

V3 also classifies PostgreSQL SQLSTATE values into fixed safe categories
(e.g., statement timeout versus schema/grouping problems); no raw SQL,
connection string, private row, role or exception text enters logs,
GitHub issues or workflow artifacts. All seven source-group counts remain
bounded SELECT-only inside one REPEATABLE READ READ ONLY transaction with
explicit ROLLBACK and a separate **keyless** issue-comment reporting job.

Successful V3 means **bounded DB aggregate coverage**, not complete original
CFB report-to-transaction matching, 2021 printed committee vote recovery
or media senator-speaker attribution. Keep #864 OPEN.

**Additional V3 preflight:** before any protected key is supplied, the exact reviewed main-commit CI job uses only its disposable localhost PostgreSQL (migrated from scratch, local postgres role) to run `EXPLAIN` **without `ANALYZE`** on all seven immutable SELECT statements. This catches schema, alias/grouping and SQL syntax problems locally without executing evidence scans or contacting Neon. It then runs the full suite and dependency audit as before. This compile check does **not** prove query performance on the real database, which is why the protected SQL statement timeout and safe SQLSTATE error classification remain enforced.


## V4 observability correction: test SQL on PR and report pre-key failures

The historical V2 protected Actions run **definitively failed during its
finance aggregate** after completing an actual existing-DB roster SELECT.
V3 changed the finance SELECT to the restricted indexed Senate membership
subset and added a strictly disposable *main-push* SQL EXPLAIN preflight,
but the existing issue reporter still did not run if that pre-secret main
verification failed, leaving another visibility gap. **Absence of a new
reporting comment does not prove what happened.**

V4 makes that original seven-query SQL compilation run in a dedicated
**unprivileged same-repo PR check** as well, using only a disposable
PostgreSQL container and local schema migrations. It never sees
NEON_API_KEY, any other Neon secret, the actual SQL password, donor/source
rows, or a production network connection. Invalid schema/query plans
fail the PR directly, before a protected key can become available.
A second independent post-main CI still performs the same compilation,
entire application test/build check and dependency audit on the **exact
merged main commit** before the protected audit runs.

The existing isolated **keyless** issue-comment job now also reports
when the full **pre-secret verification failed**. Consequently a genuine
V4 post-main run can produce a verifiable comment for one of three
outcomes: pre-secret CI failure, protected READ ONLY SQL failure with
only a fixed safe last phase, or protected READ ONLY SQL SUCCESS with
sanitized year/family aggregates and confirmed ROLLBACK.

All three outcomes preserve the distinction between the actual existing
Neon default branch, independently proven deployed production bindings,
the source completeness denominator and per-document source-to-DB
row-level equality. #864 stays OPEN.
