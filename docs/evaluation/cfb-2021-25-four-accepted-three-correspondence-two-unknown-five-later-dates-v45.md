# VotePredict #864 — owner-approved narrow disposition of the nine PDFs and five date conflicts

**Date:** October 15, 2026. **Scope:** research-source profile/display only. The authoritative CFB filing index, all full-PDF SHA256s, original printed receipt stamps, raw registration/amendment identities and historical model eligibility are unchanged.

This follows [merged #1296](https://github.com/killjoy00/votepredict/pull/1296), [#1297](https://github.com/killjoy00/votepredict/pull/1297), and [#1300](https://github.com/killjoy00/votepredict/pull/1300). The user simplified the unresolved agenda as follows:

1. For Jason Isaacson's two **2022** handwritten report versions, do not ask the user to transcribe illegible digits; keep exact amounts **unknown** unless official independent evidence emerges. The other three flagged 2021 “amendments” (Putnam, Fateh, Mohamed) are *emails/correspondence* from the user's review, and should be excluded from monetary report reconciliation. Keep each historical CFB-indexed document visible as documentary source evidence.
2. Accept the four other handwritten original **Total Receipts** amounts already visually checked against the Board's separate current **Financial Summary** tab; for the review date use the Board's “Most recent report through” date for that committee-year. This does not assert the PDF version was posted by the end of the reporting period.
3. Where the current original PDF has a “Received by the Board” stamp before its own period-end, **use the later of these two printed dates for research review/display**. Do not claim this is a corrected official Board receipt date, an archive first-public-by date, or a date to backdate a prediction feature.

## A. Four accepted, independent Board-crosschecked handwritten originals

| Original report PDF | Board Financial Summary *Total receipts* | Source committee/year | Review through date |
| --- | ---: | --- | --- |
| Thomas M. Bakk, 2021 YE original | **$76,559.12** | [CFB Financial Summary, registration 17140](https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/17140/2022/) | 2021-12-31 |
| Thomas M. Bakk, 2022 YE original | **$1,025.00** | Same committee | 2022-12-31 |
| Jason Isaacson, 2021 YE original | **$5,830.20** | [CFB Financial Summary, registration 17929](https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/17929/2022/) | 2021-12-31 |
| Jerry Newton, 2021 YE original | **$1,100.00** | [CFB Financial Summary, registration 18004](https://register.cfb.mn.gov/reports-and-data/viewers/campaign-finance/candidates/18004/2022/) | 2021-12-31 |

The Board public Financial Summary's **eight contribution/receipt category fields sum exactly to its printed annual total** for each accepted row. Those independently returned public response bodies matched at the SHA256 level on [source job 116543314555 and replay 116544130547](https://github.com/killjoy00/votepredict/actions/runs/38770091118). This establishes the current reported committee-year amount and corroborates the legible total on the signed government original form, not amended-version monetary history or exact first public-by.

The original V42 machine parser certified 379 reports independently; these four are **additional owner-accepted current annual source crosschecks**. Do not multiply the Board annual total by multiple filing versions.

## B. Two still-unknown 2022 handwritten report versions

| CFB indexed original PDF | Review decision |
| --- | --- |
| [Jason Isaacson 2022 YE original](https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year=22&type=pcc&period=YE&se=0&regnum=17929&amend=0) | The cash/total row is handwritten; the exact cents are not independently verifiable. **Unknown**. |
| [Jason Isaacson 2022 YE amendment 1](https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year=22&type=pcc&period=YE&se=0&regnum=17929&amend=1) | Similar handwritten receipt row; no independently verifiable exact cents or amendment difference. **Unknown**. |

The official current Financial Summary returns a 2021 entry for this registration, **not 2022**. Neither missing numeric data nor a handwritten guess is proof the official filings are absent or that contributions are zero. No extra user action is necessary.

## C. Three documents excluded from monetary reconciliation

These remain **indexed by the CFB as amendment version 1** but the user identifies them as **email/correspondence attachments**, not substantive financial amendment report bodies. Financial review ignores their supposed amended monetary totals. This is a review classification, not a deletion or a retroactive reclassification of the government source index.

- [Aric Putnam 2021 YE amendment attachment](https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year=21&type=pcc&period=YE&se=0&regnum=18430&amend=1)
- [Omar Fateh 2021 YE amendment attachment](https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year=21&type=pcc&period=YE&se=0&regnum=18488&amend=1)
- [Zaynab Mohamed 2021 YE amendment attachment](https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year=21&type=pcc&period=YE&se=0&regnum=18730&amend=1)

## D. Five source-date conflicts: later-of-two applied for review

| Original YE PDF | Unaltered Board receipt stamp | Unaltered period end | **Selected later review date** |
| --- | --- | --- | --- |
| [Bill Ingebrigtsen, 2022](https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year=22&type=pcc&period=YE&se=0&regnum=16311&amend=0) | 2022-09-17 | 2022-12-31 | **2022-12-31** |
| [Paul Gazelka, 2021](https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year=21&type=pcc&period=YE&se=0&regnum=16931&amend=0) | 2021-09-26 | 2021-12-31 | **2021-12-31** |
| [Melisa López Franzen, 2022](https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year=22&type=pcc&period=YE&se=0&regnum=17347&amend=0) | 2022-11-05 | 2022-12-31 | **2022-12-31** |
| [Andrew Lang, 2023](https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year=23&type=pcc&period=YE&se=0&regnum=17994&amend=0) | 2023-12-29 | 2023-12-31 | **2023-12-31** |
| [Bruce Anderson, 2025](https://cfb.mn.gov/rptViewer/Main.php?do=viewPDF&downloadpdf=false&year=25&type=pcc&period=YE&se=0&regnum=17362&amend=0) | 2025-10-09 | 2025-12-31 | **2025-12-31** |

The selected date is a **user-requested research sorting / review-date convention**. It is explicitly neither a newly discovered filing receipt timestamp nor a proof that the signed PDF contents were posted publicly by that date. The source printed stamp remains intact in every underlying V41/V43 original PDF proof. These five are *not* treated as reconciled exact filing dates.

## Implementation and evidence

- [User disposition overlay](../../data/cfb-2021-25-nine-five-review-dispositions-v45.json) is a separate 14-version, SHA-pinned decision record. It does **not** change the 830-version official government source ledger or historical as-of model eligibility.
- [Independent official annual source proof](source-proof/cfb-2021-25-official-annual-financial-summary-double-source-v44.json) preserves **11** public committee Financial Summary source response hashes; 13 committee-years requested, **12 annual totals verified arithmetically**, and **one 2022 missing**. The proof was retrieved twice with identical source hashes.
- [Standalone V45 audit](../../scripts/audit-cfb-864-nine-five-owner-resolution-v45.mjs) enforces four accepted amount matches, three correspondence exclusions, two unknown handwritten versions, five max-date decisions, exact source PDF provenance and **zero** claims of historic exact first public-by dates.
- The legislator profile displays the result beside the specific CFB filing and still links the original PDF. It does not silently replace the government original-filing classification, date stamp or database evidence.

**Review outcome:** Four monetary totals accepted, three correspondence attachments excluded from monetary reconciliation, five review dates selected conservatively, and just two handwritten PDF version amounts remaining unknown. Issue #864 may remain open for broader statutory owed-filing universe and historical first-public-by data, but this narrowed nine/five research review requires no user transcriptions, donor export, production data changes, or further routine approvals.
