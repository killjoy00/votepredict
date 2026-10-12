# #864 — Alternative contemporaneous official PDF link historical-publication audit (V13)

**Requested scope ONLY:** individual Minnesota Senate-serving committee original/amended CFB report PDF version historical publication. No candidate CSV transaction-to-stored matching, older legacy filing-derived eligibility, statewide legal filing-obligation census, outside contact/email, protected DB or production, forecasts/serving/model/deployment/scheduler/2027.

## Why this is not the previous blocked CDX query

Earlier [four-exact-PDF-CDX pilot](cfb-2023-24-exact-original-pdf-version-archive-publicby-research.md) looked for the current source viewer URL form, including modern extra downloadpdf=false and explicit amend=N query parameters. All four responses were valid **empty exact query listings**, not proof a PDF was never available under a different contemporaneous original government URL.

**New contemporaneous original-source lead:** the Minnesota Campaign Finance Board's official [2022 Probable Cause Determination PDF](https://cfb.mn.gov/pdf/bdactions/1655_Probable_Cause_Determination.pdf), original printed **page 3, footnote 5**, links directly to a 2021 year-end committee form using an older GET URL format:

    cfb.mn.gov/rptViewer/Main.php?do=viewPDF&year=21&type=pcc&period=YE&se=0&regnum=18697

This **independent original regulator footnote** documents the *shape* of official report links contemporaneously, not any of our selected senator reports themselves. V13 therefore tests the equivalent fixed official source structure for **nine carefully chosen original/amended version IDs** drawn from V12, dropping downloadpdf=false and omitting amend=0 for original forms, plus adding amend=N for distinct amended forms. It also tests an alternate known official legacy host **cfbreport.state.mn.us** against the separately controlled **cfb.mn.gov** original host. These are hypotheses for historical archival query identities; the footnote does **not** establish every host actually published the same PDF.

