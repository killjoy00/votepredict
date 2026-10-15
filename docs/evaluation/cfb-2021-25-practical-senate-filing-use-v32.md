# #864 — Use the official filing evidence we already have

The original PDF validation process was too strict for answering a basic question: **does the Minnesota Campaign Finance Board list a filing for this senator's committee?** Some public PDF files are scans that do not expose machine-readable first-page text. The CFB also records familiar names in different ways than the legislative roster. Those details should not make a listed, linked official filing disappear.

## Revised working result — October 14, 2026

| What we can say | Current evidence |
| --- | ---: |
| Senators who served during 2021–2025 and have at least one official indexed candidate-committee filing in the collected panel | **95 of 95** |
| Official CFB indexed original report references | **274** |
| Official indexed amended version references | **171** |
| **Total indexed filing versions** | **445** |
| Indexed version references with source PDF bytes and SHA available | **444** |
| **Distinct retrieved PDF bodies** (some versions share a file) | **440** |
| Reports with verified readable original PDF form fields | **425** |
| Source PDFs downloaded but with text/first-page details incomplete | **14** |
| Downloaded source PDF with a reported date conflict requiring further review | **1** |
| CFB indexed filing whose PDF fetch failed | **1** |
| Indexed version references that share another version's identical PDF body | **4** |

These are *collected source versions*, **not** a count of every report legally owed over five years. Amendments are revisions, not additional money to sum.

The earlier [435-version/416-full-readable-body audit](source-proof/cfb-2021-25-86-serving-senators-435-exact-original-amended-report-versions-v28.psv) is preserved unchanged for its narrower field-level findings; this inclusive ledger does **not** erase prior examination or overstate what a scanned image says. Original full-file SHA evidence is retained where available.

The [complete 445-source inventory](source-proof/cfb-2021-25-95-senators-445-official-filing-version-inventory-v32.psv), [five-senator name/candidate crosswalk with ten original reports](source-proof/cfb-2021-22-five-senator-name-variants-ten-official-yearend-originals-v32.psv), and [profile-ready 95-senator source data](../../data/cfb-senate-official-filings-2021-25-v32.json) have been added to the **same research PR**.

## What changed from "strict authentication"

1. **Scanned PDFs are not missing reports.** Fourteen PDFs returned by CFB already have real downloaded bodies and SHA-256 hashes but had been labeled *identity holds* because original text parsing was incomplete or inconsistent. They now count as CFB-listed official versions with retrieved PDFs. The text/receipt/financial fields that cannot be read remain unfilled. This also applies to original signed PDF sources for Bakk, Gazelka, Isaacson, Putnam, Fateh, Morrison, Lang, Lieske and Franzen, etc.
2. **A temporary fetch failure is not a missing filing.** The official 2021 CFB viewer lists Jerry Newton's year-end report; that indexed version now counts even though its full PDF was unavailable on the recent retry. A source link is retained, and PDF-derived monetary fields are not fabricated.
3. **Normal name variants are okay.** The original government 2020/22 CFB district/registration pages, authentic downloaded 2021–22 original filings, LRL Senate service districts, and additional official senator name evidence link:
   - **William (Bill) Ingebrigtsen → Bill G. Ingebrigtsen** (registration 16311)
   - **Greg Clausen → Gregory D. Clausen** (17441)
   - **Jeffrey R. Howe → Jeff R. Howe** (18337)
   - **James Carlson → Jim Carlson** (16246)
   - **Matthew D. Klein → Matt D. Klein** (17924)

   Their ten **officially indexed 2021 and 2022 original year-end filings** are no longer omitted from the main working evidence inventory. Nine readable original report pages were recovered on the first government source run; eight of ten PDF hashes were matched on the second run, with two first-run-only source PDFs retained rather than thrown out.
4. **An odd printed date does not erase a filing.** William/Bill Ingebrigtsen's 2022 CFB-indexed year-end PDF reports a Board receipt **September 17, 2022** for a period ending **December 31, 2022**. The year-end filename/index still provides existence evidence, but the contradictory chronology needs a source/form review before we use the receipt date or numerical report contents. It is explicitly labeled in the profile.

## How it is used

The legislator profile now displays **Official historical CFB filings (2021–25)** with report-year, original/amendment version, direct official Board PDF links, and straightforward statuses such as "PDF available; some details unreadable" or "Listed by CFB; PDF download unavailable." The UI reads the pinned public-source JSON and **does not require a successful PDF text parse** before a filing appears. The five documented name links have been made explicit, not guessed by fuzzy matching.

**Still important:** a 2024 amended PDF does not prove that the revised 2022 report contents were public for a 2022 vote. A report's current availability, original year, receipt date and first historical publication are separate facts. The collected filing can be used as contextual source evidence without pretending that the amendment was available earlier. No stored pre-vote eligibility data or model input is changed in this research work.

For total receipts, use only the separately verified [six 2022 original/amended government PDF report summary cells](source-proof/cfb-2022-three-senate-original-amended-double-authenticated-receipts-summary-v31.psv). Other balances, donors, expenditures and loans are not filled in based on an unreadable document.

## Remaining useful work

- Recover Newton's original PDF and inspect selected scanned first pages where the money/receipt fields would add value, rather than keeping the entire filing out of the inventory.
- Reconcile the Ingebrigtsen 2022 anomalous period/received date before using that field for time-specific evaluation.
- Expand *aggregate-only* report totals as readable source evidence permits. Do not treat two amendment versions as two independent receipts totals.
- Compare genuinely due original filing obligations separately, if needed; absence from a 2026 index alone cannot prove nonfiling.

No production or stored prediction changes, contact with officials, raw PDF uploads, or personal donor data in these files. [PR #1287](https://github.com/killjoy00/votepredict/pull/1287) remains review-only.
