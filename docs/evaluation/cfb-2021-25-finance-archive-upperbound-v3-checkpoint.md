# #864 Track B — historical CFB archive upper-bound provenance V3 checkpoint

**Status:** protected read-only count-only *metadata* diagnostic. No 2027 work; no database mutation, source write, serving/model/forecast/training change, scheduler, or outreach. Parent #864 remains OPEN.

## Verified V2 result: two fundamentally different legacy proof populations

The successful [protected V2 run #38262122837](https://github.com/killjoy00/votepredict/actions/runs/38262122837) yielded the immutable [aggregate-only issue receipt #6126220510](https://github.com/killjoy00/votepredict/issues/864#issuecomment-6126220510). The *later* [owner-comment run #38262276065](https://github.com/killjoy00/votepredict/actions/runs/38262276065) failed its pre-secret **disposable local PostgreSQL** verification and correctly skipped Neon; its HOLD receipt does not invalidate the earlier successful run and must not be presented as zero rows. Its local verifier did not initially admit the `issue_comment` event; V3 explicitly handles verified owner comments in keyless local CI.

The V2 success used the deterministic first **500 selected finance source documents × 64 earliest evidence items** source-prefix selection rule, covering Senate membership-linked observations within all chambers' initially selected documents. V1 and V2 each returned 6,801 such sampled Senate observations and 4,598 preexisting `asOfEligible=true` claims; identical aggregate counts do **not** prove the exact source/row IDs are unchanged between database snapshots.

| Eligible observations in selected prefix | V2 count | Interpretation |
| --- | ---: | --- |
| Stored policy label `v1` through `v6` | **2,448** | All 2,448 explicitly filing-derived, `published_at` and `metadata.availableOn` populated. **Report filing/due floor cannot independently establish historic public-by.** |
| `availabilityPolicyVersion` missing/empty | **2,150** | All have `published_at`, `rowKey`, and one of the V2-labelled `availabilityProofUrl`/`proofUrl` fields, but `metadata.availableOn`, filing date, report locator and v1–v6 labels are absent. Their provenance **cannot** be inferred from those keys alone. |
| Policy labels v7, v8 or other | **0** | Within this deterministic sampled prefix only, not evidence that no such records exist elsewhere. |

The 2,150 **unversioned** eligible prefix observations consist only of **2021 (1,761)** and **2022 (389)** sampled rows; 1,140 candidate contributions, 909 candidate expenditures and 101 independent-expenditure observations. Unversioned 2022 expenditure noneligible rows and 1,493 `unknown_or_outside` source-kind legacy `campaign_finance_bulk` rows are not included in the 2,150 eligible total. Across all V2 eligible rows, no `metadata.reportDueOn`, `dueOn`, or `disclosedOn` was populated under those exact names. `published_at` presence by itself is NOT proof of independent public availability.

## Original source-code explanation to test (not yet a certified attribution)

Review of committed historical repair writers reveals a distinct **archive-capture upper-bound path**, separate from report filing metadata:

1. `scripts/probe-cfb-bulk-wayback-upper-bound.ts` reconstructs historical 2021–22 candidate CSV snapshots from archived CFB landing/download links, parses candidate contribution and expenditure rows, matches their deterministic `rowKey` to previously *unproven* persisted rows, and, **only under an explicit writer environment flag**, historically wrote `published_at=archived capture timestamp`, `asOfEligible=true`, `availabilityProof='independent_archive_capture_exact_row'`, `availabilityBoundKind='conservative_upper_bound'`, `exactFirstPublicationKnown=false`, `availableAt`, `archiveCapturedAt`, `archiveDigest`, `availabilityProofUrl`, `availabilitySourceUrl`, and `cfbCandidateBulkUpperBoundVersion`. Its archive capture is only a *conservative public-by upper bound*, not the first public date.
2. `scripts/probe-cfb-legacy-download-catalog.ts` has an analogous **2021–22 independent-expenditure** Wayback CSV recovery/writer with `cfbIeLegacyBulkUpperBoundVersion` and the same archive-provenance fields.
3. Both writers omit the newer `availabilityPolicyVersion` and `metadata.availableOn` naming. Both use an archival original-CSV `rowKey` match as a proof claim, NOT an ordinary CFB report due/filing date. This makes them a plausible explanation for the 2,150 unversioned eligible observations. **V2 key-presence counts cannot conclusively attribute any private row to either writer.**

Crucial distinction: the archived CSV's original byte content and CDX-indexed digest must be independently reacquired and verified against the stored proof identifiers before an exact-row **authenticated** archive-time claim can be certified. The CDX `archiveDigest` field must not be conflated with original report-PDF SHA256, legal filing duty, or earliest-publication capture. A current PDF report does not replace a historically pinned CSV version.

## V3 protected count-only audit

`scripts/audit-cfb-864-neon-finance-archive-upperbound-v3.ts` samples using the *same rule* as V1/V2 and emits **only strictly allowlisted nonnegative integer aggregates** grouped by five policy buckets, six year buckets and four source families. The new fields counted are:

- archival proof/status labels for candidate/IE recovery, version-marker key presence, `availableAt`, `archiveCapturedAt`, `archiveDigest`, proof/archive source URL **presence**, conservative-upper-bound label, and earliest-publication-unknown label;
- combined **complete archived-keyset** presence (not proof validity);
- UTC date-level equality between stored `published_at`, `availableAt` and `archiveCapturedAt`; and whether `published_at` appears the same day as, or earlier than, `transactionDate`, solely as source-date risk triage;
- for comparison, filing-derived eligible labels in the same cohort.

No person/source/transaction identifiers, raw URLs, hashes, archive capture dates, financial amounts, donor fields, or raw policy strings leave the protected SELECT. No independent official archive is retrieved by the protected SQL job; metadata cannot establish original source equality.

PR CI runs **no Neon credentials**, disposable local PostgreSQL migrations and EXPLAIN of fixed SQL, synthetic transaction/identity/rollback and publisher JavaScript syntax tests. A **unique first-attempt merged-main** marker, exact checked-out latest-main SHA marker, full `npm run check`, security audit, and `evidence-readonly-sandbox` gate the mandatory `READ ONLY REPEATABLE READ` transaction with `ROLLBACK`. A separate keyless reporter posts only allowlisted aggregate counts to #864; an exactly specified OWNER-authenticated #864 issue-comment fallback is available if a token-created merge suppresses its normal push event. A failed pre-secret step publishes HOLD, **not** zero rows.

## Follow-up after receipt: source verification and authorization boundaries

- **Unversioned archive-labelled cohort:** if counts support this hypothesis, reconstruct and independently verify source Wayback CSV originals and indexed CDX original SHA1/Base32/byte hashes, then compare canonical parsed row keys to persisted row identity **privately**, using aggregate-only matching receipts. If the original archive is unavailable or a match cannot be proven, mark HOLD; do not claim absence of a transaction.
- **v1–v6 filing-derived cohort:** do **not** re-label legal report due/filing floors as exact historical PDF public-by. Per-report independently documented original/amended published versions and row-specific source identity remain necessary.
- **Legal report inventory:** enumerate actual 2021–25 Senate serving registrations/effective periods and legally owed filings separately; neither the selected prefix nor known 71/12/51-report research cohorts is a statewide denominator.
- **Existing prior-cycle context reader:** `src/evidence/prior-cycle-finance-context.ts` still trusts preexisting `asOfEligible=true` plus `published_at`. It has not been changed because any serving/forecast changes and persisted eligibility corrections require separate owner authorization.

**No database writes, backfills, migrations outside disposable CI PostgreSQL, serving/model/scheduler changes, or false completion claims.**


## Follow-up code-only safeguard: candidate backfill writer cannot promote filing-only windows

The V3 stored-provenance result established the **two different historical proof-label mechanisms** in the selected prefix, but did not change the stored flags. While following the older v1–v6 filing-derived path, source review found a dormant defense-in-depth gap: `scripts/backfill-cfb-candidate-finance.ts` still contained a legacy positive `UPDATE evidence_items` block labelled `availabilityProofKind='cfb_report_filing'`. Under the already-merged v8 selector, a current PDF produces `cfb_report_filing` and that matching route now returns `null`, so no corresponding new mappings are expected; nevertheless the lower-level writer SQL itself previously did **not** enforce the same restriction.

The follow-up code-only change adds all three independent safety gates:

1. Candidate report mapping requires explicit `match.window.proofKind==='cfb_public_disclosure'`; `cfb_report_filing` (including a guessed date after the statutory floor) never enters the mapping queue.
2. The mapped record must carry the separately source-labelled `disclosedOn` date; the SQL `UPDATE` independently requires `disclosure.proof_kind='cfb_public_disclosure'`, a non-null `disclosed_on` and exact equality to `available_on`.
3. Stored provenance no longer **mislabels** a mapping as `cfb_report_filing` if it is direct disclosure; script result labels now correctly say filing/due provide only a legal not-before boundary and exact-version historical PDF public-by is not certified.

Synthetic tests confirm current filing-only windows still fail positive historical selection; a valid separately labelled direct public disclosure passes only the normal selector, and source-static tests enforce SQL side filtering even if the selector changes in the future. **No live writer is executed, no database row or model/serving feature is changed, and no existing v1–v6 stored eligibility is repaired.** Independently authenticating a direct disclosure at source is still required before certifying historical as-of eligibility.