The nine exact fixed original report version targets cover examples across **2021, 2022 pre-primary and pre-general, 2023 year-end original and amendment, 2024 original and amendment, and 2025 special primary and 2025 ordinary year-end amendment**, for previously verified authentic original-source candidate PDFs (Aric Putnam #18430 and Keri Heintzeman #19205).

## Fail-closed exact archived PDF historical availability gate

[Public-only V13 verifier](../../scripts/audit-cfb-864-legacy-pdf-publicby-v13.mjs):

1. Accepts only pinned authentic exact report identity, original full PDF SHA256 and byte length, known covered period and **source-verified earliest possible release date floor** from the 229-version committed source ledger. Rejects held first-page source identities and duplicate viewer aliases.
2. Queries Wayback **CDX JSON metadata only** for the 9 versions × 2 fixed official host profiles; bounds to **8 historical captures** per query, **32 KB** max response and **16 seconds** request timeout. Only exact host/path/query parameter profile, HTTP 200, valid capture timestamp and PDF-like mimetype are accepted as *capture leads*.
3. Rejects a capture before the original source-verified legal/receipt release floor. For up to **2** candidate captures per exact archived profile, replays the **exact original captured URL at the exact timestamp** with id_ mode, no redirects, bounded **5 MB** response and strict PDF signature, original byte length, full SHA256 equality to the corresponding authentic official CFB version body.
4. **Only** an identical full archival PDF with date later than the legal nonpublicity floor can be considered **independently proved as actually publicly available by its archive timestamp**. This is *not* the first-ever date. The CDX row alone, a 2026 modern CFB acquisition, official statutory due date, paper Board receipt or a government memo discussing an amendment **never** promotes historical public-by.
5. No retrieved PDF bytes, donor/recipient names, contribution amounts, transaction row keys, real PDFs or external contacts are exported into GitHub, logs or artifacts. Result is an allowlisted per-target count/hold or exact validated historical archive timestamp only; no DB connections or model updates.

A valid CDX empty query returns a no-PDF-capture-for-this-exact-legacy-URL result, meaning only that this historical URL form did not yield a usable PDF capture in the query. Invalid/missing index, temporary HTTP errors, index HTML instead of PDF, archival source drift and mismatched body hashes are **HOLDS / no positive proof**. The current repository's **0/229** exact historically independently proved versions remains unchanged absent a new validated full-body archived source.

## Source basis and archival references

- [Merger PR #1266, unified exact PDF-version ledger](cfb-2021-25-served-report-version-unified-v12.md) and its [229-row source-traceable PSV](source-proof/cfb-2021-25-served-25-panel-229-exact-version-ledger.psv).
- [CFB 2022 primary-original Board link](https://cfb.mn.gov/pdf/bdactions/1655_Probable_Cause_Determination.pdf), printed p. 3 footnote 5.
- [Wayback CDX reference](https://github.com/internetarchive/wayback/blob/master/wayback-cdx-server/README.md) documents exact match by URL, output JSON, timestamp, mimetype, statuscode, digest and bounded result limit. The original/CDX linked URL's identity is not freely inferred from a modern source.
- [Earlier four-negative exact URL pilot](cfb-2023-24-exact-original-pdf-version-archive-publicby-research.md) remains valid for only the four original query URLs.

Commands:

    node --test tests/cfb-864-legacy-pdf-publicby-v13.test.mjs
    node scripts/audit-cfb-864-legacy-pdf-publicby-v13.mjs

**Remaining requested-scope work after this finite pilot:** independently establish actual historical public-by of the exact authentic PDF versions, including earlier original and amended versions, and expand the report ledger beyond the already source-verified 25 actual Senate-serving committee registrations toward the full actual-serving senator panel. Do not collect legally owed filing denominator, bulk CSV stored-transaction parity or older filing-derived evidence. No production writes; keep #864 OPEN.


## Actual live V13 original historic-URL pilot result (2026-10-12)

[Public-only run 38312512329](https://github.com/killjoy00/votepredict/actions/runs/38312512329) completed successfully (all focused synthetic tests and all 18 bounded live CFB official URL-profile lookups). **ZERO historic PDF bodies were fetched or independently authenticated as exact earlier public-by proofs.** The 9 selected PDF IDs × 2 government-host URL profiles produced:

| Bounded metadata response status | Number of exact queries | Meaning |
| --- | ---: | --- |
| HTTP 200 with valid CDX JSON, but **no indexed full original PDF capture** for that exact legacy URL | **13** | A finite negative for this exact URL query, not a claim that the report was never available |
| Invalid CDX response or network HOLD | **5** | Archive response cannot establish absence, availability or PDF identity |
| Independently SHA256-matched archived original report PDF | **0** | No positive historical PDF public-by date in this pilot |

The 2021 YE original, 2022 C/E, 2023 YE original/amendment, 2024 YE original/amendment and 2025 selected exact special/ordinary version remained **actual historically public-by UNKNOWN** after these 18 query attempts. Historical *original* CFB source PDF SHA and report coverage remain independently authenticated under V12 and are **not changed** by a negative archive metadata search. The tested official 2022 Board legacy hyperlink **proves the earlier URL form was documented**, but does not establish Internet Archive captured our other nine senator PDFs.

**Practical decision:** a blanket repeat of current and legacy **exact** Wayback CDX queries is unlikely to resolve the 0/229 public-by debt. Next in-scope candidates are capture of an **actual full original report PDF** embedded as a contemporaneously timestamped first-party/regulator exhibit, independent public source with equivalent exact byte hash, or a regulator-authenticated historical listing that attaches a verifiable original binary. Board possession/receipt without proof of anonymous public distribution still is not sufficient. Prioritize the 2021–22 originals with smallest PDFs and contemporaneous official documents, but insist on exact complete-body SHA256 equality and a timestamp at/after the version's own legal/reception floor. Expand 25 source-verified committee crosswalk toward all independently attested 95 actually-serving people separately, with no attempt to classify legal owed-filing obligations.
