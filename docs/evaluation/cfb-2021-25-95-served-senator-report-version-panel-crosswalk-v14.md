# #864 — official actual 95-serving-senator to report-version source-panel crosswalk (V14)

**Scope:** A per-person source-coverage audit in support of the requested original/amended Minnesota Senate 2021–2025 CFB report-version ledger. **Not** a statewide legal filing-duty denominator, not a claim everyone owed a report, and not a proof a committee without previous report captures never registered/filed. No contact, private DB, finance transactions, older filing-derived eligibility, forecast or serving changes.

## Starting facts, separately sourced

- The [Minnesota Legislative Reference Library original Senate directory](https://www.lrl.mn.gov/legdb/senate_dir) combined with the [Senate swearing/oath historical page](https://www.lrl.mn.gov/history/caucus?body=s) has already been independently authenticated and parsed in the existing #864 Senate source track as **95 distinct people with reported Senate terms overlapping at least one year in 2021–2025**, from 105 official service-directory records in the pinned 2026 source acquisition. The official terms may give *year overlap* rather than precise within-year member start/end days. Five special-oath events were independently examined. This is an actual-serving **people source inventory**, not a legal report obligation count or campaign-candidate list.
- The [V12 source-verified 229 report-version rows](source-proof/cfb-2021-25-served-25-panel-229-exact-version-ledger.psv) cover **25 separately established CFB registration IDs** (22 actual 2022-serving senators with 2021–24 observed version references, 3 additional actual 2025-serving special-election senators), **223 independently authenticated different CFB PDF binaries**, 3 held first-page IDs and 3 duplicate version aliases, and **0 independently proved exact historical actual public-by dates**. The 25 CFB registrations were sourced from official viewer/PDF originals, NOT derived from fuzzy similarity of names alone.

## Public-only bounded V14 crosswalk

[Original official service + report-version crosswalk](../../scripts/audit-cfb-864-95-served-report-version-crosswalk-v14.mjs) independently re-fetches and parses the two **fixed official LRL URLs**, using the already-reviewed original Senate-service source parser, preserving complete original-source SHA256 and retrieval time for both URLs. Source response must be fixed exact host/path/HTTP 200 and bounded HTML byte size; requires **105 official Senate directory people, 95 actual 2021–25 serving people**, and only the same 25 independently original-CFB-source-established report principals in the existing 229-version ledger.

The crosswalk uses **unique normalized first and last name** as an additional *identity consistency review*, never as permission to invent a new committee registration. Any unmatched committee already independently proven by CFB is returned explicitly for source identity reconciliation, not forcibly assigned to a coincidental senator. Each of the 95 official served people is labelled:

- Already represented in the **selected CFB original-version report-source panel**, giving separately authenticated existing CFB registration ID, observed distinct *official viewer version reference count* and actual report years observed. This only means one or more versions were already acquired for that principal; it does **not** mean every report year or amendment was seen or historically public by its reporting cutoff.
- **No selected source-panel CFB version identity join yet**. This means registration/filing PDF acquisition should be investigated from official sources, **NOT that the senator was unregistered, did not owe a report or filed nothing**.

The output is exactly 95 allowlisted public official serving-person entries with annual term-year observations, source-reported districts and existing selected report-version panel join status, plus a source-only checksum and explicit known unknown counts. No donor/vendor/contact data, raw PDF, raw HTML, amounts, bulk candidate source comparison, private DB access, storage artifacts, or production writes. The independent [PR-only original-source workflow](../../.github/workflows/senate-864-cfb-95-served-report-crosswalk-v14.yml) runs synthetic adversarial collision/invalid-source/no-absence tests and the live bounded public official service-source join.

**Crucial:** The 95-person actual-source-service roster is the relevant *member identity coverage target*, but it does not satisfy or reopen the user-excluded **legally owed/received official filing-report denominator**; we must not treat 95/25 as a fraction of filing obligations or expected individual year-end forms.

## Narrow next steps

For actual-serving people without existing report-version-source matches, seek official CFB principal committee registration and exact contemporary original/amended viewer version ID. Verify exact official PDF first page/period/receipt and entire SHA256, then seek independent **actual historical published-by** evidence. Attach each newly verified PDF version to the [V12 report-version ledger](cfb-2021-25-served-report-version-unified-v12.md) instead of retroactively labeling absent/missing reports from a current viewer. Prior V13 alternate historic CFB 2022-GET-profile Wayback pilot can provide an independently dated full-body positive only on exact SHA agreement; absent CDX hits or retrieval errors do not prove nonpublication.

No legal owed filing-duty accounting, legacy eligibility claims or candidate bulk CSV transaction-to-stored matching will be pursued on this track.


## First independently replayed full official service source: positive (2026-10-12)

[GitHub Actions source-only run 38313196069](https://github.com/killjoy00/votepredict/actions/runs/38313196069) **successfully reacquired and parsed both complete original public government HTML sources** with the existing source-authenticating service parser, despite a first output-envelope-size safety HOLD subsequently corrected. Its original source receipts:

| Independently reacquired original source | Source SHA256 |
| --- | --- |
| Official Minnesota LRL entire Senate service directory | **9a19784212b9401d34ef29101015718d03edc27592f2a20847de405586ba6bc6** |
| Official LRL special-senator oath historical page | **c49e90519c24c4c5db9ffa0af9e034b69a1c9d96fde2335e14c475d72837a9a7** |

The re-acquired current source full-body hashes are new **2026 observations**, not a historical original page public-by proof for financial report PDFs. All 95 actual-serving senators were independently source-represented and exact names remained unambiguous. **25/25** previously separately original-CFB-report-proven principal registrations found a unique official serving-senator identity join; **70** additional actually served official senators had **no corresponding registration in this selected existing 229-report-version source panel**, which means **not searched/acquired in this ledger**, never “no CFB report.”

Permanent person-by-person source output:
- [95-row exact official serving-senator and CFB-report-version panel crosswalk](source-proof/cfb-2021-25-95-serving-senator-report-version-source-crosswalk-v14.psv)
- [Full original public LRL source SHA/checkpoint and expected counts](source-proof/cfb-2021-25-95-served-report-version-crosswalk-checkpoint-v14.json)

Every person has official name, source-attested term overlap years/districts, official source type, existing independently CFB report-panel registration when source-confirmed, count/years of exact already authenticated original/amended PDF source references, and an explicit UNKNOWN otherwise. Total observed known panel references sum exactly to **229**. *Neither a name match nor this 95-member service roster proves an individual registered principal campaign committee or a legally due report.* The latter filing-obligation exercise remains excluded at the user's direction.

The implementation now demands that repeat full public original government HTML SHA256 and the entire 95-row person-by-person checkpoint regenerate byte-for-byte; a changed source or unexpected committee reassignment safely HOLDS rather than silently rewriting the prior official service roster. Any later 2027/current-site content updates will require separate evidence review.
