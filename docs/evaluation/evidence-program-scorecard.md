# Evidence program operating scorecard

_Last reconciled: 2026-10-08. Tracker: [#847](https://github.com/killjoy00/votepredict/issues/847). Scope: present evidence status and refresh operations, not future-session planning._

This is a **dated, provenance-linked index**, not a fresh production database query. Never combine general persisted context, reviewed semantic claims, and unique directional feature rows into one evidence count.

## Program state

| Lane | Status | Meaning and source |
| --- | --- | --- |
| Eight-family historical/public source expansion | Closed within frozen source/proof boundaries | [#355](https://github.com/killjoy00/votepredict/issues/355), [#459](https://github.com/killjoy00/votepredict/issues/459), [#514](https://github.com/killjoy00/votepredict/issues/514); intentionally non-exhaustive |
| Senate legislative/evidence corpus | Closed within journal, electronic-minute and attribution boundaries | [#477](https://github.com/killjoy00/votepredict/issues/477); missing source or speaker remains unknown |
| Evidence Quality strict directional density | 92 unique nonzero member-event rows in frozen v1.8 | [PR #782](https://github.com/killjoy00/votepredict/pull/782), [acceptance](https://github.com/killjoy00/votepredict/issues/718#issuecomment-6041784252); non-serving |
| 2021-22 historical recovery | Open: 9 / 35,510 strict directional rows | [#718](https://github.com/killjoy00/votepredict/issues/718); narrowly bounded, no broad reopened crawls |
| Current public-evidence refresh | **Suspended; manual-only workflow** | [workflow](../../.github/workflows/public-evidence-refresh.yml), [#732](https://github.com/killjoy00/votepredict/issues/732); still Vercel credential-dependent |
| Vercel production automation | Repository triggers paused; **deployed cron state not verified** | [PR #733](https://github.com/killjoy00/votepredict/pull/733) / [#732](https://github.com/killjoy00/votepredict/issues/732); no current Vercel/DB probe performed |

## Directional features (frozen, NOT serving probabilities)

Canonical Evidence Quality v1.8 from PR #782, accepted 2026-10-07:

| Biennium / evaluation use | Target member-event rows | Exact-bill | Reviewed applicability | Combined directional |
| --- | ---: | ---: | ---: | ---: |
| 2021-22 training | 35,510 | 3 | 6 | **9** |
| 2023-24 validation | 49,827 | 32 | 0 | **32** |
| 2025-26 descriptive | 50,120 | 3 | 48 | **51** |
| **Total** | **135,457** | **38** | **54** | **92** |

The frozen target universe has 1,339 events and 611 memberships. From v1.7 to v1.8, reviewed applicability moved 6 -> 54 and combined directional rows 44 -> 92, with **zero exact-bill changes, overlaps, or overwrites**. Canonical v1.8 NDJSON SHA: `2d4ed4993fd7efce5a0c7de2a4331f1f3a0f163e323f437c6f9e7dacf266a30b`; gzip SHA: `42f9d79bd69df63b46a2f0f5c1636f4cc7f8fd0ec0a65ae905d85f28fd436700`. Main audit run `37647888556`, main CI `37647888675`.

**Separate review-only finding:** The completed 2025-26 House cohort-2 sequence through [PR #845](https://github.com/killjoy00/votepredict/pull/845) identified **49 aligned claim/event pairs**. These are **context-only**, none integration-ready, and must **not** be added to the v1.8 feature-row count. They add nothing to 2021-22 training density.

**Another distinct substrate:** The #459 canonical historical *37-feature* as-of research matrix is not the v1.8 Evidence Quality directional matrix, even though both refer to the 135,457 member-event target universe. Neither research feature count nor all persisted evidence items denotes directional feature coverage. No model fitting or serving promotion is authorized.

## Persisted source-family checkpoints (heterogeneous, bounded)

These are the *latest explicitly dated reconciled source milestones*, **not a live October 8 database read**:

| Family | Recorded count | Meaning / unresolved portion | Checkpoint |
| --- | ---: | --- | --- |
| Candidate finance | **52,374** | Historically eligible member-linked row keys, plus **8,879** timing-unproven; disclosure/publication proof required, not transaction date | [#355 historical salvage](https://github.com/killjoy00/votepredict/issues/355) |
| Independent expenditures | **2,889** | Historically eligible distinct row keys of 7,048 persisted; **4,159** remain timing-unproven; no financial-influence-to-vote inference | [#355](https://github.com/killjoy00/votepredict/issues/355) |
| Lobbying | **811** | Exact principal rows with conservative historic availability proof; **7,183** of 7,994 principal rows still timing-unproven | [#355](https://github.com/killjoy00/votepredict/issues/355) |
| Local/trade news | **948** | Historically timed context; session split **313 / 273 / 362**, 44-source final depth pass, run `37095808223` | [#514](https://github.com/killjoy00/votepredict/issues/514) |
| Organization publications | **118** | Dated endorsements, questionnaires, scorecards; no automatic specific-bill vote stance | [#355](https://github.com/killjoy00/votepredict/issues/355) |
| Senate issue positions | **350 / 551 / 405** | By 2021-22 / 2023-24 / 2025-26; issue statements are *not* exact-bill positions | [#477](https://github.com/killjoy00/votepredict/issues/477) |
| Senate named floor votes | **29,241 / 71,644 / 38,711** | Resolved per-member journal rolls by biennium; passage vs amendment/procedural mechanics remain distinct | [#477](https://github.com/killjoy00/votepredict/issues/477) |
| Senate electronic minute documents | **1,452** | Official exposed 2022-25 collection; 2021 print minutes not collected | [#477](https://github.com/killjoy00/votepredict/issues/477) |
| Safe Senate caption-derived speaker remarks | **0** | 3,048 indexed recording pages, no reliable direct speaker attribution | [#477](https://github.com/killjoy00/votepredict/issues/477) |

A separate **340,852 durable evidence-item** statistic came from an **October 4, 2026 read-only snapshot** (run `37244121897`). It is **not** a fresh current count, and its mixed-source items cannot be added to the 92 directional rows.

The immutable `data/evaluation/historical-evidence-source-family-freeze-v1.json` represents the **October 2** closeout. Its initial finance, IE, lobbying and news numbers predate subsequent explicitly recorded salvage and press-depth milestones. Do not rewrite that frozen input to make its numbers appear newer.

## Open evidence gaps and stops

- The **2021-22 training bottleneck is 9 / 35,510**. Strict coverage, not total documents, determines the value of further historical recovery.
- Public [2021 Senate agenda audit](2021-senate-public-source-audit.md): **8** dated agendas, **14** unique frozen bills, **17 existing** candidate-event associations, but **0** verified recording source bytes and **0** attributable directional member statements. Meeting agendas remain discovery metadata.
- Caption proximity, anonymous ASR, voice/count-only committee actions, donations, lobbying and organizational association must **never** become invented individual vote positions.
- **No contact with the Minnesota Legislative Reference Library or any other office.** No email, draft, phone, requests, digitization or visits. Work only with independently accessible public online sources. This applies to all future work under #718 and #847.
- Broad exhausted Wayback, member-publication, House attachment PDF and unproven finance timing proof lanes stay closed absent a genuinely novel, independent proof surface.
- All new historical/context records remain nonmechanical; serving Quick baseline is `member-eb-v1.2-decay180` and unchanged.

## Current evidence-refresh operating posture (source-controlled only)

| Component | Verified on current main at reconciliation | Unknown or not approved |
| --- | --- | --- |
| Evidence refresh job | `.github/workflows/public-evidence-refresh.yml` has only `workflow_dispatch`, requiring `run_vercel == true` and current main | No automatic cadence; job intentionally **not invoked** |
| Credentials | Job runs `npx vercel env pull` before invoking a direct GitHub worker | Not a Vercel-free credential route; do not invoke under #732 |
| Worker | `scripts/run-direct-public-evidence-refresh.ts` reads that temporary environment, probes Postgres, may use authenticated Neon DB-bridge fallback, and **writes** through `runPublicEvidenceRefresh()` | Not a read-only health check; no production writes allowed for this issue |
| Git/Vercel repo configuration | `vercel.json` has `git.deploymentEnabled=false` and **no configured crons**; production deployment workflow is also manual-only | A cron on a **previously deployed** release might still run. Its live status is **unverified**, not disabled |
| Monitoring | Operations contains durable ingestion/freshness/yield observability code | Latest production freshness, costs and data are not re-queried |

The reproducible **repository-only** audit `node --import tsx scripts/audit-evidence-operating-posture.ts` checks the 15 pinned #733 workflows, manual approval gates, repo Vercel deployment/cron configuration and relevant documentation. **It does not call GitHub, Vercel, production DB or sources** and cannot determine live cron status.

## Proposed independent-refresh path — not enabled

1. Establish a protected GitHub environment with a dedicated, least-privilege **Neon direct database credential** approved separately. Keep **read-only freshness** and **ingestion write** credentials/roles separate. Do not silently pull the production environment from Vercel or use the existing CRON_SECRET/Neon bridge. Such credentials are **not claimed to exist** today.
2. Prove direct connectivity, bounded queries and safe credential redaction first on non-production/test data; a future production read-only audit requires an explicit separate authorization and must emit a timestamped, immutable freshness/yield report.
3. Only after a further explicit write approval, modify the existing direct GitHub refresh worker to accept a scoped secret without a Vercel env file; use a manual, main-only, confirmation-gated **one-member canary** with time/cost budgets. Retain idempotent ingestion and the existing batch hard ceiling of 24.
4. Verify no duplicate capture, unbounded external fetch or missing-source-to-zero assumption. Review source family freshness, inserts/reuses, failures, unresolved identities, backend runtime cost and operational impact before even proposing a schedule.
5. Treat the previously registered production cron question as a **separate #732 live-state gate**. This project does not call or redeploy Vercel to resolve it.

## Vercel-independent sandbox health implementation (unactivated)

The implementation branch for #847 adds a **sandbox-only** read-only proof path. This is not a production refresh and does not create a credential, GitHub environment, Neon branch, or recurring trigger. The Vercel-dependent, write-capable legacy `public-evidence-refresh.yml` remains paused and unchanged.

| Capability | Committed path | Execution boundary |
| --- | --- | --- |
| Standalone bounded read-only SQL auditor | `src/operations/evidence-neon-readonly.ts` | Restricts source tables, selects only latest pipeline metadata and six source-kind last-fetch timestamps, and requires a least-privilege SQL role |
| Offline-default CLI | `scripts/audit-evidence-neon-readonly.ts` | No arguments / `--offline`: zero connectivity. `--connect`: **sandbox-only**, requires verified TLS and explicit environment acknowledgement |
| Manually gated GitHub Action | `.github/workflows/evidence-neon-readonly-sandbox.yml` | Sole trigger `workflow_dispatch`; default-off `run_readonly=false`, exact phrase, `main` branch and `evidence-readonly-sandbox` GitHub environment; no Vercel secrets/CLI/HTTP or database bridge |
| Static and integration tests | `tests/evidence-neon-readonly.test.ts` and `tests/evidence-operating-posture.test.ts` | Pure fake-client fail-closed tests plus a disposable **localhost-only CI PostgreSQL** least-privilege role test |

**No live Neon project, live branch, GitHub environment approval rules, or secret has been configured or verified in this session.** Merely merging the new workflow does not authorize or cause a read. Do not run it until all preconditions below are independently verified. The workflow **cannot itself prove** that an operator supplied a *sandbox* Neon endpoint; the protected environment and user-managed branch/credential scope are essential.

To provision separately **only in an approved disposable Neon branch**, have an appropriately authorized operator create a **SQL-level** dedicated non-owner role with a strong privately generated password. Role creation or grants below are *illustrative*, not executed:

```sql
-- Execute only on an explicitly approved, disposable Neon sandbox branch.
-- Substitute the actual sandbox database name and a privately generated secret.
CREATE ROLE vp_evidence_ro_sandbox LOGIN
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
  PASSWORD '<privately-generated-unique-secret>';
GRANT CONNECT ON DATABASE <sandbox_database> TO vp_evidence_ro_sandbox;
GRANT USAGE ON SCHEMA public TO vp_evidence_ro_sandbox;
GRANT SELECT ON public.ingestion_runs, public.source_documents
  TO vp_evidence_ro_sandbox;
-- No INSERT, UPDATE, DELETE, TRUNCATE, CREATE, GRANT ALL or default table grants.
```

Configure `evidence-readonly-sandbox` with explicitly reviewed branch/reviewer restrictions, environment-secret `EVIDENCE_READONLY_SANDBOX_URL` and variable `EVIDENCE_READONLY_SANDBOX_ROLE`. The URL must be an **actual non-production Neon Postgres endpoint** with a matching username and `sslmode=verify-full`; no fallback to owner credentials, production env pulls or the authenticated database bridge. The auditor additionally enforces `BEGIN ... READ ONLY`, a single DB connection, local statement/lock/idle timeouts, absence of superuser/DDL/DML table rights, and explicit SELECT grants before reading ingestion status or source timestamps. A missing source row is **not observed**, never recorded as zero evidence.

For development: `node --import tsx scripts/audit-evidence-neon-readonly.ts --offline` requires **no secrets or network**. The GitHub job uses `--connect` only after affirmative manual inputs and the environment gate; it does **not** run on PR, push, schedule, issue comments or CI. Do not use the production database to rehearse it under #847.

The **remaining operating gates** are: review/apply protected GitHub environment rules and sandbox-only role on a truly separate Neon branch; manually authorize one bounded sandbox read-only test; inspect the output and role proofs; then separately decide whether any production read-only check or write-capable collector is justified. Those future decisions do **not** follow automatically from green CI. The old live Vercel cron remains **unverified** under #732.

## #847 current execution ledger

- [x] Reconcile distinct evidence families, historical directional coverage and review-only results with source links and cutoff dates.
- [x] Establish a source-code-only safety test and the explicit independent refresh design.
- [x] Merge the original scorecard/docs/static guard in [PR #848](https://github.com/killjoy00/votepredict/pull/848); exact PR-head [CI 37860748651](https://github.com/killjoy00/votepredict/actions/runs/37860748651) and exact post-merge [CI 37860978280](https://github.com/killjoy00/votepredict/actions/runs/37860978280) both **success**.
- [ ] Validate live-only questions under their separate authorization boundaries. **Never** treat unverified live cron or stale freshness as verified healthy.
- [x] Implement the offline-default, sandbox-only direct-Neon read-only audit, manual GitHub gate and disposable PostgreSQL privilege tests in [PR #849](https://github.com/killjoy00/votepredict/pull/849). Exact PR-head [CI 37863019343](https://github.com/killjoy00/votepredict/actions/runs/37863019343) **success**, merge SHA `b56f16e4c34a2bd6c4fc4fa9650db0b385f87413`; follow the exact-merge [CI 37863231879](https://github.com/killjoy00/votepredict/actions/runs/37863231879). **No sandbox Neon credentials, protected environment or live check are asserted.**
- [ ] Provision and approve sandbox-only secret/role and execute bounded **sandbox** read-only proof; production health/ingestion remains independently gated.
- [ ] Any production ingestion writes or scheduled refresh still require a separate explicit approval; never resume from this audit automatically.

**Boundary:** the completed software work is repo documentation, offline configuration audit, regression tests and a manually gated, unactivated Neon sandbox reader. No Vercel contact, production database access, ingestion writes, source crawls, model fitting, serving changes, or future-session work. The live cron remains unverified and production ingestion stays paused.
