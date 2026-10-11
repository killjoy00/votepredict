# #864 — April 7, 2022 Senate Finance named-roll source discovery (electronic, not print reconciled)

**Strict focus:** Minnesota Senate committee motions, amendments and recorded member choices from 2021–2025. The public [official LRL electronic Senate Finance minutes](https://www.lrl.mn.gov/archive/minutes/senate/2022/Fin/20220407/Fin_20220407_minutes.pdf) identify **seven printed named-roll paragraphs** across **SF3510, SF4269, and SF4091**. This is a **text-level public-source research lead**, **not** an original PDF byte-hash or rendered-page review and not seven certified new database votes.

| Bill | Introduced motion | Mover | Printed YEA / NAY / Absent | Disposition / interpretation |
| --- | --- | --- | --- | --- |
| SF3510 | A17 | Marty | 3 / 6 / 1 (Champion explicitly Absent) | Failed |
| SF3510 | A16 | Lopez Franzen | 4 / 6 / 0 (Absent: - printed) | Failed |
| SF3510 | A15 | Kent | 4 / 6 / 0 (Absent: - printed) | Failed |
| SF4269 | A15 | Marty | 4 / 6 / 0 (Absent: - printed) | Failed, different bill from SF3510 A15 |
| SF4269 | *oral modification* to A16 | Marty | 4 / 6 / 0 (Absent: - printed) | Failed, **HOLD** because narrative then says A16 amendment not adopted (base vs oral motion unclear) |
| SF4269 | A17 | Kent | 4 / 6 / **unprinted in available extracted text** | Failed; **do not convert absent to 0 without source page check** |
| SF4091 | Recommended to pass **as amended** | Pratt | 5 / 3 / 2 (Kiffmeyer, Lopez Franzen Absent) | Carried committee recommendation, **NOT full Senate passage** |

The seven paragraphs contain **67 explicitly named YES/NO choices** and **3 explicitly named absence tokens**. The extracted result for SF4269 A17 includes all ten named YEA/NAY members but does not print an independently isolated *Absent* row in the available text. That is an **unknown/missing row**, not a source-certified zero. The committee's opening roster lists all ten members present, yet Champion is printed *absent* at SF3510 A17: **attendance must be assigned per motion**.

**Another serious deduplication trap:** SF3510 A15 and SF4269 A15 have identical 4–6 recorded sides, but different bills and separate motion introductions. They cannot be merged by amendment number + outcome. Pratt's A21 was **withdrawn**, and other amendments were **adopted by voice vote**. No individual member choices are assigned to those distinct procedural events.

## Provenance and restrictions

The LRL expressly warns [2022 Senate staff prepared both print and electronic minutes and that their contents may differ](https://www.lrl.mn.gov/minutes/). The original 2022 **print collection is unreviewed** here. The public web-indexed PDF text was inspected as a discovery lead; actual original PDF bytes, visual page rendering, original PDF/extraction SHA256 and independent source-to-private-stored-vote parity were **not** obtained in this source pass. Uncertified original motion unique-denominator claims are prohibited, as are silent corrections of the printed Senator *Ingebrightsen* spelling to an official roster form.

The [machine-readable metadata-only checkpoint](source-proof/senate-2022-finance-apr07-electronic-seven-rolls-discovery.json) and [deterministic regression](../../tests/senate-2022-finance-apr07-electronic-seven-rolls-discovery.test.ts) preserve bill-level separateness, the true **null** absence field, the oral A16 conflict, withdrawal/voice-vote exclusions, and no PDF-hash fiction. The hearing-day convention uses **2022-04-07** with no same-day forecasts when precise motion clock is unknown.

**No individual member-vote import or raw member-side lists, production/private DB, models/training/forecast/serving/scheduler, Senate floor, 2027 or government contact.** The actual statewide 2021–2025 committee recorded-vote denominator remains unknown. **Issue #864 stays OPEN.**
