# VotePredict #864 — practical estimated dates for 830 CFB filing PDF versions

**October 15, 2026.** The CFB PDF acquisition, receipt-total/handwriting cleanup, correspondence and five stamp-conflict **subtrack is finished** (merged PRs #1296, #1297, #1300, #1303). The two Isaacson 2022 monetary figures remain appropriately unknown, not a blocker. This V46 work is a **separate document dating subtrack**.

## What the dates mean

Every **currently indexed** 2021–25 Senate CFB PDF-version record has a **day-level estimated availability date**, a Board-source choice, confidence tier and source original full-PDF SHA in [the 830-row dated inventory](../../data/cfb-2021-25-830-estimated-availability-v46.json). This is a practical approximation for historical document review, **not** a claim that a particular 2026 PDF binary demonstrably existed online on the estimated date. We do not require independent first-public proof to assign a usable context date.

| Dating evidence | Documents | Rule |
| --- | ---: | --- |
| Original official PDF **Received by the Board** stamp | **807** | Use the day after stamped receipt, but never before the day after the legally applicable report **due date**. |
| Identical whole PDF SHA already dated in same candidate/period | **13** | Reuse the dated copy's Board stamp with the same public-release floor. Same-file aliases do not establish when a distinct index version was created. |
| Unique original PDF with unreadable date | **6** | Use the scheduled legal first-release date, *assuming on-time filing*; low-confidence fallback only. Includes Bakk 2021/22, Isaacson 2021/22, Newton 2021 and Doron Clark special January 2025. |
| Distinct amended/email PDF with no valid stamp | **4** | Use the *first independently observed current official website copy date*, rather than pretending an amendment was available when its original report appeared. Putnam's PDF was observed Oct 11, 2026; Isaacson 2022 amended, Fateh 2021 and Mohamed 2021 were confirmed by Oct 15, 2026. |
| **Total** | **830** | **All 830 have an estimated date and evidence tier.** |

## Legal constraints, not unnecessary historical proof requirements

Minnesota [§10A.20, subdivision 1b](https://www.revisor.mn.gov/statutes/2021/cite/10A.20) requires an ordinary report to remain nonpublic until **8 a.m. on the day AFTER it was DUE**, even if filed earlier. In estimating availability, applying this legal floor avoids the known filing-plus-one backdating bug. The [2022 CFB legislative candidate calendar](https://cfb.mn.gov/pdf/calendars/current_year_senate_house_district_court.pdf) has a pre-primary report due July 25 and a weekend-adjusted pre-general report due October 31: earliest release floors **July 26** and **November 1, 2022**. The [2026 CFB candidate calendar](https://cfb.mn.gov/pdf/calendars/2026_senate_house_district_court.pdf) sets the **2025 year-end due at February 2, 2026**, so its earliest public release is **February 3, 2026**—not February 1.

For special-election-indexed CFB reports, the source PDF's reported period close plus seven days estimates the due date, and the following day is the release floor. That is labelled **inferred** (lower confidence). For example, Doron Clark's January 14, 2025 pre-general period end yields January 22 estimated public availability. Non-special reports use the exact official due calendar above and January 31 due dates for 2021–24 year-ends.

An early Board stamp that contradicts the reported period end is **not** substituted as an earlier public release. For the five owner-reviewed conflicts, the original contradictory stamps and separately selected December 31 **review dates** are preserved. For example, Ingebrigtsen's 2022 year-end review date is Dec 31, 2022 but the estimated document availability is **Feb 1, 2023** after the January 31 filing deadline.

**All dates have day-level precision**; none authorizes same-day vote-cutoff inclusion without separate time evidence. The six on-time assumptions are deliberately identified as such; the four truly undated distinct amendments wait until an actual website observation rather than receiving an invented 2021/22 publication date.

## Integration, reproducibility, and explicit limits

The original [830 exact PDF metadata rows](source-proof/cfb-2021-25-95-senators-830-indexed-830-downloaded-v41.psv) and [388 new source stamped-date reads](source-proof/cfb-2021-25-388-report-level-summary-and-date-review-v42.psv) are **unaltered**. The [independent V46 auditor](../../scripts/audit-cfb-864-830-dated-availability-v46.mjs) recomputes all 830 estimates from those original sources, exact PDF body SHAs, statutory due dates and website proof. New tests validate the actual 95-senator profile display. The app shows estimated date + how derived, preserving existing source links, four accepted totals, three correspondence exclusions and two unknown monetary amounts.

The data is intentionally **not automatically written into stored historic prediction eligibility, forecasting models or Neon**. Such writes are separate work; this implementation changes contextual evidence/profile labels only. There are **zero claims of independently verified exact historic first-public copies**, but all 830 docs have usable estimated dates. Remaining #864 issues around statutory legally owed reports, committee motions, campaign positions, media remarks and complete original-to-Neon source parity are outside this finished CFB PDF source cleanup.

**Disposition:** Mark the PDF source/monetary cleanup subtrack **complete**. Treat the all-830 document-date inventory as a distinct, delivered track after CI/merge, while leaving parent issue #864 open for the wider work.
