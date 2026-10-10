# Issue #864 — four non-Elections original committee motion contexts: actual source-run closeout

**Source-only status, 2026-10-10.** Merged [PR #954](https://github.com/killjoy00/votepredict/pull/954) at `ad2498d03920562de8b731cadf5c3cc8b273101f`, following passing exact-head [full CI #38093319868](https://github.com/killjoy00/votepredict/actions/runs/38093319868). Its **actual original-PDF source verification [workflow #38093480954](https://github.com/killjoy00/votepredict/actions/runs/38093480954) passed**, with both the 2023 and 2024 year jobs successful.

Each original PDF was downloaded within the 3 MiB/30-page bounds and its **original file-byte SHA-256 and extracted-text SHA-256 matched its independently archived original source manifest** (run `38075573031`). Each of the **four exact original text offsets** was reproduced by the existing isolated supplemental parser with matching explicit 15 YEA + 18 NAY = **33 named source-choice tokens**. There were **zero original PDF/hash/parser failures, zero printed-date/weekday discrepancies, zero machine-matched source-absentee YEA/NAY conflicts**. **This is not four new certified production votes**; it is four independently rechecked source-block candidates whose particular procedural motions are now human-context-identified.

| Source hearing / committee | Exact source text offset | Named original result | Contextual motion confirmed from original published minutes | Source check |
| --- | ---: | --- | --- | --- |
| 2023-03-03 Judiciary and Public Safety | 3840 | 2 YEA / 6 NAY | SF47 **A-3 amendment failed**, separate from the later recommendation | Original PDF and text SHA verified; attendance parser locates absent section |
| 2024-02-15 Health and Human Services | 4729 | 3 YEA / 5 NAY | SF610 **A2 amendment failed**, different from earlier A1 voice action and subsequent layover | Original PDF/text SHA verified; **absent header not machine-located**, see HOLD |
| 2024-03-07 Labor | 2517 | 6 YEA / 4 NAY | SF4483 **as-amended recommendation carried** | Original LRL PDF excerpt matches the [same published Senate hearing minutes](https://www.senate.mn/schedule/hearing_minutes.html?hearing_id=18367&ls=93) on motion/bill/tally/named sides |
| 2024-03-14 Labor | 2250 | 4 YEA / 3 NAY | SF4742 **as-amended recommendation carried** | Opening attendance and motion-time absent statuses differ for two senators; later prose restatement is **not a second roll** |

### Exact original run artifacts — ZIPs not permanent evidence storage

The permanent, [immutability-tested provenance JSON](./source-proof/senate-committee-four-non-elections-original-source-run-provenance-ledger.json) pins **all four** original source URLs, exact text offsets, original PDF and extracted-text SHA, bounded near-context hashes, and separate year input/output artifact hashes. The artifacts themselves are 7-day temporary QA records and can disappear without losing these fingerprints.

| Year | Original input manifest artifact / ZIP SHA-256 | Actual source-result artifact / ZIP SHA-256 | Result JSON SHA-256 |
| --- | --- | --- | --- |
| 2023 | `11678374068` / `8c009aaefdc2109072ffc8b3962eb9325eb8b9a0f256de4fa4133d3f74a30827` | `11684629342` / `c69d53e6209e3803b23d696f15924600acb572e9921e1431ae28b1a3cd4e9188` | `be462efdc63c46c9d7e93052693fdb67e661405490f99edfa262c9d57ebe5e64` |
| 2024 | `11677594594` / `9e36a461d385087a73c76b4b2c172fbb0f8f004aef018ccf0c66e4d6dfc73b4e` | `11684279938` / `164d256d5e5bbfa953199ab85ff403b6fe5c04a5a812122bd764d02513a9554e` | `6b2419426b1c0b26bc8a2f6f7ab3cab5a2e8bee4b7cadc31fde20a31127065db` |

### Independent published bill-log qualification

Separate LRL official committee bill-log PDFs confirm the matching hearing dates and bill-level **actions**, not the individual named member choices:
- [2023 Judiciary bill log](https://www.lrl.mn.gov/archive/minutes/senate/2023/jud/Jud_2023_bill-log.pdf): SF47 considered 2023-03-03; subsequent amended committee recommendation distinct from the failed A-3.
- [2024 Health and Human Services bill log](https://www.lrl.mn.gov/archive/minutes/senate/2024/health/Health_2024_Committee-Bill-Log.pdf): SF610 laid over 2024-02-15 after failed A2 amendment; layover itself is not the named amendment vote.
- [2024 Labor bill log](https://www.lrl.mn.gov/archive/minutes/senate/2024/labor/labor_2024_bill-log.pdf): SF4483 referred on 2024-03-07 and SF4742 referred on 2024-03-14; does not independently authenticate how each senator voted.

The LRL-hosted PDF and Minnesota Senate HTML can be copies of the **same underlying minutes**. Agreement between them is **semantic parity, not a second independent account of the roll-call choices**. Original hearing date drives historical action timing after source identity resolution; same-day model cutoffs remain excluded.

### Explicit limits / follow-up

1. **HHS 2024-02-15 attendance remains HOLD for automated certification.** The actual source QA's limited absent-header regex did not locate the opening absence section, despite an explicit `ABSENT` name in the motion's own source roll. The computed **zero conflicting absent votes** is not a reliable exhaustive opening-attendance proof for that meeting. Preserve that uncertainty rather than treating `absentPeopleParsed=0` as no absent member.
2. **March 14 Labor** includes two senators shown present at meeting opening but absent at the motion: an unresolved motion-time difference, not a hard proof of invalid choice.
3. **Historical committee memberships and full motions** remain for separate date-specific verification. Bill logs verify dates/handling, not every amendment choice. No YEA/NAY is inferred from attendance, count-only, voice, unanimous, absent/pass or outcomes.
4. Original vote corpus remains incomplete statewide: 2021 printed minutes and possible 2022 print/electronic differences, other 2023–25 parser candidates, 141 missing-linked-Minutes meetings/media content, and independent row-by-row historical database equality are unresolved. The available database credentials **do not authorize** private production reads or any writes.
5. No production `member_votes`, database writes, prediction, training, serving, scheduler, Senate floor, 2027 code or government-staff contact. **Issue #864 stays OPEN**.
