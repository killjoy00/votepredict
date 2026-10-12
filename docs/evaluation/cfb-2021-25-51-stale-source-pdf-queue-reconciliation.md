# #864 — superseded 51-item CFB Senate PDF acquisition queue: exact-version reconciliation

**Research scope:** Track B, Minnesota Senate 2021–2025 finance, offline only. This audit **does not acquire any new CFB source**, re-download PDFs, connect to Neon, or change historical forecast eligibility. It reconciles old queued exact IDs with **later already-independent, original-source-authenticated** acquisition results to avoid wasting effort on duplicate requests.

## What changed since the earlier matrix was frozen

The [older 90-row served-senator committee-year matrix](source-proof/cfb-2021-25-served-senator-committee-year-coverage.psv), its [51 requested PDF versions](source-proof/cfb-2021-25-served-senator-next-source-pdf-targets.psv), and [original metadata checkpoint](source-proof/cfb-2021-25-served-senator-committee-year-coverage-source-checkpoint.json) were honest snapshots **at the time**. Their 2023/24 44-version and 2025 7-version queues are **not today's unacquired PDF list**.

A complete exact-ID and CFB registration/person/API source-hash comparison of all **51** previously queued version references with two **newer, source-authenticated cohorts** yields:

| Previously requested tranche | Exact version IDs | Authenticated distinct PDF bodies | Official viewer alias references | Original document-identity HOLD |
| --- | ---: | ---: | ---: | ---: |
| P1: SD29 2025 special original-parent amendments | 7 | 6 | 1 | 0 |
| P2: 2023/24 14-person original year-end reports | 28 | 28 | 0 | 0 |
| P3: 2023/24 14-person year-end amendments | 16 | 14 | 1 | 1 |
| **Entire previously open queue** | **51** | **48** | **2** | **1** |

The 2023/24 source statuses come from the [71-version yearly ledger](source-proof/cfb-2023-24-served-22-71-yearend-version-statutory-release-bounds.psv) and its [authenticated source/PDF SHA checkpoint](source-proof/cfb-2023-24-served-22-71-yearend-legal-release-and-publicby-checkpoint.json). Those sources cover a **wider 22-senator 2023/24 cohort** than the 14-person original queue; do not confuse their 71-version whole-cohort denominator with the queue's 44 specific references.

The 2025 results come from the [seven amended PDF bodies/aliases ledger](source-proof/cfb-2025-served-sd29-seven-amended-version-pdfs.psv) and its [independently repeated source acquisition and alias proof](source-proof/cfb-2025-served-sd29-seven-amended-version-source-checkpoint.json). In that source, the SD29 2025 ordinary year-end amendment viewer reference `19229:25:pcc:YE:0:1` is **binary identical** to original version `19229:25:pcc:YE:0:0` — not a seventh independently different amendment.

The **one remaining ID HOLD** in the old queue is Aric Putnam registration #18430, 2023 year-end amendment `18430:23:pcc:YE:0:1`: the CFB viewer version pointer and fetched PDF hash are pinned, but the original document first page fails the independently verifiable required registration/form identity. The 2024 Putnam year-end amendment viewer ID `18430:24:pcc:YE:0:2` is another **binary-identical official alias**, of `18430:24:pcc:YE:0:1`.

## New durable row-by-row reconciliation

The [51-row exact-ID resolution ledger](source-proof/cfb-2021-25-51-priority-queue-source-resolution.psv) retains in order each older queue's priority, version ID, year, actual-served-person cohort label, committee registration, original parent, official viewer API hash, later proven source ledger, precise source PDF identity status, binary SHA, report coverage, Board receipt where verified, statutory due date, legal/receipt **not-before** bound where verifiable, alias target, and explicit unknown historical publication and legal-duty fields.

It does **not** reclassify a held document as authenticated merely because its binary was retrievable. Held form metadata / receipt / coverage and release floor remain blank in the new status ledger to prevent accidental promotion from a viewer key. Original immutable ledgers and acquisition-source IDs are unchanged.

[Offline regression tests](../../tests/cfb-2021-25-51-priority-queue-source-resolution.test.ts) pin the **original input Git blob fingerprints**, rejoin every one of the 51 report IDs against the newer source ledger by exact identity and viewer response SHA, validate all available dates, verify both aliases and the hold, and separately assert **no exact historical public-by date, legal filing-duty certification or forecast eligibility** was gained.

## What this result does **not** prove

The queue's **0 unlocated version references in this bounded sample** does not mean the full statewide 2021–2025 Senate reports are now collected. The actual 95-serving-person-to-effective-dated CFB registration crosswalk, conditional reporting-obligation denominator, all unselected committee-year viewers (including eight unobserved 2024-segment registrations in this former matrix), other 2025 election report families, PAC/party/independent expenditure inventories, and actual persisted finance transaction row equality remain open.

The legal release floor under [Minnesota §10A.20 subd. 1b](https://www.revisor.mn.gov/statutes/2025/cite/10A.20) is **not proof the exact original or amended report version was actually public at the forecast cutoff**. In these 51 matching current-version rows, **0/51** have independent exact historical PDF public-by proof and **0/51** have proved transaction-row containment from this join. A version reference, amendment or duplicate alias is also not a separate legally owed report. Unverified legal duties remain **UNKNOWN**, not zero.

This reconciliation updates **research triage**, not the old original source observation. Recommended next Track B: focus independent source acquisition on genuinely *unrepresented actual-serving senators/committee effective status*, build the official obligations per year/type, and perform carefully bounded approved private read-only **source-to-persisted-finance-row** comparisons rather than reacquiring these 51 version URLs.

**Safety:** no donors/raw PDFs/private evidence/production credentials in output; no Neon reads/writes; no forecasting/retraining/deployment/schedulers; issue #864 stays OPEN.
