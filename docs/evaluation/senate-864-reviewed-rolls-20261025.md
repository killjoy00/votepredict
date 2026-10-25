# Reviewed handwritten and grouped roll recovery — October 25, 2026

This bounded plan proposes **15 additional committee questions / 146 explicit binary choices** from two existing stored originals. It is not a new historical census or a completed production receipt. Issue #864 remains open. No source document, historical alias, floor vote, model, forecast, training, frozen evaluation, Vercel or scheduler is modified.

## Source and question binding

The exact artifact is `tests/fixtures/senate-864-reviewed-rolls.json`; its complete SHA is pinned in `source-proof/senate-864-population-reviewed-rolls-plan.json`. Production independently fetches both original PDFs and the canonical Labor Clerk body. PDF raw bytes, canonical Clerk body and the reviewed artifact must agree with the committed fingerprints. Taxes uses a prior OCR narrative and individually reviewed rendered cells, not a claim that fresh OCR reliably reads handwriting.

The public page images and raw 300dpi raster fingerprints are in the immutable [render commit](https://github.com/killjoy00/votepredict/tree/54934f257226db4132899e1ca300aef02c5f9a91/docs/evaluation/source-proof/senate-864-55-followup-review). Per-page hashes come from the published `senate-864-55-ocr-rendered-audit-20261023.json`. This is a scoped Codex rendered-page review, not independent-human or word-perfect OCR certification. No OCR quality flag is promoted.

### April 27, 2023 Taxes — SF1811

Original: [signed minutes](https://www.lrl.mn.gov/archive/minutes/senate/2023/taxes/20230427/Taxes_20230427_Signed-Minutes.pdf), raw SHA `e3a4137544f6a73289707f71e83d16e881bde925d2953469970484db3cfad4ec`. Narrative pages 1–2 explicitly bind the marked sheets to SF1811 and supply the complete motion, tally and outcome. Every named row and selected question field is retained in the reviewed artifact.

| Sheet page | Exact question | Yes / No | Result |
| --- | --- | --- | --- |
| 3 | A36 to A35 | 5 / 4 | Prevailed |
| 4 | A35 as amended by A36 | 4 / 6 | Failed |
| 6 | A37 to Nelson A31 | 5 / 4 | Prevailed |
| 7 | A28 | 4 / 6 | Failed |
| 8 | A12 | 4 / 5 | Failed |
| 9 | A24 | 2 / 8 | Failed |
| 10 | A23 | 10 / 0 | Prevailed |
| 11 | A4 | 5 / 5 | Failed |
| 12 | A26 | 4 / 6 | Failed |
| 13 | SF1811 recommendation as amended | 8 / 2 | Prevailed |

The ten questions have **97** explicit Yes/No choices. Rest's Pass marks on A36/A37 create no binary vote. The A35 sheet explicitly says “Senator Klein changed vote to yes”; A26 explicitly says “changed to NO” for Dziedzic. Both original marks and final-choice annotations are retained. The A12 sheet marks Dziedzic Absent while the narrative says one abstention: the conflict remains metadata and no nonbinary choice is inserted. Page 5 is a blank A31 sheet associated with a withdrawn motion and yields no event. Page 13 is a committee recommendation, not floor passage.

The existing stored original has a null committee field. Only this exact URL, raw SHA, date and session may use the same-original printed Taxes header for the event committee. Its stored source-document metadata stays unchanged; wrong/non-null committee metadata holds.

### April 9, 2024 Labor — SF5266

Provenance uses the existing [canonical Clerk original](https://www.senate.mn/schedule/hearing_minutes.html?always_show_minutes=Y&hearing_id=18645&ls=93&type=minutes), body SHA `f6fa9a3eae50f12e501c8f2420a87bd12bdd6cd87869b54bf0ea17e706f1effd`, corroborated by the [same-hearing PDF](https://www.lrl.mn.gov/archive/minutes/senate/2024/labor/20240409/labor_20240409_minutes.pdf), raw SHA `de6ad3d443d8846bb7cf9a6e669a0c6919fea44caba7b8973d01ff17ae19b4f1`.

| Amendment | Yes / No | Result |
| --- | --- | --- |
| A10 | 6 / 3 | Adopted |
| A9 | 6 / 4 | Adopted |
| A5 as amended | 4 / 6 | Not adopted |
| A12 as amended | 6 / 4 | Adopted |
| A17 | 4 / 6 | Not adopted |

These **49** choices are explicitly labeled YEA/NAY. Pappas's Absent label on A10 supplies no binary vote. Each result names its amendment and binds to one originating motion after the explicit SF5266 heading. A5/A12 include the full accepted friendly oral amendment and its explicit adoption to the same parent before the roll request. Those voice actions yield no separate named event. A15 and the A3/A14 voice actions are excluded. Nearby SF5226 testifier/lay-over typos do not replace the explicit SF5266 bill heading or the amendment questions.

The literal “Hauschilld” in A9 requires the existing exact historical alias, one active membership and the same-original full printed Grant Hauschild header. No fuzzy surname match or new alias is created. Ambiguous, missing, expired or contradictory identities hold.

## Still held: May 12, 2023 Taxes

[Signed minutes](https://www.lrl.mn.gov/archive/minutes/senate/2023/taxes/20230512/Taxes_20230512_Signed-Minutes.pdf), raw SHA `55b04f01403a8df728069c8e8d3e975dbeca6ffc8bef431699587254f9d0d4a2`, show a five-to-three sheet, with two Absent marks after a corrected Dziedzic mark. The number 1949 is handwritten in the amendment field, with a freehand Finance referral; the narrative describes an SF1949 recommendation as amended and referral. The selected question category is not safely established, and the bounded stored-source query found no exact PDF source document. No source or event is inserted. Reopening needs an authenticated original establishing the complete selected question plus exact stored provenance.

## Deployment requirements

The existing protected main-push workflow runs keyless source authentication, standard checks, focused mutation tests and disposable PostgreSQL add/readback/zero-write-replay tests before exposing the existing Neon credential. Production verifies the existing primary database, schema ledger, exact source records and full bounded state in READ ONLY/ROLLBACK, then locks and rechecks in SERIALIZABLE. The only allowed delta is 15 events and 146 choices; partial/conflicting production states hold. Existing events/choices and source documents, roster and bills must remain unchanged. All new events retain hearing-date availability, same-day exclusion, is_passage=false, modelWeight=0 and mechanicallyActionable=false.
