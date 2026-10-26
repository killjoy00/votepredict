# Evidence and forecasting readiness remediation

Owner authorization: October 25, 2026, “can you fix all of these?” following the
12-finding evidence/storage review. This is a bounded correctness, access,
preservation and capture package. It does not fit a model, reopen exhausted
source searches, promote evidence, activate future-session collection, or
reactivate Vercel automation.

## Implementation and completion boundary

| Review finding | Implemented remedy | Remaining boundary |
| --- | --- | --- |
| F1: committee choices labeled floor | Migration 0037 corrects the existing projection. A separate normalized vote view has one row per stored individual choice, explicit venue/question/event identity and no raw-source UNION. | A source index remains distinct from a deduplicated model matrix. No missing choices are invented. |
| F2: target text/time and mutable references | Historical target requests use only retained, pre-cutoff observations; they never fetch the current page or use mutable `bill_versions` as their historical fallback. A pinned title is required for historical runtime use; companion metadata is not borrowed from the present. Current acquisition retains the exact consumed text in an append-only content store, then seals its cutoff. Each new Quick revision stores a hashed immutable manifest with target text, model config, member inputs, selected analogues, rule and code revision. | Old revisions without a manifest are not retroactively certified. Historical requests without authenticated retained inputs explicitly fail closed; the separately corrected offline historical replay retains its own protocol. |
| F3: future supersession hides old evidence | All three Quick shadow evidence readers bind replacement visibility to the original cutoff, including source observation and system acceptance. | This is a temporal correctness fix; frozen shadow formula, vectors and thresholds are unchanged. |
| F4: permissive Deep impact policy | Serving Deep requires positive content-bound literal/person/bill/time proof. The gateway cannot supply verifier receipts through its model-output schema. Recognized URLs, confidence and legacy flags are insufficient. Original source bytes are retained and the first source observation is preserved. | Unverified Deep findings remain useful context and do not alter probabilities. A trusted source verifier must supply exact proof before mechanical impact. |
| F5: legacy finance eligibility | The new access contract invokes the existing strict exact-row finance proof helper and returns explicit publication holds; legacy `asOfEligible` alone cannot admit a feature. | Existing immutable experiments and stored legacy assertions are preserved. Missing disclosure proof remains unknown; contribution, spending and IE are separate. |
| F6: inconsistent access semantics | Bounded, versioned stable-person readers expose clocks, original/target membership, source digest, canonical identity, allowed use and exclusion reason. Website text retains its literal ownership/archive contract without subjective sincerity or stance certification. | New access is research/context only; it does not automatically become a serving feature or change existing frozen feature definitions. |
| F7: retention and exact replay | Three original Actions ZIPs are pinned, byte-verified and internally checked, with append-only database archival and network-free DB restoration. An independent owner-private persistent backup was also downloaded back and verified. New bill-text observations and forecast input manifests are append-only. | These controls resist ordinary DML, not malicious database owners capable of DDL. The independent copy is a backup, not third-party notarized WORM. |
| F8: copies/proof classes inflate support | Canonical finance identity includes family/filer/year/row hash. Website research deduplicates stable-person literal text, preserves source-copy IDs and prefers a proven observation over an unproved copy. Sparse/frozen proof classifications remain explicit. | The 92-row directional matrix and the 37-feature matrix remain separate. No old result is relabeled an untouched holdout. |
| F9: expensive broad access | Bounded family/year/member readers reject truncation. New ingestion/series-key and relationship-target indexes match the actual query predicates. The broad union remains an audit/discovery view. | Full-view counts are not a production serving pattern. Workload-specific plans/read budgets are verified separately; no search service or compute upgrade is introduced. |
| F10: insufficient evidence of predictive lift | Additional families remain non-serving. Previously failed gates, examined website outcomes and frozen prospective thresholds are preserved. | Predictive lift cannot be manufactured by a storage fix. Further promotion needs the original prospective evaluation or a separately specified new hypothesis. |
| F11: missingness, source scope, target semantics | The access contract returns `missingMeans=unknown`, explicit proof holds and zero serving permission. Runtime manifests preserve the assumed ordinary floor rule and actual member input population. | Existing archival gaps, nonbill design holds and unsupported special-rule forecasts remain excluded/scoped. Complete archive recovery is not a baseline launch requirement. |
| F12: silent/mutable capture | Append-only capture attempts expose started, completed, failed and not-applicable states. Ordered sequences handle equal timestamps. Same-content Quick/cap20 retries verify and reuse the first sealed shadow; conflicting retries hold. The owner-only Operations health surface displays failed/unfinished/unsealed counts. | A database outage also emits a fixed ledger-unavailable diagnostic; deployment, real source availability, collector scheduling and external on-call routing are not falsely claimed active. |

## Preservation receipts

`data/evaluation/research-artifact-retention-v1.json` pins the original package
SHA-256 and every internal ZIP member. The P8 model content is separately checked
against `abcf583153939d46aa021dccf2afe61d698ad4538a981059cdee265c03166a65`.
The decompressed v1.8 matrix is checked against
`2d4ed4993fd7efce5a0c7de2a4331f1f3a0f163e323f437c6f9e7dacf266a30b`
and its 135,457 rows. These are integrity checks, not fitting or scoring.

| Original artifact | Role | Original expiry |
| --- | --- | --- |
| 10772991611 | Frozen P8 model | December 22, 2026 |
| 11494634289 | v1.8 evidence matrix | January 5, 2027 |
| 10660140930 | Corrected combined historical robustness | December 20, 2026 |

