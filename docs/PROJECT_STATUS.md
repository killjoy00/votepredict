# VotePredict project status

_Last updated: 2026-09-16_

VotePredict V2 is no longer a rebuild project. The clean-slate V2 sequence is complete through production hardening, introduction forecasting, current/floor forecasting, immutable revisions, evidence storage, scheduled production forecasting, and forecast-vs-actual scoring infrastructure. The project is now in **operate, validate prospectively, and selectively expand** mode.

## Production posture

- Production application: Vercel, exact-green-main deployment workflow.
- Primary database: Neon Postgres with private owner authentication and recovery controls.
- Current/floor serving member model: `member-eb-v1.2-decay180`.
- Current/floor rollback arm: `member-eb-v1.1`.
- Minnesota 2025-26 introduction model: `intro-title-text-eb-v4`, frozen and session-pinned.
- Hourly production forecast polling: GitHub Actions, with Vercel Cron as the daily fallback.
- Process-history research: completed and manual-only; the selected enriched process candidate did not earn a prospective shadow or production action.
- Deep research: currently operationally blocked because Vercel AI Gateway requests fail until billing is enabled. Quick forecasting remains independent of that failure.

The owner Operations page is the live production source of truth. Its Production readiness panel separates the availability of core Quick/introduction forecasting from optional/blocked modes such as Deep and from planned 2027-28 provisioning.

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

As of this status snapshot, production contains 1,867 campaign-finance evidence rows historically and **453 current unsuperseded campaign-finance context items covering 200 current memberships**. These records are deliberately neutral/context-only and do not mechanically move a member probability.

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

## Current gaps

1. **Deep availability.** AI Gateway billing must be enabled or Deep should be explicitly treated as unavailable. The production runtime smoke is expected to remain red while its real Deep check cannot complete.
2. **Prospective production evidence.** The production scorecard infrastructure is built, but the project still needs a meaningful set of real pre-outcome forecasts that later resolve to official votes.
3. **2027-28 opening-day readiness.** The future session, roster, bill universe, and new introduction artifact do not exist yet and must be prepared before the next biennium begins.
4. **Durable external-evidence breadth.** Campaign finance is durable; general news/campaign-site ingestion is not yet systematic.

## Plan from here

### P0 — finish the production surface

- Enable/validate Deep if it remains a core product mode; require a successful persisted evidence/revision smoke.
- Keep the Production readiness panel as the at-a-glance source of truth for serving model, introduction integrity, scheduler health, Deep state, durable evidence, source warnings, and 2027-28 provisioning.
- Keep documentation aligned with the live serving model and current operational limitations.

### P1 — build a non-Deep durable public-evidence program

- Add a source registry for official/member/campaign websites with stable legislator identity and source type.
- Add scheduled, timestamped retrieval of campaign issue pages, press releases, and selected reputable news discovery.
- Store fetched content hashes, publication/capture dates, canonical URLs, extraction provenance, and target member/bill linkage.
- Deduplicate and supersede mutable pages rather than overwriting history.
- Expose durable evidence in member profiles and Quick forecast explanation/context even when it is non-mechanical.
- Create historical/as-of replay coverage before any new evidence class is allowed to change Quick probabilities.
- Evaluate candidate mechanical use in frozen shadows first; do not infer a vote stance from campaign finance by default.

### P1 — prepare 2027-28

- Create/test the 2027-28 legislative session and roster turnover pipeline.
- Ingest the new Revisor bill universe and initial versions automatically.
- Train/evaluate/freeze a new 2027-28 introduction artifact using only completed prior biennia.
- Verify the frozen prospective production-evidence cohort and existing future shadow protocols activate correctly.
- Run an end-to-end preseason rehearsal on a disposable Neon branch.

### P2 — measure rather than tune

Once 2027-28 begins, keep the serving model stable long enough to accumulate genuinely prospective evidence. Resolve real production forecasts to official outcomes, score Quick, and build paired Quick-vs-Deep observations if Deep is operational. Resume model research only when new evidence identifies a concrete failure pattern worth testing.

## Project milestone

The next project milestone is **2027 Opening Day Ready**:

- core production readiness green;
- Deep either operational or explicitly disabled;
- 2027-28 session/roster ingestion automated;
- 2027-28 introduction artifact frozen and deployed;
- Quick model and prospective protocols frozen before in-scope outcomes;
- scheduler, source health, recovery, and Operations checks green;
- no manual database preparation required when the first 2027 bills arrive.
