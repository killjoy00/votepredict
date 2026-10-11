# Issue #864 — permanent original-source receipts for 68 actual Minnesota senator campaign page captures (2019–2022)

This research artifact makes the prior [2022 twelve-person original archival acquisition](SENATE_2022_TWELVE_MORE_VERIFIED_PERSON_ORIGINAL_SITE_SEARCH.md) and [2019–20 six-person original archive acquisition](SENATE_2020_SIX_ACTUAL_SENATORS_ORIGINAL_CAMPAIGN_SITE_SEARCH.md) independently traceable **after their full original-HTML GitHub Actions ZIPs expire**. It is a webpage source-provenance ledger, NOT additional quoted campaign positions, official 2020/22 SOS filed campaign website fields, an all-state original archive census, or an approved historical vote-model feature collection.

## Exact confirmed original page coverage

- **2022 pre-November 8:** 12 independently serving people, 12 public historical Wayback CDX indices, **48** bounded original HTML replay GETs, **44** real exact original archived HTML responses with full SHA-256 and separately indexed historic Wayback CDX SHA-1 digest verified. Four replay attempts lacking authenticated full original page bytes are excluded—not interpreted as missing candidate platforms.
- **2019–2020 pre-November 3, 2020:** six independently verified serving individuals, **24/24** real original HTML replay bodies fully matched to separate original CDX SHA-1. These six are a historical overlap of the 12 people from the 2022 window, **not six additional distinct politicians**.
- **Total: 68 exact authenticated page copies**, 12 unique people among the researched cohorts. This is an authentic-page-body capture count, not a count of issue passages, pages on distinct paths, unique policy viewpoints, person-year completeness, or election coverage.

Each of the [68 permanent source receipt records](../data/evaluation/senate-original-2020-22-authenticated-68-pages-v1.json) pins:
the LRL-confirmed senator identity, historical election-year cohort, exact **original** candidate-hosted URL, actual archive capture UTC, original immutable archived HTML filename, **SHA-256 of the full original HTML bytes**, independently source-indexed **Wayback CDX SHA-1 Base32 digest**, and explicit false/null values for first author-post date, campaign-year content review, forecast/evidence admissibility. The archived original replays can be reconstructed from their original URL plus historical timestamp, subject to Wayback availability.