The separate independent-backup receipt records a restored bundle SHA-256 of
`882a8988e228e1ff82f5770d64cbf28c193a3789bb97503bea9bc9d385dd2e33`.
All three original ZIP bytes survived the independent restore. Private bytes,
donor/source rows and reusable signed download URLs are not committed.

## Deployment and validation

Migration 0037 is additive; it changes the research view labels and creates
append-only retained bytes, observations, manifests, attempts and artifact
registrations plus targeted indexes. Existing source/evidence/vote rows and all
36 prior migrations remain intact.

The `forecast-evidence-remediation` workflow runs clean PostgreSQL 18 migrations,
full checks/build and dependency audit without production secrets. Only a
successful exact reviewed-main run with the
`FORECAST_EVIDENCE_REMEDIATION` marker can enter the existing protected Neon
environment. The production script independently verifies the current main SHA,
existing VotePredict primary, database identity and full schema ledger. It
applies only migration 0037, retains only the three fixed packages, restores
their actual database bytes without network, and verifies committee labeling.
There is no schedule or Vercel call.

Local validation used Node 22 and a disposable PGlite database; the latter is
explicitly not represented as PostgreSQL 18 production parity. The rehearsal
exercises venue selection, immutable historical text after a future replacement,
as-of supersession, forbidden updates/deletes, sealed manifests, visible failed
captures and retries. It also archives and restores all three original packages
from database bytes. The CI integration uses a unique throwaway schema so older
view-migration tests cannot race with these assertions.

## Executed completion: October 25, 2026 Central time

[PR #1582](https://github.com/killjoy00/votepredict/pull/1582) merged as
`61bff42156b1948d707c3571c3c075b2678c1a13`. Both main CI and the
[protected remediation run](https://github.com/killjoy00/votepredict/actions/runs/40267258604)
passed. PostgreSQL 18 CI ran all **2,474 tests with zero failures or skips**;
typecheck, build and the production dependency audit passed with zero reported
vulnerabilities.

The protected job applied migration 0037 and archived all three pinned original
ZIPs. It restored the actual database bytes without GitHub or original source
access and rechecked every internal digest, model-content digest and the matrix
row count. An independent read-only, repeatable-read transaction with explicit
rollback at **2026-10-26 04:09:23 UTC** matched all 37 migration checksums,
confirmed all five append-only triggers and all five targeted indexes, and
rehashed the stored ZIP bytes successfully. The committee projection now labels
all **1,950 individual choices** correctly. The normalized view exposes 186
committee events with individual choices; the older total of 221 stored events
also includes 35 events without stored individual choices. Those absences are
preserved.

Bounded plans use the new indexes. A sampled ingestion-key lookup changed from
8,211.033 ms to 1.874 ms; a reverse supersession lookup changed from 169.877 ms
to 0.063 ms. The bounded 2023 finance reader returned 57 observations in 8.895 ms.
These single samples have different cache/hint-bit conditions and are not a
controlled throughput test. The broad UNION is still a research index.

Core source/evidence/text/statement/testimony counts and the 849 forecast revisions
match the original review. Fourteen official bill-text captures were fetched
between that review and 2026-10-26 01:16:41 UTC, before this deployment; the new
total is 13,819. This package did not acquire those captures. No new forecast,
model, runtime manifest, bill-text observation or capture attempt was generated.
The latter three new tables correctly remain empty while the application release
is paused.

The machine-readable
[completion receipt](../../data/evaluation/forecast-evidence-remediation-completion-20261025.json)
records the exact run, hashes, counts and limits. This closes the bounded
correctness/access/preservation repair package. It does not certify missing
historical evidence, predictive lift or an unreleased runtime.

A subsequent documentation-merge CI run exposed intermittent interference in
the older repair integration fixture's shared catalog and bounded backfill
queue. That fixture now applies all migrations in its own throwaway schema,
using the same isolation as the new contract test. Its original strict-clock,
identity, literal-text and author-change assertions remain intact. This is a
test-isolation repair and does not change production SQL or trigger another
database deployment.

## Atomic capture registration: October 26, 2026

The continuation review found a crash window between committing a Quick revision
and recording its first capture attempt. A worker stopping in that interval
could leave no ledger entry for the health reader to see. Both required capture
attempts now start in the same transaction as the revision and sealed input
manifest. The wrapper appends only completed, failed or not-applicable results.
An interruption after commit remains visible as unfinished work; an interruption
before commit rolls back the revision, manifest and both obligations together.

The disposable-database integration checks the committed-but-not-yet-captured
state, full rollback, explicit not-applicable completion, failed capture, and
successful retry. The existing schema is sufficient. No new migration or
production data write is needed, and this runtime change remains subject to the
same intentional application-release gate as the other runtime safeguards.

## Forecasting and source holds

Keep the accepted Quick model and all frozen evaluation protocols unchanged.
This package makes new evidence safer to access and preserve; it does not prove
predictive value. Finance publication, missing committee originals/questions,
wider website/media coverage and nonbill identity holds from the final #864
closeout stay explicit exclusions. No office contact or new archival sweep is
needed to finish this package.

Before a future live/prospective launch, #287/#310 still require real official
universe/calendar/source authentication and the original scoring gates. #732
still governs the paused Vercel release/scheduler state. A technical rehearsal
does not claim that a paused application has received this runtime revision or
that 2027 data collection is active.
