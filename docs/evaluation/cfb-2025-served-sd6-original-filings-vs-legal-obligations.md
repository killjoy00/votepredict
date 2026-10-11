# Issue #864 — 2025 actual-served Senate SD6 committee-year report reconciliation

**Bounded case, not Minnesota Senate statutory-filer completeness.** The original official legislative service record establishes that **Keri Heintzeman** served Minnesota Senate District 6, with the officially attested May 6, 2025 swearing. The independent original CFB report metadata is already pinned in
[`cfb-2025-senate-district6-report-pdfs.json`](source-proof/cfb-2025-senate-district6-report-pdfs.json) (read-only acquisition October 9, 2026, Actions run [37997701770](https://github.com/killjoy00/votepredict/actions/runs/37997701770)).
The source-audit workflow rechecks the official [LRL Senate service directory](https://www.lrl.mn.gov/legdb/senate_dir) and [special swearing chronology](https://www.lrl.mn.gov/history/caucus?body=s) with original HTML byte hashes and 2026 UTC observation timestamps. This establishes actual service of the subject, not historical availability of any financial report.

## Source-authenticated report versions, not obligations

| Report kind | Original CFB version ID | PDF Board received | Independently authenticated due | Earliest conservative possible release, **not** proven public-by |
|---|---|---|---|---|
| Special pre-primary | `19205:25:pcc:C:1:0` | Apr 8, 2025 | Apr 8, 2025 | Apr 9, 2025 |
| Special pre-general | `19205:25:pcc:E:1:0` | Apr 22, 2025 | Apr 22, 2025 | Apr 23, 2025 |
| Special election cycle-final | `19205:25:pcc:YE:1:0` | May 26, 2025 | May 27, 2025 | May 28, 2025 |
| 2025 year-end | `19205:25:pcc:YE:0:0` | Jan 30, 2026 | Feb 2, 2026 | Feb 3, 2026 |

**4 original reports have independently authenticated original-version PDF hashes/headers, coverage and Board-received dates; 0 new original PDFs authenticated in this reconciliation.** A fifth PDF version, `19205:25:pcc:YE:0:1`, is an amendment to the year-end original, Board-received May 24, 2026. It is **not** a fifth original report or fifth legal obligation. A previously authenticated version in the twelve-C/E 2025 special reports or earlier SD6 control is not counted again.

The legal references for the **reporting rules** are [Minnesota Statutes (2025), §10A.20](https://www.revisor.mn.gov/statutes/2025/cite/10A.20) and [§10A.243](https://www.revisor.mn.gov/statutes/2025/cite/10A.243), supplemented by the specific official [2025 SD6 special calendar](https://cfb.mn.gov/pdf/publications/elections/candidate_packets/2025/Senate_6_special.pdf) and original [2025 statewide disclosure calendar](https://cfb.mn.gov/pdf/calendars/2025_general_disclosure_calendar.pdf?t=1743206400).

**The historical legal-owed denominator is still `null`.** Proof of a Board-received filing and a calendar's due date does not, alone, establish that the filer was legally required to file that particular type; primary/election applicability, historical committee registration and termination, exemptions and year-end continuity must be independently source-proven. Nor does an absent viewer record prove nonfiling. Each of the four verified original reports therefore has `historicalObligationState=unknown`, `actualOriginalFilingEvidenceState=original_filing_verified`, and `historicalPublicByEvidenceState=historical_public_by_unknown`. We do **not** assert four legally required reports, four timely filings statewide, any historical nonfiler, or any missing report.

The original cycle-final report PDF ended its coverage May 14, 2025, whereas the independently retained original special calendar gives May 20 as the cycle's last-transaction date. This is a **held source discrepancy**, not a license to change a coverage date or infer that the May 15–20 transactions went missing; the annual year-end original starts May 15. Resolve the mismatch against both original documents before any historical import.

All report PDFs and fiscal-detail bodies remain at original official CFB URLs; no raw donor names, transactions, signatures, contact details or PDF contents have been added. Historical public-by evidence verified: **0**; all report forecast-eligibility flags **false**. No production database, prediction, scheduler, serving, 2027 programme or retraining changes. **Keep #864 open**.

## Next independently source-testable inputs

Acquire historical *effective* 2025 Senate SD6 committee registration and termination notices rather than treating a 2026 current-registry snapshot as historical lifecycle proof; reconcile filing-required threshold and SD6 special primary/general participation with original candidate filings, and apply exemptions under the effective 2025 statutes. Keep source verified originals and the legal owed denominator separate until independently reconcilable. After a successful exact-head CI/source run, pin this case's source-only metadata artifact permanently rather than relying on the expiring 30-day artifact.
