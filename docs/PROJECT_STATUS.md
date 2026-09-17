# VotePredict project status

_Last updated: 2026-09-17_

VotePredict V2 is no longer a rebuild project. The clean-slate V2 sequence is complete through production hardening, introduction forecasting, current/floor forecasting, immutable revisions, evidence storage, scheduled production forecasting, forecast-vs-actual scoring infrastructure, and the automated 2027-28 Opening Day transition path. The project is now in **operate, validate prospectively, and selectively expand** mode.

## Production posture

- Production application: Vercel, exact-green-main deployment workflow.
- Primary database: Neon Postgres with private owner authentication and recovery controls.
- Current/floor serving member model: `member-eb-v1.2-decay180`.
- Current/floor rollback arm: `member-eb-v1.1`.
- Minnesota 2025-26 introduction model: `intro-title-text-eb-v4`, frozen and session-pinned.
- 2027-28 introduction artifact: frozen from completed prior-biennium data and prepared for the future session; it does not use 2027 outcomes.
- Hourly production forecast polling: GitHub Actions, with Vercel Cron as the daily fallback.
- 2027-28 source/bootstrap readiness: automated and guarded; production remains fail-closed until authoritative future-session sources are plausible.
- Release migration integrity: PR #231 adds a read-only exact migration-ledger gate before Vercel production deployment so code cannot silently outrun the production database.
- Process-history research: completed and manual-only; the selected enriched process candidate did not earn a prospective shadow or production action.
- Deep research: currently operationally blocked because Vercel AI Gateway requests fail until billing is enabled. Quick forecasting remains independent of that failure.

The owner Operations page is the live production source of truth. Its Production readiness panel separates the availability of core Quick/introduction forecasting from optional/blocked modes such as Deep and from 2027-28 source provisioning.

## Data posture

The authoritative Minnesota introduced-bill universe contains 31,010 bills across the 2021-22, 2023-24, and 2025-26 biennia. The current/floor historical corpus contains 1,264 official passage vote events.

The dated Revisor process-history corpus covers 659 of 660 targeted historical passage bills, with one explicit malformed-source exclusion (`HF3769`), and contains 7,819 dated process events. This corpus is retained for research; the frozen process-history screen did not justify changing serving probabilities.

## Durable public evidence

External public evidence is **not synonymous with Deep**. VotePredict has a durable evidence layer built on `source_documents`, `evidence_items`, and provenance/supersession relationships. Evidence can be ingested and displayed without invoking an AI research run.

Current production evidence includes:

- official Minnesota Campaign Finance and Public Disclosure Board candidate-contribution aggregates;
- candidate general-expenditure aggregates;
- independent-expenditure aggregates;
- official member/committee context;
- curated member statements and official news;
- selected interest-group positions and official bill-status facts.

The September 16 status snapshot contained 1,867 campaign-finance evidence rows historically and **453 current unsuperseded campaign-finance context items covering 200 current memberships**. These records are deliberately neutral/context-only and do not mechanically move a member probability.

### What is currently Deep-specific

Deep is the mechanism that performs targeted fresh research for consequential/uncertain members, verifies source-backed directional evidence, applies the evidence-impact policy, and creates a new Deep revision. Its preloaded context currently includes:

- GDELT news-index results for the bill and selected members;
- campaign-finance catalog references;
- deterministic campaign-finance snapshots already available to VotePredict.

GDELT results are an index/discovery surface; article content still requires source verification before it can become evidence.

### What is not yet a durable recurring feed

VotePredict does not yet have a general recurring crawler/ingester for:

- campaign websites and issue pages;
- legislator/candidate press-release archives outside the existing curated evidence;
- arbitrary news article content discovered through GDELT;
- endorsements or organizational scorecards at broad coverage.

Those sources can be added to the durable evidence layer without requiring Deep at ingestion time. The correct architecture is **ingest broadly, preserve source/date/provenance, expose as context, and evaluate separately before allowing a new evidence class to move probabilities**.

Campaign-finance relationships in particular must remain context rather than an inferred vote stance unless an independently evaluated model demonstrates predictive value. A contribution, employer, donor category, or independent expenditure does not by itself establish how a legislator will vote.

## Modeling posture

Retrospective research has now screened member-history decay, participation, issue conditioning, analogue alternatives, process context, richer dated process history, event-level uncertainty, and passage fragility. The strongest accepted production change was 180-day member-history decay.

The recent process-history candidate slightly improved expected chamber vote-count error but worsened passage Brier score in both validation and descriptive test periods, so the frozen gate correctly rejected it.

The project should therefore reduce broad retrospective feature searching on the same 2021-26 outcomes. New model work should generally be driven by a predeclared hypothesis, a specific observed failure mode, or genuinely new prospective evidence.

The frozen `member-history-cap20-prospective-v1` experiment remains intentionally bound to its declared `member-eb-v1.1` baseline. The current `member-eb-v1.2-decay180` serving model is ineligible for that old experiment; any decay180 cap candidate must be a newly frozen protocol rather than a redefinition of the existing one.

## 2027-28 Opening Day readiness evidence

The application-level transition path is now rehearsed before any 2027 outcomes exist:

