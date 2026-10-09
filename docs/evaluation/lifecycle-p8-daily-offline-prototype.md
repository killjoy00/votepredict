# P8 immutable daily capture — offline-only prototype (2026-10-09)

Tracking: [#310](https://github.com/killjoy00/votepredict/issues/310). **Status: implemented for synthetic offline rehearsal; NOT activated, NOT production-ready.**

This is the first bounded engineering prerequisite after the owner-approved [forecast-quality pivot](historical-2021-22-pivot-decision-2026-10-09.md). It **does not** change or replace the frozen `data/evaluation/lifecycle-p8-prospective-plan-v1.json` or the September 23 P8 model artifact; no new training, scores or forecasts are produced.

## Existing contracts reused

- Forecast target: strict source-chamber passage, over **all authoritative introduced bills**, not only bills reaching the floor.
- Session: `2027-2028`; daily as-of cutoff in **America/Chicago**. Each day includes only bills introduced and first observed on a **strictly earlier** calendar day; no retroactive first-seen rows.
- Process: `revisor-process-v2` and the existing P3 source-chamber state machine. Event occurred date **and** first observed date must each precede cutoff. `source_deferred` or unverified/intraday process does not imply the bill had zero process activity; the missingness is explicit.
- Bill versions: both official published date **and** source-observed date must be strictly before cutoff; same-day versions cannot enter historical replay. Original source URLs/hashes and version identity are retained.
- Outcomes: the input schema rejects target/outcome/unrecognized fields and terminal outcome stage kinds. No target labels, post-cutoff votes, member NAY fabrication, P7 lineages or historical-vote outcome columns are accepted.
- Model identity: each row references the **already-frozen** P8 model-content SHA-256 `abcf583153939d46aa021dccf2afe61d698ad4538a981059cdee265c03166a65`; this prototype **does not load or revalidate the full model bytes and does not compute predictions**. A hash reference by itself is not a model execution.
- Raw external evidence and reconstructable authorship are **not consumed** in this first pass. The row explicitly reports `not_collected` / `not_reconstructed`; do not interpret empty feature counts as no public evidence existed.

## Offline-only implementation

- `src/evaluation/lifecycle-p8-daily-capture.ts`: pure, strict, outcome-free builder from **caller-supplied synthetic/as-of source observations** to deterministic member-label-free daily P8 feature rows. It checks official Revisor HTTPS source provenance, SHA-256 lineage, parser version, calendar dates, fixed session identity, duplicate bill identities, and same-day/late-observation exclusions. Rows are sorted by stable bill identity.
- `src/evaluation/lifecycle-p8-offline-store.ts`: local atomic/exclusive append-only file publication, one JSON artifact per cutoff date. Uses a temporary file and exclusive hard-link creation. If an identical day is replayed, preserve the original first-capture timestamp; if the reconstructed content differs, **throw** and never change the earlier day's contents. Each row and batch is SHA-256 checked before storage.
- `scripts/rehearse-lifecycle-p8-daily-capture.ts`: **fixed synthetic inputs only**, no external/real-data arguments or credentials. Writes to a disposable OS temp directory, verifies first-write/replay behavior, reports counts and hashes, deletes files on exit.
- `tests/lifecycle-p8-daily-capture.test.ts`: exercises source chronology, observed-vs-occurred timing, Chicago day/DST boundaries, post-introduction eligibility, parser/source mismatches, fail-closed outcome fields, deferred-process missingness, deterministic hashes, immutable replay/conflict behavior and strict event-time selection.

Run the fixture-only rehearsal manually from a checked-out repository:

```bash
npm ci --no-fund --no-audit
npm run rehearse:lifecycle:p8:offline
```

Normal repo CI runs unit tests with `npm test` plus TypeScript/build checks against a disposable local PostgreSQL container; **neither the script nor the tests use PostgreSQL**. No workflow schedules this rehearsal.

## Remaining gates: do NOT interpret this as activation

1. Independently verify a future **durable, owner-approved frozen P8 model artifact source** and its exact hash before allowing model predictions; the older GitHub Actions artifact is time-limited and must not be assumed to remain retrievable forever.
2. Implement a separately reviewed **as-of official-data adapter** that can enumerate the complete authoritative 2027 bill universe, prove source observation/publishing timestamps, safely track deferred-source cases, and never read outcome labels at capture time. The current builder takes only supplied observations; **no live sources were read**.
3. Add **frozen P4/P5, introduction-v4 and conditional P6 probability scoring** using immutable model bytes and strictly prior member/vote history; record model/data versions and explicit fallback/missingness. These outputs are intentionally `predictionsComputed=false` today.
4. Decide and separately authorize the long-lived append-only production storage/permissions, idempotent concurrency behavior across workers, completeness/coverage monitoring, resource budget and retry behavior. This prototype uses only local temporary files and has no production DB migration.
5. Preserve [#732](https://github.com/killjoy00/votepredict/issues/732) Vercel pause and unverified live-cron status. A future capture cadence/deploy must receive **fresh, specific owner approval**; no schedule, external credential or production route is configured here.
6. Retain the frozen P8 sealed evaluation rule: no scoring reveal before **2028-07-01T00:00:00Z**, complete strict labels, and at least **95% introduction coverage, 90% lifecycle capture coverage and 95% process-source coverage** on scored rows. Daily rows are source records; after the reveal only, event-time evaluation uses the **latest earlier-day** capture and never same-day hindsight.

**Acceptance for this PR:** exact-head normal CI green; fixed-fixture rehearsal tests green; no changes to `migrations/`, frozen plan/model files, serving probabilities, `vercel.json`, scheduled workflows, real 2027 data or production. Only this offline prototype and its tests/docs/scripts are authorized.
