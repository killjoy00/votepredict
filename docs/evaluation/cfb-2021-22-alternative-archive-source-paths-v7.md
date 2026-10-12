# #864 Track B — independently discover alternate historical candidate CSV copies (V7)

**Scope:** Minnesota Senate 2021–2025 finance evidence only. This V7 tranche is **public source discovery**, not a protected stored-row audit or any change to forecast eligibility, ingestion, production data, deployment, scheduler, or 2027. No outreach or email. Issue #864 remains open.

## The precise obstacle

The [V4 original-byte verification](https://github.com/killjoy00/votepredict/actions/runs/38285676317) independently fetched and authenticated the **June 6, 2022, 10:30:37 UTC** archived candidate-expenditure CSV at the official Minnesota CFB selector **-1890073264**. The fixed public original has SHA1/Base32 **GMF33XY3X4LNADGCPU52JWEDWRHXE23V**, full-body SHA256 **6d9d9061a0a4080083b62b352763697852105c10b3ab1d1bef96fea25ce4d00b**, **41,138,871 bytes**, and 21,495 distinct canonical 2021–22 transaction keys in the independent parse. This earlier authentication stands.

The [V6 protected attempt](https://github.com/killjoy00/votepredict/actions/runs/38297382142) safely ended with **3/3 source retrieval HOLDS**: CDX HTTP HOLD for the **2022-06-06 10:24:11 UTC** candidate-contribution capture, CDX HTTP HOLD for its **2023-06-12 00:29:07 UTC** capture (both selector **-2113865252**), and replay HTTP HOLD for the prior V4 expenditure copy. **No Neon connection was established; the absence of new verification is not missing transaction evidence.** Private stored source-row parity for these three originals remains unverified. Do not rerun V6's protected one-shot marker.

## Newly verified independent publisher path

The Accountability Project / Investigative Reporting Workshop published separately cleaned [Minnesota candidate contribution](https://publicaccountability.org/datasets/369/mn-contribs/) and [Minnesota expenditure](https://publicaccountability.org/datasets/417/new-minnesota-ca/) datasets. Their source diaries are publicly accessible and show direct CFB downloads with precisely the official selectors above:

- [February 27, 2023 contribution notebook](https://github.com/irworkshop/accountability_datacleaning/blob/master/state/mn/contribs/docs/mn_contribs_diary.md): selector **-2113865252**; processed public-output basename **mn_contribs_clean.csv**, published to a publicaccountability S3 bucket according to the reproducible notebook.
- [February 27, 2023 expenditure notebook](https://github.com/irworkshop/accountability_datacleaning/blob/master/state/mn/expends/docs/mn_expends_diary.md): selector **-1890073264**; processed public-output basename **mn_expends_20150101-20221231.csv**. The notebook's 260,875-row working count is not interchangeable with the website's reported 449,060 dataset records, nor with V4's candidate 2021–22 exact original parse.

**Negative discovery boundary:** current public GitHub tree at **state/mn/contribs/** and **state/mn/expends/** holds **docs/** and **plots/**, **not the raw data/raw CSVs**; the notebook's reference to raw local directories is not evidence that raw inputs were published in GitHub. The public website's "Source dataset download" points back to the **current** official Minnesota download, not a retained independent historical raw snapshot. Thus the publisher is a **real corroboration path**, but not yet a recovered byte-identical original or historically timestamped pre-June-2022 source. A cleaned 2023 file cannot independently prove that a particular 2021 transaction was public in June 2022.

V7 issues **HEAD only**, without retrieving any rows, to the *notebook-derived* public S3 key guesses:
- https://publicaccountability.s3.amazonaws.com/csv/mn_contribs_clean.csv
- https://publicaccountability.s3.amazonaws.com/csv/mn_expends_20150101-20221231.csv

A positive HTTP 200 is **only** a currently retrievable cleaned-object lead; 403/404/network failure does not prove the organization's data is absent. Even an actual processed-file hash is **not** a substitute for V4's historical raw original fingerprint.

## Alternate archive index paths tested by this code

1. **Common Crawl CDX/WARC index**: the official [Common Crawl collection index](https://index.commoncrawl.org/collinfo.json) advertises independent 2022/2023 historical collections. The official [CDXJ index guide](https://www.commoncrawl.org/cdxj-index) explains why an index row has capture time, SHA1 and a WARC filename/byte-range pointer. V7 queries the **two exact fixed official CFB selectors** across only six published historical index collections: 2022-21, 2022-27, 2022-33, 2022-49, 2023-06 and 2023-23. This is a *finite discovery pilot*, not all collections, nearby URLs, PDF documents or complete Minnesota evidence.
2. **Arquivo.pt Memento time maps**: [published Memento documentation](https://dados.gov.pt/en/datasets/memento-api-url-search) identifies a separate archive time-map service. V7 requests metadata for the two exact official source URLs. A 200 but nonempty response is only a *possible lead*, not checked CSV or original public-by proof.
3. **TAP cleaned-object heads**: two HEAD requests to the independent public dataset path guesses above. No body downloaded.

Command (no credentials; all endpoints fixed in code; no user flags):

    node --test tests/cfb-864-alt-archives-v7.test.mjs
    node scripts/probe-cfb-864-alt-archives-v7.mjs

Dedicated [PR-only public check](../../.github/workflows/senate-864-cfb-public-alt-archives-v7.yml) has **contents: read** and zero secrets, DB connections, GitHub write scopes, schedules or artifacts. Request bodies capped to **64 KB** metadata, each request capped to **9 seconds**, index result counts capped to **10**. All redirects are forbidden. The only printed output is a source-ID-index-ID allowlisted metadata/count receipt; no donor, vendor, contribution, amount, raw original URL, transaction identity or WARC body. Tests include source/selector spoofing, wrong WARC path, invalid digest, oversized index, HTTP/timeout failures and proof-not-claimed assertions.

**Interpretation:** an indexed CSV WARC lead means a plausible independent capture *pointer* was indexed; it does NOT authenticate its bytes, the official original release timestamp, individual stored row keys, or a cutoff. Index 404, no CSV lead, and any HOLD mean only that this particular API/query did not yield a usable lead. None means "CFB never published it." A nonempty Arquivo timemap response and HTTP 200 for a TAP cleaned object are equally non-proof statuses. The separately proven V4 SHA1+SHA256 source checkpoint is never overwritten with a third-party index digest.

## Only if a lead is found

**Common Crawl:** In a *separately reviewed public-only* verification, retrieve a single WARC record using its exact indexed byte range, bound the compressed and inflated sizes, verify WARC target/time/response identity, compute SHA1 and SHA256 of the **complete original HTTP entity bytes**, reject content encodings/different original versions, and test against the prior V4 whole-byte checkpoint where appropriate. Do not log or store raw CSV/WARC, donor/vendor/transaction identities. A WARC pointer or indexed SHA1 alone is insufficient.

**TAP:** Verify whether an independently retained original can be identified from public sources without outreach. If only cleaned current files can be found, label later corroboration separately with their real first independently demonstrated availability—never backdate them or silently treat their normalized rows as original CFB row keys.

**After authenticating original CSV bytes only:** prepare a *new, separately reviewed, uniquely marked* first-attempt merged-main protected **read-only, count-only** source-to-stored audit of 909 candidate expenditure / 1,140 candidate contribution **previously sampled** archive-labelled observations. Preserve original-claim/version-specific counts, bound in-memory source row keys, repeatable-read read-only SQL and explicit rollback. No production writes or serving changes.

## Unchanged separate finance proof debt

2,448 older filing-derived eligible observations still need exact historical original/amended report-version *public-by* evidence, not legal due dates, filed dates, or present-day PDF availability. The Senate-specific official required/received filing denominator and 2023–25 version publication ledger are separate unresolved lines. The 101/101 prior IE stored observations verified in V5 remain independently proved for their bounded cohort. A 500-source × 64-evidence selection rule is **not a statewide denominator** and the selected cohort can change between runs.


## First observed live public probe (2026-10-12)

The PR's [first public-only live run 38305630428](https://github.com/killjoy00/votepredict/actions/runs/38305630428) **succeeded**, including all synthetic adversarial tests. It located **independent Common Crawl WARC pointer leads**, not downloaded/authenticated original CSV bodies:

| Original official selector | Common Crawl index | Earliest indexed date | Public index payload SHA1/Base32 | Stage |
| --- | --- | --- | --- | --- |
| Candidate contributions -2113865252 | CC-MAIN-2022-27 | **2022-07-04** | **MUZRYIIC5EO6SZH55HJZ5R77RSOT5JNK** | Indexed CSV WARC pointer only |
| Candidate expenditures -1890073264 | CC-MAIN-2022-27 | **2022-07-04** | **IY4OVW75AC2SDHPMKL5KYDCVQYO7CBBK** | Indexed CSV WARC pointer only |
| Candidate expenditures -1890073264 | CC-MAIN-2023-23 | **2023-06-07** | **Y6Q3ZD2EBSIGJPJJT7P2R32SAS26AR4S** | Indexed CSV WARC pointer only |

**All three index digests differ from the previously authenticated V4 June 6, 2022 expenditure digest** where comparable; therefore do not claim the July expenditure file is the same original version. Different WARC payload digests may reflect a different content version or response processing; only full-body verification can decide. In particular July 4 is **not** a newly proven original-byte/public-by date yet.

The exact six-index pilot also returned 404/no-match statuses for most individual queries, one contribution 2022-49 invalid/network HOLD and one expenditure 2022-21 HTTP HOLD; these cannot establish total absence. Arquivo.pt's two tested exact time-map queries returned HTTP 404 (for **these two queried URL forms only**). The public S3 HEAD for the independently cleaned contribution file returned HTTP 200 with content length **58,871,220 bytes**; the expenditure HEAD was HTTP HOLD. These are strictly metadata findings, never reconstructed donation/expenditure bodies.

**Next highest-value action:** independently retrieve the **two July 4 WARC records** using only the validated indexed byte ranges in a public-only ephemeral runner; validate exact HTTP entity and WARC identity, hash complete bodies, and parse bounded original 2021-22 row-key *counts only* without publishing private row-key data. This is separate from any protected database comparison, and must not promote the 2022-06-06 original certificate or stored as-of flags without a source/version-specific proof.
