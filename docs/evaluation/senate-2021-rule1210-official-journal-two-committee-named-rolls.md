# #864 — 2021 Senate committee named votes in the OFFICIAL Journal: Rule 12.10

**2021 Minnesota Senate committee proceedings only.** Unlike official 2021 Senate committee minutes (print-only at LRL), the official Senate Journal is available in historical PDFs and publishes named COMMITTEE vote reports on request of three members under Senate Rule 12.10. The journal also includes Senate FLOOR divisions: these remain OUT OF SCOPE. The three-member request publication trigger is nonexhaustive: it cannot establish a statewide recorded committee vote denominator.

## Two separate 2021 original named committee rolls

| Official Journal report date and page | Underlying Senate committee | Exact committee recommendation | Explicit original choices |
| --- | --- | --- | --- |
| **Feb 8, 2021, 11th day, p. 272** | Transportation Finance and Policy | SF173 recommend pass and re-refer to Civil Law and Data Practices Policy, **carried 5–4** | YEA: Coleman, Jasinski, Kiffmeyer, Newman, Osmek; NAY: Carlson, Dibble, Johnson Stewart, McEwen |
| **Mar 4, 2021, 20th day, p. 666** | Housing Finance and Policy | SF1470 **as amended** recommend pass and re-refer to Civil Law and Data Practices Policy, **carried 4–3** | YEA: Dahms, Draheim, Duckworth, Rosen; NAY: Dziedzic, Port, Rest |

The official [February 8 Senate Journal PDF](https://www.senate.mn/journals/2021-2022/20210208011.pdf) p. 272 prints the SF173 committee roll under the explicit heading **REPORT OF VOTE IN COMMITTEE**. [Revisor SF173](https://www.revisor.mn.gov/bills/92/2021/0/SF/173/?body=Senate) independently records one Feb 8 committee report on p. 271 plus the related Rule 12.10 recorded-committee-vote report p. 272. Those two report references concern ONE underlying committee motion and cannot be counted as two votes. Feb 1 was a different committee stage; May 3 was a different SENATE FLOOR recorded vote and is excluded.

The official [March 4 Senate Journal PDF](https://www.senate.mn/journals/2021-2022/20210304020.pdf) p. 666 prints the separately reported SF1470 as-amended committee recommendation. [Revisor SF1470](https://www.revisor.mn.gov/bills/92/2021/0/SF/1470/?body=Senate) independently records the March 4 Housing committee report at p. 665a and separate printed committee vote report p. 666. The later April 12 FLOOR vote is unrelated and excluded.

## Crucial historical dating and individual absence boundaries

February 8 and March 4 are proven **Senate Journal report dates** only. An independently dated contemporaneous **underlying committee meeting** has not yet been cross-matched to those named rolls. Never silently treat a journal-publication day as the underlying motion date or as a minute-level historically available timestamp.

The SF173 Journal report explicitly names **nine** YES/NO choices. SF1470 names **seven**. Neither provides an individual Absent list: printed Absent is **null**, not a roster-inferred zero. Senate Rule 12.10 reports were printed only upon request of three members before a roll vote, so the method does not cover every committee action.

## Original immutable source proof and safety

The [exact two-Journal source inspector](../../src/evidence/senate-2021-rule1210-two-original-journal-committee-rolls.ts) requires authentic journal header/report-date text, exact **REPORT OF VOTE IN COMMITTEE** heading, three-member Rule 12.10 invocation, unique specifically identified SF and as-amended motion, complete individually printed source YES/NO partition, printed division and “motion prevailed.” It refuses floor-style passages and duplicate or altered bill/roll members. Its [synthetic negative tests](../../tests/senate-2021-rule1210-two-original-journal-committee-rolls.test.ts) use only fictional people.

[One-time original source workflow](../../.github/workflows/senate-2021-rule1210-two-original-committee-rolls.yml) downloads only these two exact official PDFs (strict URLs/no redirects, PDF MIME, streamed byte cap), extracts original text, checks named division in committee context, emits original PDF/extracted text SHA256, bounded source text hashes and SHA-only member-side identity. No original PDFs/full text/unhashed actual senator choice-side lists go into Git.

The source contents are research leads supported by official historical published text. **Do not call the original PDF byte-level research “authenticated” until the real post-merge source runner succeeds and actual artifact ZIP/JSON is independently downloaded and checked.** Failure artifacts must retain their failure conclusions.

This original published Senate Journal method **does not substitute for the official 2021 LRL print-only committee minutes**, the 2022 print-versus-electronic comparison or private VotePredict row-by-row evidence parity. No 2021–25 statewide denominator, no same-day forecast or model use, no member_vote import, no private/production DB operations, no Senate floor vote expansion, 2027 or agency outreach. Keep [issue #864](https://github.com/killjoy00/votepredict/issues/864) OPEN.
