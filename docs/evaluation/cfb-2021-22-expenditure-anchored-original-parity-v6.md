# #864 Track B — Candidate expenditure 2022 original SHA-pinned parity V6

**Purpose:** remove one source-access bottleneck from the *candidate-finance* historical provenance track without weakening the independent original-byte authentication rule. No production source/row writes, no serving/forecast/training/scheduler/deployment changes. Parent #864 remains OPEN.

## Immutable source evidence already independently established

[PR #1240](https://github.com/killjoy00/votepredict/pull/1240) and exact-main first-attempt [public-only run #38285676317](https://github.com/killjoy00/votepredict/actions/runs/38285676317) **independently fetched the original Internet Archive CDX record and entire `id_` archived CSV raw bytes**, showing:

- Original official CFB selector: `https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/?download=-1890073264`.
- Exact captured version: **2022-06-06 10:30:37 UTC**, earliest-original-publication date **not established**.
- Entire original raw file: **41,138,871 bytes**.
- Indexed *original* CDX SHA-1/Base32: `GMF33XY3X4LNADGCPU52JWEDWRHXE23V`, independently matched by hashing the entire replay body in that public run.
- Full original SHA-256: `6d9d9061a0a4080083b62b352763697852105c10b3ab1d1bef96fea25ce4d00b`.
- Canonically parsed 2021/22 candidate expenditure rows: **18,497 / 3,241**, **21,495 distinct row keys** (with 243 duplicate row observations). These are public-source parser counts, not private Senate-member matches.

[PR #1241](https://github.com/killjoy00/votepredict/pull/1241) and successful protected [V5 run #38287067853](https://github.com/killjoy00/votepredict/actions/runs/38287067853) used a **fresh live CDX response on each candidate**, before raw-body authentication and protected count-only SQL. The V5 run could not re-query candidate source CDX due intermittent HTTP/network failure, so it correctly reported candidate **HOLD**, not absence of data. In the same V5 run, another independently authenticated June 12, 2023 IE original verified **101/101 sampled Senate IE archived-claim observations / 29 distinct row keys**, with independent digest, capture date and source-row parity. See [issue V5 receipt](https://github.com/killjoy00/votepredict/issues/864#issuecomment-6130189450).

## V6 immutable two-hash source boundary

`scripts/audit-cfb-864-expenditure-anchored-v6.ts` **does not query the CDX index again**, because the prior first-party public run already produced independent CDX-original digest authentication and a reviewed immutable SHA-256 fingerprint.

Instead the V6 protected script must **re-fetch the exact entire** `20220606103037id_` Wayback original source and prove *every one* of the following, or HOLD **before contacting Neon**:

1. Original source host/selector, capture timestamp and replay mode are exactly the reviewed immutable CFB 2022 archived source. HTTP redirect is manual, at most two safe hops, and any path/selector/date/host change fails closed.
2. Complete replay body is HTTP 200, streamed under the unchanged 120 MB cap (no HTML interstitial or partial range body).
3. Byte count is **exactly 41,138,871**, independently calculated whole-body SHA-1/Base32 **equals `GMF33XY3X4LNADGCPU52JWEDWRHXE23V`**, and whole-body SHA-256 **equals `6d9d9061a0a4080083b62b352763697852105c10b3ab1d1bef96fea25ce4d00b`**.
4. Reparse under the exact canonical CFB 2021–22 candidate expenditure parser and recover the same **18,497 + 3,241 rows / 21,495 unique SHA256 row keys**; all source keys remain only in protected process memory.

A successful V6 match proves **byte-for-byte equality to the previously independently CDX-authenticated archived original**, not that the CDX was independently reachable again in V6. The source file's 2022-06-06 capture is a conservative public-by upper bound, not earliest historical public day.

## Protected SQL and output contract

Only after a fresh full-body match does V6 discover the existing Neon default branch through the reviewed readonly connector and perform a single `REPEATABLE READ READ ONLY` transaction with explicit `ROLLBACK`. It reuses the **unchanged already SQL EXPLAIN-reviewed** V5 fixed aggregate SQL and bounded first-500-source × earliest-64-evidence source-prefix selection (which is **not a frozen row-ID cohort**). The selected source-kind is limited to persisted Senate membership-linked `campaign_finance_candidate_expenditure_bulk` 2021–22 archived-claim observations. Parsed public row keys are bound as private protected SQL parameters, never printed. Query returns strict allowlisted numeric counts for actual provenance/source-URL/digest/capture-day/exact-original-row-key matches and discrepancies.

Run only once on merged main with unique reviewed commit marker `SENATE_864_CFB_EXPENDITURE_ANCHORED_V6_20261012`, fully green pre-secret synthetic/privacy tests, disposable localhost PostgreSQL migrations/EXPLAIN, repository-wide `npm run check`, high-severity production-dependency audit, and protected `evidence-readonly-sandbox` job. Workflow has **no issue write permission or artifact upload**; a safe receipt is printed to protected log only and subsequently verified/published using the GitHub connector.

If bytes, hashes, source identity, raw HTTP or parser counts cannot be independently recovered, V6 reports an explicit source HOLD and **does not contact Neon**. Such a failure is *not zero stored records*. Previously eligible observations are neither repaired nor reclassified.

The separate **candidate contribution** historical source remains not freshly authenticated in V5; the **2,448 filing-derived** older-policy claims remain another legal/version-specific report-publication proof track. The **101 IE observations in the fixed prefix** were verified in V5 but do not represent all historical IE transactions or filings. Any production eligibility repair or serving-reader policy change needs separate owner authorization.
