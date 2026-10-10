# #864 — 2026 public CFB candidate registry vs. 2021–25 Senate source-discovery inventory

**Acquired October 10, 2026.** Historical finance window remains **2021–2025 only**. This read-only metadata audit does not query any production database, alter forecasts, retrieve donors or report PDFs, or assert historical statutory filing obligations.

## Public regulator APIs verified

The official [CFB Current Lists](https://register.cfb.mn.gov/reports/current-lists/) application uses https://register.cfb.mn.gov/reports/api/ with the form arguments action=grid_data, data[type]=current-lists and the following source-backed data[action] identifiers:

- **all-registered-candidates**: 767 currently listed candidate registrations **across all offices** on October 10, 2026, including 230 with OfficeSoughtFullName=Senate. Its actual response columns contain RegisteredEntityID, office, district, RegistrationDate and TerminationDate. All 767 records carried registration dates and 6 had a populated termination date (across all offices). This is a *current status list*, not a historical all-registrations archive.
- **recent-candidate-registrations**: five recent all-office registrations with public registration/termination dates; not full 2021–2025 cohort.
- **recent-candidate-terminations**: 21 all-office records in the source snapshot, including six registration IDs previously observed in the 2020/22/24/26 Senate district viewers; not a complete termination history since 2021.

The one-time PR-only [public API source run](https://github.com/killjoy00/votepredict/actions/runs/38084492788) used only two bounded API calls for the actual registry overlap, plus a public app session. Both raw API response SHA-256 hashes, collection timestamps, original source artifact ZIP/JSON SHA-256 hashes, and rejected row counts are in the permanently versioned [source checkpoint](source-proof/cfb-2026-public-current-senate-registry-checkpoint.json).

## Evidence actually obtained

| 2026 public source comparison | Counts |
|---|---:|
| Registered candidate records listed across all offices | 767 |
| Registered Senate candidate records listed | **230** |
| Senate records matched by official numeric CFB ID to our [494-ID source-viewer checkpoint](cfb-2021-25-senate-statewide-registration-proof-checkpoint.md) | **230 / 230** |
| Current Senate records absent from the 268-page Senate election-viewer scan | **0** |
| Historical viewer IDs **not listed in the current candidate list** | **264 / 494** |
| Currently listed Senate IDs with registered-on date **on or before 2025-12-31** | **152** |
| Currently listed Senate IDs with registered-on date **during 2026** | **78** |
| Listed Senate rows with termination date populated | 3 |
| Source-viewer IDs observed in recent all-office termination list | 6 |
| Malformed current registry source rows or conflicting same-registration rows | 0 |

The checkpoint preserves the exact 230 current-list Senate numeric registration IDs, current reported registration/termination dates in [a compact PSV](source-proof/cfb-2026-public-current-senate-registration-dates.psv), SHA256-pinned by offline regression tests. It deliberately retains **no candidate names**, home addresses, committee officers, email addresses, phone numbers, donor names or financial transactions.

### Control registrations

- **18443** (original 2021–22 Senate District 64 report proofs) appears in the current list; listed date **2019-10-02**.
- **19205** (original 2025 Senate District 6 report proofs) appears in the current list; listed date **2025-03-20**.

These current-list registration dates are not proofs that any specific report was due or historically public on that date. Nor does absence from a 2026 current list prove the committee had terminated by 2025.

### Six recent-termination viewer overlap IDs

17854, 18694, 18763, 19362, 19422, 19563.

Three also appear on the all-registered-candidates list with 2026 termination dates. These are **2026 recent termination observations**; an independent complete dated historic termination/re-registration ledger is still needed for each committee.

## Critical blocking gap to a statutory 2021–2025 denominator

This cross-check provides a dated observation of **230 present-day Senate committee registrations**, not the count legally active in any year 2021, 2022, 2023, 2024 or 2025. Many of the other **264 IDs** in the original district-viewer footprint may have terminated before October 2026, may represent committees omitted from the current list, or have a different history. They must not be coded as terminated or assigned a termination date without independent source documents. Even the **152** dates on/before 2025 from the current list are not proof of uninterrupted committee registration, valid Senate office assignment, or an annual filing obligation. An observed committee or report-reference page is not a legal filing requirement or actual report.

Required next gates:

1. Reconcile **all 494 observed numeric registrations** to separately dated official registration, change and termination records, including identities never shown in a current-list source and potentially missing from the election-viewer union. Preserve unresolved statuses.
2. Determine required 2021–2025 reports **per filer, office, election/special-election reporting calendar, registration episode, exemption and termination**.
3. Source-acquire actual original/amended/termination PDF versions and independent historic public-by dates. Keep statutory disclosure floor, actual filing date and exact finance-row containment separate.
4. Only with separate authorization, reconcile offline sources to appropriately authorized read-only DB exports. No production DB, serving, schedulers, model retraining or 2027 changes.

**Issue #864 remains open**, and all official historical statewide required/actual filing totals remain unknown. A complete present-day list vs election-viewer source join does **not** certify the historical denominator.
