# #864 — 2020 historical campaign archive gaps and actual Minnesota Senate 2021–2025 person-by-person original-site coverage

## 1. Research denominator — actual Senate members, not candidates or winners

The **complete independently obtained original** Minnesota Legislative Reference Library 2021–2025 State Senate service roster and actual Senate special-sworn members yields **95 distinct actual 2021–2025 serving state senators (among 105 historical records in the independently parsed original directory)**, according to the pinned original government directory and source SHA/UTC audit.

- Original official Senate service directory: `https://www.lrl.mn.gov/legdb/senate_dir`, source GitHub Actions run `38094976711`, artifact `11685387674`, full HTML SHA-256 `bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51`.
- The dedicated 95-serving-member coverage job rehashes this **entire original LRL directory**, independent recorded UTC/SHA, original Senate special-swearing history HTML, and compares all all 105 original parsed historical government service records, then explicitly restricts the coverage denominator to the 95 people actually serving in 2021–2025 to the independent audit.
- It joins short exact first-party source excerpt research-ledger rows by actual serving senator name, with explicitly limited nickname equivalence and **all unresolved identity joins excluded**, not silently conflated. A senator can be in the official denominator yet have **zero currently sourced website short statement leads**. That means **not observed in the selected, bounded research**, *never* "had no positions."
- The 95-row exact-person report is emitted as downloadable JSON and Markdown source-proof workflow artifacts. It distinguishes member service years, source ledger contributions, archived-site-body-only observations, and explicit gaps. It is **not** a member-year complete enumeration of filed websites nor a source-to-production database reconciliation.

## 2. Three actually-serving 2021 senators with remaining pre-2020 website archives to investigate

The independent public original-site gap collector must first verify original official government actual Senate service in 2021 for **David Tomassoni** (2020 SD6), **Carrie Ruud** (SD10), and **Roger Chamberlain** (SD38) **before it sends any network request**. Then it examines seven separate bounded original archive windows:

| Person | Independent candidate-owned domain discovery lead | Inclusive original archive years requested |
| --- | --- | --- |
| David Tomassoni | `tomassoni4senate.com` | 2004–2013, 2014–November 2 2020 |
| Carrie Ruud | `carrieruud.com` | 2014–2016, 2017–November 2 2020 |
| Roger Chamberlain | `rogerchamberlain.org` | 2014–2018, 2019–November 2 2020 |
| Roger Chamberlain | `rogerchamberlainmn.com` | 2018–November 2 2020 |

- For each independently observed archive response, pin actual request/retrieval UTC, full index original JSON body SHA-256, status/error, number of original rows and whether bounded 300-row limit was reached.
- Select at most two distinct original HTML pages from each window and accept a genuine retained original body only if its original SHA-1 Base32 matches the **separately retrieved actual full original Wayback CDX record** and its visible text names the actual serving person.
- Important historical distinction: 2013 Carrie Ruud copy is documented as post-2012 election; 2022 Roger Chamberlain campaign homepage and his separately senator-owned priorities page are previously captured historical evidence, **not** proof of 2020 platform content; an independently funded advertising site is not candidate-authored.
- CDX error, 0 hits, capped 300-row index or failed original HTML replay **never** mean the person had no issue positions. Also, an archived page's UTC is merely a demonstrable *public-by* observation, not independently proven first publication date.

## 3. Isolation and independent proof

This PR changes historical source-research scripts, docs and one source-proof workflow only. It does **not** read/write production databases; import evidence; change votes, models, forecasts, or target selection; activate a scheduler; alter a 2027 workflow; or contact a public agency. The separate GitHub Actions jobs generate their artifacts without committing original copyrighted site page bodies into the repository.

Issue [#864](https://github.com/killjoy00/votepredict/issues/864) remains **open**. Neither the 95-person original serving denominator nor source ledger quote counts establishes full website text completeness, official SOS filed candidate website URLs, website mutation histories or the official/source-to-database reconciliation required to close the issue.