- session/roster turnover and guarded source readiness are automated;
- live Revisor House/Senate bill discovery, status, introduction metadata, and initial text/version persistence are automated;
- the 2027-28 introduction serving artifact is frozen from completed prior biennia;
- prospective production-evidence seeding and non-serving future-shadow activation have deterministic rehearsals;
- a clean-database integration rehearsal runs the full migration chain and simulates January 1, 2027 with synthetic, parser-realistic Minnesota source responses;
- that rehearsal verifies 130 House + 65 Senate memberships, session rollover, bill-universe/status persistence, initial-text hashing, passage-action leakage blocking, prospective cohort seeding, and idempotence;
- the rehearsal found and fixed a real handoff defect in live Revisor persistence: camelCase URL payload keys did not match the PostgreSQL `jsonb_to_recordset` snake_case fields, which would have left bill source URLs null and prevented status refresh selection;
- the repaired path passed PR CI, post-merge main CI, exact-green-main deployment, production scheduler, production Opening Day readiness/bootstrap, and public-evidence refresh checks.

The production-engine preseason rehearsal is also complete without modifying production:

- a disposable Neon branch was cloned directly from production and confirmed to have the expected pre-rollover state: 2025-26 current, with 2027-28 present but zero memberships and zero bills;
- an isolated Neon rehearsal database on that branch successfully ran the schema path through `0012`, including the approved `DROP CONSTRAINT`/replacement steps in `0011` and `0012`;
- the final constraints include `source_chamber_passage` and the complete process-history stage set;
- a separate temporary Neon migration branch cloned from production successfully applied the prepared one-time production reconciliation and produced an exact 12-entry migration ledger with the expected checksums;
- no production database rows or constraints were changed by either rehearsal.

That production-shaped rehearsal exposed a release-integrity defect: the live production migration ledger stops at `0010`. The expanded `0012` stage-event constraint is already present structurally, apparently from an out-of-band operation, while the `0011` `source_chamber_passage` forecast constraint is not present. The production repair is prepared and tested on a temporary Neon branch but still requires explicit production-apply approval.

## Current gaps

1. **Production migration reconciliation.** Apply the prepared, production-tested `0011`/`0012` reconciliation and ledger repair, then require the new exact migration-ledger deployment gate for every release.
2. **Deep availability.** AI Gateway billing must be enabled or Deep should be explicitly treated as unavailable. The production runtime smoke is expected to remain red while its real Deep check cannot complete.
3. **Prospective production evidence.** The production scorecard infrastructure is built, but the project still needs a meaningful set of real pre-outcome forecasts that later resolve to official votes.
4. **Durable external-evidence breadth.** Campaign finance and guarded publisher-verified news ingestion are durable, but broader campaign-site/press-release coverage is not yet systematic.

## Plan from here

### P0 — finish production release integrity

- Apply the prepared production migration reconciliation after explicit operator approval.
- Verify the live production ledger contains exact checksums for all repository migrations through `0012` and that both widened constraints match the repository definitions.
- Merge the read-only deployment migration gate so future exact-main releases fail closed on missing, unexpected, or checksum-mismatched migrations.
- Decide whether Deep remains a core product mode. If yes, enable AI Gateway billing and require a successful persisted evidence/revision smoke; otherwise explicitly treat Deep as unavailable while keeping Quick independent.
- Keep the Production readiness panel as the at-a-glance source of truth for serving model, introduction integrity, scheduler health, Deep state, durable evidence, source warnings, and 2027-28 provisioning.

### P1 — build a non-Deep durable public-evidence program

- Expand the source registry for official/member/campaign websites with stable legislator identity and source type.
- Expand scheduled, timestamped retrieval of campaign issue pages, press releases, and selected reputable news discovery while retaining publisher verification.
- Store fetched content hashes, publication/capture dates, canonical URLs, extraction provenance, and target member/bill linkage.
- Deduplicate and supersede mutable pages rather than overwriting history.
- Expose durable evidence in member profiles and Quick forecast explanation/context even when it is non-mechanical.
- Create historical/as-of replay coverage before any new evidence class is allowed to change Quick probabilities.
- Evaluate candidate mechanical use in frozen shadows first; do not infer a vote stance from campaign finance by default.

### P1 — prepare 2027-28

- [x] Create/test the 2027-28 legislative session and roster turnover pipeline.
- [x] Automate live Revisor bill-universe, status, introduction, and initial-version ingestion.
- [x] Train/evaluate/freeze the 2027-28 introduction artifact using only completed prior biennia.
- [x] Verify the frozen prospective production-evidence cohort and eligible future shadow protocols activate correctly without outcome use.
- [x] Rehearse the full application transition against a clean disposable PostgreSQL database in CI.
- [x] Validate a disposable Neon production clone has the expected pre-Opening-Day baseline.
- [x] Execute the complete Neon schema write rehearsal through `0012`, including the constraint-replacement migrations.
- [x] Validate the one-time production migration reconciliation on a temporary Neon branch cloned from production.

### P2 — measure rather than tune

Once 2027-28 begins, keep the serving model stable long enough to accumulate genuinely prospective evidence. Resolve real production forecasts to official outcomes, score Quick, and build paired Quick-vs-Deep observations if Deep is operational. Resume model research only when new evidence identifies a concrete failure pattern worth testing.

## Project milestone

The next project milestone remains **2027 Opening Day Ready** until release integrity is reconciled in production:

- core Quick/introduction production readiness green;
- Deep either operational or explicitly unavailable;
- 2027-28 session/roster ingestion automated;
- 2027-28 introduction artifact frozen and deployed;
- Quick model and prospective protocols frozen before in-scope outcomes;
- scheduler, source health, recovery, and Operations checks green;
- disposable PostgreSQL and Neon preseason rehearsals complete;
- production migration ledger reconciled and deployment drift gate active;
- no manual production database preparation required when the first 2027 bills arrive.
