# #864 Track B — candidate archived-original parity V6: controlled read-only attempt

**Scope:** Minnesota Senate historical campaign-finance evidence 2021–2025 only; exact 2021–22 candidate CSV originals. Does not authorize 2027 work, contact, deployment, scheduler activation, stored-row corrections, schema/data writes, serving/model/forecast changes or retraining. Issue #864 stays OPEN.

## Independent prior proof and new V6 retry

Public-only V4 first-attempt, main SHA `d875abaefed8820141b6bf33a041895b31ed8800`, [run 38285676317](https://github.com/killjoy00/votepredict/actions/runs/38285676317) authenticated the official CFB 2022 expenditure CSV exact original and capture using live Internet Archive CDX SHA1/Base32 against complete immutable raw replay bytes, then independent full-body SHA256. The publicly checked facts frozen in `V4_EXPENDITURE_CHECKPOINT` are:

- Official CFB source `https://cfb.mn.gov/reports-and-data/self-help/data-downloads/campaign-finance/?download=-1890073264`
- Wayback raw `id_` timestamp **20220606103037 UTC**
- Independent V4 CDX SHA1 RFC4648 Base32 `GMF33XY3X4LNADGCPU52JWEDWRHXE23V`
- Independently recalculated full original SHA256 `6d9d9061a0a4080083b62b352763697852105c10b3ab1d1bef96fea25ce4d00b`
- Exact original size **41,138,871 bytes**, parsed **18,497** 2021 and **3,241** 2022 rows; **21,495 distinct canonical original row keys**.

The protected V5 [run 38287067853](https://github.com/killjoy00/votepredict/actions/runs/38287067853) could not independently reauthenticate candidate versions because the live CDX/replay service was intermittently inaccessible. Accordingly it made **no candidate stored parity claim**. It did independently verify 101/101 bounded IE stored evidence observations, 29 distinct transaction keys. This result stands and is not rerun in V6.

**V6 improves the single candidate expenditure retry only, without weakening historical original identity:** It re-fetches the exact immutable June 6, 2022 raw `id_` replay; allows at most two strictly same archived capture/official selector redirects; bounds the raw body to 120 MB, and requires **both** full source-body digests and the original exact byte length to match the previously independently proved V4 checkpoint. It then re-parses the same 2021–22 canonical original row keys and checks the frozen original row counts. The V6 run does not require a **new live CDX lookup for this one already public-authenticated original only**. A new body cannot become certified by matching a hash from private stored metadata or by trusting the current CFB live export.

Two 2021–22 candidate-contribution pinned captures of the official `download=-2113865252` source (**20220606102411** and **20230612002907** UTC) still require **fresh bounded exact CDX indexed digest plus raw replay complete-body SHA1 matching that digest, and new whole-body SHA256** under the preexisting V4 implementation. Safe exact-capture redirect protections remain unchanged. All three sources are finite fixed allowlists. A network outage, CDX failure, mismatched digest, unexpected redirect or parse failure is **HOLD**, not evidence a report or historical transaction did not exist. An unavailable original never enters protected parity.

## One-shot protected comparison

The new dedicated V6 workflow uses the **already reviewed V5 fixed SELECT** with a first-500-finance-documents, per-document first-64-evidence-items deterministic *selection rule*; actual persisted Senate membership links and 2021–22 year/provenance claim filters. The selected private item identities are **not frozen across runs**, and category observations are not unique transactions.

For **each successfully independently authenticated source separately**, the audit binds the freshly parsed private exact canonical row keys in an in-memory PostgreSQL `text[]` parameter. The fixed query returns only integers showing: family archive-labelled observations; identical original download claims; digest and capture-day agreement; original row-key inclusion; four-way proof matches; distinct matched key **counts**; absent keys from that particular version; digest/capture disagreements and published-day agreement. A source with zero matching version claims says nothing about other candidate versions or other archived files. Contribution captures may cover overlapping claims: **never sum per-version family denominators or distinct row-key counts as if disjoint**.

If **all three** originals HOLD: return explicit `allSourcesHoldNotMissingRows=true`, `results=[]`, `protectedReadOnlyConnectionEstablished=false`, without accessing Neon. If one or more authenticate: discover only the existing Neon default branch (not independently verified as deployed serving DB), validate current DB/user/transaction read-only identity, execute **one** `BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY` with the fixed SELECT, and explicitly `ROLLBACK`. Query and receipt field allowlists and finite integer-only validation reject private keys, donors, vendors, amounts, raw URLs or non-count fields. Do not log or upload original finance CSV bodies or private rows.

The initial V3 selected-prefix claims still awaiting historical original-to-stored reconciliation were **909 candidate-expenditure observations** and **1,140 candidate-contribution observations**; these are expected reference counts, **not a fresh cohort denominator** and not assumed to refer to these three original versions. **2,448 separate v1–v6 ordinary filing-derived claims** remain unproven until source-specific original/amended report-version historical-publication evidence (not a mere due/filed/receipt date) is authenticated. Statutory §10A.20 subdivision 1b supplies a nonpublic-before floor where relevant, never an affirmative publication timestamp.

## Review/CI gates and safety receipt

This change adds only dedicated source reauthentication, count-only protected audit, synthetic adversarial tests and a one-shot workflow; it does **not** alter V4/V5 proof history or historical finance ingestion and serving. Before credentials are available on reviewed merged main, PR CI checks:
- Disposable **local** PostgreSQL migrations and V5 fixed-SQL `EXPLAIN` only.
- Offline synthetic exact digest/tamper/unsafe redirect/hold tests, mocked Neon APIs and count-only DB session, original keys bound and rollback.
- `npm run check` (typecheck, tests and build) and `npm audit --omit=dev --audit-level=high`.
- Exact reviewed merge SHA and one-shot marker `SENATE_864_CFB_CANDIDATE_PARITY_READONLY_V6_20261012`, only first attempt, repo/branch/OWNER gate.
- Existing `evidence-readonly-sandbox` protected environment. No PR secrets, issue write permissions, source/data artifacts, or schedule triggers. The one-shot OWNER fallback command is unique and not a replay of V5.

Only after real source/authentication and protected result logs exist may a sanitized public result note be placed on issue #864. Receipt must include independently proven source fingerprints, each precise source version, sample family denominator, matched observation count and **distinct-key count** (not keys), held and mismatched counts, published-day agreement, and confirmation of rollback/read-only. If source fetch fails, report exact HOLD stage and **never invent zero matches**.

## Separate remaining finance completion obligations

V6 cannot certify the entire 2021–25 Senate finance record: still needed are an authoritative legal filing-duty/registration/actual service period inventory, originals and amendments, per-exact-version independently evidenced public-by captures, coverage beyond the 500×64 prefix, additional IE observations beyond 101, 2023–25 finance versions, and verification of deployed serving DB binding. Never promote 2021–25 records based only on `filedOn`, `dueOn`, statutory release floors or a contemporary PDF. V8 prospective policy and source-writer safeguards remain untouched; any legacy as-of eligibility corrections/serving changes require distinct owner review and authorization.
