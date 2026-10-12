# #864 Track B — authenticated original archived CSV -> protected stored-proof parity V5

**One-shot, READ ONLY, no stored-record repair.** Owner authorized all four finance tracks; this is the conditional step 4 following the independent public source-original rehash from [PR #1240](https://github.com/killjoy00/votepredict/pull/1240). Parent #864 OPEN. No 2027 activity, deployments, model/serving/forecast changes, backfills, scheduler, outreach, new ingestion or production DB writes.

## Independent original proof prerequisite

The source module `scripts/prove-cfb-864-pinned-public-originals-v4.ts` pins ten historically parsed public CFB source/capture tuples (two contribution, one expenditure, seven IE) taken from earlier 2026-10-02 source-recovery logs. Each is **freshly** CDX-index checked by exact capture timestamp and official URL, then full original Wayback `id_` raw CSV fetched with a max 120MB stream and strictly same-capture/same-official-source redirects, full raw-body SHA1/Base32 equals independent public CDX digest, full-body SHA256 and canonical 2021–22 CFB parser row-key extraction.

**No part of the private stored dataset is consulted if no source passes this complete original-body proof**. CDX or replay access failures remain individual source HOLDS, never absence-of-history or zero stored transactions.

## What the V5 protected parity actually counts

On one authenticated public original in memory, `scripts/audit-cfb-864-authenticated-original-parity-v5.ts` discovers the **existing Neon default branch** (deployment binding remains unverified) and opens exactly one `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY`. It verifies `current_database`, `current_user` and server `transaction_read_only=on`.

The **fixed parameterized SELECT** samples the **same selection rule** as protected V1–V3: first **500** finance source documents ordered by `source_kind,id`, then first **64** evidence items per selected document ordered by `created_at,id`, across both chambers before restricting to persisted Senate membership. This is not a frozen original row-identity cohort or statewide census.

Only 2021–22 evidence rows already labelled `metadata.asOfEligible=true` AND `metadata.availabilityProof=independent_archive_capture_exact_row` in the matching candidate contribution, candidate expenditure or IE persisted source family are considered. Each fresh authenticated source is compared with five bound SQL parameters:

1. **Exact official public original selector** (legacy `http:` normalized to `https:` only) vs stored `metadata.availabilitySourceUrl`
2. **Newly authenticated raw-original CDX SHA1/Base32** vs stored `metadata.archiveDigest`
3. **Exact historical capture UTC calendar day** vs stored `metadata.archiveCapturedAt`
4. **Freshly reparsed canonical original CSV SHA256 row-key set**, passed strictly as a PostgreSQL text[] parameter that **never leaves the protected process**
5. **Known persisted finance source family**, with no inference from text mentioning a candidate or Senate without an actual membership chamber link.

Each query returns exactly **one allowlisted aggregate-count row**, not raw private source IDs, donor names, contributions, transaction amounts, capture URLs, or source/store row keys. The finite per-source metrics are: archived prefix observation denominator; source-selector equality; selector+digest; selector+day; selector+canonical original row-key; selector+digest+day; complete all-four match; distinct exact stored row-key matches; matching version without row containment; row/digest but other day; row/day but other digest; complete match with stored `published_at` UTC day parity; blank stored row-key count.

These are **per-pinned-original** comparisons. A single stored row can appear under multiple distinct authenticated originals, so summing per-source groups would be invalid unless a separately reviewed de-duplication proof is run. Only the original-source versions actually independently reauthenticated in the same V5 execution can produce verified count groups. "Not matched to one particular pinned version" is not evidence that the record is erroneous or did not appear in another captured version.

The SQL produces fixed counts only; after validation all groups must fit the finite 13-metric schema with consistency checks. The client must explicitly `ROLLBACK`; an exception also tries rollback and aborts before any public result is certified.

## Review and execution boundaries

- PR pre-secret synthetic Neon API and synthetic PostgreSQL tests assert **zero DB discovery when all originals HOLD**, exact bound count SELECT, no raw row-key output, strict Neon identity and mandatory rollback. A separate keyless **disposable localhost PostgreSQL EXPLAIN** compiles fixed SQL against migrations; no arbitrary query or remote URL.
- Main protected run requires an immutable merge commit marker `SENATE_864_CFB_ORIGINAL_PARITY_READONLY_V5_20261012`, SHA exact checkout, first attempt, complete `npm run check` and production-dependency audit after migrations, then `evidence-readonly-sandbox` for source reproof and READ ONLY SQL.
- A precisely matched OWNER-authenticated one-time issue #864 comment is available if GitHub suppresses the token-created main push workflow. No schedule, production writer key, uploads, artifact publishing, or third-party notification.
- Public logs contain only allowlisted finite per-source statuses, public original file SHA256 and aggregate **integer counts** after rollback. If every fresh original fails, the result must report `allSourcesHoldNotMissingRows=true`, `protectedReadOnlyConnectionEstablished=false`, `results=[]` — not misleading zero exact matches.
- The previous 2,150 archival-labelled and 2,448 filing-derived eligible observations are *sampled observations*, not a distinct full report/transaction/legal inventory. A matching 2022 or 2023 archive capture proves only a conservative **public-by upper bound**, never the original first publication day. The filing-derived group requires separate report version-publication evidence and cannot be legitimized by archive CSV matches.

**No source/body or private row may be marked historically certified until the complete independent original plus bound exact-row comparison passes; no persisted record, as-of eligibility or serving-reader policy is modified by V5.**
