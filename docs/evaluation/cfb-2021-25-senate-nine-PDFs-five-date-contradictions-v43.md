# VotePredict #864 — V43 final form-layout review of nine unresolved CFB PDFs and five source-date contradictions

**Research checkpoint: 2026-10-15.** This follows **merged [#1296](https://github.com/killjoy00/votepredict/pull/1296) and [#1297](https://github.com/killjoy00/votepredict/pull/1297)**. V41 preserved 830 exact report-version references and authenticated current official government complete PDF SHA256/byte counts; V42 independently reviewed 388 source PDFs, verified 379 report-stated cash + in-kind = total receipts aggregate lines, and reconciled 92 original-versus-last-amendment receipt pairs. V43 rechecks **only nine still-unverified money summaries plus five internally inconsistent printed date forms**, without modifying the immutable earlier original source ledgers.

## Why this phase exists and what is/was verified

A second manual-source-layout pass used the **actual current Minnesota Campaign Finance Board official PDFs**, their unchanged government SHA256/byte identities and rendered **narrow crops of the source report rows**, not OCR text alone. The source-only Actions [original layout proof run #38763363290](https://github.com/killjoy00/votepredict/actions/runs/38763363290) and [final bounded source review #38765027682](https://github.com/killjoy00/votepredict/actions/runs/38765027682) validate 14 unchanged whole PDF bodies, and pin the observed original first-page date fields / scanned aggregate labels in [V43 SHA-pinned source checkpoint](source-proof/cfb-2021-25-nine-unverified-PDFs-five-printed-receipt-date-anomalies-v43.json). Source details are independently reconstructed by [V43 offline auditor](../../scripts/audit-cfb-864-nine-PDF-five-date-original-source-v43.mjs).

**Source retrieval proves the current official PDF and form, not the exact date a historic copy became public.** Neither a printed file-stamp contradiction nor a handwritten candidate summary digit is sufficient to support historical as-of prediction eligibility, or independently reconciled personal donor/transaction or loan/expenditure data.

## Nine report-version PDFs: original direct rendered-page findings

| Senator, exact original report version | Pages | Source form review | Certification outcome |
| --- | ---: | --- | --- |
| Thomas M. Bakk, **2021 year-end original**, 17140:21:pcc:YE:0:0 | 19 | Image-only signed form; labelled **Total Receipts** row on page 2, handwritten amount cells | Cash/in-kind/total arithmetic not independently certified |
| Thomas M. Bakk, **2022 year-end original**, 17140:22:pcc:YE:0:0 | 9 | Image-only form; **Total Receipts** row on page 2 | Handwritten source amount not certified |
| Jason Isaacson, **2021 year-end original**, 17929:21:pcc:YE:0:0 | 10 | Image-only form; **Total Receipts** row on page 3 | Handwritten/source nil-cell interpretation held |
| Jason Isaacson, **2022 year-end original**, 17929:22:pcc:YE:0:0 | 10 | Image-only form; **Total Receipts** row on page 2 | Handwritten/cell-total incompleteness held |
| Jason Isaacson, **2022 year-end amendment 1**, 17929:22:pcc:YE:0:1 | 10 | Image-only amended form; **Total Receipts** row on page 2 | Amendment cannot be counted as a new receipt; amounts held |
| Aric Putnam, **2021 year-end amendment 1**, 18430:21:pcc:YE:0:1 | 2 | Selectable digital text, but no full principal-report cover or Committee Transaction Summary heading | No qualifying summary row in the short indexed attachment |
| Omar Fateh, **2021 year-end amendment 1**, 18488:21:pcc:YE:0:1 | 8 | Image-only source; bounded OCR examined **all 8 pages**, found no recognisable Total Receipts label | Unknown, not proof of absence |
| Jerry Newton, **2021 year-end original**, 18004:21:pcc:YE:0:0 | 4 | Image-only form; **Committee Transaction Summary / Total Receipts** row on page 2 | Handwritten cash/total-looking cells; not promoted without independent arithmetic transcription |
| Zaynab Mohamed, **2021 year-end amendment 1**, 18730:21:pcc:YE:0:1 | 2 | Selectable digital text, no full principal-report cover or Committee Transaction Summary heading | No qualifying full-report summary row in this attachment |

**Crucial distinction:** **6 of 7 scanned source versions visibly contain an aggregate “Total Receipts” row**, despite failure of the strict machine parser. The seventh image-only report (Fateh amendment) has no OCR-recognized total row after one complete bounded eight-page pass. Two short, text-readable amended attachments do not have standard full-report summary pages. **All nine exact filing-version IDs remain valid official indexed filing-source evidence.** A row visually detectable in a scanned PDF is *not* automatically a valid money total: the relevant cash/in-kind/total cells are handwritten, blank or partially illegible in ways that prevent the already-approved arithmetic certification from being applied reliably. No additional receipts have been added to the 379 certifiable V42 totals, and no amendment versions are summed as separate donations.

This completes the bounded **review/classification** of the nine, **not** complete receipt reconciliation. A future approved independent manual numeric transcription from a clear official original or a Board-published report-level summary export is needed to turn any of these into certified original/amended money values. Repeating identical low-resolution OCR is unlikely to close those proof gaps.

## Five source forms: direct printed dates on the SAME first page

Each government PDF's original full-body SHA was authenticated, its year-end **Report of Receipts and Expenditures** header and **Period Covered** line read on page 1, and the red **Received by the Board** stamp inspected on **that same page**. These are *actual printed government PDF field contradictions*, not whitespace/text extraction date-parser errors:

| Candidate principal | Year-end period end printed | Red Board-received stamp printed | Result |
| --- | --- | --- | --- |
| Bill G. Ingebrigtsen (2022) | December 31, 2022 | September 17, 2022 | Prior original conflict independently visually confirmed |
| Paul E. Gazelka (2021) | December 31, 2021 | September 26, 2021 | New original conflict independently visually confirmed |
| Melisa López Franzen (2022) | December 31, 2022 | November 5, 2022 | New original conflict independently visually confirmed |
| Andrew R. Lang (2023) | December 31, 2023 | December 29, 2023 | New original conflict independently visually confirmed |
| Bruce Douglas Anderson (2025) | December 31, 2025 | October 9, 2025 | New original conflict independently visually confirmed |

The [Board's candidate reporting guidance](https://cfb.mn.gov/pdf/publications/handbooks/candidate_handbook.pdf) describes year-end reports as covering a calendar-year reporting period and ordinarily due at the end of the following January. The red first-page source stamps are therefore internally chronologically inconsistent with the year-end form's own covered period. The fact that two fields are printed together **does not establish which was entered incorrectly** or whether source processing/reposting contributed. It also does not prove deliberate misconduct or when the exact PDF file was originally public. No corrected receipt date has an independent original-Board source; **all five stay flagged as provenance/chronology holds**.

## Delivered and excluded

- **Delivered:** all original 830/813 CFB file identity checks, original nine PDF and five anomalous PDF manual-layout-source categories, original five same-page date conflicts, cropped source audit logs, [V43 original-source checkpoint](source-proof/cfb-2021-25-nine-unverified-PDFs-five-printed-receipt-date-anomalies-v43.json), and independent code/CI proof.
- **Still unproven:** nine report-level aggregate receipt summaries, corrected dates for five printed anomalies, expenditures/cash/debts/loans and itemized transaction parity, committee-effective and termination filing-obligation denominator, 2021–25 exact-version contemporaneous public-by times. **Do not infer missing legally owed forms** from an imperfect PDF summary or endorse specific donor/recipient figures.
- **Not performed:** raw PDFs stored in Git, public full-page scans, donor/payee names or financial transaction export, private Neon/production DB reads/writes, future/past prediction eligibility changes, model recalculations, migration, scheduler or outreach.

**Resolution status:** V41 and V42 source retrieval and content-review phases are merged. **V43 form-source investigation is complete**, but the **nine numerical summaries and five internally contradictory government stamp values remain explicitly held pending independent source confirmation.** Parent [issue #864](https://github.com/killjoy00/votepredict/issues/864) should remain open for statutory owed-original filing denominator, any requested official source correction, and historical publication evidence; this is not a reason to rewrite existing original evidence.