The immutable original source artifacts were actually downloaded from GitHub Actions:
- [2022 source run #38107693123](https://github.com/killjoy00/votepredict/actions/runs/38107693123), artifact **11689989592**, source ZIP SHA-256 **610ba6c678fd93ce38a5c120e7c29fb57d99f3d998276b26cae8e5c276e7dc47**.
- [2020 source run #38107731662](https://github.com/killjoy00/votepredict/actions/runs/38107731662), artifact **11689839922**, source ZIP SHA-256 **eea4562fe218b9e49c3d764aabb675ac25d8c20dabcb56554aa102e939c446ef**.
- Original independent [MN LRL Senate-service original source run #38094976711](https://github.com/killjoy00/votepredict/actions/runs/38094976711), artifact **11685387674**, government LRL directory HTML SHA-256 **bdc2bb41872e193149068f1f294fc172e2916a997320056c5c5dab9368410f51**.

These are original acquisition artifacts with approximately 30-day GitHub Actions retention (through November 10, 2026), **not** permanent archived-HTML blobs in Git. Individual original URL, timestamp and dual-digest receipts now remain in version control even after the ZIPs expire.

## Notable exact original dated source pages suitable for NEXT issue quotation work

| LRL actual Senate service verified person | Date-first-attested historical original campaign issue page | Important attribution caveat |
| --- | --- | --- |
| Zaynab Mohamed | [2022-01-31 platform](https://web.archive.org/web/20220131215245id_/https://zaynabmohamed.org/platform/) | The historical original body is authenticated, but exact candidate policy quote spans are not yet human-reviewed or added |
| Grant Hauschild | [2022-08-05 priorities](https://web.archive.org/web/20220805034920id_/https://grantformn.com/priorities/) | Pre-Nov general election source, not proof of first author-posted date |
| Jen McEwen | [2022-08-05 issues](https://web.archive.org/web/20220805080126id_/https://www.votemcewen.com/issues) | Same actual person who was SD7 before redistricting and SD8 afterward |
| Nathan Wesenberg | [2022-08-05 issues](https://web.archive.org/web/20220805054602id_/https://www.wesenbergforsenate.com/issues) | Campaign-site copy not proof of an individual bill vote |
| Aric Putnam | [2022-07-05 issues](https://web.archive.org/web/20220705195418id_/https://aricformn.com/issues/) | Distinguish already serving senator's claimed past policy work from an actual recorded vote |
| Clare Oumou Verbeten | [2022-08-05 issues](https://web.archive.org/web/20220805042231id_/https://www.clareverbeten.com/issues) | Source capture proves page existed, not first author-posted date |
| Mark Johnson | [2022-01-17 issues](https://web.archive.org/web/20220117012518id_/https://markjohnsonmnsenate.com/issues.html) | Earlier-cycle carryover possibility must be checked |
| Gary Dahms | [2019-07-20 issues](https://web.archive.org/web/20190720101647id_/http://dahmsforsenate.com/issues/) and [2022-01-26 issues](https://web.archive.org/web/20220126205951id_/https://dahmsforsenate.com/issues/) | His person-level Senate service crosses historic SD16 to SD15; compare source text, never assign exact 2022 original author date |
| Mary Kunesh | [2020-08-04 vision](https://web.archive.org/web/20200804232735id_/http://marykunesh.com/vision/) | Same actual senator identified as former **Kunesh-Podein** on 2020 ballot, later SD39 |
| Liz Boldon | [2022-08-05 issues](https://web.archive.org/web/20220805125632id_/https://lizboldon.com/issues) | **Older House 25B campaign branding appears in archived original**; do not claim newly authored 2022 Senate SD25 policy text |

## How to revalidate *all* original bytes against immutable provenance

The [source-only verification script](../scripts/audit-senate-original-68-campaign-page-receipts-offline.ts) loads the immutable JSON plus the re-opened original government LRL Senate directory bytes and original UTC/SHA receipt. It also requires BOTH historical full-source GitHub Actions artifacts, not just hashes supplied by a new manifest. For each of 68 pages, it:
  - rechecks the actual LRL person identity, 2020/22 election district and independently verified subsequent Senate service, not a mere website surname match;
  - matches the corresponding archived **actual acquisition manifest** record on exact original URL, capture UTC, full HTML filename, independently fetched original CDX SHA-1 and original SHA-256;
  - reopens the actual original saved body and computes both hashes again;
  - excludes source response files without full historical CDX-reconciled original bytes, and refuses any unexpected source, file overwrite, source substitution or artificial population adjustment.

The [PR-only original source recheck workflow](../.github/workflows/audit-senate-68-original-2020-22-campaign-page-receipts.yml) obtains three original acquisitions from pinned GitHub Actions runs and saves a 30-day proof report. It does not make current campaign-site or public Wayback fetch requests, read a production database, change the statewide member denominator, insert evidence, modify any forecast, retrain models or contact public officials.

### What this deliberately does not mean

Authenticating an archived *page copy* does NOT authenticate every issue statement on that page, certify its original author-posting time, imply that a previous House/district platform was consciously readopted in a new Senate election, establish the historical SOS *filed* website field, prove statewide campaign completeness, or make the page eligible for a historical election-day model cutoff. Some historical 2022 captures preserve earlier-cycle House and old-district copy. **The next research phase is original quote/context comparison for actual Senate-serving people**, by exact campaign year and issue; then optional separate source-to-production evidence parity evaluation only with appropriate authorization.

Keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) **OPEN**. No production access or changes to database/Neon/Vercel, historical evaluation freezes, model serving, schedules, forecasts, training or 2027 work.
