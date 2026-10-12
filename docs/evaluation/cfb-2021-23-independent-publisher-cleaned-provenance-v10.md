# #864 Track B — independent publisher's complete cleaned Minnesota contribution dataset (V10)

**Strict scope:** Public-only source provenance and coverage verification for Minnesota Senate 2021–2025 campaign finance research. No email/contact, private database, source-row identities, donor/recipient/amount logs, GitHub artifact uploads, ingestion, historical eligibility updates, model serving, scheduler, deploy or 2027. Issue #864 remains OPEN.

## Why this is separate from the archived original CSV recovery

Both exact Minnesota CFB historical 2021–22 candidate contribution/expenditure bulk-download selectors are documented in The Accountability Project / Investigative Reporting Workshop's **February 27, 2023** public source/cleaning notebooks:

- [Minnesota contribution notebook](https://github.com/irworkshop/accountability_datacleaning/blob/master/state/mn/contribs/docs/mn_contribs_diary.md) downloads original candidate/other contribution source selector **-2113865252**, processes source columns with janitor and other normalizations, then writes **mn_contribs_clean.csv** to the public **publicaccountability** S3 bucket. Notebook reports **359,673 records**; file includes mixed recipient classes, not exclusively Senate candidates.
- [Minnesota expenditures notebook](https://github.com/irworkshop/accountability_datacleaning/blob/master/state/mn/expends/docs/mn_expends_diary.md) downloads CFB source selector **-1890073264**, then processes/exports its separately cleaned version. The public repo has notebooks/plots, **not** retained original input files.
- [The Accountability Project's MN contributions dataset description](https://publicaccountability.org/datasets/369/mn-contribs/) declares source CFB, years 2015–January 2023, **359,673** records. This later cleaned body must NOT be substituted as a byte-identical original June 2022 CFB source or used to retroactively validate previously eligible V6 item timestamps.

V7's successful [public pilot 38305630428](https://github.com/killjoy00/votepredict/actions/runs/38305630428) verified the independent cleaned contributions S3 object responded to HEAD with **58,871,220 bytes**; the separately published cleaned expenditures key's HEAD HTTP held. This **is a positive independently retained dataset**, even though it is not the sought raw, historically archived original. By contrast, V9's [public range and CDX pilot PR #1258](https://github.com/killjoy00/votepredict/pull/1258) explored full June original Range replay and an alternative independent archive CDX interface, all with source network/identity HOLDS. Repeating the same blocked archival requests is unlikely to yield new evidence right now.

## V10 independently revalidates the complete currently public third-party body

A PR-only, zero-secret, source-only job:

1. HEAD-checks the exact independent public S3 cleaned-contribution key, requires HTTP 200, no redirection, bounded content length and **agreement with previous independently observed V7 58,871,220 bytes**. A changed object size is HOLD rather than silently considered the same publisher body.
2. Performs one finite complete-body GET of the same S3 cleaned object (maximum **85 MB**), requires HTTP 200 and identity content-encoding, exact body length, and locally hashes the **whole cleaned body using SHA256**.
3. Strictly parses CSV quoting (including embedded newlines and escaped quotes), ensures expected documented cleaned CFB contribution schema, up to 64 columns and 500,000 rows, and checks the independently published **359,673 row** count. Only the **year and CFB filer-class type** fields are processed after the header. Source donor names/addresses/recipient names and monetary amounts are never gathered into the output, never uploaded or retained.
4. Returns only public cleaned-body full SHA256, byte count, counts for 2015–2023, combined PCC (principal candidate committee) counts for 2021 and 2022, and object Last-Modified **calendar day** if the server provided it. PCC/recipient type codes do NOT establish Minnesota Senate membership or official legal filing-obligation denominators.

All source requests are fixed, bounded, unauthenticated public GET/HEAD. Only minimal validated aggregate and fixed hash receipts leave CI; there is **no source-body, individual original-row hash, donor, vendor, address or transaction exported**. If unavailable or changed, outputs an explicit nonzero/mismatch HOLD state rather than a misleading zero campaign-finance count. Adversarial tests include malformed schema, embedded quoted CSV newlines, wrong columns, truncated bodies, altered object length, and protected-credential/scheduler absences.

Commands:

    node --test tests/cfb-864-public-publisher-cleaned-v10.test.mjs
    node scripts/verify-cfb-864-public-publisher-cleaned-v10.mjs

## How to use the result, and what it cannot prove

The object Last-Modified header or GitHub notebook's February 2023 date is **not independently proven first-public availability of exact cleaned source contents**, and neither authenticates a *June 6 2022* or *June 12 2023* official CFB original CSV. Replaying a 2023 cleaned file in 2026 alone cannot establish historical forecast eligibility. Even clean 2021/22 entries in a 2023 dataset cannot be used as retroactive pre-publication-time evidence. Later corroboration can be investigated with a separately authenticated contemporaneous S3/website archived capture, exact preserved object digest and dated public access.

No protected source-to-stored parity is executed. Existing bounded sample unresolved candidate source-matched archive-labelled records remain 909 expenditures, 1,140 contributions, and 2,448 older filing-derived as-of claims requiring original version historically public-by evidence. Prior V5 independent expenditure 101/101 sampled stored observations (29 keys) remain proven. Exact source version, Senate-specific official filer-duty universe, amendments, and original/amended 2023–25 PDF historical public-by remain independent outstanding evidence tasks.

Do not merge any later actual correction or backfill without a separate owner authorization. Any future private count-only parity must have its own reviewed main-only, protected READ ONLY REPEATABLE READ transaction and explicit rollback, never PR credentials or open raw finance artifacts.


## First successful full independent body audit (October 12, 2026)

The [V10 source-only live workflow run 38309468823](https://github.com/killjoy00/votepredict/actions/runs/38309468823) **succeeded** (all synthetic tests and complete cleaned body acquisition/validation). Its exact non-identifying provenance receipt:

| Whole cleaned object property | Verified observation |
| --- | --- |
| Full S3 HEAD HTTP status | 200 |
| Full S3 GET HTTP status | 200 |
| Historical notebook's named cleaned object | mn_contribs_clean.csv |
| Complete original 2023 *cleaned derivative*, bytes | **58,871,220** (agrees with previous V7 HEAD) |
| Entire body SHA256, computed independently in public CI | **cb7b829bfe6a3b5d6b44745462cb6e994c179d9e841ad648d73994ce0df0492e** |
| S3 current object HTTP Last-Modified calendar day | **2023-02-26** |
| Cleaned normalized schema fields | **19** |
| Parsed all-filer contribution records | **359,673**, exactly as independent publisher notebook |
| 2021 records across ALL recipient classes | **41,277** |
| 2022 records across ALL recipient classes | **94,348** |
| 2021 CFB filer-type **PCC** records | **20,472** |
| 2022 CFB filer-type **PCC** records | **64,544** |
| 2023 / outside-2015–2023 records in this current body | **0 / 0** |

The observed all-filer year counts are **2015: 31,064; 2016: 33,869; 2017: 29,816; 2018: 55,473; 2019: 28,767; 2020: 45,059; 2021: 41,277; 2022: 94,348; 2023: 0**, summing to 359,673. All 359,673 data rows had the required normalized header/column cardinality. The apparent **2023: 0** is fully consistent with the publisher's late-February 2023 notebook having a max transaction date only through the end of 2022, but is **NOT** evidence that statewide 2023 campaign contributions were absent: this is a fixed *earlier cleaned source snapshot*, not a complete live dataset.

**Important cutoffs:** the S3 Last-Modified timestamp is a current HTTP object metadata assertion about the stored derivative and agrees in chronology with the February 27, 2023 notebook. It does **not** authenticate when that exact body was first anonymously downloadable, whether the source was already public on a given February 2023 date, or when the corresponding ORIGINAL CFB report or specific contribution rows were publicly filed. The candidate PCC tally includes every candidate office/type in this derivative; it is neither a Senate-only item denominator nor a public-by proof. There is **no** comparison with protected database records. The successfully audited dataset now has a fixed body SHA256 that could be compared to independently dated future or historic **same-file** captures if located, but only with a new separately reviewed source-verification procedure.
